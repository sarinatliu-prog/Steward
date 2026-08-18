// Good Steward — multi-user sandbox app server.
//
// Real accounts (email + password), client profiles, and per-user brokerage
// accounts. When Alpaca creds are present, each user gets a REAL Alpaca SANDBOX
// account created at onboarding and their round-ups place real sandbox orders in
// it. Without creds, the whole app still works on a simulated broker.
//
// All money is sandbox / simulated — no real funds move.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as db from "./lib/db.js";
import { hashPassword, verifyPassword, dummyVerify, newToken, sessionFromCookie, sessionCookie, validateCredentials, validateProfile, storableProfile } from "./lib/auth.js";
import { alpacaEnabled, alpacaIsLive, createBrokerageAccount, fundIfActive, fundViaAch, createCharityAccount, journalFirmTo, findExistingCharityAccount, createAchRelationshipFromPlaid, listAchRelationships, createDeposit, createWithdrawal, listTransfers } from "./lib/account-service.js";
import { plaidEnabled, createLinkToken, exchangePublicToken, fetchTransactions, listBankAccounts, createAlpacaProcessorToken } from "./lib/plaid.js";
import { recordPurchase, retryPending, rebalance, summary } from "./lib/portfolio.js";
import { fromCents } from "./lib/roundup.js";
import { FakeBroker, AlpacaBroker } from "./lib/broker.js";
import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";
import { randomPurchase } from "./lib/feed.js";
import { mailerEnabled, siteUrl, sendMail, resetEmail, verifyEmail } from "./lib/mailer.js";
import { snaptradeEnabled, registerUser as stRegister, connectionPortalUrl, allPositions } from "./lib/snaptrade.js";
import { analyze } from "./lib/analyzer.js";
import { screenCatalogue, isScreenKey } from "./lib/screens.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const DIST_DIR = join(HERE, "..", "dist");

// ── Broker wiring ─────────────────────────────────────────────────────────────
const ALPACA = alpacaEnabled();
const fakeBroker = new FakeBroker();
let alpacaBroker = null, alpacaReq = null;
if (ALPACA) {
  const { auth, baseUrl } = authFromEnv();
  alpacaBroker = new AlpacaBroker({ auth, baseUrl });
  alpacaReq = makeRequester(auth, baseUrl);
}
const usesAlpaca = (user) => ALPACA && !!user.alpacaAccountId;
const brokerFor = (user) => (usesAlpaca(user) ? alpacaBroker : fakeBroker);
const modeFor = (user) => (usesAlpaca(user) ? "alpaca" : "fake");

// Real Deposits: the app used to gift every new sandbox account $100 of OUR money
// (fundIfActive, below) so demos work instantly. In production that same code
// hands every signup real company money — a hundred signups is ten thousand
// dollars, gone. This flag makes the auto-gift opt-in and off by default; a real
// deployment should never set it. Set it in Render ONLY for this sandbox demo.
const AUTO_FUND = process.env.AUTO_FUND_NEW_ACCOUNTS === "1";

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function sendJson(res, code, body, extraHeaders = {}) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...securityHeaders(),
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
}
// Never trust a dollar amount from the browser: must be a finite positive number,
// converts cleanly to integer cents, and stays under a sane per-transfer cap (a
// placeholder sanity limit, not a regulatory one — tune as needed).
const MAX_TRANSFER_CENTS = 25_000 * 100;
function validAmountCents(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  if (cents <= 0 || cents > MAX_TRANSFER_CENTS) return null;
  return cents;
}
// The client's IP, for the signed-agreement record on the account application.
// TRUST_PROXY must be set explicitly: blindly believing X-Forwarded-For lets any
// caller forge the IP we attest to on a regulatory filing. On Render the platform
// sets the header and terminates TLS, so it is trustworthy there and only there.
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers["x-forwarded-for"];
    if (fwd) {
      const first = String(fwd).split(",")[0].trim();
      if (first) return first;
    }
  }
  const addr = req.socket?.remoteAddress || "";
  return addr.replace(/^::ffff:/, "") || "0.0.0.0";
}

function currentUser(req) {
  const token = sessionFromCookie(req.headers.cookie);
  const session = db.getSession(token);
  return session ? db.getUser(session.userId) : null;
}
const publicUser = (u) => ({
  id: u.id, email: u.email, hasProfile: !!u.profile, emailVerified: !!u.emailVerified,
  accountLinked: !!u.alpacaAccountId,
  bankLinked: !!u.plaidAccess,
  plaidEnabled: plaidEnabled(),
});

// Live Alpaca position value for a user's account (best-effort, for portfolio value).
async function snapshotFor(user) {
  if (!usesAlpaca(user)) return null;
  try {
    const sym = user.config.holdings[0]?.symbol ?? "ESGV";
    const acct = await alpacaReq("GET", `/v1/trading/accounts/${user.alpacaAccountId}/account`);
    let positionValueCents = 0;
    try {
      const pos = await alpacaReq("GET", `/v1/trading/accounts/${user.alpacaAccountId}/positions/${sym}`);
      positionValueCents = Math.round(Number(pos.market_value ?? 0) * 100);
    } catch { /* no position yet */ }
    return {
      portfolioValueCents: Math.round(Number(acct.portfolio_value ?? 0) * 100),
      positionValueCents,
      cashCents: Math.round(Number(acct.cash ?? 0) * 100),
    };
  } catch { return null; }
}

