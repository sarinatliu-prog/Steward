import assert from "node:assert/strict";
import { analyze } from "../lib/analyzer.js";
import { flagsFor, isScreenKey, screenCatalogue, companyName } from "../lib/screens.js";
import { knownFund } from "../lib/funds.js";

let passed = 0;
const test = (name, fn) => { fn(); console.log(`  ✓ ${name}`); passed++; };

// Mirrors the real SnapTrade sandbox portfolio shape.
const positions = [
  { account: "Ind", symbol: "AAPL",  description: "Apple Inc.",      kind: "stock",      units: 5,   price: 180.5, valueCents: 90250 },
  { account: "Ind", symbol: "XOM",   description: "ExxonMobil",      kind: "stock",      units: 10,  price: 110,   valueCents: 110000 },
  { account: "Ind", symbol: "LMT",   description: "Lockheed Martin", kind: "stock",      units: 2,   price: 450,   valueCents: 90000 },
  { account: "Ind", symbol: "VOO",   description: "Vanguard S&P 500",kind: "etf",        units: 15,  price: 500,   valueCents: 750000 },
  { account: "IRA", symbol: "ARKK",  description: "ARK Innovation",  kind: "etf",        units: 10,  price: 50,    valueCents: 50000 },
  { account: "Ind", symbol: "BTC",   description: "Bitcoin",         kind: "crypto",     units: 0.25,price: 59000, valueCents: 1475000 },
];

console.log("screens:");
test("keys are recognized", () => assert.ok(isScreenKey("fossil_fuels") && isScreenKey("weapons")));
test("unknown key rejected", () => assert.equal(isScreenKey("nonsense"), false));
test("XOM flags fossil fuels when active", () => assert.equal(flagsFor("XOM", ["fossil_fuels"]).length, 1));
test("XOM does not flag if screen is off", () => assert.equal(flagsFor("XOM", ["weapons"]).length, 0));
test("case-insensitive ticker match", () => assert.equal(flagsFor("xom", ["fossil_fuels"]).length, 1));
test("companyName resolves from reason", () => assert.equal(companyName("XOM"), "ExxonMobil"));
test("catalogue exposes counts, not reasons", () => assert.ok(screenCatalogue.every((s) => typeof s.count === "number" && s.tickers === undefined)));

console.log("funds:");
test("VOO is a known fund", () => assert.ok(knownFund("VOO")));
test("VOO holds Exxon and Lockheed", () => { const f = knownFund("VOO"); assert.ok(f.holds.includes("XOM") && f.holds.includes("LMT")); });
test("ARKK is not a known fund", () => assert.equal(knownFund("ARKK"), null));

console.log("analyzer — direct stocks:");
test("flags exactly the conflicted stocks", () => {
  const a = analyze(positions, ["fossil_fuels", "weapons"]);
  assert.deepEqual(a.conflictedStocks.map((h) => h.symbol).sort(), ["LMT", "XOM"]);
});
test("direct dollar attribution", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  assert.equal(a.summary.directConflictValueCents, 110000); // XOM only
});
test("crypto is not analyzed", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  assert.equal(a.holdings.find((h) => h.symbol === "BTC").analyzable, false);
});

console.log("analyzer — fund look-through:");
test("VOO is looked into and flagged", () => {
  const a = analyze(positions, ["fossil_fuels", "weapons"]);
  const voo = a.holdings.find((h) => h.symbol === "VOO");
  assert.equal(voo.lookThrough, true);
  assert.equal(voo.conflicted, true);
});
test("VOO surfaces the flagged companies it holds", () => {
  const a = analyze(positions, ["tobacco"]);
  const voo = a.holdings.find((h) => h.symbol === "VOO");
  const names = voo.contains.map((c) => c.ticker);
  assert.ok(names.includes("MO") && names.includes("PM"));
});
test("VOO respects the active screens", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  const voo = a.holdings.find((h) => h.symbol === "VOO");
  assert.ok(voo.contains.every((c) => c.flags.every((f) => f.key === "fossil_fuels")));
});
test("unknown fund ARKK stays not-analyzed, never called clean", () => {
  const a = analyze(positions, ["fossil_fuels", "weapons"]);
  const arkk = a.holdings.find((h) => h.symbol === "ARKK");
  assert.equal(arkk.analyzable, false);
  assert.equal(arkk.conflicted, false);
});
test("funds are counted by company, not dollars", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  // VOO conflict must NOT add to the direct dollar figure.
  assert.equal(a.summary.directConflictValueCents, 110000);
  assert.equal(a.summary.fundConflictCount, 1);
});
test("byFlag rolls up stock dollars and fund companies", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  const fossil = a.summary.byFlag.find((f) => f.key === "fossil_fuels");
  assert.equal(fossil.valueCents, 110000);   // XOM
  assert.equal(fossil.directHoldings, 1);
  assert.ok(fossil.fundCompanies > 1);        // VOO holds many fossil names
});
test("summary counts analyzed vs opaque funds", () => {
  const a = analyze(positions, ["fossil_fuels"]);
  assert.equal(a.summary.analyzedFunds, 1);   // VOO
  assert.equal(a.summary.opaqueFunds, 1);     // ARKK
});
test("no active screens -> nothing conflicted", () => {
  const a = analyze(positions, []);
  assert.equal(a.conflictedStocks.length, 0);
  assert.equal(a.conflictedFunds.length, 0);
});

console.log(`\n${passed} analyzer tests passed ✓`);
