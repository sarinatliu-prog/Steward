// Live API for the Good Steward site.
//
// Runs in one of two modes, chosen automatically:
//   • "alpaca" — real Alpaca sandbox: round-up sweeps place REAL sandbox orders in a
//                real brokerage account, and portfolio value is read from Alpaca.
//   • "fake"   — no creds present: in-memory FakeBroker (for a zero-config demo).
//
// State (transactions, clearing balance, invested/pending totals) persists to a JSON
// file so it survives restarts. Orders that can't be placed yet (funds still settling)
// are queued and retried — the site keeps working through the sandbox ACH delay.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ledger } from "./lib/ledger.js";
import { FakeBroker, AlpacaBroker } from "./lib/broker.js";
import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";
import { generateMonth, randomPurchase } from "./lib/feed.js";
import { fromCents, toCents } from "./lib/roundup.js";
import { loadState, saveState } from "./lib/store.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const ETF = "ESGV";
const USER = "cole";
const STATE_FILE = join(HERE, "data", "state.json");
const DIST_DIR = join(HERE, "..", "dist");
const MONTH_MS = 30 * 86_400_000;

// ── Broker selection ────────────────────────────────────────────────────────
let mode = "fake";
let broker = new FakeBroker();
let alpacaReq = null;          // requester for reading account/positions
let accountId = null;
try {
  const { auth, baseUrl } = authFromEnv();
  accountId = process.env.ALPACA_TEST_ACCOUNT_ID || null;
  if (accountId) {
    broker = new AlpacaBroker({ auth, baseUrl });
    alpacaReq = makeRequester(auth, baseUrl);
    mode = "alpaca";
  }
} catch {
  /* no creds → stay in fake mode */
}

// ── State ───────────────────────────────────────────────────────────────────
const ledger = new Ledger({ thresholdCents: 500, roundTo: 100 });
let transactions = [];
let investedCents = 0;      // sum of ETF order notionals Alpaca ACCEPTED
let pendingInvestCents = 0; // swept but not yet placed (funds settling)
let orders = [];            // { id, notionalCents, status, ts }
let alpacaSnapshot = null;  // { portfolioValueCents, cashCents, positionValueCents }

// ── Core pipeline ─────────────────────────────────────────────────────────────
// Try to place any queued investment. In fake mode this always succeeds; in alpaca
// mode a "funds settling" 403 leaves it queued for the next retry.
async function flushPending() {
  if (pendingInvestCents <= 0) return;
  const amount = pendingInvestCents;
  try {
    const order = await broker.invest(mode === "alpaca" ? accountId : USER, amount, ETF);
    investedCents += amount;
    pendingInvestCents -= amount;
    orders.push({ id: order.id, notionalCents: amount, status: order.status ?? "accepted", ts: Date.now() });
  } catch (err) {
    if (!String(err.message).includes("insufficient buying power")) {
      console.warn("order attempt failed:", err.message.split("\n")[0]);
    }
    // stays pending; retried later
  }
}

// Feed a purchase through: round-up → clearing → maybe sweep → queue investment.
async function ingest(p, { persist = true } = {}) {
  const { spare, balance } = ledger.recordPurchase(USER, p.amountCents, { name: p.name });
  const tx = { ...p, spare, balanceAfter: balance };
  const swept = ledger.sweep(USER);
  if (swept !== null) {
    pendingInvestCents += swept;
    tx.swept = swept;
    await flushPending();
    tx.invested = pendingInvestCents === 0; // did it clear immediately?
  }
  transactions.push(tx);
  if (persist) persist_();
  return tx;
}

function persist_() {
  saveState(STATE_FILE, {
    v: 1, transactions, investedCents, pendingInvestCents, orders,
    clearing: ledger.balanceOf(USER),
  });
}

// ── Alpaca snapshot (cached; refreshed on a timer) ───────────────────────────
async function refreshSnapshot() {
  if (mode !== "alpaca") return;
  try {
    const acct = await alpacaReq("GET", `/v1/trading/accounts/${accountId}/account`);
    let positionValueCents = 0;
    try {
      const pos = await alpacaReq("GET", `/v1/trading/accounts/${accountId}/positions/${ETF}`);
      positionValueCents = Math.round(Number(pos.market_value ?? 0) * 100);
    } catch { /* no position yet */ }
    alpacaSnapshot = {
      portfolioValueCents: Math.round(Number(acct.portfolio_value ?? 0) * 100),
      cashCents: Math.round(Number(acct.cash ?? 0) * 100),
      buyingPowerCents: Math.round(Number(acct.buying_power ?? 0) * 100),
      positionValueCents,
    };
  } catch (err) {
    console.warn("snapshot refresh failed:", err.message.split("\n")[0]);
  }
}