// ── Error monitoring ──────────────────────────────────────────────────────────
// A tiny in-memory ring buffer. Real production would ship these to Sentry/Datadog;
// the point is that nothing is swallowed silently and clients never see a stack trace.
const errorLog = [];
function captureError(err, ctx) {
  const entry = { ts: Date.now(), message: String(err?.message || err), where: ctx };
  errorLog.push(entry);
  if (errorLog.length > 100) errorLog.shift();
  console.error(`[error] ${ctx}: ${entry.message}`);
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// A fixed-window counter keyed by IP + bucket. In-process, so it resets on restart
// and doesn't coordinate across instances — enough to stop a single host hammering
// signup, password-reset, or the verification mailer, which is what actually happens.
// A multi-instance deployment should move this to Redis.
const rateBuckets = new Map(); // `${bucket}:${key}` -> { n, first }
function rateLimit(bucket, key, max, windowMs) {
  const now = Date.now();
  const id = `${bucket}:${key}`;
  const rec = rateBuckets.get(id);
  if (!rec || now - rec.first > windowMs) {
    rateBuckets.set(id, { n: 1, first: now });
    return { limited: false, retryAfter: 0 };
  }
  rec.n++;
  if (rec.n > max) {
    return { limited: true, retryAfter: Math.ceil((rec.first + windowMs - now) / 1000) };
  }
  return { limited: false, retryAfter: 0 };
}
// Keep the map from growing without bound on a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [id, rec] of rateBuckets) if (now - rec.first > 60 * 60 * 1000) rateBuckets.delete(id);
}, 10 * 60 * 1000).unref();

// ── CSRF ──────────────────────────────────────────────────────────────────────
// Session auth is a cookie, so any page on the internet can make the browser send it.
// SameSite=Lax blocks the common cross-site POST, but it is one cookie attribute and
// not every client honours it identically — so state-changing requests must also
// prove they came from our own origin.
//
// Same-origin is asserted by headers the page cannot forge: Sec-Fetch-Site (sent by
// every current browser) and Origin. A request with neither is not a browser form
// post, so it is allowed through for curl/health checks; a request with either must match.
function allowedOrigins() {
  const list = [];
  if (process.env.APP_URL) list.push(process.env.APP_URL.replace(/\/$/, ""));
  if (process.env.RENDER_EXTERNAL_URL) list.push(process.env.RENDER_EXTERNAL_URL.replace(/\/$/, ""));
  if (!process.env.DATABASE_URL) {
    // Local dev: the Vite dev server and the API run on different ports.
    list.push(`http://localhost:${PORT}`, "http://localhost:5173", "http://127.0.0.1:5173");
  }
  return list;
}
function csrfRejected(req) {
  const site = req.headers["sec-fetch-site"];
  if (site) return !(site === "same-origin" || site === "same-site" || site === "none");
  const origin = req.headers.origin;
  if (!origin) return false; // not a browser-initiated form post
  return !allowedOrigins().includes(origin.replace(/\/$/, ""));
}

// ── Security headers ──────────────────────────────────────────────────────────
// The app ships no inline <script>, but it does use inline style attributes
// throughout, so style-src needs 'unsafe-inline' while script-src does not.
// connect-src stays 'self' plus Plaid, which the Link SDK talks to directly.
const IS_PROD = !!process.env.DATABASE_URL;
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.plaid.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data:",
  "connect-src 'self' https://*.plaid.com",
  "frame-src https://cdn.plaid.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");
function securityHeaders() {
  const h = {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  // Only meaningful over HTTPS, and actively harmful to set on a localhost http dev
  // server (the browser would then refuse plain http on localhost for two years).
  if (IS_PROD) h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return h;
}

// Basic login throttle: slow down credential-stuffing without a full auth service.
const loginAttempts = new Map(); // key -> { n, first }
function loginBlocked(key) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 8;
  const rec = loginAttempts.get(key);
  if (rec && now - rec.first > win) { loginAttempts.delete(key); return false; }
  return !!(rec && rec.n >= max);
}
function loginFailed(key) {
  const now = Date.now(), rec = loginAttempts.get(key);
  if (!rec || now - rec.first > 10 * 60 * 1000) loginAttempts.set(key, { n: 1, first: now });
  else rec.n++;
}
const loginOk = (key) => loginAttempts.delete(key);

// ── Email verification ───────────────────────────────────────────────────────
// One place that mints the token and sends the mail, so signup and the manual
// "resend" button can't drift apart.
//
// Issuing a new link invalidates any earlier one: a verification link that stays live
// for 24 hours after the user asked for a fresh one is an unnecessary window, and it
// means a link leaked from an old inbox can still be redeemed.
async function issueVerification(user) {
  db.revokeTokens("verify", user.id);
  const token = db.createToken("verify", user.id, 24 * 60 * 60 * 1000); // 24 h
  const link = `${siteUrl()}/api/verify?token=${token}`;
  let emailed = false;
  if (mailerEnabled()) {
    const out = await sendMail({ to: user.email, ...verifyEmail(link) });
    emailed = !!out.sent;
    if (!out.sent) captureError(new Error(`verification email not sent: ${out.reason}`), "issueVerification");
  }
  // Only ever surface the raw link when there is no mail provider AND we are not
  // running against a real database (i.e. local dev), or when explicitly switched on.
  const devOk = !mailerEnabled() && (process.env.ALLOW_DEV_MAIL_LINKS === "1" || !process.env.DATABASE_URL);
  if (!emailed) console.log(`[mail:dev] verification for ${user.email}: ${link}`);
  return { emailed, devLink: devOk ? link : null };
}

