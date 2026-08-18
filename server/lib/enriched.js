// Loads the EDGAR-enriched company dataset (built by scripts/enrich-edgar.mjs) and
// exposes flags for tickers the hand-curated screens don't cover. This is the breadth
// layer: curated screens.js gives precise, reasoned flags for well-known names; this
// gives industry-classified flags for the rest of the market, for free, from SEC data.
//
// The reason string names the SIC classification, so it stays a plain factual statement
// ("Classified under Petroleum Refining (SIC 2911)") rather than a judgment.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { screenLabel } from "./screens.js";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "generated", "companies.json");

let _data = { lastUpdated: null, source: null, count: 0, companies: {} };
try {
  if (existsSync(FILE)) _data = JSON.parse(readFileSync(FILE, "utf8"));
} catch { /* no enrichment yet — the app still runs on curated screens alone */ }

/** Freshness metadata for the UI ("data last updated …"). */
export function dataMeta() {
  return { lastUpdated: _data.lastUpdated, source: _data.source, count: _data.count || 0 };
}

/** Industry-classified flags for a ticker, filtered to the active screens. */
export function enrichedFlagsFor(ticker, activeKeys) {
  if (!ticker) return [];
  const c = _data.companies[String(ticker).toUpperCase()];
  if (!c) return [];
  const active = new Set(activeKeys);
  return (c.flags || [])
    .filter((k) => active.has(k))
    .map((k) => ({ key: k, label: screenLabel(k), reason: `Classified under ${c.sicDescription} (SIC ${c.sic}).` }));
}

/** Name for a ticker if the enriched set knows it. */
export const enrichedName = (t) => _data.companies[String(t || "").toUpperCase()]?.name || null;

/** Every ticker the enriched set flags for a given screen — used by fund look-through. */
export function enrichedTickersForScreen(key) {
  const out = [];
  for (const [ticker, c] of Object.entries(_data.companies)) if ((c.flags || []).includes(key)) out.push(ticker);
  return out;
}
