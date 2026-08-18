# Steward — the ethical portfolio analyzer

**Connect your brokerage, read-only, and see which of your holdings conflict with the
ethical lines you care about — including the companies hiding inside your index funds.**
Steward never trades and never moves money.

Try it without an account: type any ticker on the home page and see what's inside it.
Even a plain S&P 500 fund holds oil majors, weapons makers, and tobacco giants.

---

## What it does

1. **Pick your lines** — fossil fuels, weapons, tobacco, gambling, surveillance, and more
   (12 screens, ~83 companies). We only ever flag what you turn on.
2. **Connect your brokerage** — one read-only link via SnapTrade (Robinhood, Schwab,
   Fidelity, E*TRADE, Webull, …). We can see your holdings; we can't touch them.
3. **See what clashes** — the stocks you hold directly *and* the flagged companies inside
   the index funds you own, each with a one-sentence reason.

## What it doesn't do — by design

- **No trading, no money movement.** The SnapTrade connection is read-only.
- **No advice.** You choose the screens and the funds; we only explain what's there.
- **No accounts, no SSNs.** We never open a brokerage account or collect identity data —
  your existing broker already did that.

These three "don'ts" are why Steward isn't an investment adviser, a money transmitter, or
a broker-dealer. See [`compliance/REGULATORY.md`](compliance/REGULATORY.md).

## Honesty rules (the product's whole premise)

- Every flag is a plain, checkable fact about what a company does — never an opaque score.
- We look inside the funds we **know** (major index funds, from published holdings). A
  fund we don't know is marked "not analyzed," never "clean."
- A clean result means "none of the names we track," never "audited pure."
- We name the companies inside a fund; we never fake a per-company dollar amount.

---

## Run it locally

Requires Node 22+.

```bash
npm install
cp server/.env.example server/.env    # add your SnapTrade keys (see below)
npm start                             # API server on :8787
npm run dev                           # Vite dev server on :5173 (proxies /api → :8787)
npm test                              # unit tests (49): engine, analyzer, funds, SIC
npm run lint                          # oxlint
npm run lint:data                     # validate the ethical dataset
npm run build                         # production build to dist/
```

Open http://localhost:5173. The home-page ticker lookup works immediately with no keys.
Connecting a brokerage needs SnapTrade credentials in `server/.env`:

```
SNAPTRADE_CLIENT_ID=...
SNAPTRADE_CONSUMER_KEY=...
```

Get them at https://dashboard.snaptrade.com. In SnapTrade's connection portal you can link
the **SnapTrade Sandbox** ("for testing only") to exercise the full flow with fake
holdings — no real brokerage needed.

## Layout

| Path | What |
|---|---|
| `server/lib/screens.js` | the ethical screens — companies by ticker, each with a reason |
| `server/lib/funds.js` | fund look-through — known index funds and their constituents |
| `server/lib/sic.js` | SIC industry code → screens (the EDGAR enrichment mapping) |
| `server/lib/enriched.js` | loads the generated EDGAR dataset; industry-classified flags |
| `server/lib/analyzer.js` | matches holdings (and fund contents) against chosen screens |
| `server/lib/snaptrade.js` | read-only brokerage connection (register, portal, positions) |
| `server/generated/companies.json` | EDGAR-classified companies (built by the enrich script) |
| `server/api.mjs` | the HTTP server: auth, screens, lookup, connect, analysis |
| `src/Analyzer.jsx` | the entire frontend — landing, hero lookup, auth, dashboard |
| `scripts/enrich-edgar.mjs` | pull SEC data → `companies.json` (`npm run enrich`) |
| `scripts/lint-data.mjs` | validate the dataset (`npm run lint:data`) |

## The data

Two layers feed the analyzer:

- **Curated** (`screens.js`) — well-known companies, each with a precise, reasoned flag.
- **Enriched** (`companies.json`, built from free SEC EDGAR data by `npm run enrich`) —
  industry-classified flags across the market, for the clear-cut industries. Fuzzy
  categories (surveillance, gambling, private prisons) stay curated + AI-classified.

`allFlagsFor()` unions the two, curated winning. The UI shows when the dataset was last
updated. Run `npm run enrich` to (re)build it (~20 min for the full ~10.4k filers, no API
key), and `npm run lint:data` to validate it.

## API (the routes that matter)

| Route | Auth | Does |
|---|---|---|
| `GET /api/lookup?symbol=` | public | analyze one ticker against all screens (powers the hero) |
| `GET /api/screens` | public | the screen catalogue |
| `POST /api/signup` · `/api/login` · `/api/logout` | — | accounts |
| `POST /api/screens/select` | session | save which screens you turned on |
| `POST /api/brokerage/connect` | session | returns a SnapTrade read-only portal URL |
| `GET /api/analysis` | session | your holdings, screened, with fund look-through |

## Docs

- [`PLAN.md`](PLAN.md) — what this is, why, and where it's going
- [`SECURITY.md`](SECURITY.md) — security posture
- [`compliance/REGULATORY.md`](compliance/REGULATORY.md) — why the analyzer is regulatorily clear