// ── The charitable account: "redirect the residue", for real ─────────────────
// One designated sandbox account that tithes are journaled into. Resolved from env,
// then persisted meta, else created once and remembered. The residue therefore
// accumulates in Alpaca's books — visible in the Broker dashboard — not just ours.
let charityId = process.env.ALPACA_CHARITY_ACCOUNT_ID || null;
// Single-flight: getCharityId is async and called from several places (each sweep,
// the settle loop, every user). Without this guard two concurrent callers both see
// "no charity yet" and each opens an account — which is how we ended up with several.
let charityInFlight = null;

async function getCharityId() {
  if (!ALPACA) return null;
  if (charityId) return charityId;
  if (charityInFlight) return charityInFlight;   // a resolve is already running — join it

  charityInFlight = (async () => {
    // 1. Explicit override always wins.
    if (process.env.ALPACA_CHARITY_ACCOUNT_ID) return process.env.ALPACA_CHARITY_ACCOUNT_ID;

    // 2. Remembered from a previous run.
    const stored = db.getMeta("charityAccountId");
    if (stored) return stored;

    // 3. Ask Alpaca whether we already made one. Self-healing when our stored id was
    //    lost to a restart — adopt the existing account rather than opening another.
    const found = await findExistingCharityAccount();
    if (found) {
      if (found.duplicates > 1) {
        console.warn(`charity: ${found.duplicates} charitable accounts exist; using the oldest (${found.id}). Consider closing the extras.`);
      }
      db.setMeta("charityAccountId", found.id);
      await db.flushNow();
      console.log(`charity: adopted existing charitable account ${found.id}`);
      return found.id;
    }

    // 4. Genuinely none — create one, and persist the id immediately so a restart
    //    in the next few seconds can't cause a duplicate.
    const acct = await createCharityAccount();
    db.setMeta("charityAccountId", acct.id);
    await db.flushNow();
    console.log(`charity: created charitable account ${acct.id} (${acct.status})`);
    return acct.id;
  })()
    .then((id) => { charityId = id; return id; })
    .catch((e) => { captureError(e, "getCharityId"); return null; })
    .finally(() => { charityInFlight = null; });

  return charityInFlight;
}

// Route any queued residue to the charitable account. Real journal for Alpaca users;
// instant simulated routing otherwise. Never throws — retried by the background loop.
async function routeDonations(user) {
  const pending = user.pendingDonationCents ?? 0;
  if (pending <= 0) return false;
  if (!usesAlpaca(user)) {
    user.donationRoutedCents = (user.donationRoutedCents ?? 0) + pending;
    user.pendingDonationCents = 0;
    return true;
  }
  const charity = await getCharityId();
  if (!charity) return false;
  try {
    const j = await journalFirmTo(charity, pending);
    user.donationRoutedCents = (user.donationRoutedCents ?? 0) + pending;
    user.pendingDonationCents = 0;
    db.audit(user, "residue_routed", { cents: pending, journal: j.id, to: charity.slice(0, 8) });
    return true;
  } catch (e) {
    // Common benign case: charity account still activating. The loop retries.
    return false;
  }
}
const charityShort = () => (charityId ? charityId.slice(0, 8) + "…" : null);

// Advance one user's pending money: fund the account if it's ready, route any queued
// residue, and invest anything still waiting. Safe to call often — every step is a
// no-op when there's nothing to do.
//
// This runs BOTH on a timer and on request. On Render's free tier the server sleeps
// after ~15 min idle, which kills the interval — so an account created just before a
// sleep would sit unfunded forever, with round-ups stuck "pending". Calling it when
// the user loads their portfolio means any page view nudges their money forward.
async function settleUser(user) {
  if (!usesAlpaca(user)) return false;
  let changed = false;
  // AUTO_FUND-gated: this whole block gives the user OUR money (sandbox demo
  // convenience). In production it's off, and stays off — see AUTO_FUND above.
  if (AUTO_FUND && !user.funded) {
    const f = await fundIfActive(user.alpacaAccountId);
    if (f.method === "journal") {
      user.funded = true; user.fundingMethod = "journal"; changed = true;
    } else if (!user.achFallbackDone &&
               Date.now() - (user.fundingStartedAt || 0) > 180000) {
      try {
        await fundViaAch(user.alpacaAccountId);
        user.achFallbackDone = true; user.funded = true; user.fundingMethod = "ach";
        changed = true;
      } catch (e) {
        console.warn("ACH fallback failed for " + user.alpacaAccountId + ": " +
          String(e.message).split("\n")[0]);
      }
    }
  }
  if ((user.pendingDonationCents ?? 0) > 0) {
    if (await routeDonations(user)) changed = true;
  }
  if (user.pendingInvestCents > 0) {
    const before = user.pendingInvestCents;
    await retryPending(user, brokerFor(user));
    if (user.pendingInvestCents !== before) changed = true;
  }
  if (changed) db.saveUser(user);
  return changed;
}

