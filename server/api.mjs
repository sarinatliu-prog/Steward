// Steward — the ethical portfolio analyzer.
//
// Multi-user accounts (email + password), a read-only SnapTrade brokerage connection,
// and an ethical-screen analysis of the user's holdings. We never trade and never move
// money.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as db from "./lib/db.js";
import { hashPassword, verifyPassword, dummyVerify, newToken, sessionFromCookie, sessionCookie, validateCredentials } from "./lib/auth.js";
import { mailerEnabled, siteUrl, sendMail, resetEmail, verifyEmail } from "./lib/mailer.js";
import { snaptradeEnabled, registerUser as stRegister, connectionPortalUrl, allPositions } from "./lib/snaptrade.js";
import { analyze } from "./lib/analyzer.js";
import { screenCatalogue, isScreenKey } from "./lib/screens.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const DIST_DIR = join(HERE, "..", "dist");

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
function currentUser(req) {
  const token = sessionFromCookie(req.headers.cookie);
  const session = db.getSession(token);
  return session ? db.getUser(session.userId) : null;
}
const publicUser = (u) => ({
  id: u.id, email: u.email, emailVerified: !!u.emailVerified,
  brokerageConnected: !!(u.snaptrade && u.snaptrade.connectedAt),
  snaptradeEnabled: snaptradeEnabled(),
});

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
  console.log(`Steward on http://localhost:${PORT}`);
  console.log(`  db:        ${dbInfo.backend} · ${dbInfo.users} users`);
  console.log(`  snaptrade: ${snaptradeEnabled() ? "on" : "OFF — set SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY"}`);
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
});
