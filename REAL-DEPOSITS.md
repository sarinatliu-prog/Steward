# Build Spec — Real Deposits (users fund with their own money)

> **Status: implemented.** Steps 1–7 below are built and live in `server/lib/plaid.js`,
> `server/lib/account-service.js`, `server/lib/db.js`, `server/api.mjs`, and the Deposit &
> withdraw screen in `src/GoodSteward.jsx`. `AUTO_FUND_NEW_ACCOUNTS` is off by default and
> only set to `"1"` in this deployment's Render env (it IS the sandbox demo). The one
> **open problem below is still open** — read it before touching residue routing.
> A full sandbox click-through with Plaid Link's sandbox UI (test creds `user_good` /
> `pass_good`) hasn't been run end-to-end yet; the guards, amount validation, and empty
> state have been verified directly.

This is the last big piece before Steward can work with real money. It's needed on
either regulatory track, so it's safe to build now while Alpaca sales replies.

---

## Why this has to change

Right now, when someone finishes onboarding, the app **gives them $100** — it journals
it out of our firm account into their new account (`fundIfActive` in
`server/lib/account-service.js`).

That's correct for sandbox: it's play money and it makes the demo work instantly.

In production that exact code means **we hand every person who signs up $100 of real
company money.** A hundred signups is ten thousand dollars, gone.

So the funding model has to invert. Instead of us pushing money *to* the user, the user
pulls money *from their own bank* into their own brokerage account. They own it, they
can withdraw it, and we never touch it.

---

## The good news

Half of this is already built. Users already link their bank through Plaid for the
transaction feed (`server/lib/plaid.js` — `createLinkToken`, `exchangePublicToken`, and
`user.plaidAccess` on every user record).

Bank linking for *reading transactions* and bank linking for *moving money* use the same
Plaid Link session. We just need one extra token and three new endpoints.

---

## How real funding works (the flow)

Alpaca and Plaid have an official partnership for exactly this:

```
1. User links bank in Plaid Link            ← ALREADY DONE
2. Ask Plaid for an Alpaca "processor token"  ← new
3. Give that token to Alpaca to create an ACH relationship  ← new
4. Create a transfer (user's bank → their brokerage account)  ← new
5. Poll transfer status until it settles     ← new
```

Steps 2–5 are what we're building.

---

## What to build

### 1. Plaid: get a processor token

**File:** `server/lib/plaid.js`

Add one function. After a user links their bank, exchange their access token for a
token Alpaca can use:

```js
// Alpaca can't use a raw Plaid access token — it needs a "processor token" minted
// specifically for them. This is the official Plaid↔Alpaca funding handshake.
export async function createAlpacaProcessorToken(accessToken, accountId) {
  const r = await client().processorTokenCreate({
    access_token: accessToken,
    account_id: accountId,      // the specific BANK account the user picked
    processor: "alpaca",
  });
  return r.data.processor_token;
}
```