// ── Routes ────────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
 try {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const ip = clientIp(req);

  // Reject cross-site state changes before any handler runs (see csrfRejected).
  if (req.method !== "GET" && req.method !== "HEAD" && csrfRejected(req)) {
    return sendJson(res, 403, { error: "Cross-site request blocked." });
  }

  // ---- the ethical screens catalogue (public reference data) ----
  if (req.method === "GET" && path === "/api/screens") {
    return sendJson(res, 200, { screens: screenCatalogue, snaptrade: snaptradeEnabled() });
  }

  // ---- health ----
  if (req.method === "GET" && path === "/api/health") {
    return sendJson(res, 200, { ok: true, alpaca: ALPACA, errors: errorLog.length, ...db.stats() });
  }

  // ---- waitlist: capture demand while real money is gated behind compliance ----
  if (req.method === "POST" && path === "/api/waitlist") {
    const rl = rateLimit("waitlist", ip, 5, 60 * 60 * 1000);
    if (rl.limited) return sendJson(res, 429, { error: "Too many requests. Try again later." }, { "Retry-After": String(rl.retryAfter) });
    const body = await readBody(req);
    if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
      return sendJson(res, 400, { error: "Enter a valid email address." });
    }
    const r = db.addWaitlist(body.email);
    return sendJson(res, 200, { ok: true, position: r.total });
  }

  // ---- funnel event (lightweight, name-only) ----
  if (req.method === "POST" && path === "/api/event") {
    const body = await readBody(req);
    const allowed = ["landing_view", "cta_click", "signup", "onboarding_done", "first_purchase", "bank_linked", "waitlist_join", "share_open"];
    if (body?.name && allowed.includes(body.name)) db.logEvent(body.name);
    return sendJson(res, 200, { ok: true });
  }

  // ---- funnel counts (aggregate only — no emails/PII) ----
  if (req.method === "GET" && path === "/api/funnel") {
    return sendJson(res, 200, db.funnel());
  }

  // ---- email verification: confirm link ----
  if (req.method === "GET" && path === "/api/verify") {
    const rl = rateLimit("verify-confirm", ip, 30, 60 * 60 * 1000);
    if (rl.limited) return sendJson(res, 429, { error: "Too many attempts. Try again later." });
    const t = db.useToken(url.searchParams.get("token"), "verify");
    if (t) {
      const u = db.getUser(t.userId);
      if (u) { u.emailVerified = true; db.saveUser(u); db.audit(u, "email_verified"); }
      res.writeHead(302, { Location: "/?verified=1", ...securityHeaders() });
      return res.end();
    }
    res.writeHead(302, { Location: "/?verified=0", ...securityHeaders() });
    return res.end();
  }

  // ---- password reset: request a link ----
  // Always answers the same way so it can't be used to probe which emails exist.
  // Without an email provider (sandbox), the link is returned to the client only when
  // ALLOW_DEV_MAIL_LINKS=1 — an explicit, documented demo switch — and always logged
  // server-side. Wiring Postmark/SES later replaces the dev link with a real send.
  if (req.method === "POST" && path === "/api/reset/request") {
    const rl = rateLimit("reset", ip, 5, 60 * 60 * 1000);
    if (rl.limited) return sendJson(res, 429, { error: "Too many requests. Try again later." }, { "Retry-After": String(rl.retryAfter) });
    const body = await readBody(req);
    const email = String(body?.email || "").toLowerCase();
    let devLink = null;
    const u = db.getUserByEmail(email);
    if (u) {
      // Only the newest reset link stays redeemable — see issueVerification.
      db.revokeTokens("reset", u.id);
      const token = db.createToken("reset", u.id, 30 * 60 * 1000); // 30 min
      const link = `${siteUrl()}/?reset=${token}`;
      console.log(`[mail:dev] password reset for ${email}: ${link}`);
      db.audit(u, "password_reset_requested");
      if (mailerEnabled()) await sendMail({ to: u.email, ...resetEmail(link) });
      // Surface the link on-screen only in dev / when explicitly allowed — and never
      // when real email is configured (the email is the delivery channel then).
      if (!mailerEnabled() && (process.env.ALLOW_DEV_MAIL_LINKS === "1" || !process.env.DATABASE_URL)) devLink = link;
    }
    const message = mailerEnabled()
      ? "If that address has an account, we've emailed a reset link. Check your inbox."
      : "If that address has an account, a reset link has been issued.";
    return sendJson(res, 200, { ok: true, message, devLink });
  }

  // ---- password reset: set the new password ----
  if (req.method === "POST" && path === "/api/reset") {
    const body = await readBody(req);
    if (!body?.password || body.password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
    const t = db.useToken(body.token, "reset");
    if (!t) return sendJson(res, 400, { error: "That reset link is invalid or has expired. Request a new one." });
    const u = db.getUser(t.userId);
    if (!u) return sendJson(res, 400, { error: "Account not found." });
    const { salt, passHash } = hashPassword(body.password);
    u.salt = salt; u.passHash = passHash;
    db.saveUser(u);
    db.deleteUserSessions(u.id); // every existing session is signed out
    db.audit(u, "password_reset");
    return sendJson(res, 200, { ok: true, message: "Password updated. Sign in with your new password." });
  }

  // ---- signup ----
  if (req.method === "POST" && path === "/api/signup") {
    const rl = rateLimit("signup", ip, 5, 60 * 60 * 1000);
    if (rl.limited) return sendJson(res, 429, { error: "Too many sign-ups from this network. Try again later." }, { "Retry-After": String(rl.retryAfter) });
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "invalid JSON" });
    const err = validateCredentials(body.email, body.password);
    if (err) return sendJson(res, 400, { error: err });
    if (db.getUserByEmail(body.email)) return sendJson(res, 409, { error: "An account with that email already exists." });
    const { salt, passHash } = hashPassword(body.password);
    const user = db.createUser({ email: body.email, salt, passHash });
    db.audit(user, "account_signup");
    // Send the verification email straight away. Previously this only happened if the
    // user noticed the banner and clicked it, so most accounts were never verified.
    // Never block signup on the mail provider — a slow or down Resend must not fail
    // account creation.
    issueVerification(user).catch((e) => captureError(e, "signup/verify-email"));
    const token = newToken();
    db.createSession(user.id, token);
    return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token) });
  }

  // ---- login ----
  if (req.method === "POST" && path === "/api/login") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "invalid JSON" });
    const key = String(body.email || "").toLowerCase();
    // Per-email throttling alone doesn't stop password spraying: one attacker trying
    // one common password against a thousand accounts never trips it. Limit the IP too.
    const rl = rateLimit("login", ip, 30, 10 * 60 * 1000);
    if (rl.limited) return sendJson(res, 429, { error: "Too many attempts. Try again in a few minutes." }, { "Retry-After": String(rl.retryAfter) });
    if (loginBlocked(key)) return sendJson(res, 429, { error: "Too many attempts. Try again in a few minutes." });
    const user = db.getUserByEmail(body.email);
    // Always spend the same work whether or not the account exists (see dummyVerify).
    const ok = user
      ? verifyPassword(body.password || "", user.salt, user.passHash)
      : dummyVerify(body.password);
    if (!ok) {
      loginFailed(key);
      return sendJson(res, 401, { error: "Wrong email or password." });
    }
    loginOk(key);
    db.audit(user, "login");
    const token = newToken();
    db.createSession(user.id, token);
    return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token) });
  }

  // ---- logout ----
  if (req.method === "POST" && path === "/api/logout") {
    const token = sessionFromCookie(req.headers.cookie);
    if (token) db.deleteSession(token);
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", { clear: true }) });
  }

  // ---- me ----
  if (req.method === "GET" && path === "/api/me") {
    const user = currentUser(req);
    return user ? sendJson(res, 200, { user: publicUser(user) }) : sendJson(res, 401, { error: "not signed in" });
  }

  // ===== everything below requires a session =====
  const authRoutes = ["/api/profile", "/api/portfolio", "/api/purchase", "/api/config",
                      "/api/plaid/link-token", "/api/plaid/exchange", "/api/plaid/sync", "/api/audit", "/api/verify/request",
                      "/api/bank/accounts", "/api/bank/link", "/api/deposit", "/api/withdraw", "/api/transfers",
                      "/api/screens/select", "/api/brokerage/connect", "/api/analysis"];
  if (authRoutes.includes(path)) {
    const user = currentUser(req);
    if (!user) return sendJson(res, 401, { error: "not signed in" });

    // ---- email verification: request a link ----
    if (req.method === "POST" && path === "/api/verify/request") {
      // Unthrottled, this endpoint is a free email cannon pointed at any address an
      // attacker can sign up with, and a fast way to burn the sending reputation.
      const rl = rateLimit("verify", user.id, 5, 60 * 60 * 1000);
      if (rl.limited) return sendJson(res, 429, { error: "Too many verification emails. Try again later." }, { "Retry-After": String(rl.retryAfter) });
      if (user.emailVerified) return sendJson(res, 200, { ok: true, alreadyVerified: true, emailed: false, devLink: null });
      const out = await issueVerification(user);
      return sendJson(res, 200, { ok: true, emailed: out.emailed, devLink: out.devLink });
    }

    // ---- save which ethical screens the user turned on ----
    if (req.method === "POST" && path === "/api/screens/select") {
      const body = await readBody(req);
      const keys = Array.isArray(body?.screens) ? body.screens.filter(isScreenKey) : [];
      user.screens = keys;
      db.saveUser(user);
      return sendJson(res, 200, { screens: user.screens });
    }

    // ---- start a read-only brokerage connection: returns SnapTrade portal URL ----
    if (req.method === "POST" && path === "/api/brokerage/connect") {
      if (!snaptradeEnabled()) return sendJson(res, 503, { error: "Brokerage connection isn't configured on this server." });
      try {
        // Register with SnapTrade once; reuse the stored credential after that.
        if (!user.snaptrade) {
          const reg = await stRegister(user.id);
          user.snaptrade = { userId: reg.userId, userSecret: reg.userSecret, connectedAt: null };
          db.saveUser(user);
          db.audit(user, "snaptrade_registered");
        }
        const redirect = `${siteUrl()}/?connected=1`;
        const url = await connectionPortalUrl(user.snaptrade.userId, user.snaptrade.userSecret, { redirect });
        return sendJson(res, 200, { url });
      } catch (e) {
        captureError(e, "brokerage/connect");
        return sendJson(res, 502, { error: "Couldn't start the brokerage connection. Try again." });
      }
    }

    // ---- the analysis: holdings screened against the user's chosen flags ----
    if (req.method === "GET" && path === "/api/analysis") {
      if (!snaptradeEnabled()) return sendJson(res, 503, { error: "Brokerage connection isn't configured on this server." });
      if (!user.snaptrade) return sendJson(res, 200, { connected: false });
      try {
        const { accounts, positions } = await allPositions(user.snaptrade.userId, user.snaptrade.userSecret);
        if (accounts.length && !user.snaptrade.connectedAt) {
          user.snaptrade.connectedAt = Date.now(); db.saveUser(user);
          db.audit(user, "brokerage_connected", { accounts: accounts.length });
        }
        const analysis = analyze(positions, user.screens || []);
        return sendJson(res, 200, {
          connected: accounts.length > 0,
          accounts: accounts.map((a) => ({ name: a.name, institution: a.institution })),
          screens: user.screens || [],
          ...analysis,
        });
      } catch (e) {
        captureError(e, "analysis");
        return sendJson(res, 502, { error: "Couldn't read your holdings. Try reconnecting." });
      }
    }

    // ---- the user's own audit trail ----
    if (req.method === "GET" && path === "/api/audit") {
      return sendJson(res, 200, { events: (user.audit || []).slice().reverse() });
    }

    // ---- complete profile → create the real sandbox brokerage account ----
    if (req.method === "POST" && path === "/api/profile") {
      const body = await readBody(req);
      if (!body) return sendJson(res, 400, { error: "invalid JSON" });
      // Validate BEFORE opening an Alpaca account so bad input never 422s in front
      // of the user (Alpaca rejects e.g. names under 2 chars).
      const submitted = body.profile || {};
      const invalid = validateProfile(submitted);
      if (invalid) return sendJson(res, 400, { error: invalid });

      // The SSN is used once, for the account application, and is never written to
      // our database — storableProfile() drops it and keeps only the last four.
      const taxId = String(submitted.taxId || "").trim();
      user.profile = { ...(user.profile || {}), ...storableProfile(submitted) };
      if (body.config) {
        user.config = { ...user.config, ...body.config };
        if (Array.isArray(body.config.holdings) && body.config.holdings.length) rebalance(user);
      }
      let accountStatus = null, accountError = null, funding = null;
      if (ALPACA && !user.alpacaAccountId) {
        try {
          const acct = await createBrokerageAccount({
            profile: user.profile,
            email: user.email,
            taxId,
            ip: clientIp(req),
          });
          user.alpacaAccountId = acct.id;
          accountStatus = acct.status;
          db.audit(user, "brokerage_account_created", { account: acct.id, status: acct.status });
          if (AUTO_FUND) {
            // Sandbox-only convenience: gift a starting balance so a demo doesn't
            // require linking a real bank first. New sandbox accounts are SUBMITTED
            // for a couple minutes before they go ACTIVE and can be journal-funded.
            // Try now (instant if already active); otherwise the background loop
            // funds it the moment it activates.
            user.fundingStartedAt = Date.now();
            funding = await fundIfActive(acct.id);
            user.funded = funding.method === "journal";
          } else {
            // Production path: the account starts at $0. The user funds it
            // themselves from their own bank via /api/deposit.
            funding = { method: "user_funded", status: "awaiting_deposit" };
          }
        } catch (e) {
          accountError = String(e.message).split("\n")[0];
        }
      }
      db.saveUser(user);
      return sendJson(res, 200, {
        account: user.alpacaAccountId ? { id: user.alpacaAccountId.slice(0, 8) + "…", status: accountStatus } : null,
        accountError,
        funding, // { method: "journal" | "ach", status } — journal is instant, ach takes 10–30 min
        ...summary(user, { mode: modeFor(user), charity: charityShort(), alpacaSnapshot: await snapshotFor(user) }),
      });
    }

    // ---- portfolio ----
    if (req.method === "GET" && path === "/api/portfolio") {
      // Nudge any pending funding/investing along; the interval alone can't be
      // relied on when the host sleeps between visits.
      try { await settleUser(user); } catch (e) { captureError(e, "settleUser"); }
      return sendJson(res, 200, summary(user, { mode: modeFor(user), charity: charityShort(), alpacaSnapshot: await snapshotFor(user) }));
    }

    // ---- add a (simulated) purchase ----
    if (req.method === "POST" && path === "/api/purchase") {
      const body = await readBody(req);
      const p = body && body.amount != null
        ? { name: body.name ?? "Manual purchase", category: body.category ?? "Other", amountCents: Math.round(Number(body.amount) * 100), ts: Date.now() }
        : randomPurchase();
      const tx = await recordPurchase(user, p, brokerFor(user));
      if (tx.swept) db.audit(user, "sweep_invested", { swept: tx.swept, donated: tx.donated || 0 });
      if (tx.donated) await routeDonations(user); // real journal to the charitable account
      db.saveUser(user);
      return sendJson(res, 200, summary(user, { mode: modeFor(user), charity: charityShort(), alpacaSnapshot: await snapshotFor(user) }));
    }

    // ---- update config (framework / tithe / etc.) ----
    if (req.method === "POST" && path === "/api/config") {
      const body = await readBody(req);
      if (!body) return sendJson(res, 400, { error: "invalid JSON" });
      const prevHoldings = JSON.stringify(user.config.holdings);
      user.config = { ...user.config, ...body };
      if (Array.isArray(body.holdings) && body.holdings.length && JSON.stringify(user.config.holdings) !== prevHoldings) {
        rebalance(user);
      }
      db.saveUser(user);
      return sendJson(res, 200, summary(user, { mode: modeFor(user), charity: charityShort(), alpacaSnapshot: await snapshotFor(user) }));
    }

    // ---- Plaid: start bank linking (returns a temporary link token) ----
    if (req.method === "POST" && path === "/api/plaid/link-token") {
      if (!plaidEnabled()) return sendJson(res, 400, { error: "Plaid is not configured." });
      try {
        const linkToken = await createLinkToken(user.id);
        return sendJson(res, 200, { linkToken });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.response?.data?.error_message || e.message).split("\n")[0] });
      }
    }

    // ---- Plaid: finish linking (exchange public token → saved connection) ----
    if (req.method === "POST" && path === "/api/plaid/exchange") {
      if (!plaidEnabled()) return sendJson(res, 400, { error: "Plaid is not configured." });
      const body = await readBody(req);
      if (!body?.publicToken) return sendJson(res, 400, { error: "publicToken required" });
      try {
        const { accessToken, itemId } = await exchangePublicToken(body.publicToken);
        user.plaidAccess = { accessToken, itemId };
        user.plaidCursor = null;
        db.audit(user, "bank_linked", { itemId });
        db.saveUser(user);
        return sendJson(res, 200, { bankLinked: true });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.response?.data?.error_message || e.message).split("\n")[0] });
      }
    }

    // ---- Plaid: pull new transactions → hand each to the SAME round-up engine ----
    if (req.method === "POST" && path === "/api/plaid/sync") {
      if (!user.plaidAccess) return sendJson(res, 400, { error: "No bank linked yet." });
      try {
        const { transactions, cursor } = await fetchTransactions(user.plaidAccess.accessToken, user.plaidCursor);
        // fetchTransactions already keeps only positive-amount spend (skips refunds/
        // deposits), and the cursor guarantees we never count a transaction twice.
        for (const p of transactions) {
          await recordPurchase(user, p, brokerFor(user)); // exact same path as "Make a purchase"
        }
        user.plaidCursor = cursor;
        db.saveUser(user);
        return sendJson(res, 200, { synced: transactions.length, ...summary(user, { mode: modeFor(user), charity: charityShort(), alpacaSnapshot: await snapshotFor(user) }) });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.response?.data?.error_message || e.message).split("\n")[0] });
      }
    }

    // ═══ Real Deposits: user's own money, from their own bank ═══════════════════
    // Same Plaid Link session as above (user.plaidAccess) — no second bank-linking
    // popup. See "Real Deposits Build Spec" for the full flow.

    // ---- list the user's bank accounts, so they can pick which one to fund from ----
    if (req.method === "GET" && path === "/api/bank/accounts") {
      if (!plaidEnabled()) return sendJson(res, 400, { error: "Plaid is not configured." });
      if (!user.plaidAccess) return sendJson(res, 400, { error: "Link your bank first." });
      try {
        const accounts = await listBankAccounts(user.plaidAccess.accessToken);
        return sendJson(res, 200, { accounts });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.response?.data?.error_message || e.message).split("\n")[0] });
      }
    }

    // ---- link a chosen bank account for funding (processor token → ACH relationship) ----
    if (req.method === "POST" && path === "/api/bank/link") {
      if (!plaidEnabled()) return sendJson(res, 400, { error: "Plaid is not configured." });
      if (!user.plaidAccess) return sendJson(res, 400, { error: "Link your bank first." });
      if (!user.alpacaAccountId) return sendJson(res, 400, { error: "Open your brokerage account first." });
      const body = await readBody(req);
      if (!body?.bankAccountId) return sendJson(res, 400, { error: "bankAccountId required" });
      try {
        // Don't create a duplicate relationship — reuse one if it already exists.
        if (!user.achRelationshipId) {
          const existing = await listAchRelationships(user.alpacaAccountId);
          const usable = (Array.isArray(existing) ? existing : [])
            .find((r) => !["CANCEL", "REJECTED", "CLOSED"].includes(String(r.status).toUpperCase()));
          if (usable) {
            user.achRelationshipId = usable.id;
          } else {
            const processorToken = await createAlpacaProcessorToken(user.plaidAccess.accessToken, body.bankAccountId);
            const rel = await createAchRelationshipFromPlaid(user.alpacaAccountId, processorToken);
            user.achRelationshipId = rel.id;
          }
          db.audit(user, "bank_linked_for_funding", { relationship: user.achRelationshipId });
          db.saveUser(user);
        }
        return sendJson(res, 200, { achRelationshipId: user.achRelationshipId });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.response?.data?.error_message || e.message).split("\n")[0] });
      }
    }

    // ---- deposit: user's bank -> their brokerage account ----
    if (req.method === "POST" && path === "/api/deposit") {
      if (!user.alpacaAccountId) return sendJson(res, 400, { error: "Open your brokerage account first." });
      if (!user.achRelationshipId) return sendJson(res, 400, { error: "Link a bank account for funding first." });
      const body = await readBody(req);
      const cents = validAmountCents(body?.amount);
      if (!cents) return sendJson(res, 400, { error: "Enter a valid amount." });
      try {
        const t = await createDeposit(user.alpacaAccountId, user.achRelationshipId, cents);
        user.transfers = user.transfers ?? [];
        user.transfers.push({ id: t.id, direction: "INCOMING", status: t.status, amountCents: cents, ts: Date.now() });
        db.audit(user, "deposit_created", { cents, transferId: t.id });
        db.saveUser(user);
        return sendJson(res, 200, {
          transfer: { id: t.id, status: t.status },
          ...summary(user, { mode: modeFor(user), charity: charityShort(), alpacaSnapshot: await snapshotFor(user) }),
        });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.response?.data?.error_message || e.message).split("\n")[0] });
      }
    }

    // ---- withdraw: brokerage account -> user's bank ----
    if (req.method === "POST" && path === "/api/withdraw") {
      if (!user.alpacaAccountId) return sendJson(res, 400, { error: "Open your brokerage account first." });
      if (!user.achRelationshipId) return sendJson(res, 400, { error: "Link a bank account for funding first." });
      const body = await readBody(req);
      const cents = validAmountCents(body?.amount);
      if (!cents) return sendJson(res, 400, { error: "Enter a valid amount." });
      try {
        const t = await createWithdrawal(user.alpacaAccountId, user.achRelationshipId, cents);
        user.transfers = user.transfers ?? [];
        user.transfers.push({ id: t.id, direction: "OUTGOING", status: t.status, amountCents: cents, ts: Date.now() });
        db.audit(user, "withdrawal_created", { cents, transferId: t.id });
        db.saveUser(user);
        return sendJson(res, 200, {
          transfer: { id: t.id, status: t.status },
          ...summary(user, { mode: modeFor(user), charity: charityShort(), alpacaSnapshot: await snapshotFor(user) }),
        });
      } catch (e) {
        return sendJson(res, 502, { error: String(e.response?.data?.error_message || e.message).split("\n")[0] });
      }
    }

    // ---- transfer history: fresh status from Alpaca, merged into our local mirror ----
    if (req.method === "GET" && path === "/api/transfers") {
      if (!user.alpacaAccountId) return sendJson(res, 200, { transfers: [] });
      try {
        const remote = await listTransfers(user.alpacaAccountId);
        const byId = new Map((Array.isArray(remote) ? remote : []).map((t) => [t.id, t]));
        user.transfers = (user.transfers ?? []).map((t) => {
          const fresh = byId.get(t.id);
          return fresh ? { ...t, status: fresh.status } : t;
        });
        db.saveUser(user);
      } catch (e) {
        captureError(e, "listTransfers");
      }
      return sendJson(res, 200, {
        transfers: (user.transfers ?? []).slice(-20).reverse().map((t) => ({
          id: t.id, direction: t.direction, status: t.status,
          amountCents: t.amountCents, display: fromCents(t.amountCents), ts: t.ts,
        })),
      });
    }
  }

  // ---- static frontend ----
  if (path.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });
  if (req.method === "GET") return serveStatic(res, path);
  sendJson(res, 404, { error: "not found" });
 } catch (err) {
  // Never leak a stack trace to the client; capture it for monitoring instead.
  captureError(err, `${req.method} ${req.url}`);
  try { if (!res.headersSent) sendJson(res, 500, { error: "Something went wrong." }); } catch { /* ignore */ }
 }
});

