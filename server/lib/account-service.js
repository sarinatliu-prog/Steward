// Creates a real Alpaca SANDBOX brokerage account from a user's profile, and
// funds it (virtual ACH). Sandbox only — no real person, no real money — but it
// exercises the exact Broker API calls a production onboarding would.

import { authFromEnv, makeRequester } from "./alpaca-auth.js";

// Is Alpaca wired up? (creds present) — if not, the app runs in simulated mode.
export function alpacaEnabled() {
  try { authFromEnv(); return true; } catch { return false; }
}

function requester() {
  const { auth, baseUrl } = authFromEnv();
  return makeRequester(auth, baseUrl);
}

// Build the KYC/account payload from the user's onboarding profile. Sandbox
// tolerates synthetic values; a unique email + tax id avoids collisions.
function accountPayload(profile) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();
  const ssn = profile.taxId || `${100 + (stamp % 800)}-${10 + (stamp % 80)}-${1000 + (stamp % 9000)}`;
  return {
    contact: {
      email_address: `steward.user+${stamp}@example.com`, // synthetic to avoid sandbox dupes
      phone_number: profile.phone || "5556667777",
      street_address: [profile.address || "123 Steward Way"],
      city: profile.city || "San Mateo",
      state: profile.state || "CA",
      postal_code: profile.postal || "94401",
      country: "USA",
    },
    identity: {
      given_name: profile.firstName || "Steward",
      family_name: profile.lastName || "User",
      date_of_birth: profile.dob || "1990-01-01",
      tax_id: ssn,
      tax_id_type: "USA_SSN",
      country_of_citizenship: "USA",
      country_of_birth: "USA",
      country_of_tax_residence: "USA",
      funding_source: ["employment_income"],
    },
    disclosures: {
      is_control_person: false,
      is_affiliated_exchange_or_finra: false,
      is_politically_exposed: false,
      immediate_family_exposed: false,
    },
    agreements: [{ agreement: "customer_agreement", signed_at: now, ip_address: "127.0.0.1" }],
  };
}

// Create the account. Returns { id, accountNumber, status }.
export async function createBrokerageAccount(profile) {
  const req = requester();
  const account = await req("POST", "/v1/accounts", accountPayload(profile));
  return { id: account.id, accountNumber: account.account_number, status: account.status };
}

// ── Funding ───────────────────────────────────────────────────────────────────
//
// Two ways to give a new sandbox account buying power:
//
//   1. JOURNAL (JNLC) from the firm/sweep account — INSTANT. Every sandbox partner
//      gets a firm account pre-funded with $50k. This is also how real apps do
//      "instant funding" (cash pooling), so it's not a demo hack.
//   2. ACH transfer — realistic, but sandbox simulates the bank delay, so the cash
//      takes 10–30 MINUTES to settle. Until then every order is rejected with
//      "insufficient buying power" and nothing shows up in Alpaca.
//
// We try the journal first and fall back to ACH. That's the difference between a
// user's first round-up landing a real order in seconds vs. half an hour.
//
// Note: JNLC has a daily limit (default ~$1,000/day across ALL journals), so we
// fund a modest $100 per user — plenty for $5 round-up sweeps, and it lets ~10
// users onboard per day. Raise ALPACA_FUND_AMOUNT at your own risk.

const FUND_AMOUNT = Number(process.env.ALPACA_FUND_AMOUNT ?? 100);

let firmAccountCache = process.env.ALPACA_FIRM_ACCOUNT_ID || null;
let firmLookupDone = false;

/**
 * The firm ("sweep") account we journal cash from. Set ALPACA_FIRM_ACCOUNT_ID to
 * skip discovery — you can copy it from the Broker dashboard's "Firm Balance" tab,
 * or run `node --env-file=server/.env server/alpaca-find-firm.mjs`.
 */
