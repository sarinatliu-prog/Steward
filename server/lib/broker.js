// Broker abstraction. The rest of the app talks to this interface, never to Alpaca
// directly — so we can develop/test against a fake and swap in the real Alpaca
// Broker API client with zero changes to the round-up/ledger logic.

import { fromCents } from "./roundup.js";

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

/**
 * Real Alpaca Broker API client — same interface as FakeBroker.
 * Placeholder until the sandbox keys authenticate; the shape is ready so the
 * swap is a one-liner (new AlpacaBroker(...) instead of new FakeBroker()).
 */
export class AlpacaBroker {
  constructor({ keyId, secret, baseUrl = "https://broker-api.sandbox.alpaca.markets" }) {
    if (!keyId || !secret) throw new Error("AlpacaBroker requires keyId and secret");
    this.baseUrl = baseUrl;
    this.auth = "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64");
  }

  async #req(method, path, body) {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: { Authorization: this.auth, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Alpaca ${method} ${path} -> ${res.status}: ${await res.text()}`);
    return res.json();
  }

  /** Place a fractional notional buy of `symbol` for the user's brokerage account. */
  async invest(accountId, amountCents, symbol) {
    return this.#req("POST", `/v1/trading/accounts/${accountId}/orders`, {
      symbol,
      notional: fromCents(amountCents).replace("$", ""),
      side: "buy",
      type: "market",
      time_in_force: "day",
    });
  }
}