// ── Static file serving ───────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
  ".json": "application/json", ".woff2": "font/woff2", ".map": "application/json",
};
async function serveStatic(res, pathname) {
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(DIST_DIR, rel);
  if (!filePath.startsWith(DIST_DIR)) filePath = join(DIST_DIR, "index.html");
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
      ...securityHeaders(),
    });
    return res.end(body);
  } catch {
    try {
      const html = await readFile(join(DIST_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store", ...securityHeaders() });
      return res.end(html);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found (frontend not built — run `npm run build`).");
    }
  }
}

// Background: fund accounts the moment they activate, then invest queued round-ups.
// New sandbox accounts sit in SUBMITTED for a couple minutes; this journal-funds
// each one as soon as it flips to ACTIVE, so buying power (and the user's first real
// order) lands automatically without blocking onboarding or waiting on slow ACH.
if (ALPACA) {
  setInterval(async () => {
    for (const user of db.allUsers()) {
      try { await settleUser(user); } catch (e) { captureError(e, "settleUser/interval"); }
    }
  }, 20_000);
}

// Flush the last few seconds of state on shutdown (Render sends SIGTERM on deploy).
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    try { await db.closeDb(); } catch { /* best effort */ }
    process.exit(0);
  });
}

// Load persisted state BEFORE serving, so a restart doesn't look like data loss.
const dbInfo = await db.initDb();

