// Fund the sandbox test account so it has buying power. Uses a virtual ACH
// transfer — Alpaca's sandbox simulates the whole bank flow, no real money.
//
// Run:  node --env-file=.env alpaca-fund-account.mjs
// Optional amount (default 1000):  node --env-file=.env alpaca-fund-account.mjs 500

import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";

let ctx;
try {
  ctx = authFromEnv();
} catch (err) {
  console.error("✗ " + err.message);
  process.exit(1);
}

const ACCOUNT = process.env.ALPACA_TEST_ACCOUNT_ID;
const AMOUNT = process.argv[2] ?? "1000";

if (!ACCOUNT) {
  console.error("✗ No ALPACA_TEST_ACCOUNT_ID in .env. Run alpaca-create-account.mjs first.");
  process.exit(1);
}

const req = makeRequester(ctx.auth, ctx.baseUrl);

try {
  console.log(`Funding account ${ACCOUNT} with $${AMOUNT} (virtual ACH)…\n`);

  // 1. Create a fake bank relationship (sandbox auto-approves).
  console.log("1/3  Creating ACH relationship…");
  const rel = await req("POST", `/v1/accounts/${ACCOUNT}/ach_relationships`, {
    account_owner_name: "Steward Tester",
    bank_account_type: "CHECKING",
    bank_account_number: "32131231abc",
    bank_routing_number: "121000358",
    nickname: "Sandbox Checking",
  });
  console.log(`     relationship_id: ${rel.id} (status: ${rel.status})`);

  // 2. Request an INCOMING transfer (money into the brokerage account).
  console.log("2/3  Requesting ACH transfer…");
  const transfer = await req("POST", `/v1/accounts/${ACCOUNT}/transfers`, {
    transfer_type: "ach",
    relationship_id: rel.id,
    amount: String(AMOUNT),
    direction: "INCOMING",
  });
  console.log(`     transfer_id: ${transfer.id} (status: ${transfer.status})`);

  // 3. Poll the account balance for a short while.
  console.log("3/3  Waiting for the cash to land (sandbox ACH takes a few minutes)…");
  const deadline = Date.now() + 90_000;
  let cash = 0;
  while (Date.now() < deadline) {
    const acct = await req("GET", `/v1/trading/accounts/${ACCOUNT}/account`);
    cash = Number(acct.cash ?? 0);
    process.stdout.write(`     cash so far: $${cash.toFixed(2)}   \r`);
    if (cash > 0) break;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log("");

  if (cash > 0) {
    console.log(`\n✓ Funded. Buying power is now ~$${cash.toFixed(2)}.`);
  } else {
    console.log("\nℹ Transfer accepted but cash hasn't settled yet (normal — sandbox ACH");
    console.log("  can take 10–30 min). You don't have to wait: a notional order will still");
    console.log("  be ACCEPTED by Alpaca, which is all we need to prove the code works.");
  }
  console.log("\n  Next: node --env-file=.env alpaca-place-order.mjs");
} catch (err) {
  console.error("✗ Funding failed:\n  " + err.message);
  process.exit(1);
}
