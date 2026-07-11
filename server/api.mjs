// Steward API + production static server.
//
// In development: Vite serves the frontend on :5173 and proxies /api here (:8787).
// In production:  this process serves BOTH the built frontend (../dist) and /api
//                 on a single port ($PORT) — what Render/Railway/Fly expect.
//
// BROKER SELECTION (env var BROKER):
//   BROKER=fake    (default) — in-memory FakeBroker. No keys, no network, safe for a
//                  public demo. Nothing can reach a real market.
//   BROKER=alpaca  — real Alpaca SANDBOX orders via AlpacaBroker. Requires
//                  ALPACA_CLIENT_ID / ALPACA_CLIENT_SECRET / ALPACA_TEST_ACCOUNT_ID.
//                  Still sandbox: fake money, no real market.
//
// There is no path here to real money: the Alpaca host defaults to the sandbox, and
// going live is a legal question, not a config flag — see GOING_LIVE.md.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ledger } from "./lib/ledger.js";
import { FakeBroker, AlpacaBroker } from "./lib/broker.js";
import { generateMonth, randomPurchase } from "./lib/feed.js";
import { fromCents } from "./lib/roundup.js";

const PORT = process.env.PORT || 8787;
const ETF = "ESGV"; // Broad Ethical core holding
const MONTH_START = Date.now() - 30 * 86_400_000;

// In production the server also serves the built frontend (Vite `dist/`), so the
// whole app is one deployable service and /api is same-origin (no CORS/proxy).
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const HAS_DIST = existsSync(DIST_DIR);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".map": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

// ── Broker selection ───────────────────────────────────────────────────────
const USE_ALPACA = (process.env.BROKER ?? "fake").toLowerCase() === "alpaca";
let broker;
let BROKER_ACCOUNT = "cole"; // FakeBroker keys positions by any string

if (USE_ALPACA) {
  const clientId = process.env.ALPACA_CLIENT_ID ?? process.env.ALPACA_API_KEY_ID;
  const clientSecret = process.env.ALPACA_CLIENT_SECRET ?? process.env.ALPACA_API_SECRET_KEY;
  BROKER_ACCOUNT = process.env.ALPACA_TEST_ACCOUNT_ID;
  if (!clientId || !clientSecret || !BROKER_ACCOUNT) {
    console.error(
      "BROKER=alpaca but ALPACA_CLIENT_ID / ALPACA_CLIENT_SECRET / ALPACA_TEST_ACCOUNT_ID are missing."
    );
    process.exit(1);
  }
  broker = new AlpacaBroker({
    clientId,
    clientSecret,
    baseUrl: process.env.ALPACA_BASE_URL, // defaults to sandbox inside AlpacaBroker
    authUrl: process.env.ALPACA_AUTH_URL,
  });
} else {
  broker = new FakeBroker();
}

const ledger = new Ledger({ thresholdCents: 500, roundTo: 100 });
const USER = "cole";
const transactions = [];

// Tracked locally rather than queried from the broker on every poll: the frontend
// polls /api/portfolio every 5s, and hammering Alpaca for it would burn rate limits.
let investedCents = 0;
let ordersPlaced = 0;
let lastBrokerError = null;

/**
 * Feed a purchase through the pipeline: round-up -> clearing -> maybe sweep -> invest.
 * `placeOrder` is false while seeding history, so booting the server doesn't fire
 * dozens of real sandbox orders (and immediately fail on buying power).
 */
async function ingest(p, { placeOrder = true } = {}) {
  const { spare, balance } = ledger.recordPurchase(USER, p.amountCents, { name: p.name });
  const tx = { ...p, spare, balanceAfter: balance };

  const swept = ledger.sweep(USER);
  if (swept !== null) {
    tx.swept = swept;
    investedCents += swept;
    ordersPlaced += 1;

    if (placeOrder) {
      try {
        const order = await broker.invest(BROKER_ACCOUNT, swept, ETF);
        tx.orderId = order.id;
        lastBrokerError = null;
      } catch (err) {
        // Never let a broker hiccup take down the app — the round-up engine is the
        // product; the order is a side effect. Surface the error instead.
        lastBrokerError = err.message;
        console.error("broker.invest failed:", err.message);
      }
    }
  }

  transactions.push(tx);
  return tx;
}

