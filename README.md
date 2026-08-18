# Steward — the ethical portfolio analyzer

Connect your brokerage read-only, and see which of your holdings conflict with the
ethical lines you care about, and why. Steward never trades and never moves money.

## How it works

1. **Choose your ethical lines** — fossil fuels, weapons, tobacco, surveillance, and more.
2. **Connect your brokerage** — read-only, via SnapTrade (Robinhood, Schwab, Fidelity, …).
3. **See what you own** — the individual stocks that conflict with your flags, with a
   plain, checkable reason for each.

We analyze individual stocks. We do not claim to see inside a broad index fund, so an
unflagged fund is "not analyzed," never "clean." A clean result means "none of the names
we track."

## Run it locally

```bash
npm install
cp server/.env.example server/.env   # add your SnapTrade keys
npm run dev                          # frontend on :5173, proxies /api to :8787
npm start                            # the API server on :8787 (run in another shell)
npm test                             # unit tests (round-up engine + analyzer)
```

## Layout

- `server/lib/snaptrade.js` — read-only brokerage connection (register, portal, positions)
- `server/lib/screens.js` — the ethical screens (companies by ticker, with reasons)
- `server/lib/analyzer.js` — matches holdings against chosen screens (pure, tested)
- `server/api.mjs` — the HTTP server: auth, screens, connect, analysis
- `src/Analyzer.jsx` — the whole frontend

See `PLAN.md` for the roadmap and `SECURITY.md` for the security posture.
