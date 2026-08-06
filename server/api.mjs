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
import { hashPassword, verifyPassword, newToken, sessionFromCookie, sessionCookie, validateCredentials, validateProfile } from "./lib/auth.js";
import { alpacaEnabled, createBrokerageAccount, fundIfActive, fundViaAch, createCharityAccount, journalFirmTo } from "./lib/account-service.js";
import { plaidEnabled, createLinkToken, exchangePublicToken, fetchTransactions } from "./lib/plaid.js";
import { recordPurchase, retryPending, rebalance, summary } from "./lib/portfolio.js";
import { FakeBroker, AlpacaBroker } from "./lib/broker.js";
import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";
import { randomPurchase } from "./lib/feed.js";
import { mailerEnabled, siteUrl, sendMail, resetEmail, verifyEmail } from "./lib/mailer.js";

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

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function sendJson(res, code, body, extraHeaders = {}) {
  res.writeHead(code, { "Content-Type": "application/json", ...extraHeaders });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
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
    return { portfolioValueCents: Math.round(Number(acct.portfolio_value ?? 0) * 100), positionValueCents };
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

// ── The charitable account: "redirect the residue", for real ─────────────────
// One designated sandbox account that tithes are journaled into. Resolved from env,
// then persisted meta, else created once and remembered. The residue therefore
// accumulates in Alpaca's books — visible in the Broker dashboard — not just ours.
let charityId = process.env.ALPACA_CHARITY_ACCOUNT_ID || null;
async function getCharityId() {
  if (!ALPACA) return null;
  if (charityId) return charityId;
  const stored = db.getMeta("charityAccountId");
  if (stored) { charityId = stored; return charityId; }
  try {
    const acct = await createCharityAccount();
    db.setMeta("charityAccountId", acct.id);
    charityId = acct.id;
    console.log(`charity: created charitable account ${acct.id} (${acct.status})`);
  } catch (e) {
    captureError(e, "createCharityAccount");
  }
  return charityId;
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

// ── Routes ────────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
 try {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ---- health ----
  if (req.method === "GET" && path === "/api/health") {
    return sendJson(res, 200, { ok: true, alpaca: ALPACA, errors: errorLog.length, ...db.stats() });
  }

  // ---- waitlist: capture demand while real money is gated behind compliance ----
  if (req.method === "POST" && path === "/api/waitlist") {
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
    const t = db.useToken(url.searchParams.get("token"), "verify");
    if (t) {
      const u = db.getUser(t.userId);
      if (u) { u.emailVerified = true; db.saveUser(u); db.audit(u, "email_verified"); }
      res.writeHead(302, { Location: "/?verified=1" });
      return res.end();
    }
    res.writeHead(302, { Location: "/?verified=0" });
    return res.end();
  }

  // ---- password reset: request a link ----
  // Always answers the same way so it can't be used to probe which emails exist.
  // Without an email provider (sandbox), the link is returned to the client only when
  // ALLOW_DEV_MAIL_LINKS=1 — an explicit, documented demo switch — and always logged
  // server-side. Wiring Postmark/SES later replaces the dev link with a real send.
  if (req.method === "POST" && path === "/api/reset/request") {
    const body = await readBody(req);
    const email = String(body?.email || "").toLowerCase();
    let devLink = null;
    const u = db.getUserByEmail(email);
    if (u) {
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
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "invalid JSON" });
    const err = validateCredentials(body.email, body.password);
    if (err) return sendJson(res, 400, { error: err });
    if (db.getUserByEmail(body.email)) return sendJson(res, 409, { error: "An account with that email already exists." });
    const { salt, passHash } = hashPassword(body.password);
    const user = db.createUser({ email: body.email, salt, passHash });
    db.audit(user, "account_signup");
    const token = newToken();
    db.createSession(user.id, token);
    return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token) });
  }

  // ---- login ----
  if (req.method === "POST" && path === "/api/login") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "invalid JSON" });
    const key = String(body.email || "").toLowerCase();
    if (loginBlocked(key)) return sendJson(res, 429, { error: "Too many attempts. Try again in a few minutes." });
    const user = db.getUserByEmail(body.email);
    if (!user || !verifyPassword(body.password || "", user.salt, user.passHash)) {
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
                      "/api/plaid/link-token", "/api/plaid/exchange", "/api/plaid/sync", "/api/audit", "/api/verify/request"];
  if (authRoutes.includes(path)) {
    const user = currentUser(req);
    if (!user) return sendJson(res, 401, { error: "not signed in" });

    // ---- email verification: request a link ----
    if (req.method === "POST" && path === "/api/verify/request") {
      const token = db.createToken("verify", user.id, 24 * 60 * 60 * 1000); // 24 h
      const link = `${siteUrl()}/api/verify?token=${token}`;
      console.log(`[mail:dev] verification for ${user.email}: ${link}`);
      if (mailerEnabled()) await sendMail({ to: user.email, ...verifyEmail(link) });
      const devLink = (!mailerEnabled() && (process.env.ALLOW_DEV_MAIL_LINKS === "1" || !process.env.DATABASE_URL)) ? link : null;
      return sendJson(res, 200, { ok: true, emailed: mailerEnabled(), devLink });
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
      const invalid = validateProfile(body.profile || {});
      if (invalid) return sendJson(res, 400, { error: invalid });
      user.profile = { ...(user.profile || {}), ...(body.profile || {}) };
      if (body.config) {
        user.config = { ...user.config, ...body.config };
        if (Array.isArray(body.config.holdings) && body.config.holdings.length) rebalance(user);
      }
      let accountStatus = null, accountError = null, funding = null;
      if (ALPACA && !user.alpacaAccountId) {
        try {
          const acct = await createBrokerageAccount(user.profile);
          user.alpacaAccountId = acct.id;
          user.fundingStartedAt = Date.now();
          accountStatus = acct.status;
          db.audit(user, "brokerage_account_created", { account: acct.id, status: acct.status });
          // New sandbox accounts are SUBMITTED for a couple minutes before they go
          // ACTIVE and can be journal-funded. Try now (instant if already active);
          // otherwise the background loop funds it the moment it activates.
          funding = await fundIfActive(acct.id);
          user.funded = funding.method === "journal";
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
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    return res.end(body);
  } catch {
    try {
      const html = await readFile(join(DIST_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": MIME[".html"] });
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
      if (!usesAlpaca(user)) continue;
      let changed = false;
      if (!user.funded) {
        const f = await fundIfActive(user.alpacaAccountId);
        if (f.method === "journal") {
          user.funded = true; user.fundingMethod = "journal"; changed = true;
        } else if (!user.achFallbackDone &&
                   Date.now() - (user.fundingStartedAt || 0) > 180000) {
          // Journal hasn't funded within 3 min — fall back to ACH so the account is
          // never permanently stuck at $0. Only mark done if the ACH call succeeds,
          // so a transient failure retries next loop.
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
  if (!process.env.DATABASE_URL) {
    console.log("  ⚠ no DATABASE_URL — state is a local file and will NOT survive a redeploy.");
  }
});
