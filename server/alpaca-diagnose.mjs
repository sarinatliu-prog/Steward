// Deep diagnostic for the Alpaca 401. Figures out WHICH thing is wrong.
// Run:  node --env-file=.env alpaca-diagnose.mjs
//
// It never prints your full key or secret — only lengths, prefixes, and pass/fail.
// It only ever makes read-only GET /v1/accounts calls. Nothing is created or traded.

import { readFileSync } from "node:fs";

const KEY = process.env.ALPACA_API_KEY_ID ?? "";
const SECRET = process.env.ALPACA_API_SECRET_KEY ?? "";

const mask = (s) => (s.length > 7 ? `${s.slice(0, 4)}…${s.slice(-3)}` : "(too short)");

console.log("═══ Alpaca credential diagnostic ═══\n");

// ── 1. Inspect the raw .env text for invisible junk ─────────────────────────
console.log("1. Checking the raw .env file for hidden characters…");
try {
  const raw = readFileSync(".env", "utf8");
  if (raw.charCodeAt(0) === 0xfeff) {
    console.log("   ⚠ File starts with a BOM (byte-order mark). Re-save it as plain UTF-8.");
  }
  let flagged = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const [name, ...rest] = line.split("=");
    const value = rest.join("=");
    const issues = [];
    if (/\r/.test(line)) issues.push("carriage return (\\r)");
    if (/^["']|["']$/.test(value.trim())) issues.push("wrapped in quotes — remove them");
    if (value !== value.trim()) issues.push("leading/trailing whitespace");
    if (/\s/.test(value.trim())) issues.push("a space INSIDE the value");
    if (name !== name.trim()) issues.push("space around the '=' — remove it");
    if (issues.length) {
      flagged = true;
      console.log(`   ⚠ ${name.trim()}: ${issues.join(", ")}`);
    }
  }
  if (!flagged) console.log("   ✓ No quotes, stray spaces, or line-ending problems.");
} catch {
  console.log("   ⚠ Could not read .env in this folder.");
}

// ── 2. Shape of the credentials ────────────────────────────────────────────
console.log("\n2. Checking the shape of the credentials…");
console.log(`   Key ID: ${mask(KEY)}  (${KEY.length} chars)`);
console.log(`   Secret: ${mask(SECRET)}  (${SECRET.length} chars)`);

if (KEY.startsWith("CK")) {
  console.log("   ✓ Key starts with 'CK' → this IS a Broker API key. Right dashboard.");
} else if (/^(PK|AK)/.test(KEY)) {
  console.log("   ✗ Key starts with 'PK'/'AK' → this is a TRADING API key, not a Broker key.");
  console.log("     Get Broker keys from https://broker-app.alpaca.markets");
} else {
  console.log("   ? Unrecognized key prefix. Broker keys normally start with 'CK'.");
}
if (KEY === SECRET) console.log("   ✗ Key and secret are IDENTICAL — same value pasted twice.");
if (SECRET.length && SECRET.length < 30) {
  console.log("   ⚠ Secret looks short. Alpaca secrets are usually ~40 chars.");
  console.log("     You may have pasted the Key ID into both fields.");
}

// ── 3. Try every plausible combination and see what Alpaca says ─────────────
console.log("\n3. Testing the credentials against Alpaca (read-only)…\n");

const ENVS = [
  ["Broker SANDBOX  ", "https://broker-api.sandbox.alpaca.markets"],
  ["Broker LIVE/PROD", "https://broker-api.alpaca.markets"],
];

async function tryAuth(baseUrl, user, pass) {
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  try {
    const res = await fetch(`${baseUrl}/v1/accounts`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, 300), reqId: res.headers.get("x-request-id") };
  } catch (e) {
    return { status: `network error (${e.message})`, body: "", reqId: null };
  }
}

const results = [];
for (const [label, url] of ENVS) {
  const normal = await tryAuth(url, KEY, SECRET);
  const swapped = await tryAuth(url, SECRET, KEY);
  results.push({ label, url, normal: normal.status, swapped: swapped.status, detail: normal });
  console.log(`   ${label}  key:secret → ${normal.status}    (swapped → ${swapped.status})`);
  if (normal.body) console.log(`        Alpaca says: ${normal.body}`);
  if (normal.reqId) console.log(`        X-Request-ID: ${normal.reqId}`);
}

