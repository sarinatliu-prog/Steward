// SnapTrade — read-only brokerage connection.
//
// We never place orders and never move money. We register a user, hand them a
// connection portal to link their own brokerage, then read their positions. That is
// the whole surface: connect, read, analyze.
//
// Auth is a commercial API key (clientId + consumerKey). The consumerKey is a secret
// and lives only in server/.env. Get keys at https://dashboard.snaptrade.com.
//
// The SDK signs each request with HMAC-SHA256 over the path, query, and body — getting
// that by hand is the classic SnapTrade time-sink, so we lean on the official client.

import { Snaptrade } from "snaptrade-typescript-sdk";

const CLIENT_ID = process.env.SNAPTRADE_CLIENT_ID;
const CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY;

export function snaptradeEnabled() {
  return !!(CLIENT_ID && CONSUMER_KEY);
}

let _client = null;
function client() {
  if (!snaptradeEnabled()) {
    throw new Error("SnapTrade is not configured (set SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY).");
  }
  if (_client) return _client;
  _client = new Snaptrade({
    auth: { mode: "commercialApiKey", clientId: CLIENT_ID, consumerKey: CONSUMER_KEY },
  });
  return _client;
}

/**
 * Register a SnapTrade user. Returns { userId, userSecret }. The userSecret is issued
 * once and can never be retrieved again — it is a credential and must be stored (and,
 * in production, encrypted at rest). We key the SnapTrade user off our own user id.
 */
export async function registerUser(ourUserId) {
  const res = await client().authentication.registerSnapTradeUser({ userId: String(ourUserId) });
  return { userId: res.data.userId, userSecret: res.data.userSecret };
}

/**
 * Start a connection session. Returns the portal URL to send the user to; they pick
 * their brokerage and authorize there, on SnapTrade's domain, never ours.
 * `connectionType: "read"` keeps this explicitly read-only — no trade authority.
 */
export async function connectionPortalUrl(userId, userSecret, { redirect } = {}) {
  const res = await client().authentication.loginSnapTradeUser({
    userId: String(userId),
    userSecret,
    connectionType: "read",
    ...(redirect ? { customRedirect: redirect } : {}),
  });
  // The SDK returns either { redirectURI } (login) or an encrypted payload; we only
  // ever request the redirect form.
  return res.data?.redirectURI ?? null;
}

/** List the brokerage accounts the user has connected. */
export async function listAccounts(userId, userSecret) {
  const res = await client().accountInformation.listUserAccounts({ userId: String(userId), userSecret });
  return (res.data || []).map((a) => ({
    id: a.id,
    name: a.name,
    number: a.number,
    institution: a.institution_name,
  }));
}

/**
 * Every position across every connected account, normalized to the few fields the
 * analyzer needs. One entry per holding; `account` labels which account it's in.
 */
export async function allPositions(userId, userSecret) {
  const c = client();
  const accounts = await listAccounts(userId, userSecret);
  const out = [];
  for (const acct of accounts) {
    let results = [];
    try {
      const res = await c.accountInformation.getAllAccountPositions({
        userId: String(userId),
        userSecret,
        accountId: acct.id,
      });
      results = res.data?.results || [];
    } catch {
      // A single account failing to sync shouldn't blank the whole analysis.
      continue;
    }
    for (const p of results) {
      const inst = p.instrument || {};
      const units = Number(p.units) || 0;
      const price = Number(p.price) || 0;
      out.push({
        account: acct.name,
        symbol: inst.symbol || inst.raw_symbol || null,
        description: inst.description || null,
        kind: inst.kind || "unknown", // stock | etf | mutualfund | crypto | option
        units,
        price,
        valueCents: Math.round(units * price * 100),
      });
    }
  }
  return { accounts, positions: out };
}