server.listen(PORT, () => {
  console.log(`Good Steward on http://localhost:${PORT}`);
  console.log(`  alpaca: ${ALPACA ? "on (sandbox)" : "off (simulated)"}`);
  console.log(`  db:     ${dbInfo.backend} · ${dbInfo.users} users`);
  console.log(`  mail:   ${mailerEnabled() ? "resend" : "OFF — verification/reset links are logged, not emailed"}`);
  if (!process.env.DATABASE_URL) {
    console.log("  ⚠ no DATABASE_URL — state is a local file and will NOT survive a redeploy.");
  }
  if (process.env.DATABASE_URL && !mailerEnabled()) {
    console.warn("  ⚠ RESEND_API_KEY is unset in a production deployment — nobody can verify their email or reset a password.");
  }
  if (process.env.DATABASE_URL && !process.env.APP_URL && !process.env.RENDER_EXTERNAL_URL) {
    console.warn(`  ⚠ neither APP_URL nor RENDER_EXTERNAL_URL is set — email links will point at localhost:${PORT} and will not work.`);
  }
  if (process.env.DATABASE_URL && !TRUST_PROXY) {
    console.warn("  ⚠ TRUST_PROXY is unset behind a proxy — the IP recorded on account agreements will be the proxy's, not the user's.");
  }
  if (AUTO_FUND && alpacaIsLive()) {
    console.error("  ✖ AUTO_FUND_NEW_ACCOUNTS=1 with LIVE Alpaca credentials — this gifts real company money to every signup. Refusing to start.");
    process.exit(1);
  }
});
