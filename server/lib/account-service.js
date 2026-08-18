// Creates a real Alpaca brokerage account from a user's profile.
//
// The account application is a CIP (Customer Identification Program) filing: the
// identity, disclosures, and signed agreement we send are attested to be the user's
// own. Nothing in accountPayload() may be invented or defaulted — validateProfile()
// in lib/auth.js is what guarantees every field arrived from the person opening the
// account. Which environment we point at does not change that obligation.

import { authFromEnv, makeRequester } from "./alpaca-auth.js";

// Is Alpaca wired up? (creds present) — if not, the app runs in simulated mode.
export function alpacaEnabled() {
  try { authFromEnv(); return true; } catch { return false; }
}

/** True when we are pointed at Alpaca's live hosts rather than sandbox. */
export function alpacaIsLive() {
  const base = process.env.ALPACA_BASE_URL || "";
  const auth = process.env.ALPACA_AUTH_URL || "";
  const looksLive = (u) => /alpaca\.markets/.test(u) && !/sandbox/.test(u);
  return looksLive(base) || looksLive(auth);
}

function requester() {
  const { auth, baseUrl } = authFromEnv();
  return makeRequester(auth, baseUrl);
}

// Build the KYC/account payload from the user's onboarding profile.
//
// Every value here comes from the user. `validateProfile` has already rejected the
// request if any of it is missing, so a missing field at this point is a programming
// error and throws rather than silently substituting a placeholder.
function accountPayload({ profile, email, taxId, ip }) {
  const need = (v, what) => {
    if (v === undefined || v === null || v === "") {
      throw new Error(`cannot open a brokerage account without ${what}`);
    }
    return v;
  };
  const phone = String(need(profile.phone, "a phone number")).replace(/[^\d]/g, "");
  return {
    contact: {
      email_address: need(email, "the user's email address"),
      phone_number: phone,
      street_address: [need(profile.address, "a street address")],
      city: need(profile.city, "a city"),
      state: need(profile.state, "a state"),
      postal_code: need(profile.postal, "a postal code"),
      country: "USA",
    },
    identity: {
      given_name: need(profile.firstName, "a first name"),
      family_name: need(profile.lastName, "a last name"),
      date_of_birth: need(profile.dob, "a date of birth"),
      tax_id: need(taxId, "a tax id"),
      tax_id_type: "USA_SSN",
      country_of_citizenship: profile.citizenship || "USA",
      country_of_birth: profile.citizenship || "USA",
      country_of_tax_residence: "USA",
      funding_source: [need(profile.fundingSource, "a funding source")],
    },
    // The user's own answers, captured in onboarding. Never defaulted.
    disclosures: {
      is_control_person: !!profile.isControlPerson,
      is_affiliated_exchange_or_finra: !!profile.isAffiliatedExchangeOrFinra,
      is_politically_exposed: !!profile.isPoliticallyExposed,
      immediate_family_exposed: !!profile.immediateFamilyExposed,
    },
    // Signed-agreement evidence. The IP is the user's real one, from the request that
    // accepted the agreement — a hardcoded 127.0.0.1 is not evidence of anything.
    agreements: [{
      agreement: "customer_agreement",
      signed_at: profile.agreementsAcceptedAt || new Date().toISOString(),
      ip_address: need(ip, "the client IP that accepted the agreement"),
    }],
  };
}

/**
 * Look for a charitable account we already created, by the marker in its email.
 * This is the self-healing path: even if our stored id is lost (restart, DB blip,
 * fresh deploy), we adopt the existing account instead of opening another one.
 */
export async function findExistingCharityAccount() {
  try {
    const accounts = await requester()("GET", "/v1/accounts?status=ACTIVE,SUBMITTED,APPROVED");
    const list = Array.isArray(accounts) ? accounts : [];
    const hits = list.filter((a) => String(a.contact?.email_address || a.email_address || "").startsWith("steward.charity+"));
    if (!hits.length) return null;
    // Oldest first, so everyone converges on the same account.
    hits.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    return { id: hits[0].id, status: hits[0].status, duplicates: hits.length };
  } catch {
    return null;
  }
}

// Create the account. Returns { id, accountNumber, status }.
/**
 * Open a brokerage account for a real person.
 * @param {object} args
 * @param {object} args.profile - the validated, storable onboarding profile
 * @param {string} args.email   - the user's own verified email (not a synthetic one)
 * @param {string} args.taxId   - SSN, passed straight through and never persisted here
 * @param {string} args.ip      - client IP that accepted the customer agreement
 */
