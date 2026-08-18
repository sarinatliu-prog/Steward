// The analyzer — match a user's holdings against the ethical screens they turned on.
//
// Two kinds of match:
//   • a STOCK you hold directly is flagged if it's on a screen you enabled;
//   • a FUND you hold is looked into (for the funds we know — see funds.js) and we
//     surface the flagged companies inside it.
//
// Pure function of (positions, activeScreenKeys). No network, no state.

import { flagsFor, companyName, SCREEN_KEYS } from "./screens.js";
import { knownFund } from "./funds.js";

/**
 * Analyze a single ticker against ALL screens — for the public, no-login hero widget.
 * A visitor hasn't chosen screens, so we surface everything we'd flag.
 * Returns { type: "fund" | "stock" | "none", ... }.
 */
export function lookupSymbol(symbol) {
  const sym = String(symbol || "").trim().toUpperCase();
  if (!sym) return null;
  const fund = knownFund(sym);
  if (fund) {
    const contains = [];
    for (const t of fund.holds) {
      const fl = flagsFor(t, SCREEN_KEYS);
      if (fl.length) contains.push({ ticker: t, name: companyName(t), flags: fl });
    }
    return { symbol: sym, type: "fund", name: fund.name, basis: fund.basis, contains };
  }
  const flags = flagsFor(sym, SCREEN_KEYS);
  if (flags.length) return { symbol: sym, type: "stock", name: companyName(sym), flags };
  return { symbol: sym, type: "none" };
}

const distinctLabels = (contains) => {
  const seen = new Map();
  for (const c of contains) for (const f of c.flags) if (!seen.has(f.key)) seen.set(f.key, { key: f.key, label: f.label });
  return [...seen.values()];
};

export function analyze(positions, activeKeys) {
  const holdings = positions.map((p) => {
    // Direct stock holding.
    if (p.kind === "stock") {
      const flags = flagsFor(p.symbol, activeKeys);
      return { ...p, type: "stock", flags, analyzable: true, conflicted: flags.length > 0 };
    }
    // Fund: look inside if we know its constituents, otherwise leave it opaque.
    if (p.kind === "etf" || p.kind === "mutualfund") {
      const fund = knownFund(p.symbol);
      if (fund) {
        const contains = [];
        for (const t of fund.holds) {
          const fl = flagsFor(t, activeKeys);
          if (fl.length) contains.push({ ticker: t, name: companyName(t), flags: fl });
        }
        return { ...p, type: "fund", fundBasis: fund.basis, contains,
          flags: distinctLabels(contains), analyzable: true, lookThrough: true, conflicted: contains.length > 0 };
      }
      return { ...p, type: "fund", analyzable: false, contains: [], flags: [], conflicted: false };
    }
    // Crypto, options, cash, anything else — not screened.
    return { ...p, type: p.kind, analyzable: false, flags: [], conflicted: false };
  });

  const stocks = holdings.filter((h) => h.type === "stock");
  const funds = holdings.filter((h) => h.type === "fund");
  const conflictedStocks = stocks.filter((h) => h.conflicted);
  const conflictedFunds = funds.filter((h) => h.conflicted);

  const totalValueCents = holdings.reduce((s, h) => s + h.valueCents, 0);
  // Dollar attribution is only honest for direct stocks — we don't have per-name
  // weights inside a fund, so we count fund conflicts by company, not by dollar.
  const directConflictValueCents = conflictedStocks.reduce((s, h) => s + h.valueCents, 0);

  // Per-flag rollup: dollars from direct stocks, plus a count of fund-held companies.
  const byFlag = {};
  const bump = (key, label) => (byFlag[key] ??= { key, label, valueCents: 0, directHoldings: 0, fundCompanies: 0 });
  for (const h of conflictedStocks) for (const f of h.flags) { const b = bump(f.key, f.label); b.valueCents += h.valueCents; b.directHoldings += 1; }
  for (const h of conflictedFunds) for (const c of h.contains) for (const f of c.flags) { const b = bump(f.key, f.label); b.fundCompanies += 1; }

  const analyzedFunds = funds.filter((h) => h.lookThrough).length;
  const opaqueFunds = funds.filter((h) => !h.analyzable).length;

  return {
    holdings,
    conflictedStocks,
    conflictedFunds,
    summary: {
      totalHoldings: holdings.length,
      analyzedStocks: stocks.length,
      analyzedFunds,        // funds we could see inside
      opaqueFunds,          // funds we couldn't (not analyzed)
      directConflictCount: conflictedStocks.length,
      fundConflictCount: conflictedFunds.length,
      totalValueCents,
      directConflictValueCents,
      directConflictPct: totalValueCents ? Math.round((directConflictValueCents / totalValueCents) * 100) : 0,
      byFlag: Object.values(byFlag).sort((a, b) => (b.valueCents - a.valueCents) || (b.fundCompanies - a.fundCompanies)),
    },
  };
}
