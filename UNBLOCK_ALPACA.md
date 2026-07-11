# Unblocking Alpaca — a start-to-finish guide

This walks you from "the 401 error" to "a real fractional order placed through the
app's own code." It assumes **no prior knowledge**. Follow it top to bottom.

Everything here happens in Alpaca's **sandbox** — a fake, parallel environment. No
real money, no real people, nothing hits the real stock market.

---

## The root cause (this is the interesting part)

The project stalled for months on a `401 unauthorized` that no amount of key-regenerating
would fix. Here's what was actually happening.

**Alpaca's Broker API has two different authentication flows:**

| | How it works | Who it's for |
|---|---|---|
| **Legacy flow** | Send your key + secret directly as HTTP Basic auth | Older credentials |
| **Client credentials** (current) | POST your client id + secret to a **token server**, get a short-lived access token, then send `Authorization: Bearer <token>` | What the Broker dashboard issues **today** |

The old `AlpacaBroker` code used the **legacy** flow. But the Broker dashboard now issues
**"Client Secret"** credentials (you can see the `TYPE` column says exactly that), which
require the **client-credentials** flow.

Sending Basic auth with a client-credentials key returns **`401 unauthorized`** — with no
hint that you're using the wrong flow entirely. That's why:

- the keys looked perfectly valid (they were!),
- the dashboard said **Active**, **Full** permissions, **Sandbox**,
- but **LAST USED** stayed `-` on every key — Alpaca never accepted a single call,
- and regenerating keys never helped, because the keys were never the problem.

**The fix was in the code, not the credentials.** It's now implemented.

### What changed

- **`server/lib/alpaca-auth.js`** (new) — exchanges your client id + secret for an access
  token at `https://authx.sandbox.alpaca.markets/v1/oauth2/token`, caches it, and refreshes
  it automatically (tokens last ~15 minutes).
- **`server/lib/broker.js`** — `AlpacaBroker` now sends `Authorization: Bearer <token>`
  instead of Basic auth. It also gained `positionOf()` and `listOrders()`.
- All the helper scripts use the new flow.

---

## Prerequisite

You need **Node.js 20.6+** (for `--env-file`). Check with `node --version`; if it's older,
install the latest LTS from https://nodejs.org.

All commands below run **from inside the `server/` folder**:

```bash
cd path/to/Steward/server
```

---

## Part A — Your credentials

You need two values from **https://broker-app.alpaca.markets** (the **Broker** dashboard),
with the environment selector set to **Sandbox**:

1. **CLIENT ID** — visible any time under **API/Devs → API Credentials** (starts with `CK`).
2. **CLIENT SECRET** — shown **only once**, at the moment you generate the key.

> **If you don't have the secret saved, you cannot recover it.** Click **Generate API Key**,
> and copy the secret immediately. Give it **Full** access so it can create accounts and trade.

---

## Part B — Put them in `.env`

In `server/`, copy `.env.example` to `.env` and fill it in:

```
ALPACA_CLIENT_ID=CK...
ALPACA_CLIENT_SECRET=...
ALPACA_AUTH_URL=https://authx.sandbox.alpaca.markets
ALPACA_BASE_URL=https://broker-api.sandbox.alpaca.markets
ALPACA_TEST_ACCOUNT_ID=
```

Leave the two URLs as-is. Leave `ALPACA_TEST_ACCOUNT_ID` blank — Part D fills it in.

> The code also still accepts the old variable names (`ALPACA_API_KEY_ID` /
> `ALPACA_API_SECRET_KEY`), so an existing `.env` keeps working without edits.

`.env` is git-ignored. **Never paste your secret into a chat, issue, or commit.**

---

## Part C — Prove auth works

```bash
node --env-file=.env check-alpaca.mjs
```

Success looks like:

```
1/2  Requesting an access token…
     ✓ Got a token (…), valid ~15 min.
2/2  Calling GET /v1/accounts with the token…

✓ Connected to Alpaca Broker sandbox.
  Auth works — the blocker is cleared. 🎉
```

If the **token step** fails with `invalid_client`, the client id or secret is wrong —
generate a fresh key and copy the secret in full. (This is now a *precise* error: it tells
you the credentials are bad, rather than the old ambiguous 401.)

---

## Part D — Create a test account (a fake "user")

A Broker app trades *on behalf of accounts*, so we need one:

```bash
node --env-file=.env alpaca-create-account.mjs
```

It prints the new `account_id` and writes it into `.env` automatically. Sandbox approves
accounts instantly.

---

## Part E — Put some (fake) money in it

```bash
node --env-file=.env alpaca-fund-account.mjs
```

Sets up a pretend bank link and requests a **$1,000** virtual deposit. Sandbox simulates a
real ACH transfer, so **cash can take a few minutes (sometimes ~30) to land** — that's
normal. You don't have to wait to continue.

---

## Part F — The proof: place a real fractional order

```bash
node --env-file=.env alpaca-place-order.mjs
```

This imports the **actual `AlpacaBroker` class from `lib/broker.js`** — the same code the
app uses — and places a **$5 notional buy of ESGV**:

```
✓ Order placed. Alpaca returned an Order object:
  order id:  4c6cbac4-...
  symbol:    ESGV
  notional:  $5.00
  status:    accepted
✓ AlpacaBroker.invest() works end-to-end.
```

- **`accepted` / `new`** = success. Alpaca took the order; it fills when the market is open
  and cash has settled.
- **`filled`** = even better.

You should now also see **LAST USED** populate on your key in the dashboard, and the order
appear under the sandbox account. That's the real confirmation.

---

## Part G — Turning the switch on in the app

`server/api.mjs` still uses `FakeBroker`. `AlpacaBroker` now implements `invest()`,
`positionOf()`, and `listOrders()`, so it's a genuine drop-in — but note `api.mjs` currently
calls `broker.positionOf(...)` **synchronously** and reads `broker.orders`, while the Alpaca
versions are `async` (they're network calls). So the swap needs those call sites `await`ed.

That's a small, well-scoped follow-up rather than a literal one-liner.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `invalid_client` at the token step | Wrong client id or secret | Generate a new key; copy the secret in full |
| `401` on the API call after a token was issued | Shouldn't happen — token is valid | Re-run; if persistent, contact support with the `X-Request-ID` |
| `403` on the API call | Key lacks permission for that scope | Give the key **Full** access in the dashboard |
| `--env-file` "unknown option" | Node older than 20.6 | Update Node |
| Order rejected for buying power | Funds not settled yet | Auth is fine — wait, then re-run Part F |

---

## The whole thing in four commands

```bash
cd server
node --env-file=.env check-alpaca.mjs           # 1. auth works?
node --env-file=.env alpaca-create-account.mjs  # 2. make a test account
node --env-file=.env alpaca-fund-account.mjs    # 3. fund it (fake ACH)
node --env-file=.env alpaca-place-order.mjs     # 4. place a $5 ESGV order  ← the proof
```

*Note: this is all sandbox. Moving real money brings in securities and money-transmission
regulation (KYC, etc.). Get proper legal advice before leaving sandbox — this isn't legal
advice.*