// Seed a month of history (accounting only — no broker orders).
for (const p of generateMonth()) await ingest(p, { placeOrder: false });

function summary() {
  const monthTx = transactions.filter((t) => t.ts >= MONTH_START);
  const roundupsThisMonthCents = monthTx.reduce((s, t) => s + t.spare, 0);

  const byCategory = {};
  for (const t of monthTx) byCategory[t.category] = (byCategory[t.category] ?? 0) + t.spare;

  return {
    etf: ETF,
    broker: USE_ALPACA ? "alpaca-sandbox" : "fake",
    brokerError: lastBrokerError,
    investedCents,
    clearingBalanceCents: ledger.balanceOf(USER),
    roundupsThisMonthCents,
    ordersPlaced,
    thresholdCents: ledger.thresholdCents,
    byCategory: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, cents]) => ({ category, cents, display: fromCents(cents) })),
    recent: transactions
      .slice(-8)
      .reverse()
      .map((t) => ({
        name: t.name,
        category: t.category,
        amount: fromCents(t.amountCents),
        spare: fromCents(t.spare),
        ts: t.ts,
        swept: t.swept ? fromCents(t.swept) : null,
      })),
    display: {
      invested: fromCents(investedCents),
      clearing: fromCents(ledger.balanceOf(USER)),
      roundupsThisMonth: fromCents(roundupsThisMonthCents),
    },
  };
}

function sendJson(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

/** Serve a built frontend file, falling back to index.html for SPA routes. */
async function serveStatic(res, pathname) {
  // Prevent path traversal: normalize, strip leading ../, and confine to DIST_DIR.
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(DIST_DIR, rel);
  if (!filePath.startsWith(DIST_DIR)) filePath = join(DIST_DIR, "index.html");

  try {
    const body = await readFile(filePath);
    const cacheable = rel.startsWith("/assets/") || rel.startsWith("assets/");
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
      "Cache-Control": cacheable ? "public, max-age=31536000, immutable" : "no-cache",
    });
    return res.end(body);
  } catch {
    // Unknown path -> serve the SPA entry so client-side routing works.
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
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, broker: USE_ALPACA ? "alpaca-sandbox" : "fake" });
  }

  if (req.method === "GET" && url.pathname === "/api/portfolio") {
    return sendJson(res, 200, summary());
  }

  // Inject a purchase: body {name, amount} in dollars, or empty for a random one.
  if (req.method === "POST" && url.pathname === "/api/purchase") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let p;
    try {
      const body = raw ? JSON.parse(raw) : {};
      p =
        body.amount != null
          ? {
              name: body.name ?? "Manual purchase",
              category: body.category ?? "Other",
              amountCents: Math.round(Number(body.amount) * 100),
              ts: Date.now(),
            }
          : randomPurchase();
    } catch {
      return sendJson(res, 400, { error: "invalid JSON" });
    }
    const tx = await ingest(p);
    return sendJson(res, 200, { added: { name: tx.name, spare: fromCents(tx.spare) }, ...summary() });
  }

  if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });

  // Everything else: the frontend.
  if (HAS_DIST && req.method === "GET") return serveStatic(res, url.pathname);

  sendJson(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  const s = summary();
  console.log(`Steward listening on :${PORT}`);
  console.log(`  broker:   ${s.broker}${USE_ALPACA ? ` (account ${BROKER_ACCOUNT})` : ""}`);
  console.log(`  frontend: ${HAS_DIST ? "serving ../dist" : "NOT BUILT (run `npm run build`) — API only"}`);
  console.log(
    `  seeded ${transactions.length} purchases · ${s.display.roundupsThisMonth} rounded up · ` +
      `${s.display.invested} invested in ${ETF} · ${s.display.clearing} in clearing`
  );
});