// ── Startup: restore or seed ─────────────────────────────────────────────────
const saved = loadState(STATE_FILE);
if (saved) {
  transactions = saved.transactions ?? [];
  investedCents = saved.investedCents ?? 0;
  pendingInvestCents = saved.pendingInvestCents ?? 0;
  orders = saved.orders ?? [];
  if (saved.clearing) ledger.balances.set(USER, saved.clearing);
  console.log(`Restored ${transactions.length} transactions from state.`);
  await flushPending(); // funds may have settled since last run
} else {
  for (const p of generateMonth()) await ingest(p, { persist: false });
  persist_();
  console.log(`Seeded ${transactions.length} transactions.`);
}
await refreshSnapshot();

// ── Summary for the frontend ─────────────────────────────────────────────────
function summary() {
  const monthStart = Date.now() - MONTH_MS;
  const monthTx = transactions.filter((t) => t.ts >= monthStart);
  const roundupsThisMonthCents = monthTx.reduce((s, t) => s + t.spare, 0);

  const byCategory = {};
  for (const t of monthTx) byCategory[t.category] = (byCategory[t.category] ?? 0) + t.spare;

  // Portfolio value: prefer Alpaca's real market value once it exists; else what we invested.
  const portfolioValueCents =
    alpacaSnapshot && alpacaSnapshot.positionValueCents > 0
      ? alpacaSnapshot.positionValueCents
      : investedCents;

  return {
    mode, etf: ETF,
    account: accountId ? accountId.slice(0, 8) + "…" : null,
    investedCents, pendingInvestCents,
    portfolioValueCents,
    clearingBalanceCents: ledger.balanceOf(USER),
    roundupsThisMonthCents,
    ordersPlaced: orders.length,
    thresholdCents: ledger.thresholdCents,
    alpaca: alpacaSnapshot,
    byCategory: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, cents]) => ({ category, cents, display: fromCents(cents) })),
    recent: transactions.slice(-8).reverse().map((t) => ({
      name: t.name, category: t.category,
      amount: fromCents(t.amountCents), spare: fromCents(t.spare),
      ts: t.ts, swept: t.swept ? fromCents(t.swept) : null,
    })),
    display: {
      portfolioValue: fromCents(portfolioValueCents),
      invested: fromCents(investedCents),
      pending: pendingInvestCents > 0 ? fromCents(pendingInvestCents) : null,
      clearing: fromCents(ledger.balanceOf(USER)),
      roundupsThisMonth: fromCents(roundupsThisMonthCents),
    },
  };
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

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

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { ok: true, mode, uptime: Math.round(process.uptime()), transactions: transactions.length });
  }
  if (req.method === "GET" && url.pathname === "/api/portfolio") {
    return send(res, 200, summary());
  }
  if (req.method === "POST" && url.pathname === "/api/purchase") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let p;
    try {
      const body = raw ? JSON.parse(raw) : {};
      p = body.amount != null
        ? { name: body.name ?? "Manual purchase", category: body.category ?? "Other",
            amountCents: Math.round(Number(body.amount) * 100), ts: Date.now() }
        : randomPurchase();
    } catch {
      return send(res, 400, { error: "invalid JSON" });
    }
    const tx = await ingest(p);
    return send(res, 200, { added: { name: tx.name, spare: fromCents(tx.spare) }, ...summary() });
  }

  if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "not found" });
  if (req.method === "GET") return serveStatic(res, url.pathname);
  send(res, 404, { error: "not found" });
});

// Background: retry queued investments + refresh the Alpaca snapshot.
if (mode === "alpaca") {
  setInterval(async () => { await flushPending(); persist_(); await refreshSnapshot(); }, 30_000);
}

server.listen(PORT, () => {
  const s = summary();
  console.log(`Good Steward API on http://localhost:${PORT}  [mode: ${mode}${accountId ? " · acct " + s.account : ""}]`);
  console.log(`  ${s.display.roundupsThisMonth} rounded up · ${s.display.invested} invested` +
    (s.display.pending ? ` · ${s.display.pending} pending (funds settling)` : "") +
    ` · ${s.display.clearing} in clearing`);
});
