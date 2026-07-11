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
import { hashPassword, verifyPassword, newToken, sessionFromCookie, sessionCookie, validateCredentials } from "./lib/auth.js";
import { alpacaEnabled, createBrokerageAccount, fundAccount } from "./lib/account-service.js";
import { recordPurchase, retryPending, rebalance, summary } from "./lib/portfolio.js";
import { FakeBroker, AlpacaBroker } from "./lib/broker.js";
import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";
import { generateMonth, randomPurchase } from "./lib/feed.js";

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
const publicUser = (u) => ({ id: u.id, email: u.email, hasProfile: !!u.profile, accountLinked: !!u.alpacaAccountId });

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

// Seed a little demo history so a new account isn't empty.
async function seedDemo(user) {
  for (const p of generateMonth(2, 12)) await recordPurchase(user, p, brokerFor(user));
}

// ── Routes ────────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ---- health ----
  if (req.method === "GET" && path === "/api/health") {
    return sendJson(res, 200, { ok: true, alpaca: ALPACA, ...db.stats() });
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
    const token = newToken();
    db.createSession(user.id, token);
    return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token) });
  }

  // ---- login ----
  if (req.method === "POST" && path === "/api/login") {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { error: "invalid JSON" });
    const user = db.getUserByEmail(body.email);
    if (!user || !verifyPassword(body.password || "", user.salt, user.passHash)) {
      return sendJson(res, 401, { error: "Wrong email or password." });
    }
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
  const authRoutes = ["/api/profile", "/api/portfolio", "/api/purchase", "/api/config"];
  if (authRoutes.includes(path)) {
    const user = currentUser(req);
    if (!user) return sendJson(res, 401, { error: "not signed in" });

    // ---- complete profile → create the real sandbox brokerage account ----
    if (req.method === "POST" && path === "/api/profile") {
      const body = await readBody(req);
      if (!body) return sendJson(res, 400, { error: "invalid JSON" });
      user.profile = { ...(user.profile || {}), ...(body.profile || {}) };
      if (body.config) {
        user.config = { ...user.config, ...body.config };
        if (Array.isArray(body.config.holdings) && body.config.holdings.length) rebalance(user);
      }
      let accountStatus = null, accountError = null;
      if (ALPACA && !user.alpacaAccountId) {
        try {
          const acct = await createBrokerageAccount(user.profile);
          user.alpacaAccountId = acct.id;
          accountStatus = acct.status;
          fundAccount(acct.id).catch(() => {}); // best-effort, settles later
        } catch (e) {
          accountError = String(e.message).split("\n")[0];
        }
      }
      if (user.transactions.length === 0) await seedDemo(user);
      db.saveUser(user);
      return sendJson(res, 200, {
        account: user.alpacaAccountId ? { id: user.alpacaAccountId.slice(0, 8) + "…", status: accountStatus } : null,
        accountError,
        ...summary(user, { mode: modeFor(user), alpacaSnapshot: await snapshotFor(user) }),
      });
    }

    // ---- portfolio ----
    if (req.method === "GET" && path === "/api/portfolio") {
      return sendJson(res, 200, summary(user, { mode: modeFor(user), alpacaSnapshot: await snapshotFor(user) }));
    }

    // ---- add a (simulated) purchase ----
    if (req.method === "POST" && path === "/api/purchase") {
      const body = await readBody(req);
      const p = body && body.amount != null
        ? { name: body.name ?? "Manual purchase", category: body.category ?? "Other", amountCents: Math.round(Number(body.amount) * 100), ts: Date.now() }
        : randomPurchase();
      await recordPurchase(user, p, brokerFor(user));
      db.saveUser(user);
      return sendJson(res, 200, summary(user, { mode: modeFor(user), alpacaSnapshot: await snapshotFor(user) }));
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
      return sendJson(res, 200, summary(user, { mode: modeFor(user), alpacaSnapshot: await snapshotFor(user) }));
    }
  }

  // ---- static frontend ----
  if (path.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });
  if (req.method === "GET") return serveStatic(res, path);
  sendJson(res, 404, { error: "not found" });
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

// Background: retry queued investments for Alpaca users as funds settle.
if (ALPACA) {
  setInterval(async () => {
    for (const user of db.allUsers()) {
      if (!usesAlpaca(user) || user.pendingInvestCents <= 0) continue;
      const before = user.pendingInvestCents;
      await retryPending(user, brokerFor(user));
      if (user.pendingInvestCents !== before) db.saveUser(user);
    }
  }, 60_000);
}

server.listen(PORT, () => {
  console.log(`Good Steward multi-user API on http://localhost:${PORT}  [alpaca: ${ALPACA ? "on" : "off (simulated)"}]`);
});
