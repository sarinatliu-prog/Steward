# Plan — The Ethical Portfolio Analyzer

**One-line:** connect your brokerage, and we show you which of your holdings conflict with
the ethical lines you care about. Read-only. We never trade and never touch your money.

This doc replaces the earlier strategy files (Alpaca broker build, deposits, go-live,
sprint, sponsor outreach). Their still-useful conclusions are folded in below.

---

## Why this shape

Three earlier architectures each collapsed under one requirement:

1. **We open and run brokerage accounts (Alpaca Broker API).** Required partner approval, a
   CIP program, SSN handling, money movement, and put us on the edge of investment-adviser
   status. Months of paperwork before a single real dollar.
2. **We pick portfolios for users.** Assigning allocations and scoring securities *is*
   investment advice. That's the adviser prong, and it's structural — no fee model escapes it.
3. **We move charitable money ourselves.** That's money transmission: state-by-state
   licensing, worse than the RIA problem.

The analyzer sidesteps all three. We read holdings and explain them. We never select
securities, never hold money, never open accounts. There is no advice (we recommend
nothing), no custody (we touch nothing), and no brokerage relationship of our own (the user
keeps theirs). It is the piece with the least regulatory surface and the most obvious value:
**most people have no idea what's actually inside their portfolio.**

## What's built and proven

The backend is done and tested end-to-end against SnapTrade's live sandbox:

- `server/lib/snaptrade.js` — register user, mint a **read-only** connection portal, read
  positions across all connected accounts. Uses the official SDK (HMAC signing is the
  classic time-sink; we don't hand-roll it).
- `server/lib/screens.js` — the ethical screens. Each flag names offending companies by
  ticker with a one-line, checkable reason. A curated starter set of large, widely-held
  names — **not** a complete holdings database, and the UI says so.
- `server/lib/analyzer.js` — pure function: (positions, active screens) → flagged holdings
  plus per-flag exposure totals. 14 unit tests.
- Routes: `GET /api/screens` (public catalogue), `POST /api/screens/select`,
  `POST /api/brokerage/connect` (returns portal URL), `GET /api/analysis`.

Verified flow: signup → pick screens → connect the SnapTrade sandbox → analysis returns
real holdings with GOOGL flagged for surveillance, while funds and crypto are correctly
marked "not analyzed" rather than "clean."

## Honesty rules (non-negotiable, this is the product's whole premise)

- Every flag is a plain factual claim about what a company does. No opaque ESG scores.
- We analyze **individual stocks**. A broad index fund holds hundreds of names; we do NOT
  claim to see inside one. An unflagged fund is "not analyzed," never "clean."
- A clean result means "none of the names we track," never "audited clean." Say it in the UI.
- The user picks the flags. We only ever explain, never judge for them.

---

## Roadmap

### Now — the analyzer (in progress)
- [x] SnapTrade read-only backend + screens + analyzer, tested against live sandbox
- [ ] Frontend: pick flags → connect brokerage → results with reasons and exposure
- [ ] Copy/positioning around "see what you own"

### Next — tear out the dead broker code
Remove what the old architecture needed and this one doesn't: `account-service.js`, the
deposit/withdraw/transfer routes and funding screen, the CIP onboarding and SSN handling,
firm-account journaling, and every `ALPACA_*` variable. Keep auth, the security hardening,
Plaid, the round-up engine, and the ledger — the giving rail (below) still wants them.

### Later — giving (the RoundUp.org model)
When the analyzer has users, add giving as a **separate rail**, structured exactly like
RoundUp.org: round-ups accrue as a number, one monthly card charge via Stripe, funds to a
third-party 501(c)(3) DAF that receipts and disburses. **We never hold the money** — the
agent-of-payee structure (a written agency agreement with the sponsor) is what keeps this
out of money-transmission territory. Confirm with counsel before taking a dollar.

- **First call:** Change (getchange.io) — the infrastructure behind RoundUp.org; the 1.3M
  nonprofit directory and Our Change Foundation (the DAF) come bundled. Then Ren/Renaissance
  Charitable and AEF, whose business is platform partnerships.
- The round-up engine (integer-cent, 17 tests) and Plaid sync are already built for this.

### Later — trading (optional, only if it earns it)
SnapTrade can place orders "where enabled," but OAuth connections are read-only and
fractional support varies by broker. Only pursue with explicit per-trade user approval
(discretionary authority is an adviser hallmark) and after verifying fractional coverage.

---

## Entity notes (Elevate Opportunity Inc.)

- **The platform doesn't need to be a nonprofit.** RoundUp.org is a for-profit partnered
  with a separate foundation. Mission is served by where the money goes, not the operator's
  tax status.
- **Two 501(c)(3) clocks:** Form 1023-EZ clears ~22 days but *disqualifies* any org that
  intends to maintain donor-advised funds, and caps gross receipts at $50k. Full Form 1023
  is ~6 months. So "we'll be a DAF sponsor ourselves" is the slow, heavy path — launch on a
  third-party sponsor and revisit only if there's reason to.
- Elevate's most useful near-term roles: the operating entity, or a recipient nonprofit on
  the fast EZ track — neither of which blocks the analyzer.

## Config

`server/.env` (gitignored) holds `SNAPTRADE_CLIENT_ID` and `SNAPTRADE_CONSUMER_KEY`.
Everything else the analyzer needs is already wired. `RESEND_API_KEY` + a verified domain is
still required for real verification/reset email; `APP_URL` sets the base for email links.

See `SECURITY.md` for the security posture and `compliance/` for the CIP/AML drafts (mostly
relevant to the later giving rail, not the analyzer).
