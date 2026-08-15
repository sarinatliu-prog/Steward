// Preflight for a REAL Alpaca Trading account (your own money).
//
//   node --env-file=server/.env server/alpaca-live-check.mjs           # status only
//   node --env-file=server/.env server/alpaca-live-check.mjs buy 1     # buy $1 of ESGV
//
// Reads ALPACA_TRADING_KEY_ID / ALPACA_TRADING_SECRET_KEY and
// ALPACA_TRADING_BASE_URL (defaults to PAPER — you must opt in to live).
//
// Never prints your keys.

import { AlpacaTradingBroker } from "./lib/broker.js";

const keyId = process.env.ALPACA_TRADING_KEY_ID;
const secretKey = process.env.ALPACA_TRADING_SECRET_KEY;
// Default to paper on purpose: going live is an explicit choice, not a default.
const baseUrl = process.env.ALPACA_TRADING_BASE_URL || "https://paper-api.alpaca.markets";
const isLive = baseUrl.includes("//api.alpaca.markets");

if (!keyId || !secretKey) {
  console.error("✗ Missing ALPACA_TRADING_KEY_ID / ALPACA_TRADING_SECRET_KEY in server/.env");
  console.error("  Get them at https://app.alpaca.markets → Home → API Keys.");
  process.exit(1);
}

const broker = new AlpacaTradingBroker({ keyId, secretKey, baseUrl });

console.log(`Environment: ${isLive ? "LIVE — REAL MONEY" : "paper (practice)"}`);
console.log(`Host:        ${baseUrl}\n`);

let acct;
try {
  acct = await broker.account();
} catch (e) {
  console.error("✗ Could not read the account:\n  " + e.message);
  console.error("\n  401 usually means the keys don't match this environment —");
  console.error("  live keys only work on api.alpaca.markets, paper keys only on paper-api.");
  process.exit(1);
}

console.log("✓ Connected.");
console.log(`  account:       ${acct.account_number}`);
console.log(`  status:        ${acct.status}`);
console.log(`  cash:          $${Number(acct.cash ?? 0).toFixed(2)}`);
console.log(`  buying power:  $${Number(acct.buying_power ?? 0).toFixed(2)}`);
console.log(`  equity:        $${Number(acct.equity ?? 0).toFixed(2)}`);
if (acct.trading_blocked) console.log("  ⚠ trading_blocked is TRUE — orders will be rejected.");

const [cmd, amountArg] = process.argv.slice(2);
if (cmd !== "buy") {
  console.log("\nTo place ONE small test order:");
  console.log("  node --env-file=server/.env server/alpaca-live-check.mjs buy 1");
  process.exit(0);
}

const dollars = Number(amountArg || 1);
if (!Number.isFinite(dollars) || dollars <= 0) { console.error("✗ Bad amount."); process.exit(1); }

const symbol = process.env.ALPACA_TEST_SYMBOL || "ESGV";
console.log(`\nPlacing a $${dollars.toFixed(2)} market buy of ${symbol}${isLive ? " with REAL money" : ""}…`);

try {
  const order = await broker.invest(null, Math.round(dollars * 100), symbol);
  console.log("✓ Order accepted.");
  console.log(`  id:       ${order.id}`);
  console.log(`  symbol:   ${order.symbol}`);
  console.log(`  notional: $${order.notional}`);
  console.log(`  status:   ${order.status}`);
  console.log("\n  'accepted'/'new' fills when the market is open. Check it at");
  console.log("  https://app.alpaca.markets → Orders.");
} catch (e) {
  console.error("✗ Order rejected:\n  " + e.message);
  console.error("\n  Common causes: insufficient buying power, market closed with a");
  console.error("  non-tradable asset, or fractional trading not enabled on the account.");
  process.exit(1);
}
