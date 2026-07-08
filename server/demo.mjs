// End-to-end demo of the round-up flow, using the FakeBroker (no Alpaca needed).
// Run: node demo.mjs
import { Ledger } from "./lib/ledger.js";
import { FakeBroker } from "./lib/broker.js";
import { toCents, fromCents } from "./lib/roundup.js";

const USER = "cole";
const ETF = "ESGV"; // the "Broad Ethical" framework's core holding from the app

const ledger = new Ledger({ thresholdCents: 500, roundTo: 100 }); // sweep at $5
const broker = new FakeBroker();

// A week of purchases (dollar amounts as they'd come from a card feed)
const purchases = [
  ["Blue Bottle coffee", 4.60], ["Transit", 2.90], ["Bookshop", 18.25],
  ["Groceries", 43.38], ["Pharmacy", 9.99], ["Lunch", 12.50],
  ["Hardware store", 7.05], ["Farmers market", 21.75], ["Cafe", 3.40],
  ["Bakery", 6.80], ["Bike repair", 33.33], ["Tea", 4.15],
];

console.log(`Round-up demo — ${USER}, sweeping into ${ETF} at ${fromCents(500)}\n`);

let invested = 0;
for (const [name, dollars] of purchases) {
  const cents = toCents(dollars);
  const { spare, balance } = ledger.recordPurchase(USER, cents, { name });
  console.log(
    `  ${name.padEnd(20)} ${fromCents(cents).padStart(7)}  ` +
    `+${fromCents(spare)} spare  →  clearing ${fromCents(balance)}`
  );

  const swept = ledger.sweep(USER);
  if (swept !== null) {
    const order = await broker.invest(USER, swept, ETF);
    invested += swept;
    console.log(`     ↳ swept ${fromCents(swept)} → bought ${ETF} (order ${order.id})`);
  }
}

console.log(`\nSummary:`);
console.log(`  Total invested into ${ETF}: ${fromCents(broker.positionOf(USER, ETF))}`);
console.log(`  Still pending in clearing:  ${fromCents(ledger.balanceOf(USER))}`);
console.log(`  Orders placed:              ${broker.orders.length}`);
