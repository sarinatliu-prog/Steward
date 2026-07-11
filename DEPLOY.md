# Deploying Good Steward

The app is **one service**: the Node server (`server/api.mjs`) serves both the `/api`
routes and the built frontend (`dist/`). So you deploy a single web service.

> Deploying puts the app on a public URL, but it still runs on **fake money** — either the
> in-memory `FakeBroker` (default) or the **Alpaca sandbox**. Going to real money is a
> separate, deliberate switch gated by RIA/KYC work, not by deployment. See `GOING_LIVE.md`.

---

## What each file does

- `render.yaml` — Render blueprint (build + start commands, health check, env vars).
- `.node-version` — pins Node 22 on the host.
- `package.json` scripts:
  - `dev` — Vite frontend dev server (local only)
  - `api` — API only (local only)
  - `build` — Vite → `dist/`
  - `start` — **production**: serves `dist/` + `/api` on one port
  - `serve` — `build` then `start`
  - `test` — 17 unit tests

## Test the production build locally

```bash
npm run serve        # builds the frontend, then serves everything on :8787
# open http://localhost:8787            → the app
#      http://localhost:8787/api/health → {"ok":true,"broker":"fake"}
```

---

## Deploy to Render (recommended — free, ~5 minutes)

Render suits this app because Steward keeps state in memory and needs a long-running Node
process. **Avoid Vercel/Netlify** here — they're serverless and would reset the ledger on
every request. (That changes once you add a database.)

1. Push the latest code to GitHub (`sarinatliu-prog/Steward`). Confirm `.env` is **not**
   staged — it's git-ignored, but check:

   ```bash
   git status --short     # server/.env must NOT appear
   git add -A
   git commit -m "Make app deploy-ready"
   git push
   ```

   *(PowerShell note: `&&` doesn't work in Windows PowerShell 5.1 — run the commands on
   separate lines, or join them with `;`.)*

2. Go to <https://dashboard.render.com/blueprints> → **New Blueprint Instance** → pick the
   `Steward` repo. Render reads `render.yaml` automatically.

3. Click **Apply / Deploy**. First build takes a few minutes. You get an HTTPS URL like
   `https://good-steward.onrender.com`.

4. Every `git push` auto-redeploys.

**Free-plan caveat:** the service sleeps after ~15 min idle, so the first hit after idle
takes ~30–50s to wake. Load the page a minute before you demo — don't let a grader hit a
cold start and assume it's broken.

---

## Optional: make the deployed app place real Alpaca sandbox orders

By default the deployed app uses `FakeBroker` — no keys on the server, nothing to leak, and
the demo behaves identically. That's the right default for a public link.

To have the live site place actual orders in your Alpaca **sandbox**, set these in Render →
your service → **Environment** (never in `render.yaml`, never in a commit):

```
BROKER                 = alpaca
ALPACA_CLIENT_ID       = <your sandbox client id>
ALPACA_CLIENT_SECRET   = <your sandbox client secret>
ALPACA_TEST_ACCOUNT_ID = <your sandbox account id>
```

Two things to know:

- **Orders only fire on live purchases**, not on the seeded month of history. Seeding
  deliberately skips the broker — otherwise booting the server would fire dozens of orders
  and immediately fail on buying power.
- **Broker errors don't crash the app.** If Alpaca rejects an order (e.g. insufficient
  buying power), the server logs it, surfaces it as `brokerError` in `/api/portfolio`, and
  keeps the round-up engine running. The engine is the product; the order is a side effect.

---

## Honest status of what you're deploying

**Real:** the round-up engine (integer-cent math, no float drift, 17 passing tests), the
clearing ledger and $5 sweep threshold, the live purchase → round-up → sweep → invest
pipeline, and a working authenticated Alpaca Broker integration (OAuth2 client-credentials).

**Not real yet — fix in this order:**

1. **Onboarding doesn't reach the backend.** The ETF is hardcoded to `ESGV` regardless of
   which moral framework the user picks. The framework marketplace is the product's entire
   differentiator and it currently changes nothing.
2. **No persistence.** Every restart — including Render waking from sleep — wipes state back
   to the seeded month. (Render offers free Postgres; SQLite also fine.)
3. **The ESG stats are invented.** Exclusion counts, similarity %, and the stewardship score
   are hardcoded constants in `GoodSteward.jsx`. Label them as illustrative before anyone
   sees this — see `GOING_LIVE.md`.
4. Single hardcoded user (`"cole"`), no auth, no real bank feed, donation flow is display-only.
