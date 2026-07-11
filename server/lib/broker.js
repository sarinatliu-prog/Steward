// Broker abstraction. The rest of the app talks to this interface, never to Alpaca
// directly — so we can develop/test against a fake and swap in the real Alpaca
// Broker API client with zero changes to the round-up/ledger logic.

import { fromCents } from "./roundup.js";
import { AlpacaAuth, makeRequester } from "./alpaca-auth.js";

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
 *
 * AUTH NOTE: Alpaca's Broker API now issues "Client Secret" credentials, which use
 * the OAuth2 client-credentials flow: exchange client id + secret for a short-lived
 * access token, then send `Authorization: Bearer <token>`. The older Basic-auth
 * ("legacy") flow returns 401 for these credentials. AlpacaAuth handles the token
 * exchange and caching for us. See lib/alpaca-auth.js.
 */
export class AlpacaBroker {
  /**
   * @param {object} opts
   * @param {string} opts.clientId      - CLIENT ID from the Broker dashboard
   * @param {string} opts.clientSecret  - the secret shown once at generation
   * @param {string} [opts.baseUrl]     - Broker API host (sandbox by default)
   * @param {string} [opts.authUrl]     - auth host (sandbox by default)
   * @param {AlpacaAuth} [opts.auth]    - pass a pre-built auth object instead
   */
  constructor({ clientId, clientSecret, baseUrl = "https://broker-api.sandbox.alpaca.markets", authUrl, auth } = {}) {
    this.baseUrl = baseUrl;
    this.auth = auth ?? new AlpacaAuth({ clientId, clientSecret, ...(authUrl ? { authUrl } : {}) });
    this.req = makeRequester(this.auth, this.baseUrl);
  }

  /** Place a fractional notional buy of `symbol` for the user's brokerage account. */
  async invest(accountId, amountCents, symbol) {
    return this.req("POST", `/v1/trading/accounts/${accountId}/orders`, {
      symbol,
      notional: fromCents(amountCents).replace("$", ""),
      side: "buy",
      type: "market",
      time_in_force: "day",
    });
  }

  /** Total cents invested in `symbol` for an account (from Alpaca's real position). */
  async positionOf(accountId, symbol) {
    try {
      const pos = await this.req("GET", `/v1/trading/accounts/${accountId}/positions/${symbol}`);
      return Math.round(Number(pos.cost_basis ?? 0) * 100);
    } catch (err) {
      if (String(err.message).includes("404")) return 0; // no position yet
      throw err;
    }
  }

  /** Orders placed for an account. */
  async listOrders(accountId) {
    return this.req("GET", `/v1/trading/accounts/${accountId}/orders?status=all`);
  }
}
