// The analyzer — match a user's holdings against the ethical screens they turned on.
//
// Pure function of (positions, activeScreenKeys). No network, no state, so it's trivial
// to test and the server route stays thin.

import { flagsFor } from "./screens.js";

/**
 * @param {Array} positions  normalized holdings from snaptrade.allPositions()
 * @param {string[]} activeKeys  screen keys the user enabled
 * @returns analysis: per-holding flags plus portfolio-level totals
 */
export function analyze(positions, activeKeys) {
  const holdings = positions.map((p) => {
    const flags = p.kind === "stock" || p.kind === "etf" ? flagsFor(p.symbol, activeKeys) : [];
    // We only make per-name claims about individual stocks (and, cautiously, ETFs by
    // ticker). Funds are holdings-of-holdings; we don't claim to see inside a broad
    // index fund, so an unflagged fund is "not analyzed", not "clean".
    const analyzable = p.kind === "stock";
    return { ...p, flags, analyzable, conflicted: flags.length > 0 };
  });

  const conflicted = holdings.filter((h) => h.conflicted);
  const totalValueCents = holdings.reduce((s, h) => s + h.valueCents, 0);
  const conflictedValueCents = conflicted.reduce((s, h) => s + h.valueCents, 0);

  // How many distinct flags were hit, and the value exposed to each — the useful
  // summary line ("$2,140 in fossil fuels across 2 holdings").
  const byFlag = {};
  for (const h of conflicted) {
    for (const f of h.flags) {
      byFlag[f.key] ??= { key: f.key, label: f.label, valueCents: 0, holdings: 0 };
      byFlag[f.key].valueCents += h.valueCents;
      byFlag[f.key].holdings += 1;
    }
  }

  const analyzedCount = holdings.filter((h) => h.analyzable).length;
  const fundCount = holdings.filter((h) => h.kind === "etf" || h.kind === "mutualfund").length;

  return {
    holdings,
    conflicted,
    summary: {
      totalHoldings: holdings.length,
      analyzedCount,       // individual stocks we could actually screen
      fundCount,           // funds we flagged only if a tracked ETF ticker matched
      conflictedCount: conflicted.length,
      totalValueCents,
      conflictedValueCents,
      conflictedPct: totalValueCents ? Math.round((conflictedValueCents / totalValueCents) * 100) : 0,
      byFlag: Object.values(byFlag).sort((a, b) => b.valueCents - a.valueCents),
    },
  };
}
