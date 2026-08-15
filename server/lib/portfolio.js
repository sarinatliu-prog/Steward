// Per-user round-up pipeline + summary. Operates on a user record's portfolio
// state (stored in db). The broker is shared; the "account key" is the user's
// Alpaca account id when real, else their user id for the simulated broker.

import { computeRoundUp, fromCents } from "./roundup.js";

const THRESHOLD_CENTS = 500; // sweep at $5
const MONTH_MS = 30 * 86_400_000;

function splitByAllocation(total, holdings) {
  const parts = holdings.map((h) => Math.floor((total * h.a) / 100));
  parts[0] += total - parts.reduce((s, x) => s + x, 0);
  return holdings.map((h, i) => ({ symbol: h.symbol, amount: parts[i] }));
}

// The account key passed to broker.invest: real Alpaca account id, or user id.
const acctKey = (user) => user.alpacaAccountId || user.id;

// Invest queued money across the user's chosen ETFs. Fake broker fills instantly;
// real Alpaca leaves the remainder queued if funds haven't settled (403).
async function flushPending(user, broker) {
  if (user.pendingInvestCents <= 0) return;
  const total = user.pendingInvestCents;
  let placed = 0;
  try {
    for (const { symbol, amount } of splitByAllocation(total, user.config.holdings)) {
      if (amount <= 0) continue;
      const order = await broker.invest(acctKey(user), amount, symbol);
      user.investedBySymbol[symbol] = (user.investedBySymbol[symbol] ?? 0) + amount;
      user.investedCents += amount;
      placed += amount;
      user.orders.push({ id: order.id, symbol, notionalCents: amount, status: order.status ?? "accepted", ts: Date.now() });
    }
  } catch (err) {
    if (!String(err.message).includes("insufficient buying power")) {
      console.warn("order attempt failed:", String(err.message).split("\n")[0]);
    }
  } finally {
    user.pendingInvestCents = total - placed;
  }
}

// Record a purchase → round-up → clearing → maybe sweep. On a sweep, the tithe %
// is redirected to the charitable "residue" balance (real, accumulating money
// movement — the soul of the product), and the remainder is invested.
export async function recordPurchase(user, purchase, broker) {
  const spare = computeRoundUp(purchase.amountCents, 100);
  user.clearingCents += spare;
  const tx = { ...purchase, spare };
  if (user.clearingCents >= THRESHOLD_CENTS) {
    const swept = user.clearingCents;
    user.clearingCents = 0;
    const donation = Math.round((swept * (user.config.tithePct || 0)) / 100);
    user.donatedCents = (user.donatedCents ?? 0) + donation;
    // Queue for the real journal to the charitable account (routed by the api layer;
    // simulated brokers route instantly there). donatedCents = total ever set aside,
    // donationRoutedCents = portion actually moved at the broker.
    user.pendingDonationCents = (user.pendingDonationCents ?? 0) + donation;
    const toInvest = swept - donation;
    user.pendingInvestCents += toInvest;
    tx.swept = swept;
    tx.donated = donation;
    await flushPending(user, broker);
  }
  user.transactions.push(tx);
  return tx;
}

export const retryPending = flushPending;

// Rebalance already-invested total into newly chosen holdings.
export function rebalance(user) {
  if (user.investedCents <= 0) return;
  user.investedBySymbol = {};
  for (const { symbol, amount } of splitByAllocation(user.investedCents, user.config.holdings)) {
    user.investedBySymbol[symbol] = amount;
  }
}

function buildGrowth(transactions) {
  const swept = transactions.filter((t) => t.swept).sort((a, b) => a.ts - b.ts);
  if (!swept.length) return [];
  let cum = 0;
  const pts = swept.map((t) => ({ ts: t.ts, cum: (cum += t.swept) }));
  const step = Math.max(1, Math.floor(pts.length / 12));
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return pts.filter((_, i) => i % step === 0 || i === pts.length - 1)
    .map((p) => ({ m: mon[new Date(p.ts).getMonth()], v: p.cum / 100 }));
}

