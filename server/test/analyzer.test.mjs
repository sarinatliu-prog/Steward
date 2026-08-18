import assert from "node:assert/strict";
import { analyze } from "../lib/analyzer.js";
import { flagsFor, isScreenKey, screenCatalogue } from "../lib/screens.js";

let passed = 0;
const test = (name, fn) => { fn(); console.log(`  ✓ ${name}`); passed++; };

// Mirrors the real SnapTrade sandbox portfolio shape.
const positions = [
  { account: "Individual", symbol: "AAPL",  description: "Apple Inc.",      kind: "stock",      units: 5,   price: 180.5, valueCents: 90250 },
  { account: "Individual", symbol: "XOM",   description: "ExxonMobil",      kind: "stock",      units: 10,  price: 110,   valueCents: 110000 },
  { account: "Individual", symbol: "LMT",   description: "Lockheed Martin", kind: "stock",      units: 2,   price: 450,   valueCents: 90000 },
  { account: "Individual", symbol: "SPY",   description: "S&P 500 ETF",     kind: "etf",        units: 15,  price: 558,   valueCents: 837000 },
  { account: "IRA",        symbol: "FXAIX", description: "Fidelity 500",    kind: "mutualfund", units: 120, price: 185,   valueCents: 2220000 },
  { account: "Individual", symbol: "BTC",   description: "Bitcoin",         kind: "crypto",     units: 0.25,price: 59000, valueCents: 1475000 },
];

console.log("screens:");
test("keys are recognized", () => assert.ok(isScreenKey("fossil_fuels") && isScreenKey("weapons")));
test("unknown key rejected", () => assert.equal(isScreenKey("nonsense"), false));
test("XOM flags fossil fuels when active", () => {
  const f = flagsFor("XOM", ["fossil_fuels"]);
  assert.equal(f.length, 1);
  assert.equal(f[0].key, "fossil_fuels");
});
test("XOM does not flag if screen is off", () => assert.equal(flagsFor("XOM", ["weapons"]).length, 0));
test("case-insensitive ticker match", () => assert.equal(flagsFor("xom", ["fossil_fuels"]).length, 1));
test("clean ticker returns nothing", () => assert.equal(flagsFor("AAPL", ["fossil_fuels", "weapons"]).length, 0));
test("catalogue exposes counts, not reasons", () => {
  assert.ok(screenCatalogue.every((s) => typeof s.count === "number" && s.tickers === undefined));
});

console.log("analyzer:");
test("flags exactly the conflicted stocks", () => {
  const a = analyze(positions, ["fossil_fuels", "weapons"]);
  assert.deepEqual(a.conflicted.map((h) => h.symbol).sort(), ["LMT", "XOM"]);
});
test("only individual stocks count as analyzed", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  assert.equal(a.summary.analyzedCount, 3); // AAPL, XOM, LMT — not SPY/FXAIX/BTC
});
test("funds are never claimed as clean", () => {
  const a = analyze(positions, ["fossil_fuels", "weapons"]);
  const spy = a.holdings.find((h) => h.symbol === "SPY");
  assert.equal(spy.analyzable, false);
  assert.equal(spy.conflicted, false);
});
test("crypto is not analyzed", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  assert.equal(a.holdings.find((h) => h.symbol === "BTC").analyzable, false);
});
test("byFlag sums exposed value per flag", () => {
  const a = analyze(positions, ["fossil_fuels", "weapons"]);
  const fossil = a.summary.byFlag.find((f) => f.key === "fossil_fuels");
  assert.equal(fossil.valueCents, 110000);
  assert.equal(fossil.holdings, 1);
});
test("turning a screen off removes its flags", () => {
  const a = analyze(positions, ["weapons"]);
  assert.deepEqual(a.conflicted.map((h) => h.symbol), ["LMT"]);
});
test("no active screens -> nothing conflicted", () => {
  assert.equal(analyze(positions, []).conflicted.length, 0);
});

console.log(`\n${passed} analyzer tests passed ✓`);
