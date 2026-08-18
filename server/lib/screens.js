// The ethical screens — the substance of the analyzer.
//
// A screen is one moral flag a user can turn on (e.g. "Fossil fuels"). Each screen
// names the companies that violate it, by ticker, with a one-line reason a human can
// read. When a user connects a brokerage, we match their holdings against the screens
// they chose and show them what conflicts.
//
// HONESTY RULES, because this product's whole premise is not overstating:
//   1. Every flag is a plain, checkable factual claim about what the company does —
//      not a computed "ESG score", not a vibe. If we can't say why in one sentence, it
//      isn't in here.
//   2. This is a curated starter list of large, widely-held names, NOT a complete
//      holdings database. We say so in the UI. A clean result means "none of the names
//      we track", never "audited clean".
//   3. Funds (ETFs/mutual funds) hold hundreds of companies. We can flag a fund's
//      *stated strategy* (e.g. a fossil-fuel ETF) but we do NOT claim to see inside a
//      broad index fund. Look-through holdings data is a later, sourced feature.
//
// Sources for these classifications are the companies' own primary lines of business,
// which is deliberately the least arguable basis. Reasonable people draw these lines
// differently — which is why the user picks the flags, and we only ever explain.

/**
 * @typedef {Object} Screen
 * @property {string} key      stable id, stored in user config
 * @property {string} label    UI label
 * @property {string} blurb    one line describing what it flags
 * @property {Object<string,string>} tickers  TICKER -> reason (why it violates THIS screen)
 * @property {string[]} [fundStrategies]  fund tickers whose stated strategy conflicts
 */

