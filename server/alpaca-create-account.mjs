// Create ONE sandbox brokerage account (a fake "end user") so we have something
// to fund and trade in. Sandbox only — this touches no real person or money.
//
// Run:  node --env-file=.env alpaca-create-account.mjs
//
// On success it prints the new account_id AND appends it to your .env as
// ALPACA_TEST_ACCOUNT_ID, so the funding/order scripts pick it up automatically.

import { readFileSync, appendFileSync } from "node:fs";
import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";

let ctx;
try {
  ctx = authFromEnv();
} catch (err) {
  console.error("✗ " + err.message);
  process.exit(1);
}
const req = makeRequester(ctx.auth, ctx.baseUrl);

// Unique-ish details so re-runs don't collide (Alpaca rejects duplicate email/SSN).
const stamp = Date.now();
const email = `steward.test+${stamp}@example.com`;
const ssn = `${100 + (stamp % 800)}-${10 + (stamp % 80)}-${1000 + (stamp % 9000)}`;
const now = new Date().toISOString();

const body = {
  contact: {
    email_address: email,
    phone_number: "5556667777",
    street_address: ["123 Steward Way"],
    city: "San Mateo",
    state: "CA",
    postal_code: "94401",
    country: "USA",
  },
  identity: {
    given_name: "Steward",
    family_name: "Tester",
    date_of_birth: "1990-01-01",
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
  agreements: [
    { agreement: "customer_agreement", signed_at: now, ip_address: "127.0.0.1" },
  ],
};

console.log("Creating a sandbox brokerage account…");

let account;
try {
  account = await req("POST", "/v1/accounts", body);
} catch (err) {
  console.error("✗ Account creation failed:\n  " + err.message);
  process.exit(1);
}

console.log("✓ Account created.");
console.log(`  account_id:     ${account.id}`);
console.log(`  account_number: ${account.account_number}`);
console.log(`  status:         ${account.status}`);

// Persist the id to .env so later scripts find it automatically.
try {
  let env = "";
  try { env = readFileSync(".env", "utf8"); } catch { /* no .env yet */ }
  if (/^ALPACA_TEST_ACCOUNT_ID=.+$/m.test(env)) {
    console.log("\n  Note: .env already has an ALPACA_TEST_ACCOUNT_ID.");
    console.log(`  To use this new one, set it manually to: ${account.id}`);
  } else {
    appendFileSync(".env", `\nALPACA_TEST_ACCOUNT_ID=${account.id}\n`);
    console.log("\n  Saved ALPACA_TEST_ACCOUNT_ID to .env.");
  }
} catch (e) {
  console.log(`\n  (Could not auto-save to .env: ${e.message})`);
  console.log(`  Add this line to server/.env yourself: ALPACA_TEST_ACCOUNT_ID=${account.id}`);
}

console.log("\n  Next: node --env-file=.env alpaca-fund-account.mjs");
