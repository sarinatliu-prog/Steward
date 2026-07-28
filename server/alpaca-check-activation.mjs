// Diagnose why new sandbox accounts aren't reaching ACTIVE.
// Creates ONE test account with the same payload the app uses, then watches its
// status for ~3 minutes and prints exactly where it stalls and why.
//
// Save this file into the `server/` folder, then run from the project root:
//   node --env-file=server/.env server/alpaca-check-activation.mjs
//
// It never prints your keys. Paste the whole output back.

import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";

let ctx;
try { ctx = authFromEnv(); }
catch (e) { console.error("✗ " + e.message); process.exit(1); }
const req = makeRequester(ctx.auth, ctx.baseUrl);

const stamp = Date.now();
const ssn = `${100 + (stamp % 800)}-${10 + (stamp % 80)}-${1000 + (stamp % 9000)}`;
const now = new Date().toISOString();

const payload = {
  contact: {
    email_address: `steward.diag+${stamp}@example.com`,
    phone_number: "5556667777",
    street_address: ["123 Steward Way"],
    city: "San Mateo", state: "CA", postal_code: "94401", country: "USA",
  },
  identity: {
    given_name: "Steward", family_name: "User", date_of_birth: "1990-01-01",
    tax_id: ssn, tax_id_type: "USA_SSN",
    country_of_citizenship: "USA", country_of_birth: "USA", country_of_tax_residence: "USA",
    funding_source: ["employment_income"],
  },
  disclosures: {
    is_control_person: false, is_affiliated_exchange_or_finra: false,
    is_politically_exposed: false, immediate_family_exposed: false,
  },
  agreements: [{ agreement: "customer_agreement", signed_at: now, ip_address: "127.0.0.1" }],
};

console.log("Creating a test account (same payload the app uses)…\n");
let acct;
try { acct = await req("POST", "/v1/accounts", payload); }
catch (e) { console.error("✗ Account creation failed:\n  " + e.message); process.exit(1); }

console.log(`account_id: ${acct.id}`);
console.log(`initial status: ${acct.status}\n`);
console.log("Watching status for ~3 minutes…\n");

const start = Date.now();
let lastStatus = acct.status;
let done = false;

for (let i = 0; i < 22 && !done; i++) {
  await new Promise((r) => setTimeout(r, 8000));
  let a;
  try { a = await req("GET", `/v1/accounts/${acct.id}`); }
  catch (e) { console.log("  (poll error: " + e.message.split("\n")[0] + ")"); continue; }

  const secs = Math.round((Date.now() - start) / 1000);
  if (a.status !== lastStatus) {
    console.log(`  ${secs}s: ${lastStatus} → ${a.status}`);
    lastStatus = a.status;
  } else {
    console.log(`  ${secs}s: ${a.status}`);
  }

  // If KYC held it, show why.
  if (["ACTION_REQUIRED", "APPROVAL_PENDING", "REJECTED"].includes(a.status)) {
    console.log("\n  ⚠ KYC held this account. Details:");
    console.log("  " + JSON.stringify(a.kyc_results ?? a.kyc ?? "(no kyc_results returned)"));
    done = true;
  }
  if (a.status === "ACTIVE") { done = true; }
}

console.log("\n═══ Verdict ═══");
if (lastStatus === "ACTIVE") {
  console.log("✓ Account reached ACTIVE. Activation works — the app will fund it instantly");
  console.log("  once ALPACA_FIRM_ACCOUNT_ID is set. Nothing else to fix.");
} else if (["ACTION_REQUIRED", "APPROVAL_PENDING", "REJECTED"].includes(lastStatus)) {
  console.log(`✗ Account is stuck in ${lastStatus} — a KYC hold, not a timing issue.`);
  console.log("  Fix is in the account data (see the kyc_results above). Send me the output.");
} else {
  console.log(`… Still ${lastStatus} after 3 min. Either activation is slow, or held.`);
  console.log("  Send me the full output and I'll tell you the exact fix.");
}
