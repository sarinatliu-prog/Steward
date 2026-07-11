// Connectivity check for the Alpaca Broker API sandbox, using the CLIENT CREDENTIALS
// (OAuth2) flow that Alpaca's Broker dashboard now issues credentials for.
//
// Run from the server/ folder with:  node --env-file=.env check-alpaca.mjs
// It never prints your secret — only whether auth succeeded.
//
// Step 1: exchange client id + secret for an access token at authx.sandbox.alpaca.markets
// Step 2: call the Broker API with `Authorization: Bearer <token>`
//
// (The old Basic-auth "legacy" flow returns 401 for these credentials. That was the bug.)

import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";

let ctx;
try {
  ctx = authFromEnv();
} catch (err) {
  console.error("✗ " + err.message);
  process.exit(1);
}

const { auth, baseUrl, authUrl, clientId } = ctx;

console.log("Checking Alpaca Broker sandbox (client-credentials flow)...");
console.log(`  Auth host: ${authUrl}`);
console.log(`  Broker API: ${baseUrl}`);
console.log(`  Client ID: ${clientId.slice(0, 4)}…${clientId.slice(-3)} (${clientId.length} chars)`);
console.log("");

// ── Step 1: get an access token ────────────────────────────────────────────
let token;
try {
  console.log("1/2  Requesting an access token…");
  token = await auth.token();
  console.log(`     ✓ Got a token (${token.length} chars), valid ~15 min.`);
} catch (err) {
  console.error("     ✗ Token request FAILED.\n");
  console.error("  " + err.message + "\n");
  console.error("  What this means:");
  console.error("   • 401/invalid_client → the client id or secret is wrong. The secret is");
  console.error("     shown only ONCE when you generate the key. If you don't have it,");
  console.error("     generate a NEW key in the Broker dashboard and copy both values.");
  console.error("   • Make sure the dashboard is on SANDBOX and ALPACA_AUTH_URL is");
  console.error("     https://authx.sandbox.alpaca.markets");
  process.exit(1);
}

// ── Step 2: use the token against the Broker API ───────────────────────────
try {
  console.log("2/2  Calling GET /v1/accounts with the token…");
  const req = makeRequester(auth, baseUrl);
  const accounts = await req("GET", "/v1/accounts");

  console.log("");
  console.log("✓ Connected to Alpaca Broker sandbox.");
  console.log(`  Existing brokerage accounts: ${Array.isArray(accounts) ? accounts.length : "unknown"}`);
  console.log("  Auth works — the blocker is cleared. 🎉");
  console.log("");
  console.log("  Next: node --env-file=.env alpaca-create-account.mjs");
} catch (err) {
  console.error("     ✗ The token was issued but the API call was rejected.\n");
  console.error("  " + err.message + "\n");
  console.error("  If this is a 403, your key may lack permissions for this scope.");
  console.error("  Check the key's Access Control in the Broker dashboard (needs Full,");
  console.error("  or at least read access to the Accounts scope).");
  process.exit(1);
}
