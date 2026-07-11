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

// Kick off virtual ACH funding so the account gets buying power (settles on a delay).
export async function fundAccount(accountId, amount = 1000) {
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
  try {
    await req("POST", `/v1/accounts/${accountId}/transfers`, {
      transfer_type: "ach", relationship_id: relId, amount: String(amount), direction: "INCOMING",
    });
  } catch { /* 1/day limit or already funding — fine */ }
}
