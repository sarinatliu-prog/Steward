# Deploying Good Steward

The app is **one service**: the Node server (`server/api.mjs`) serves both the `/api`
routes and the built frontend (`dist/`). So you deploy a single web service.

> **Note:** deploying puts the app on a public URL but it still runs on the **Alpaca
> sandbox** (fake money). Going to real money is a separate, deliberate switch and is
> gated by the RIA/KYC work — not by deployment.

## What each file does
- `render.yaml` — Render blueprint (build + start commands, health check, env vars).
- `.node-version` — pins Node 22 on the host.
- `package.json` scripts: `build` (Vite → `dist/`), `start` (runs the server), `serve` (build + start).

## Test the production build locally
```bash
npm run serve        # builds the frontend, then serves everything on :8787
# open http://localhost:8787   → the app
# http://localhost:8787/api/health → {"ok":true}
```

## Deploy to Render (recommended)
1. Make sure the latest code is pushed to GitHub (`sarinatliu-prog/Steward`):
   ```bash
   git add -A && git commit -m "Make app deploy-ready" && git push
   ```
2. Go to <https://dashboard.render.com/blueprints> → **New Blueprint Instance** →
   pick the `Steward` repo. Render reads `render.yaml` automatically.
3. In the service's **Environment** tab, set the secret values (they are NOT in git):
   - `ALPACA_CLIENT_ID` — your sandbox client id
   - `ALPACA_CLIENT_SECRET` — your sandbox secret
   - `ALPACA_TEST_ACCOUNT_ID` — the sandbox account id (optional for the demo)
   (`ALPACA_AUTH_URL` and `ALPACA_BASE_URL` are already set to sandbox in `render.yaml`.)
4. Click **Apply / Deploy**. First build takes a few minutes. You get a URL like
   `https://good-steward.onrender.com` with HTTPS.
5. Every `git push` auto-redeploys.

## Known limits (fine for a demo, fix before real users)
- **In-memory data:** the ledger resets on restart/redeploy. Add a database
  (Render has free Postgres) for persistence.
- **Single demo user (`cole`), FakeBroker:** the live API still uses the simulated
  broker. Wiring per-user real sandbox accounts (create → fund → invest) is the next
  milestone — the `server/alpaca-*.mjs` scripts already prove each step works.
- **Free plan sleeps** after inactivity; first hit after idle is slow to wake.
