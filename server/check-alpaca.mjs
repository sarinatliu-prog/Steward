// Quick connectivity check for the Alpaca Broker API sandbox.
// Run from the server/ folder with:  node --env-file=.env check-alpaca.mjs
// It never prints your keys — only whether auth succeeded.

const KEY = process.env.ALPACA_API_KEY_ID;
const SECRET = process.env.ALPACA_API_SECRET_KEY;
const BASE = process.env.ALPACA_BASE_URL ?? "https://broker-api.sandbox.alpaca.markets";

if (!KEY || !SECRET || KEY.startsWith("your_")) {
  console.error("✗ No credentials found. Copy .env.example to .env and fill in your sandbox keys.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");

try {
  // Broker API: list brokerage accounts under your firm (empty is fine — proves auth works).
  const res = await fetch(`${BASE}/v1/accounts`, {
    headers: { Authorization: auth, Accept: "application/json" },
  });

  if (res.status === 401 || res.status === 403) {
    console.error(`✗ Auth rejected (${res.status}). Double-check the key/secret and that they're SANDBOX Broker keys.`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`✗ Unexpected response ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const accounts = await res.json();
  console.log("✓ Connected to Alpaca Broker sandbox.");
  console.log(`  Base URL: ${BASE}`);
  console.log(`  Existing brokerage accounts: ${Array.isArray(accounts) ? accounts.length : "unknown"}`);
  console.log("  Auth works — keys are valid. Ready to build.");
} catch (err) {
  console.error("✗ Network/other error:", err.message);
  process.exit(1);
}
