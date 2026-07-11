// Find your Alpaca SANDBOX firm ("sweep") account id — the pre-funded $50k account
// we journal cash from to instantly fund new users.
//
// Run:  node --env-file=server/.env server/alpaca-find-firm.mjs
//
// Copy the id it prints into server/.env as:
//   ALPACA_FIRM_ACCOUNT_ID=<id>
// (and into Render's Environment tab for the deployed app).

import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";

let ctx;
try {
  ctx = authFromEnv();
} catch (err) {
  console.error("✗ " + err.message);
  process.exit(1);
}

const req = makeRequester(ctx.auth, ctx.baseUrl);

console.log("Looking for your firm / sweep account…\n");

let accounts;
try {
  accounts = await req("GET", "/v1/accounts");
} catch (err) {
  console.error("✗ Could not list accounts:\n  " + err.message);
  process.exit(1);
}

if (!Array.isArray(accounts) || accounts.length === 0) {
  console.log("No accounts returned.");
  process.exit(0);
}

const firm = accounts.filter((a) => a.account_type === "firm" || a.account_type === "sweep");

if (firm.length) {
  console.log("✓ Found firm/sweep account(s):\n");
  for (const a of firm) {
    console.log(`  id:             ${a.id}`);
    console.log(`  account_number: ${a.account_number}`);
    console.log(`  type:           ${a.account_type}`);
    console.log(`  status:         ${a.status}\n`);
  }
  console.log("Add this to server/.env (and to Render's Environment tab):");
  console.log(`  ALPACA_FIRM_ACCOUNT_ID=${firm[0].id}`);
} else {
  console.log("Couldn't auto-detect a firm account from the API. That's common —");
  console.log("the sweep account isn't always returned in the customer account list.\n");
  console.log("Get it manually instead:");
  console.log("  1. Open https://broker-app.alpaca.markets (Sandbox)");
  console.log("  2. Click 'Firm Balance' in the left sidebar");
  console.log("  3. Copy the account id shown there");
  console.log("  4. Put it in server/.env as ALPACA_FIRM_ACCOUNT_ID=<id>\n");
  console.log(`(For reference, these ${accounts.length} account(s) were returned:)`);
  for (const a of accounts.slice(0, 10)) {
    console.log(`  ${a.id}  type=${a.account_type ?? "?"}  status=${a.status}  #${a.account_number}`);
  }
}
