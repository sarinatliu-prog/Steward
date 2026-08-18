// Data linter — validates the ethical dataset for the kinds of mistakes that don't
// break a build but quietly corrupt results: malformed tickers, unknown screen keys,
// duplicate reasons, funds pointing at nothing, contradictory classifications.
//
//   node scripts/lint-data.mjs        # report problems, exit 1 if any errors
//
// Warnings are advisory; errors fail the run (usable in CI).

import { SCREENS, SCREEN_KEYS, isScreenKey } from "../server/lib/screens.js";
import { FUNDS } from "../server/lib/funds.js";
import { screensForSic, SIC_CLASSIFIED, CURATED_ONLY } from "../server/lib/sic.js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let errors = 0, warnings = 0;
const err = (m) => { console.error(`  ✗ ${m}`); errors++; };
const warn = (m) => { console.warn(`  ⚠ ${m}`); warnings++; };
const TICKER_RE = /^[A-Z][A-Z.]{0,6}$/; // 1–7 chars, letters + dots (class shares like BF.B)

// ── screens.js ────────────────────────────────────────────────────────────────
console.log("screens.js");
{
  const keys = new Set();
  const tickerToKeys = new Map(); // ticker -> Set(screen keys), to spot dup classifications
  for (const s of SCREENS) {
    if (!s.key || !isScreenKey(s.key)) err(`screen has an invalid key: ${JSON.stringify(s.key)}`);
    if (keys.has(s.key)) err(`duplicate screen key: ${s.key}`);
    keys.add(s.key);
    if (!s.label) err(`screen ${s.key} has no label`);
    if (!s.blurb) warn(`screen ${s.key} has no blurb`);
    if (!s.tickers || !Object.keys(s.tickers).length) err(`screen ${s.key} has no companies`);
    for (const [t, reason] of Object.entries(s.tickers || {})) {
      if (!TICKER_RE.test(t)) err(`${s.key}: malformed ticker "${t}"`);
      if (typeof reason !== "string" || reason.length < 8) err(`${s.key}/${t}: reason too short or missing`);
      if (reason && !reason.includes(" — ")) warn(`${s.key}/${t}: reason should read "Name — description" (for name parsing)`);
      const set = tickerToKeys.get(t) || new Set();
      if (set.has(s.key)) err(`${s.key}: ticker ${t} listed twice in the same screen`);
      set.add(s.key); tickerToKeys.set(t, set);
    }
  }
  console.log(`  ${SCREENS.length} screens, ${tickerToKeys.size} distinct companies`);
}

// ── funds.js ──────────────────────────────────────────────────────────────────
console.log("funds.js");
{
  for (const [ticker, f] of Object.entries(FUNDS)) {
    if (!TICKER_RE.test(ticker)) err(`fund key malformed: "${ticker}"`);
    if (!f.name) err(`fund ${ticker} has no name`);
    if (!f.basis) err(`fund ${ticker} has no basis`);
    if (!Array.isArray(f.holds) || !f.holds.length) { err(`fund ${ticker} holds nothing`); continue; }
    const seen = new Set();
    for (const h of f.holds) {
      if (!TICKER_RE.test(h)) err(`fund ${ticker}: malformed constituent "${h}"`);
      if (seen.has(h)) warn(`fund ${ticker}: constituent ${h} listed twice`);
      seen.add(h);
    }
  }
  console.log(`  ${Object.keys(FUNDS).length} funds`);
}

// ── sic.js sanity ───────────────────────────────────────────────────────────────
console.log("sic.js");
{
  // Every screen a SIC code can produce must be a real screen key.
  const probe = [1311, 2911, 2111, 2082, 2080, 3760, 3484, 2015, 6141, 3571, 0];
  for (const sic of probe) for (const k of screensForSic(sic)) if (!isScreenKey(k)) err(`sic ${sic} → unknown screen "${k}"`);
  // The known Coca-Cola false-positive guard must hold.
  if (screensForSic(2080).includes("alcohol")) err(`SIC 2080 ("Beverages") flags alcohol — reintroduces the Coca-Cola false positive`);
  // Classified/curated partition must cover exactly the screen set, no overlap.
  const union = new Set([...SIC_CLASSIFIED, ...CURATED_ONLY]);
  for (const k of SIC_CLASSIFIED) if (CURATED_ONLY.includes(k)) err(`screen ${k} is in both SIC_CLASSIFIED and CURATED_ONLY`);
  for (const k of SCREEN_KEYS) if (!union.has(k)) warn(`screen ${k} is neither SIC-classified nor curated-only (label it in sic.js)`);
  for (const k of union) if (!isScreenKey(k)) err(`sic.js partition names unknown screen "${k}"`);
  console.log(`  ${SIC_CLASSIFIED.length} SIC-classified, ${CURATED_ONLY.length} curated-only`);
}

// ── generated/companies.json (enrichment output) ────────────────────────────────
console.log("generated/companies.json");
{
  const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "server", "generated", "companies.json");
  if (!existsSync(FILE)) {
    warn("no enrichment dataset yet — run `node scripts/enrich-edgar.mjs`");
  } else {
    let d;
    try { d = JSON.parse(readFileSync(FILE, "utf8")); } catch (e) { err(`unparseable: ${e.message}`); d = null; }
    if (d) {
      if (!d.lastUpdated || Number.isNaN(Date.parse(d.lastUpdated))) err("missing/invalid lastUpdated");
      const companies = d.companies || {};
      if (Object.keys(companies).length !== d.count) warn(`count (${d.count}) != actual entries (${Object.keys(companies).length})`);
      let bad = 0;
      for (const [t, c] of Object.entries(companies)) {
        if (!TICKER_RE.test(t)) { err(`enriched: malformed ticker "${t}"`); if (++bad > 20) break; }
        if (!Array.isArray(c.flags) || !c.flags.length) { err(`enriched ${t}: no flags`); if (++bad > 20) break; }
        for (const k of c.flags || []) if (!isScreenKey(k)) { err(`enriched ${t}: unknown screen "${k}"`); if (++bad > 20) break; }
        if (c.sic == null) warn(`enriched ${t}: no SIC code recorded`);
      }
      const stale = d.lastUpdated ? Math.floor((Date.now() - Date.parse(d.lastUpdated)) / 86400000) : null;
      if (stale != null && stale > 120) warn(`dataset is ${stale} days old — consider re-running enrichment`);
      console.log(`  ${Object.keys(companies).length} companies, updated ${d.lastUpdated?.slice(0, 10)}`);
    }
  }
}

console.log(`\n${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`);
process.exit(errors ? 1 : 0);