> **Important:** `account_id` here is the **bank** account id from Plaid, not the Alpaca
> account id. You get it from `/accounts/get` (or from Link's `onSuccess` metadata).
> Add a `listBankAccounts(accessToken)` helper that calls `accountsGet` so the user can
> choose which of their bank accounts to fund from — most people have more than one.

### 2. Alpaca: create the ACH relationship from that token

**File:** `server/lib/account-service.js`

The existing `achFund()` creates a *fake* relationship with hardcoded routing numbers —
fine for sandbox, useless in production. Add the real one alongside it (don't delete the
old one yet; sandbox still uses it):

```js
/** Real ACH relationship, created from a Plaid processor token. Production path. */
export async function createAchRelationshipFromPlaid(accountId, processorToken) {
  const req = requester();
  return req("POST", `/v1/accounts/${accountId}/ach_relationships`, {
    processor_token: processorToken,
  });
}

/** List a user's existing ACH relationships (so we don't create duplicates). */
export async function listAchRelationships(accountId) {
  return requester()("GET", `/v1/accounts/${accountId}/ach_relationships`);
}

/** Move money: user's bank -> their brokerage account. amountCents -> "25.00" */
export async function createDeposit(accountId, relationshipId, amountCents) {
  return requester()("POST", `/v1/accounts/${accountId}/transfers`, {
    transfer_type: "ach",
    relationship_id: relationshipId,
    amount: (amountCents / 100).toFixed(2),
    direction: "INCOMING",
  });
}

/** Money out: brokerage account -> user's bank. */
export async function createWithdrawal(accountId, relationshipId, amountCents) {
  return requester()("POST", `/v1/accounts/${accountId}/transfers`, {
    transfer_type: "ach",
    relationship_id: relationshipId,
    amount: (amountCents / 100).toFixed(2),
    direction: "OUTGOING",
  });
}

/** All transfers for an account, for the history list and status polling. */
export async function listTransfers(accountId) {
  return requester()("GET", `/v1/accounts/${accountId}/transfers`);
}
```

### 3. Store the relationship on the user

**File:** `server/lib/db.js`, in `createUser`

Add three fields next to the existing `plaidAccess` / `plaidCursor`:

```js
achRelationshipId: null,   // Alpaca ACH relationship, once the bank is linked for money
bankName: null,            // e.g. "Chase ****1234" — for display
transfers: [],             // local mirror of deposits/withdrawals for the UI
```

### 4. New API routes

**File:** `server/api.mjs`

Add these to the `authRoutes` array (around line 185) so they require a session, then
implement them following the same pattern as the existing Plaid routes:

| Route | Method | Does |
|---|---|---|
| `/api/bank/accounts` | GET | Lists the user's bank accounts from Plaid so they can pick one |
| `/api/bank/link` | POST | `{ bankAccountId }` → processor token → ACH relationship → save `achRelationshipId` |
| `/api/deposit` | POST | `{ amount }` → `createDeposit` → push to `user.transfers` → audit |
| `/api/withdraw` | POST | `{ amount }` → `createWithdrawal` → same |
| `/api/transfers` | GET | Fresh status from `listTransfers`, merged into `user.transfers` |

Rules for all of them:

- **Guard everything.** No relationship → return a clear error, don't crash.
- **Don't create duplicate relationships.** Call `listAchRelationships` first; if one
  already exists, reuse its id.
- **Audit every money movement:** `db.audit(user, "deposit_created", { cents, transferId })`
  and the same for withdrawals. This already exists — use it.
- **Validate the amount server-side**: positive, a sane maximum, integer cents. Never
  trust the number the browser sends.

### 5. Turn off the auto-gift when running live

**File:** `server/api.mjs`, in the `/api/profile` handler where `fundIfActive` is called.

Gate it behind an explicit env flag so production can never gift money by accident:

```js
const AUTO_FUND = process.env.AUTO_FUND_NEW_ACCOUNTS === "1";
```

Set `AUTO_FUND_NEW_ACCOUNTS=1` in Render **for sandbox only**. When it's off, a new user
simply has a $0 account until they deposit — which is exactly right.

Also gate the same flag around the background `settleUser` funding block, or it'll gift
money there instead.

### 6. Frontend

**File:** `src/GoodSteward.jsx`

- **Deposit screen** — amount input, a "from" bank picker, submit. Show pending state.
- **Balance card** — cash, pending deposits, invested. Right now users only see invested.
- **Transfer history** — a simple list: date, amount, direction, status.
- **Empty state** — if a user has $0 and no bank linked, the Home screen should say
  "Link your bank to get started," not show a broken round-up UI.
- Keep the copy plain, same as the rest of the app. No jargon.

---

## Test plan (all in sandbox — safe)

1. Sign up fresh → confirm the account is created and **$0** with `AUTO_FUND_NEW_ACCOUNTS` unset.
2. Link a bank via Plaid Link (test creds `user_good` / `pass_good`).
3. `GET /api/bank/accounts` → shows the sandbox bank accounts.
4. `POST /api/bank/link` → ACH relationship created; check the Alpaca dashboard shows it.
5. `POST /api/deposit {amount: 25}` → transfer appears in Alpaca → **Transactions → Transfers**.
6. Wait for it to settle → cash appears → make purchases → round-ups sweep → real orders.
7. `POST /api/withdraw {amount: 5}` → outgoing transfer appears.
8. Re-run `/api/bank/link` → confirms it **reuses** the relationship, doesn't duplicate.

**Verified so far** (server not yet exercised against a real linked bank + Alpaca account
in the same session — needs a click-through of Plaid Link's sandbox UI):
- All five new routes guard correctly with no bank/account linked (steps that require a
  prerequisite return a clear error instead of crashing).
- Amount validation (`validAmountCents`) rejects zero, negative, non-numeric, and
  over-cap amounts; accepts valid dollar strings and numbers; caps at $25,000/transfer.
- The Home empty state ("Link your bank to get started") renders correctly when a user
  has $0 and no bank linked.
- The Deposit & withdraw screen's "ready" step (KPI tiles, pending-deposit note, deposit
  form, withdraw form, transfer history) renders correctly against a linked-bank+ACH
  state.
- Found and fixed a real layout bug: the deposit/withdraw amount input didn't have
  `min-width: 0`, so its flexbox default caused the Deposit/Withdraw button to overflow
  the viewport on narrow screens.

---

## The residue: decided, and shipping as beta

**The constraint.** Alpaca journals move firm↔customer only, never customer→customer.
Once the money is genuinely the user's, we cannot journal the tithe from their account
to a charity account. That ruled out the original design.

**The decision.** The residue is routed through the **sweep account**, and the user sets
what percentage of each sweep goes there — that is the existing stewardship-rate slider,
now doing real work. The sweep account is the firm-side account we already operate, so
the movement is customer→firm (allowed) rather than customer→customer (not). Disbursement
from the sweep account to the charity partner happens off the brokerage rail entirely.

**What that leaves open, and who owns it:**
- Which charity partner, and whether they take funds directly or via a donor-advised fund.
- The tax treatment of a user-directed gift that pools in our sweep account before it is
  disbursed — a question for the attorney, not the code. Whether the user or the entity is
  the donor of record changes the answer.
- Whether pooled, undisbursed residue sitting in the sweep account has custody
  implications. Raise it with Alpaca in the production application rather than after.

**Until those are answered, Giving ships as beta.** The rate applies, the amount accrues
and is shown to the user, and nothing is disbursed. The Giving screen says exactly that,
and says the user will be told before the first payment goes out and can opt out until
then. Accruing money against a promise we haven't finished building is only honest if the
user can see the state they are actually in.

## Order of work

1. Plaid processor token + bank account list
2. ACH relationship creation (with duplicate guard)
3. Deposit endpoint + audit
4. Transfer status + history
5. `AUTO_FUND_NEW_ACCOUNTS` gate
6. Frontend: deposit, balance, history, empty state
7. Withdrawal

1–4 is the meaningful milestone: **a user can put their own money in.** Everything after
is polish and safety.