export async function getFirmAccountId() {
  if (firmAccountCache) return firmAccountCache;
  if (firmLookupDone) return null;
  firmLookupDone = true;
  try {
    const req = requester();
    const accounts = await req("GET", "/v1/accounts");
    const firm = (Array.isArray(accounts) ? accounts : []).find(
      (a) => a.account_type === "firm" || a.account_type === "sweep"
    );
    if (firm) firmAccountCache = firm.id;
  } catch { /* discovery is best-effort */ }
  return firmAccountCache;
}

/** Instant funding: journal cash from the firm account into the user's account. */
async function journalFund(accountId, amount) {
  const firm = await getFirmAccountId();
  if (!firm) throw new Error("no firm account id (set ALPACA_FIRM_ACCOUNT_ID)");
  const req = requester();
  const journal = await req("POST", "/v1/journals", {
    from_account: firm,
    to_account: accountId,
    entry_type: "JNLC",
    amount: String(amount),
    description: "Steward onboarding credit (sandbox)",
  });
  return { method: "journal", status: journal.status, id: journal.id };
}

/** Realistic but slow: virtual ACH. Sandbox delays settlement by 10–30 minutes. */
async function achFund(accountId, amount) {
  const req = requester();
  let relId;
  try {
    const rel = await req("POST", `/v1/accounts/${accountId}/ach_relationships`, {
      account_owner_name: "Steward User", bank_account_type: "CHECKING",
      bank_account_number: "32131231abc", bank_routing_number: "121000358", nickname: "Sandbox Checking",
    });
    relId = rel.id;
  } catch {
    const rels = await req("GET", `/v1/accounts/${accountId}/ach_relationships`);
    relId = (Array.isArray(rels) ? rels[0] : null)?.id;
  }
  if (!relId) throw new Error("no ACH relationship");
  const transfer = await req("POST", `/v1/accounts/${accountId}/transfers`, {
    transfer_type: "ach", relationship_id: relId, amount: String(amount), direction: "INCOMING",
  });
  return { method: "ach", status: transfer.status, id: transfer.id };
}

/**
 * Fund a new sandbox account. Journal first (instant), ACH as fallback.
 * Returns { method, status, id } so callers can tell the user which happened.
 */
export async function fundAccount(accountId, amount = FUND_AMOUNT) {
  try {
    return await journalFund(accountId, amount);
  } catch (journalErr) {
    try {
      const res = await achFund(accountId, amount);
      console.warn(
        `funding: journal unavailable (${String(journalErr.message).split("\n")[0]}) — ` +
        `fell back to ACH, which takes 10–30 min to settle.`
      );
      return res;
    } catch (achErr) {
      throw new Error(
        `funding failed. journal: ${String(journalErr.message).split("\n")[0]} | ` +
        `ach: ${String(achErr.message).split("\n")[0]}`
      );
    }
  }
}

/** Current status of an account (e.g. SUBMITTED, ACTIVE). null on error. */
export async function getAccountStatus(accountId) {
  try {
    const req = requester();
    const a = await req("GET", `/v1/accounts/${accountId}`);
    return a.status ?? null;
  } catch {
    return null;
  }
}

/**
 * Journal-fund a NEW account, but only once Alpaca has moved it to ACTIVE.
 * Freshly created sandbox accounts sit in SUBMITTED for a bit and reject journals
 * with "account's statuses are inadequate for cash journaling". So instead of
 * blocking onboarding (or falling back to slow ACH), we no-op until the account is
 * ACTIVE — a background loop calls this again until it succeeds. Instant once ready.
 *
 * Returns the journal result, or { method: "pending", ... } if not fundable yet.
 */
export async function fundIfActive(accountId, amount = FUND_AMOUNT) {
  const status = await getAccountStatus(accountId);
  if (status !== "ACTIVE") {
    return { method: "pending", status: "awaiting_activation", accountStatus: status };
  }
  try {
    return await journalFund(accountId, amount);
  } catch (e) {
    return { method: "pending", status: "journal_error", error: String(e.message).split("\n")[0] };
  }
}
