import assert from "node:assert/strict";
import { computeRoundUp, toCents, fromCents } from "../lib/roundup.js";
import { Ledger } from "../lib/ledger.js";
import { FakeBroker } from "../lib/broker.js";

let passed = 0;
const test = (name, fn) => { fn(); console.log(`  ✓ ${name}`); passed++; };

console.log("roundup:");
test("$4.50 -> 50¢ spare", () => assert.equal(computeRoundUp(450), 50));
test("$3.60 -> 40¢ spare", () => assert.equal(computeRoundUp(360), 40));
test("$12.99 -> 1¢ spare", () => assert.equal(computeRoundUp(1299), 1));
test("whole dollar -> 0¢", () => assert.equal(computeRoundUp(400), 0));
test("$0.00 -> 0¢", () => assert.equal(computeRoundUp(0), 0));
test("custom roundTo 500 ($5): $12.30 -> $2.70", () => assert.equal(computeRoundUp(1230, 500), 270));
test("rejects floats", () => assert.throws(() => computeRoundUp(3.6)));
test("rejects negatives", () => assert.throws(() => computeRoundUp(-100)));

console.log("money helpers:");
test('toCents("$3.60") -> 360', () => assert.equal(toCents("$3.60"), 360));
test("toCents(4.5) -> 450", () => assert.equal(toCents(4.5), 450));
test("no float drift on 0.1+0.2 case", () => assert.equal(toCents(0.29) + toCents(0.31), 60));
test("fromCents(40) -> $0.40", () => assert.equal(fromCents(40), "$0.40"));

console.log("ledger:");
test("accrues spare change across purchases", () => {
  const l = new Ledger();
  assert.equal(l.recordPurchase("u1", 360).spare, 40);   // +40
  assert.equal(l.recordPurchase("u1", 450).balance, 90); // +50 -> 90
});
test("no sweep below threshold", () => {
  const l = new Ledger({ thresholdCents: 500 });
  l.recordPurchase("u1", 360); // 40
  assert.equal(l.sweep("u1"), null);
  assert.equal(l.balanceOf("u1"), 40);
});
test("sweeps whole balance once threshold crossed, resets to 0", () => {
  const l = new Ledger({ thresholdCents: 500 });
  for (let i = 0; i < 13; i++) l.recordPurchase("u1", 450); // 13 * 50 = 650
  const swept = l.sweep("u1");
  assert.equal(swept, 650);
  assert.equal(l.balanceOf("u1"), 0);
});
test("users are isolated", () => {
  const l = new Ledger();
  l.recordPurchase("a", 450); // 50
  l.recordPurchase("b", 360); // 40
  assert.equal(l.balanceOf("a"), 50);
  assert.equal(l.balanceOf("b"), 40);
});

console.log("broker (fake):");
test("invest records a filled order and accumulates position", async () => {
  const b = new FakeBroker();
  const o = await b.invest("u1", 650, "ESGV");
  assert.equal(o.status, "filled");
  assert.equal(o.notional, "6.50");
  await b.invest("u1", 100, "ESGV");
  assert.equal(b.positionOf("u1", "ESGV"), 750);
});

console.log(`\n${passed} tests passed ✓`);
