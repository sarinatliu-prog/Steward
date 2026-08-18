// Fund look-through — the point of the whole product for normal people.
//
// Most people don't hold Exxon directly; they hold an S&P 500 fund that holds Exxon.
// For a curated set of well-known index funds we know their constituents from public,
// published holdings, so we can look inside and surface the flagged companies.
//
// HONESTY RULES (this product's premise):
//   1. Only funds listed here are looked into. Anything else stays "not analyzed" —
//      we never guess at a fund's contents.
//   2. These are the well-known, stable constituents, not a live holdings feed. Index
//      membership shifts; the UI says "based on published holdings."
//   3. We never attribute an exact dollar amount to a company *inside* a fund — that
//      needs per-name weights we don't have. We name the companies, not the dollars.
//
// The lists below are screened companies (from screens.js) that are established
// large-cap members of each index. Deliberately conservative: a name is included only
// where its membership is stable and well-known.

// Screened companies that are established S&P 500 constituents.
const SP500 = [
  // fossil fuels
  "XOM", "CVX", "COP", "OXY", "SLB", "HAL", "KMI", "MPC", "VLO", "PSX",
  "WMB", "OKE", "DVN", "FANG", "EOG", "HES", "BKR", "CTRA",
  // weapons & defense
  "LMT", "RTX", "NOC", "GD", "BA", "LHX", "HII", "TXT", "LDOS",
  // tobacco
  "MO", "PM",
  // gambling
  "LVS", "MGM", "WYNN", "CZR",
  // alcohol
  "STZ", "TAP", "BF.B",
  // surveillance & data
  "META", "GOOGL", "GOOG", "PLTR",
  // factory farming
  "TSN", "HRL",
];

// Total US market holds everything in the S&P 500 plus smaller-cap screened names.
const TOTAL = [...new Set([...SP500,
  "SWBI", "RGR", "OLN", "VSTO", "POWW", "AOUT",   // firearms
  "DKNG", "PENN", "BYD", "CHDN", "RSI", "GDEN",   // gambling
  "GEO", "CXW",                                    // private prisons
  "WRLD", "EZPW", "FCFS", "ENVA",                  // predatory lending
  "TPB", "UVV",                                    // tobacco
  "KTOS", "AVAV",                                  // defense
  "SAM",                                           // alcohol
])];

// Nasdaq-100 is tech-heavy: few of our screened names, mostly the data/ad giants.
const NASDAQ100 = ["META", "GOOGL", "GOOG", "PLTR"];

/** ticker -> { name, basis (plain-English index), holds (screened constituents) }. */
export const FUNDS = {
  VOO:   { name: "Vanguard S&P 500 ETF",                    basis: "the S&P 500",        holds: SP500 },
  SPY:   { name: "SPDR S&P 500 ETF",                        basis: "the S&P 500",        holds: SP500 },
  IVV:   { name: "iShares Core S&P 500 ETF",                basis: "the S&P 500",        holds: SP500 },
  SPLG:  { name: "SPDR Portfolio S&P 500 ETF",              basis: "the S&P 500",        holds: SP500 },
  FXAIX: { name: "Fidelity 500 Index Fund",                 basis: "the S&P 500",        holds: SP500 },
  VFIAX: { name: "Vanguard 500 Index Fund",                 basis: "the S&P 500",        holds: SP500 },
  SWPPX: { name: "Schwab S&P 500 Index Fund",               basis: "the S&P 500",        holds: SP500 },
  VTI:   { name: "Vanguard Total Stock Market ETF",         basis: "the total US market", holds: TOTAL },
  ITOT:  { name: "iShares Core S&P Total US Stock Market",  basis: "the total US market", holds: TOTAL },
  VTSAX: { name: "Vanguard Total Stock Market Index Fund",  basis: "the total US market", holds: TOTAL },
  QQQ:   { name: "Invesco QQQ Trust (Nasdaq-100)",          basis: "the Nasdaq-100",     holds: NASDAQ100 },
};

/** The fund record for a ticker we can see inside, or null. */
export const knownFund = (t) => FUNDS[String(t || "").toUpperCase()] || null;
