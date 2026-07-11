// Watches for the sandbox ACH to settle, then confirms the real order landed.
import { authFromEnv, makeRequester } from "./lib/alpaca-auth.js";
const { auth, baseUrl } = authFromEnv();
const req = makeRequester(auth, baseUrl);
const A = process.env.ALPACA_TEST_ACCOUNT_ID;
for (let i = 1; i <= 15; i++) {
  const t = new Date().toISOString().slice(11,19);
  try {
    const acct = await req("GET", `/v1/trading/accounts/${A}/account`);
    const bp = Number(acct.buying_power ?? 0);
    let api = {};
    try { api = await (await fetch("http://localhost:8787/api/portfolio")).json(); } catch {}
    console.log(`[${t}] #${i} buying_power=$${bp} · api.invested=${api?.display?.invested} · pending=${api?.display?.pending ?? "—"}`);
    if (bp > 0 && api?.display?.invested && api.display.invested !== "$0.00") {
      const pos = await req("GET", `/v1/trading/accounts/${A}/positions`).catch(()=>[]);
      console.log(`\n✓ SETTLED & INVESTED. Real Alpaca position:`,
        Array.isArray(pos) ? pos.map(p=>`${p.symbol} $${p.market_value}`).join(", ") : "(pending fill)");
      process.exit(0);
    }
  } catch (e) { console.log(`[${t}] #${i} err: ${e.message.split("\n")[0]}`); }
  if (i < 15) await new Promise(r => setTimeout(r, 120000));
}
console.log("Still settling after 30 min — the backend will invest automatically once it lands.");