export function summary(user, { mode, alpacaSnapshot, charity } = {}) {
  const monthStart = Date.now() - MONTH_MS;
  const monthTx = user.transactions.filter((t) => t.ts >= monthStart);
  const roundupsThisMonthCents = monthTx.reduce((s, t) => s + t.spare, 0);
  const byCategory = {};
  for (const t of monthTx) byCategory[t.category] = (byCategory[t.category] ?? 0) + t.spare;

  const portfolioValueCents =
    alpacaSnapshot && alpacaSnapshot.positionValueCents > 0 ? alpacaSnapshot.positionValueCents : user.investedCents;
  const annualDonationCents = Math.round((roundupsThisMonthCents * 12 * user.config.tithePct) / 100);

  // Real funding fields. `?? []`/`?? null` because users created before this shipped
  // won't have them on their stored record.
  const cashCents = alpacaSnapshot?.cashCents ?? 0;
  const transfers = user.transfers ?? [];
  const pendingDepositCents = transfers
    .filter((t) => t.direction === "INCOMING" && !["FILLED", "COMPLETE", "SETTLED", "CANCELED", "REJECTED", "RETURNED"].includes(String(t.status).toUpperCase()))
    .reduce((s, t) => s + t.amountCents, 0);

  return {
    mode: mode ?? "fake",
    etf: user.config.holdings[0]?.symbol ?? "ESGV",
    account: user.alpacaAccountId ? user.alpacaAccountId.slice(0, 8) + "…" : null,
    accountLinked: !!user.alpacaAccountId,
    config: user.config,
    investedCents: user.investedCents,
    pendingInvestCents: user.pendingInvestCents,
    portfolioValueCents,
    clearingBalanceCents: user.clearingCents,
    donatedCents: user.donatedCents ?? 0,
    donationRoutedCents: user.donationRoutedCents ?? 0,
    donationPendingCents: user.pendingDonationCents ?? 0,
    charity: charity ?? null,
    roundupsThisMonthCents,
    annualDonationCents,
    ordersPlaced: user.orders.length,
    txCount: user.transactions.length,
    // Real funding: the user's own cash (from Alpaca), whether a funding bank is
    // linked, and their recent transfers for the deposit/withdraw screen.
    cashCents,
    achLinked: !!user.achRelationshipId,
    bankName: user.bankName ?? null,
    pendingDepositCents,
    transfers: transfers.slice(-20).reverse().map((t) => ({
      id: t.id, direction: t.direction, status: t.status,
      amountCents: t.amountCents, display: fromCents(t.amountCents), ts: t.ts,
    })),
    holdings: user.config.holdings.map((h) => ({
      symbol: h.symbol, targetPct: h.a,
      investedCents: user.investedBySymbol[h.symbol] ?? 0,
      investedDisplay: fromCents(user.investedBySymbol[h.symbol] ?? 0),
    })),
    growth: buildGrowth(user.transactions),
    byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1])
      .map(([category, cents]) => ({ category, cents, display: fromCents(cents) })),
    recent: user.transactions.slice(-8).reverse().map((t) => ({
      name: t.name, category: t.category, amount: fromCents(t.amountCents),
      spare: fromCents(t.spare), ts: t.ts, swept: t.swept ? fromCents(t.swept) : null,
    })),
    display: {
      portfolioValue: fromCents(portfolioValueCents),
      invested: fromCents(user.investedCents),
      pending: user.pendingInvestCents > 0 ? fromCents(user.pendingInvestCents) : null,
      clearing: fromCents(user.clearingCents),
      donated: fromCents(user.donatedCents ?? 0),
      roundupsThisMonth: fromCents(roundupsThisMonthCents),
      annualDonation: fromCents(annualDonationCents),
      cash: fromCents(cashCents),
      pendingDeposit: pendingDepositCents > 0 ? fromCents(pendingDepositCents) : null,
    },
  };
}
