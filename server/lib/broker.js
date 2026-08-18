// Broker abstraction — the round-up/ledger engine talks to this interface, never to a
// broker directly. Kept for the future giving/investing work; only the in-memory
// FakeBroker is wired today. The analyzer itself does not place orders.


/**
 * @typedef {Object} Broker
 * @property {(userId: string, amountCents: number, symbol: string) => Promise<object>} invest
 */

/** In-memory fake broker for local dev — mimics fractional ETF buys, no network. */
export class FakeBroker {
  constructor() {
    this.orders = [];               // recorded "orders"
    this.positions = new Map();     // `${userId}:${symbol}` -> cents invested
  }

  async invest(userId, amountCents, symbol) {
    const key = `${userId}:${symbol}`;
    this.positions.set(key, (this.positions.get(key) ?? 0) + amountCents);
    const order = {
      id: `fake_${this.orders.length + 1}`,
      userId, symbol,
      notional: (amountCents / 100).toFixed(2),
      status: "filled",
      ts: Date.now(),
    };
    this.orders.push(order);
    return order;
  }

  positionOf(userId, symbol) {
    return this.positions.get(`${userId}:${symbol}`) ?? 0;
  }
}