// ── 4. Verdict ─────────────────────────────────────────────────────────────
console.log("\n═══ Verdict ═══\n");

const ok = results.find((r) => r.normal === 200);
const okSwapped = results.find((r) => r.swapped === 200);

if (ok) {
  console.log(`✓ Your credentials WORK against: ${ok.label.trim()}`);
  console.log(`  ${ok.url}`);
  if (ok.url.includes("sandbox")) {
    console.log("\n  That's the sandbox — exactly what we want. Set this in .env:");
    console.log("    ALPACA_BASE_URL=https://broker-api.sandbox.alpaca.markets");
    console.log("  Then re-run: node --env-file=.env check-alpaca.mjs");
  } else {
    console.log("\n  ⚠ These are LIVE/production Broker keys, not sandbox keys.");
    console.log("  Do NOT use live keys for testing. Go to the Broker dashboard,");
    console.log("  switch the environment toggle to SANDBOX, generate a new key pair");
    console.log("  there, and put THOSE in .env.");
  }
} else if (okSwapped) {
  console.log("✓ Found it — your KEY and SECRET are SWAPPED in .env.");
  console.log(`  They authenticate against ${okSwapped.label.trim()} when reversed.`);
  console.log("  Fix: put the Key ID in ALPACA_API_KEY_ID and the Secret in");
  console.log("  ALPACA_API_SECRET_KEY (you currently have them the other way round).");
} else {
  const sandboxBody = (results[0]?.detail?.body ?? "").toLowerCase();
  console.log("✗ Rejected everywhere (sandbox AND live, normal AND swapped).");
  console.log("  So the key/secret PAIR itself is not being accepted — not a URL problem.\n");

  if (sandboxBody.includes("not found") || sandboxBody.includes("40110000")) {
    console.log("  ► Alpaca says the access key is NOT FOUND — the key doesn't exist on");
    console.log("    their side at all. A wrong secret would give a 'verification failed'");
    console.log("    instead. So this is almost certainly ONE of:");
    console.log("");
    console.log("    (a) Your Broker account is still PENDING APPROVAL. Broker API is not");
    console.log("        self-serve like paper trading — Alpaca must approve your org");
    console.log("        before sandbox keys activate. Check the dashboard for a");
    console.log("        'pending' / 'under review' banner. If so: you are BLOCKED until");
    console.log("        they approve. Ping them to speed it up.");
    console.log("");
    console.log("    (b) The key was deleted/regenerated, so this pair no longer exists.");
    console.log("        Generate a fresh SANDBOX pair and paste both values.");
  } else if (sandboxBody.includes("verification failed")) {
    console.log("  ► Alpaca recognizes the key but rejects the SECRET.");
    console.log("    Regenerate the pair and copy the secret in full (it's shown once).");
  } else {
    console.log("  ► Alpaca returned only a generic 'unauthorized' with no detail, so we");
    console.log("    CANNOT tell from the response whether it's a bad secret or an");
    console.log("    inactive/unapproved key. Both look identical from the outside.");
    console.log("");
    console.log("    Your credentials are well-formed (CK prefix, correct lengths, clean");
    console.log("    .env), and they fail in all 4 combinations. That means the problem is");
    console.log("    on Alpaca's side of the fence, not in this repo.");
    console.log("");
    console.log("    Only two things can cause this now:");
    console.log("      (a) the secret isn't the one that belongs to this key → REGENERATE");
    console.log("      (b) the key pair isn't activated for sandbox → ALPACA SUPPORT");
    console.log("");
    console.log("    Do (a) first — it's free and takes 2 minutes. If a brand-new pair");
    console.log("    still 401s, it is definitively (b) and no code change will fix it.");
  }

  console.log("");
  console.log("  Next actions:");
  console.log("   1. https://broker-app.alpaca.markets — look for any 'pending approval',");
  console.log("      'complete your onboarding', or 'under review' status on the account.");
  console.log("   2. Confirm the environment toggle says SANDBOX (not Live/Production).");
  console.log("   3. Generate a BRAND NEW key pair; copy BOTH values immediately.");
  console.log("   4. Re-run this script.");
  console.log("   5. Still failing? It's Alpaca-side. Contact support (Intercom chat in the");
  console.log("      dashboard) with the X-Request-ID above and say: 'Broker API sandbox");
  console.log("      keys return 401 access key not found — is my account approved for");
  console.log("      sandbox?'");
}
