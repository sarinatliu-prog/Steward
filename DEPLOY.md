# Deploying Good Steward

The app is **one service**: the Node server (`server/api.mjs`) serves both the `/api`
routes and the built frontend (`dist/`), plus a Postgres database for durable state.

> Deploying puts the app on a public URL, but it runs entirely on **fake money** — the
> Alpaca **sandbox**. Going to real money is a legal switch, not a config one. See
> `GO-LIVE.md`.

---

## What a user actually does, and what happens in Alpaca

1. **Sign up** (email + password) → user row created, session cookie set.
2. **Onboarding** → they pick a moral framework, screen strictness, and tithe.
   → a **real Alpaca sandbox brokerage account** is created from their profile,
   → and **instantly funded** by journaling $100 from your firm account.
3. **A purchase** → round-up computed → accrues in their clearing balance.
4. **Clearing hits $5** → swept and **split across their framework's ETFs by allocation**
   (e.g. Islamic → SPUS 50% / HLAL 30% / SPSK 20%) → **real orders placed in Alpaca**.
5. Their portfolio, holdings, and statement all read back from that state.

You can watch every step land in the Broker dashboard: **Accounts** (the new account),
**Transactions → Journals** (the funding), and the account's **Orders** tab.

---

## The instant-funding thing (read this — it's why the demo works)

Alpaca's sandbox simulates a **real ACH delay**: a bank transfer takes **10–30 minutes**
to settle. During that window every order is rejected with `insufficient buying power`.
So a grader who signs up, clicks around, and checks Alpaca would see an account with
**zero orders** — the exact thing you wanted to show.

The fix: every sandbox partner gets a **firm ("sweep") account pre-funded with $50k**.
We **journal** (`JNLC`) cash from it into each new user's account, which is **instant**.
This isn't a demo hack — cash pooling is how real apps do instant funding.

**You must set `ALPACA_FIRM_ACCOUNT_ID` for this to work.** Find it:

```bash
node --env-file=server/.env server/alpaca-find-firm.mjs
```

If it can't auto-detect it, open the Broker dashboard → **Firm Balance** and copy the id.
Then add to `server/.env` (and Render's Environment tab):

```
ALPACA_FIRM_ACCOUNT_ID=<id>
```

If it's missing, funding **falls back to ACH** and still works — just slowly. The server
logs which method it used, and `/api/profile` returns `funding: { method: "journal" | "ach" }`.

> **JNLC has a daily cap** (~$1,000/day across all journals by default). We fund **$100
> per user**, so ~10 signups/day. Plenty for $5 round-up sweeps. Tune with
> `ALPACA_FUND_AMOUNT`.

---

## Run it locally

```bash
npm install
npm run serve        # builds the frontend, then serves everything on :8787
# http://localhost:8787            → the app
# http://localhost:8787/api/health → {"ok":true,...}
npm test             # 17 unit tests
```

Without Alpaca creds the whole app still works on a simulated broker (`alpaca: off`).

---

## Deploy to Render

Render suits this app: it needs a long-running Node process. **Don't use Vercel/Netlify** —
they're serverless and would reset in-memory state on every request.

1. Push to GitHub. Confirm `server/.env` is **not** staged (it's git-ignored):

   ```bash
   git status --short
   git add -A
   git commit -m "Instant funding via journals + durable Postgres + honest ESG labels"
   git push
   ```

   *(PowerShell 5.1 has no `&&` — run these on separate lines.)*

2. <https://dashboard.render.com/blueprints> → **New Blueprint Instance** → pick the repo.
   `render.yaml` provisions **both** the web service and the Postgres database, and wires
   `DATABASE_URL` automatically.

3. In the service's **Environment** tab, paste the secrets (they're `sync: false`, so they
   are never in git):

   ```
   ALPACA_CLIENT_ID
   ALPACA_CLIENT_SECRET
   ALPACA_FIRM_ACCOUNT_ID
   ```

4. **Apply / Deploy.** You get an HTTPS URL like `https://good-steward.onrender.com`.
   Every `git push` auto-redeploys.

**Free-plan caveat:** the service sleeps after ~15 min idle; the first hit after idle takes
~30–50s to wake. Load the page a minute before you demo.

---

## Why Postgres, and what happens if it breaks

State used to live in `server/data/db.json`. On Render the filesystem is **ephemeral** and
the free plan **sleeps** — so every deploy *and every wake-from-sleep* would wipe all users,
sessions, portfolios, and their Alpaca account links. Users would lose their accounts, and
each re-signup would orphan a brand-new Alpaca brokerage account.

`render.yaml` now provisions Postgres and `DATABASE_URL` is wired in automatically.

The DB layer is **fail-soft**: if Postgres is unreachable, the server logs a loud warning and
falls back to the JSON file **rather than crashing**. A degraded boot is recoverable; a boot
crash during a demo is not. Check `/api/health` — it reports `"backend": "postgres" | "json"`.
If it says `json` in production, your database isn't connected.

---

## Honest status

**Real:** multi-user auth (scrypt + HttpOnly sessions), durable Postgres state, onboarding
that drives a real per-user Alpaca sandbox account, instant journal funding, the round-up
engine (integer-cent math, 17 tests), and round-ups that split across the chosen framework's
ETFs and place **real sandbox orders**.

**Still honest-but-fake:** the ESG **similarity %** and **exclusion counts** are modelled
placeholders, not sourced from fund holdings data. They're now labelled *"illustrative
estimates"* in the UI. Source them from real fund data before claiming otherwise — for a
product whose premise is honesty about moral compromise, that label matters.

**Not built:** real bank feed (Plaid), the donation/tithe flow is display-only, and
`ALPACA_FUND_AMOUNT` caps signups at ~10/day via the JNLC limit.
