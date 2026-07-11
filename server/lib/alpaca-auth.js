// Alpaca OAuth2 "client credentials" authentication.
//
// WHY THIS EXISTS:
// Alpaca's Broker API has two auth flows. The OLD ("legacy") one sent your key and
// secret directly as HTTP Basic auth. The NEW one — which is what the Broker
// dashboard now issues credentials for (TYPE: "Client Secret") — requires you to
// FIRST exchange your client id + secret for a short-lived access token at a
// separate auth server, then send `Authorization: Bearer <token>` on every call.
//
// Using Basic auth with a "Client Secret" credential returns 401 forever, with no
// helpful error message. That was the bug that stalled this project.
//
// Docs: https://docs.alpaca.markets/us/docs/authentication
//   sandbox auth host: https://authx.sandbox.alpaca.markets
//   live auth host:    https://authx.alpaca.markets
//   token endpoint:    POST /v1/oauth2/token  (form-encoded, client_secret_post)
//   tokens last ~15 minutes ("expires_in": 899)

const DEFAULT_AUTH_URL = "https://authx.sandbox.alpaca.markets";

export class AlpacaAuth {
  /**
   * @param {object} opts
   * @param {string} opts.clientId      - the "CLIENT ID" from the Broker dashboard (starts with CK)
   * @param {string} opts.clientSecret  - the secret shown once when you generated the key
   * @param {string} [opts.authUrl]     - auth host (sandbox by default)
   */
  constructor({ clientId, clientSecret, authUrl = DEFAULT_AUTH_URL }) {
    if (!clientId || !clientSecret) {
      throw new Error("AlpacaAuth requires clientId and clientSecret");
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.authUrl = authUrl;

    this._token = null;
    this._expiresAt = 0; // epoch ms
  }

  /**
   * Return a valid access token, fetching a new one only when needed.
   * Alpaca explicitly says: do NOT request a new token for every API call.
   */
  async token() {
    // Refresh 60s early so a token can't expire mid-request.
    if (this._token && Date.now() < this._expiresAt - 60_000) {
      return this._token;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(`${this.authUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Alpaca token request failed (${res.status}): ${text}\n` +
          `  Auth host: ${this.authUrl}\n` +
          `  Check that your client id/secret are correct and match this environment.`
      );
    }

    const json = JSON.parse(text);
    if (!json.access_token) {
      throw new Error(`Alpaca token response had no access_token: ${text}`);
    }

    this._token = json.access_token;
    this._expiresAt = Date.now() + (json.expires_in ?? 899) * 1000;
    return this._token;
  }

  /** Authorization header value, e.g. "Bearer eyJhb…". */
  async authHeader() {
    return `Bearer ${await this.token()}`;
  }
}

/**
 * Build a small request helper bound to an auth object + base URL.
 * Returns json (or {} for empty bodies) and throws a useful error otherwise.
 */
export function makeRequester(auth, baseUrl) {
  return async function req(method, path, body) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        Authorization: await auth.authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Alpaca ${method} ${path} -> ${res.status}: ${text} ` +
          `(X-Request-ID: ${res.headers.get("x-request-id") ?? "n/a"})`
      );
    }
    return text ? JSON.parse(text) : {};
  };
}

/** Read credentials from env, accepting both new and old variable names. */
export function authFromEnv() {
  const clientId = process.env.ALPACA_CLIENT_ID ?? process.env.ALPACA_API_KEY_ID;
  const clientSecret = process.env.ALPACA_CLIENT_SECRET ?? process.env.ALPACA_API_SECRET_KEY;
  const authUrl = process.env.ALPACA_AUTH_URL ?? DEFAULT_AUTH_URL;
  const baseUrl = process.env.ALPACA_BASE_URL ?? "https://broker-api.sandbox.alpaca.markets";

  if (!clientId || !clientSecret || clientId.startsWith("your_")) {
    throw new Error(
      "No Alpaca credentials found. Copy .env.example to .env and fill in your\n" +
        "  Broker dashboard CLIENT ID and CLIENT SECRET."
    );
  }
  return { auth: new AlpacaAuth({ clientId, clientSecret, authUrl }), baseUrl, authUrl, clientId };
}
