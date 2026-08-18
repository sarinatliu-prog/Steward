// Plaid integration — the real bank-transaction feed that replaces the "Make a
// purchase" demo button. Same shape as account-service.js: read creds from env,
// expose a few small async jobs, degrade gracefully when Plaid isn't configured.
//
// Get sandbox creds at https://dashboard.plaid.com → Team Settings → Keys, then
// add to server/.env:
//   PLAID_CLIENT_ID=...
//   PLAID_SECRET=...            (the "sandbox" secret)
//   PLAID_ENV=sandbox           (sandbox | production — Plaid retired Development)
//
// The three original jobs:
//   1. createLinkToken(userId)      — start a bank-linking session (temporary link token)
//   2. exchangePublicToken(token)   — finish the link → a saved access token for that user
//   3. fetchTransactions(access, cursor) — pull new transactions since last time
//
// Plus two for real funding (see server/lib/account-service.js for the Alpaca side):
//   4. listBankAccounts(access)                    — which of the user's bank accounts to fund from
//   5. createAlpacaProcessorToken(access, acctId)   — the official Plaid↔Alpaca funding handshake

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const CLIENT_ID = process.env.PLAID_CLIENT_ID;
const SECRET = process.env.PLAID_SECRET;
// Plaid retired the Development environment; the SDK now exposes only these two.
// This is validated rather than defaulted because the old code did
// `PlaidEnvironments[ENV] ?? PlaidEnvironments.sandbox` — so `PLAID_ENV=production `
// with a stray space, or the long-dead `development`, would silently run against
// SANDBOX while every dashboard and env var claimed production. Fail at boot instead.
const PLAID_ENVS = ["sandbox", "production"];
const ENV = (process.env.PLAID_ENV || "sandbox").trim();
if (!PLAID_ENVS.includes(ENV)) {
  throw new Error(
    `PLAID_ENV="${process.env.PLAID_ENV}" is not valid. Use one of: ${PLAID_ENVS.join(", ")}. ` +
    `(Plaid's "development" environment no longer exists.)`
  );
}

/** True when Plaid is pointed at real banks and real money. */
export function plaidIsLive() {
  return ENV === "production";
}

// Is Plaid wired up? If not, the app keeps using the manual "Make a purchase" button.
export function plaidEnabled() {
  return !!(CLIENT_ID && SECRET && !CLIENT_ID.startsWith("your_"));
}

let _client = null;
function client() {
  if (!plaidEnabled()) throw new Error("Plaid is not configured (set PLAID_CLIENT_ID / PLAID_SECRET).");
  if (_client) return _client;
  const config = new Configuration({
    basePath: PlaidEnvironments[ENV],
    baseOptions: { headers: { "PLAID-CLIENT-ID": CLIENT_ID, "PLAID-SECRET": SECRET } },
  });
  _client = new PlaidApi(config);
  return _client;
}

/**
 * 1. Start a bank-linking session. Returns a short-lived `link_token` the frontend
 *    hands to Plaid Link (the bank-login UI). `userId` ties the session to our user.
 */
export async function createLinkToken(userId) {
  const res = await client().linkTokenCreate({
    user: { client_user_id: String(userId) },
    client_name: "Good Steward",
    // Transactions for the round-up feed; Auth so the SAME Link session can also
    // produce the account/routing data Alpaca needs for real ACH funding later —
    // no second bank-linking popup required.
    products: [Products.Transactions, Products.Auth],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return res.data.link_token;
}

/**
 * 2. Finish the link. Plaid Link returns a one-time `public_token`; we exchange it
 *    for a long-lived `access_token` (the saved connection) to store on the user.
 */
export async function exchangePublicToken(publicToken) {
  const res = await client().itemPublicTokenExchange({ public_token: publicToken });
  return { accessToken: res.data.access_token, itemId: res.data.item_id };
}

/**
 * 3. Fetch new transactions since last time. Uses Plaid's cursor-based /transactions/sync,
 *    so each call returns only what's changed. Pass the previous `cursor` (null the first
 *    time); returns new transactions (normalized to our round-up shape) plus the `cursor`
 *    to persist for next time.
 */
export async function fetchTransactions(accessToken, cursor = null) {
  const added = [];
  let nextCursor = cursor;
  let hasMore = true;
  while (hasMore) {
    const res = await client().transactionsSync({
      access_token: accessToken,
      cursor: nextCursor ?? undefined,
    });
    for (const t of res.data.added) {
      // Only spendable outflows create round-ups (Plaid debits are positive amounts).
      if (t.amount > 0) {
        added.push({
          name: t.merchant_name || t.name || "Purchase",
          category: t.personal_finance_category?.primary || t.category?.[0] || "Other",
          amountCents: Math.round(t.amount * 100),
          ts: new Date(t.date).getTime(),
          plaidId: t.transaction_id,
        });
      }
    }
    nextCursor = res.data.next_cursor;
    hasMore = res.data.has_more;
  }
  return { transactions: added, cursor: nextCursor };
}

/**
 * 4. List the user's bank accounts (checking/savings) so they can pick which one to
 *    fund from — most people have more than one on a single linked Item.
 */
export async function listBankAccounts(accessToken) {
  const res = await client().accountsGet({ access_token: accessToken });
  return (res.data.accounts || []).map((a) => ({
    id: a.account_id,
    name: a.official_name || a.name || "Account",
    mask: a.mask || null,
    subtype: a.subtype || a.type || null,
  }));
}

/**
 * 5. Alpaca can't use a raw Plaid access token — it needs a "processor token" minted
 *    specifically for them. This is the official Plaid↔Alpaca funding handshake.
 *    `accountId` is the Plaid BANK account id (from listBankAccounts), not the Alpaca
 *    brokerage account id.
 */
export async function createAlpacaProcessorToken(accessToken, accountId) {
  const res = await client().processorTokenCreate({
    access_token: accessToken,
    account_id: accountId,
    processor: "alpaca",
  });
  return res.data.processor_token;
}