/** @type {Screen[]} */
export const SCREENS = [
  {
    key: "fossil_fuels",
    label: "Fossil fuels",
    blurb: "Oil, gas, and coal extraction, and pipelines.",
    tickers: {
      XOM: "ExxonMobil — integrated oil & gas major.",
      CVX: "Chevron — integrated oil & gas major.",
      COP: "ConocoPhillips — oil & gas exploration and production.",
      SHEL: "Shell — integrated oil & gas major.",
      BP: "BP — integrated oil & gas major.",
      OXY: "Occidental Petroleum — oil & gas exploration and production.",
      SLB: "Schlumberger — oilfield services.",
      HAL: "Halliburton — oilfield services.",
      ENB: "Enbridge — oil & gas pipelines.",
      KMI: "Kinder Morgan — oil & gas pipelines.",
      MPC: "Marathon Petroleum — petroleum refining.",
      VLO: "Valero — petroleum refining.",
      PSX: "Phillips 66 — petroleum refining.",
      WMB: "Williams Companies — natural gas pipelines.",
      OKE: "ONEOK — natural gas gathering and pipelines.",
      DVN: "Devon Energy — oil & gas exploration and production.",
      FANG: "Diamondback Energy — oil & gas exploration and production.",
      EOG: "EOG Resources — oil & gas exploration and production.",
      HES: "Hess — oil & gas exploration and production.",
      BKR: "Baker Hughes — oilfield services.",
      CTRA: "Coterra Energy — oil & gas exploration and production.",
      TRP: "TC Energy — oil & gas pipelines.",
      EPD: "Enterprise Products — natural gas & petrochemical pipelines.",
      ET: "Energy Transfer — oil & gas pipelines.",
    },
  },
  {
    key: "weapons",
    label: "Weapons & defense",
    blurb: "Military weapons manufacturing and defense contracting.",
    tickers: {
      LMT: "Lockheed Martin — defense prime; missiles, fighter aircraft.",
      RTX: "RTX (Raytheon) — missiles and defense systems.",
      NOC: "Northrop Grumman — defense prime; weapons systems.",
      GD: "General Dynamics — defense prime; combat systems, munitions.",
      BA: "Boeing — commercial and military aircraft, defense.",
      LHX: "L3Harris — defense electronics and systems.",
      HII: "Huntington Ingalls — naval warships.",
      LDOS: "Leidos — defense and intelligence contracting.",
      TXT: "Textron — military aircraft and armored vehicles.",
      KTOS: "Kratos — drones and defense systems.",
      AVAV: "AeroVironment — military drones.",
      BAESY: "BAE Systems — defense prime; weapons and vehicles.",
    },
  },
  {
    key: "firearms",
    label: "Civilian firearms",
    blurb: "Manufacturers and large retailers of civilian guns and ammunition.",
    tickers: {
      SWBI: "Smith & Wesson — civilian firearms manufacturer.",
      RGR: "Sturm Ruger — civilian firearms manufacturer.",
      OLN: "Olin — Winchester ammunition.",
      VSTO: "Vista Outdoor — ammunition and firearms accessories.",
      POWW: "AMMO Inc — ammunition manufacturer.",
      AOUT: "American Outdoor Brands — shooting and outdoor accessories.",
    },
  },
  {
    key: "tobacco",
    label: "Tobacco & nicotine",
    blurb: "Cigarettes, cigars, vaping, and other nicotine products.",
    tickers: {
      MO: "Altria — cigarettes (Marlboro US) and vaping.",
      PM: "Philip Morris International — cigarettes and nicotine.",
      BTI: "British American Tobacco — cigarettes and nicotine.",
      TPB: "Turning Point Brands — smokeless and alternative tobacco.",
      UVV: "Universal Corp — leaf tobacco supplier.",
      IMBBY: "Imperial Brands — cigarettes and nicotine.",
      JAPAY: "Japan Tobacco — cigarettes and nicotine.",
    },
  },
  {
    key: "gambling",
    label: "Gambling",
    blurb: "Casinos, sportsbooks, and betting platforms.",
    tickers: {
      DKNG: "DraftKings — sports betting and iGaming.",
      LVS: "Las Vegas Sands — casinos.",
      WYNN: "Wynn Resorts — casinos.",
      MGM: "MGM Resorts — casinos and betting.",
      CZR: "Caesars Entertainment — casinos and sportsbook.",
      PENN: "PENN Entertainment — casinos and sportsbook.",
      FLUT: "Flutter — sports betting (FanDuel, Paddy Power).",
      BYD: "Boyd Gaming — casinos.",
      CHDN: "Churchill Downs — racetracks and betting.",
      RSI: "Rush Street Interactive — online casino and sportsbook.",
      GDEN: "Golden Entertainment — casinos and taverns.",
    },
  },
  {
    key: "alcohol",
    label: "Alcohol",
    blurb: "Producers of beer, wine, and spirits.",
    tickers: {
      BUD: "Anheuser-Busch InBev — beer.",
      TAP: "Molson Coors — beer.",
      STZ: "Constellation Brands — beer, wine, spirits.",
      DEO: "Diageo — spirits (Johnnie Walker, Guinness).",
      SAM: "Boston Beer — beer and hard seltzer.",
      "BF.B": "Brown-Forman — spirits (Jack Daniel's).",
    },
  },
  {
    key: "adult",
    label: "Adult entertainment",
    blurb: "Pornography and adult-content businesses.",
    tickers: {
      // Few pure-play public names; RCI (Rick's Cabaret / RCI Hospitality) is the clearest.
      RICK: "RCI Hospitality — adult nightclubs.",
    },
  },
  {
    key: "big_tech_surveillance",
    label: "Surveillance & data",
    blurb: "Business models built on large-scale personal-data collection.",
    tickers: {
      META: "Meta — advertising built on personal-data profiling.",
      GOOGL: "Alphabet — advertising built on personal-data profiling.",
      GOOG: "Alphabet — advertising built on personal-data profiling.",
      PLTR: "Palantir — government and defense data analytics.",
    },
  },
  {
    key: "factory_farming",
    label: "Factory farming",
    blurb: "Industrial animal agriculture and meat processing.",
    tickers: {
      TSN: "Tyson Foods — industrial meat processing.",
      HRL: "Hormel — industrial meat processing.",
      BRFS: "BRF — industrial poultry and pork.",
    },
  },
  {
    key: "animal_testing",
    label: "Animal testing",
    blurb: "Cosmetics and contract research involving animal testing.",
    tickers: {
      // Contract research orgs whose core business includes animal studies.
      CRL: "Charles River Labs — preclinical animal research services.",
    },
  },
  {
    key: "private_prisons",
    label: "Private prisons",
    blurb: "For-profit incarceration and detention.",
    tickers: {
      GEO: "GEO Group — private prisons and detention centers.",
      CXW: "CoreCivic — private prisons and detention centers.",
    },
  },
  {
    key: "payday_lending",
    label: "Predatory lending",
    blurb: "High-interest payday, title, and subprime consumer lenders.",
    tickers: {
      WRLD: "World Acceptance — high-interest consumer installment loans.",
      EZPW: "EZCORP — pawn loans.",
      FCFS: "FirstCash — pawn and consumer finance.",
      ENVA: "Enova — online subprime consumer lending.",
      CURO: "CURO Group — payday and title loans.",
      OPRT: "Oportun — subprime consumer lending.",
    },
  },
];

// Fast lookup: TICKER -> [{ key, label, reason }] across every screen, so matching a
// holding is O(1) per screen rather than scanning.
const _index = new Map();
for (const s of SCREENS) {
  for (const [ticker, reason] of Object.entries(s.tickers)) {
    const upper = ticker.toUpperCase();
    if (!_index.has(upper)) _index.set(upper, []);
    _index.get(upper).push({ key: s.key, label: s.label, reason });
  }
}

export const SCREEN_KEYS = SCREENS.map((s) => s.key);
export const isScreenKey = (k) => SCREEN_KEYS.includes(k);

/** All flags that apply to a ticker, filtered to the screens the user turned on. */
export function flagsFor(ticker, activeKeys) {
  if (!ticker) return [];
  const active = new Set(activeKeys);
  return (_index.get(ticker.toUpperCase()) || []).filter((f) => active.has(f.key));
}

/** Public catalogue for the UI (no reason strings — those attach to matches). */
export const screenCatalogue = SCREENS.map(({ key, label, blurb, tickers }) => ({
  key,
  label,
  blurb,
  count: Object.keys(tickers).length,
}));