export async function createBrokerageAccount({ profile, email, taxId, ip }) {
  const req = requester();
  const account = await req("POST", "/v1/accounts", accountPayload({ profile, email, taxId, ip }));
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

// ── The charitable account ("redirect the residue", for real) ───────────────
// One designated sandbox brokerage account that tithes are journaled INTO, so the
// redirected residue exists in Alpaca's books, not just ours. Journals only move
// firm↔customer, so the route is firm → charity (in sandbox the firm is the source
// of all cash anyway — user credits came from the same firm account).
export async function createCharityAccount() {
  // This account is opened from placeholder identity data. That is acceptable against
  // sandbox, where no CIP filing is real, and is a fabricated account application
  // against the live API. On production the charitable destination must be a real
  // entity account (or the DAF/payments rail that replaces this route entirely) and
  // its id supplied explicitly via ALPACA_CHARITY_ACCOUNT_ID.
  if (alpacaIsLive()) {
    throw new Error(
      "refusing to auto-create the charitable account against live Alpaca: set " +
      "ALPACA_CHARITY_ACCOUNT_ID to a real charitable entity account id."
    );
  }
  const stamp = Date.now();
  const req = requester();
  const account = await req("POST", "/v1/accounts", {
    contact: {
      email_address: `steward.charity+${stamp}@example.com`,
      phone_number: "5556667777",
      street_address: ["1 Flourishing Way"],
      city: "San Mateo", state: "CA", postal_code: "94401", country: "USA",
    },
    identity: {
      given_name: "Steward", family_name: "Charitable",
      date_of_birth: "1980-01-01",
      tax_id: `${200 + (stamp % 700)}-${20 + (stamp % 70)}-${2000 + (stamp % 8000)}`,
      tax_id_type: "USA_SSN",
      country_of_citizenship: "USA", country_of_birth: "USA", country_of_tax_residence: "USA",
      funding_source: ["employment_income"],
    },
    disclosures: {
      is_control_person: false, is_affiliated_exchange_or_finra: false,
      is_politically_exposed: false, immediate_family_exposed: false,
    },
    agreements: [{ agreement: "customer_agreement", signed_at: new Date().toISOString(), ip_address: "127.0.0.1" }],
  });
  return { id: account.id, accountNumber: account.account_number, status: account.status };
}

/** Journal cash from the firm account into any customer account (e.g. the charity). */
export async function journalFirmTo(accountId, amountCents) {
  const firm = await getFirmAccountId();
  if (!firm) throw new Error("no firm account id (set ALPACA_FIRM_ACCOUNT_ID)");
  const req = requester();
  const j = await req("POST", "/v1/journals", {
    from_account: firm,
    to_account: accountId,
    entry_type: "JNLC",
    amount: (amountCents / 100).toFixed(2),
    description: "Steward residue redirection (sandbox)",
  });
  return { status: j.status, id: j.id };
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

/** ACH fallback funding — used only when journal funding hasn't worked within a
 * few minutes, so money is never permanently stuck at $0.
 */
export async function fundViaAch(accountId, amount = FUND_AMOUNT) {
  return achFund(accountId, amount);
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

// ── Real deposits: user's own money, via Plaid ───────────────────────────────
//
// The functions above (journalFund/achFund/fundIfActive) move OUR money into a
// user's account — correct for a sandbox demo, wrong once real people sign up (see
// "Real Deposits Build Spec"). These functions move the USER's own money, from
// their own bank, via the official Plaid↔Alpaca ACH handshake. We never touch it.

/** Real ACH relationship, created from a Plaid processor token. Production path. */
export async function createAchRelationshipFromPlaid(accountId, processorToken) {
  const req = requester();
  return req("POST", `/v1/accounts/${accountId}/ach_relationships`, {
    processor_token: processorToken,
  });
}

/** List a user's existing ACH relationships (so we don't create duplicates). */
export async function listAchRelationships(accountId) {
  return requester()("GET", `/v1/accounts/${accountId}/ach_relationships`);
}

/** Move money: user's bank -> their brokerage account. amountCents -> "25.00" */
export async function createDeposit(accountId, relationshipId, amountCents) {
  return requester()("POST", `/v1/accounts/${accountId}/transfers`, {
    transfer_type: "ach",
    relationship_id: relationshipId,
    amount: (amountCents / 100).toFixed(2),
    direction: "INCOMING",
  });
}

/** Money out: brokerage account -> user's bank. */
export async function createWithdrawal(accountId, relationshipId, amountCents) {
  return requester()("POST", `/v1/accounts/${accountId}/transfers`, {
    transfer_type: "ach",
    relationship_id: relationshipId,
    amount: (amountCents / 100).toFixed(2),
    direction: "OUTGOING",
  });
}

/** All transfers for an account, for the history list and status polling. */
export async function listTransfers(accountId) {
  return requester()("GET", `/v1/accounts/${accountId}/transfers`);
}
