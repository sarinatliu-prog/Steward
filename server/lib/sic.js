// SIC (Standard Industrial Classification) → our ethical screens.
//
// EDGAR tags every public filer with a 4-digit SIC code (free, no key). For industries
// where the code cleanly implies the activity, we can auto-flag thousands of companies
// without hand-curation — this is what turns a list of ~83 into most of the market.
//
// HONESTY: we only map SIC codes where the classification is a plain factual statement
// about the company's line of business. Fuzzy categories with no clean SIC —
// surveillance, gambling, private prisons, adult, animal testing — are NOT guessed here;
// they stay curated (screens.js) and get AI-classified over time. Membership by SIC is a
// fact about the company's registered industry, not a judgment we're making.

const inRange = (sic, lo, hi) => sic >= lo && sic <= hi;

/** Screen keys implied by a company's SIC code (may be empty). */
export function screensForSic(sicRaw) {
  const sic = Number(sicRaw);
  if (!sic) return [];
  const keys = new Set();

  // Fossil fuels — coal, oil & gas extraction, refining, pipelines, gas utilities.
  if (inRange(sic, 1220, 1241) || sic === 1311 || inRange(sic, 1381, 1389) || sic === 2911 ||
      inRange(sic, 4610, 4619) || inRange(sic, 4922, 4925) || sic === 5171 || sic === 2990) {
    keys.add("fossil_fuels");
  }
  // Tobacco — cigarettes, cigars, chewing/smoking tobacco, stemming & redrying.
  if (inRange(sic, 2100, 2141)) keys.add("tobacco");

  // Alcohol — malt beverages, malt, wine & brandy, distilled spirits, and wholesale.
  // Deliberately starts at 2082, NOT 2080: the generic "Beverages" code (2080) sweeps in
  // non-alcoholic names like Coca-Cola. True alcohol producers coded 2080 (e.g. some
  // spirits conglomerates) are caught by the curated list instead — precision over recall.
  if (inRange(sic, 2082, 2085) || sic === 5182) keys.add("alcohol");

  // Weapons & defense — ordnance, ammunition, missiles/space vehicles, tanks, and
  // search/detection/guidance (defense) systems.
  if (inRange(sic, 3480, 3489) || inRange(sic, 3760, 3769) || sic === 3795 || sic === 3812) {
    keys.add("weapons");
  }
  // Civilian firearms & small-arms ammunition (subset of the ordnance codes).
  if (sic === 3484 || sic === 3482) keys.add("firearms");

  // Factory farming — industrial meat/poultry processing and livestock feedlots.
  if (sic === 2011 || sic === 2013 || sic === 2015 || sic === 211 || sic === 213) {
    keys.add("factory_farming");
  }
  // Predatory / high-interest consumer lending.
  if (sic === 6141) keys.add("payday_lending");

  return [...keys];
}

// Which screens EDGAR/SIC can classify, vs which stay curated + AI. Used in the UI so we
// can honestly say how each flag was determined.
export const SIC_CLASSIFIED = [
  "fossil_fuels", "tobacco", "alcohol", "weapons", "firearms", "factory_farming", "payday_lending",
];
export const CURATED_ONLY = [
  "gambling", "big_tech_surveillance", "adult", "animal_testing", "private_prisons",
];
