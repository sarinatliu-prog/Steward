// Minimal zero-dependency HTTP API exposing live round-up/ledger state to the
// frontend. Seeds a month of simulated purchases on startup; supports injecting
// new ones. Swap FakeBroker -> AlpacaBroker once sandbox keys authenticate.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Ledger } from "./lib/ledger.js";
import { FakeBroker } from "./lib/broker.js";
import { generateMonth, randomPurchase } from "./lib/feed.js";
import { fromCents } from "./lib/roundup.js";

const PORT = process.env.PORT || 8787;

// In production the server also serves the built frontend (Vite `dist/`), so the
// whole app is one deployable service and /api is same-origin (no CORS/proxy).
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
  ".json": "application/json", ".woff2": "font/woff2", ".map": "application/json", ".webmanifest": "application/manifest+json",
};
const ETF = "ESGV"; // Broad Ethical core holding
const MONTH_START = Date.now() - 30 * 86_400_000;

const ledger = new Ledger({ thresholdCents: 500, roundTo: 100 });
const broker = new FakeBroker();
const USER = "cole";
const transactions = [];

// Feed a purchase through the whole pipeline: round-up -> clearing -> maybe sweep -> invest.
async function ingest(p) {
  const { spare, balance } = ledger.recordPurchase(USER, p.amountCents, { name: p.name });
  const tx = { ...p, spare, balanceAfter: balance };
  const swept = ledger.sweep(USER);
  if (swept !== null) {
    const order = await broker.invest(USER, swept, ETF);
    tx.swept = swept;
    tx.orderId = order.id;
  }
  transactions.push(tx);
  return tx;
}

// Seed a month of history.
for (const p of generateMonth()) await ingest(p);

function summary() {
  const monthTx = transactions.filter((t) => t.ts >= MONTH_START);
  const roundupsThisMonthCents = monthTx.reduce((s, t) => s + t.spare, 0);

  const byCategory = {};
  for (const t of monthTx) byCategory[t.category] = (byCategory[t.category] ?? 0) + t.spare;

  return {
    etf: ETF,
    investedCents: broker.positionOf(USER, ETF),
    clearingBalanceCents: ledger.balanceOf(USER),
    roundupsThisMonthCents,
    ordersPlaced: broker.orders.length,
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
      invested: fromCents(broker.positionOf(USER, ETF)),
      clearing: fromCents(ledger.balanceOf(USER)),
      roundupsThisMonth: fromCents(roundupsThisMonthCents),
    },
  };
}

function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

// Serve a built frontend file, falling back to index.html for SPA routes.
async function serveStatic(res, pathname) {
  // Prevent path traversal: normalize and confine to DIST_DIR.
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(DIST_DIR, rel);
  if (!filePath.startsWith(DIST_DIR)) filePath = join(DIST_DIR, "index.html");
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
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
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check (used by the host to confirm the service is up).
  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { ok: true, uptime: Math.round(process.uptime()), transactions: transactions.length });
  }

  if (req.method === "GET" && url.pathname === "/api/portfolio") {
    return send(res, 200, summary());
  }

  // Inject a purchase: body {name, amount} in dollars, or empty for a random one.
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

  // Unknown /api route -> JSON 404; everything else -> the built frontend.
  if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "not found" });
  if (req.method === "GET") return serveStatic(res, url.pathname);
  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  const s = summary();
  console.log(`API on http://localhost:${PORT}`);
  console.log(`  seeded ${transactions.length} purchases · ${s.display.roundupsThisMonth} rounded up · ` +
              `${s.display.invested} invested in ${ETF} · ${s.display.clearing} in clearing`);
});
