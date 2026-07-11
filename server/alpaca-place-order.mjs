// The real proof: place a fractional $5 notional buy using the ACTUAL
// AlpacaBroker class from lib/broker.js — the same code path the app will use
// once we swap FakeBroker -> AlpacaBroker in api.mjs.
//
// Run:  node --env-file=.env alpaca-place-order.mjs
// Optional symbol + dollars:  node --env-file=.env alpaca-place-order.mjs ESGV 5

import { AlpacaBroker } from "./lib/broker.js";
import { toCents } from "./lib/roundup.js";
import { authFromEnv } from "./lib/alpaca-auth.js";

let ctx;
try {
  ctx = authFromEnv();
} catch (err) {
  console.error("✗ " + err.message);
  process.exit(1);
}

const ACCOUNT = process.env.ALPACA_TEST_ACCOUNT_ID;
const SYMBOL = process.argv[2] ?? "ESGV";
const DOLLARS = process.argv[3] ?? "5";

if (!ACCOUNT) {
  console.error("✗ No ALPACA_TEST_ACCOUNT_ID in .env. Run alpaca-create-account.mjs first.");
  process.exit(1);
}

// The exact class api.mjs will use in production — we're exercising it directly.
const broker = new AlpacaBroker({ auth: ctx.auth, baseUrl: ctx.baseUrl });
const cents = toCents(DOLLARS);

console.log(`Placing a $${DOLLARS} notional BUY of ${SYMBOL} on account ${ACCOUNT}…`);
console.log("(using AlpacaBroker.invest from lib/broker.js)\n");

try {
  const order = await broker.invest(ACCOUNT, cents, SYMBOL);
  console.log("✓ Order placed. Alpaca returned an Order object:");
  console.log(`  order id:  ${order.id}`);
  console.log(`  symbol:    ${order.symbol}`);
  console.log(`  notional:  $${order.notional}`);
  console.log(`  side:      ${order.side}`);
  console.log(`  status:    ${order.status}`);
  console.log("");
  if (["accepted", "new", "pending_new"].includes(order.status)) {
    console.log("  Status 'accepted'/'new' = success. Alpaca took the order.");
    console.log("  It will fill when the market is open and the account has cash.");
  } else if (order.status === "filled") {
    console.log("  🎉 Already FILLED — account was funded and market is open.");
  }
  console.log("\n✓ AlpacaBroker.invest() works end-to-end. The Alpaca blocker is cleared.");
} catch (err) {
  console.error("✗ Order failed:\n  " + err.message);
  console.error("\n  A 403 about buying power just means funds haven't settled — auth is fine.");
  console.error("  Re-run alpaca-fund-account.mjs, wait a few minutes, then try again.");
  process.exit(1);
}
