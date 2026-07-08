// Clearing-account ledger. Accumulates each user's round-up "spare change" and,
// once it crosses an investment threshold, produces a sweep to be invested.
//
// This is intentionally an in-memory reference implementation with a clean surface,
// so it can later be backed by a real database without changing callers.

import { computeRoundUp } from "./roundup.js";

export class Ledger {
  /**
   * @param {object}  opts
   * @param {number}  opts.thresholdCents  minimum balance before a sweep fires (default $5.00)
   * @param {number}  opts.roundTo         round-up boundary in cents (default $1.00)
   */
  constructor({ thresholdCents = 500, roundTo = 100 } = {}) {
    this.thresholdCents = thresholdCents;
    this.roundTo = roundTo;
    this.balances = new Map();     // userId -> pending spare-change cents
    this.log = [];                 // append-only audit trail
  }

  balanceOf(userId) {
    return this.balances.get(userId) ?? 0;
  }

  /**
   * Record a purchase: compute its round-up and add the spare change to the
   * user's clearing balance. Returns the spare change added and the new balance.
   */
  recordPurchase(userId, amountCents, meta = {}) {
    const spare = computeRoundUp(amountCents, this.roundTo);
    const balance = this.balanceOf(userId) + spare;
    this.balances.set(userId, balance);
    this.log.push({ type: "purchase", userId, amountCents, spare, balance, ts: Date.now(), ...meta });
    return { spare, balance };
  }

  /**
   * If the user's clearing balance has reached the threshold, remove the full
   * balance for investment and reset to zero. Returns the sweep amount, or null
   * if not ready. (Whole balance is swept; nothing is left stranded.)
   */
  sweep(userId) {
    const balance = this.balanceOf(userId);
    if (balance < this.thresholdCents) return null;
    this.balances.set(userId, 0);
    this.log.push({ type: "sweep", userId, amountCents: balance, ts: Date.now() });
    return balance;
  }
}
