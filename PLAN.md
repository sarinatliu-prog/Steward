# Plan — The Ethical Portfolio Analyzer

**One line:** connect your brokerage read-only, and see which of your holdings — including
what's inside your index funds — conflict with the ethical lines you choose. No trading,
no money movement, no advice.

---

## Why this shape

Three earlier product ideas each collapsed under one requirement:

1. **We open and run brokerage accounts (Alpaca Broker API).** Needed partner approval, a
   CIP program, SSN handling, money movement, and edged toward investment-adviser status —
   months of paperwork before a single real dollar.
2. **We pick portfolios for users.** Assigning allocations and scoring securities *is*
   investment advice; no fee model escapes that.
3. **We move charitable money ourselves.** That's money transmission — state-by-state
   licensing, worse than the adviser problem.

The analyzer sidesteps all three. We **read and explain**. We never select securities,
hold money, or open accounts. No advice, no custody, no brokerage relationship of our own —
the least regulatory surface, and the most obviously useful thing: **most people have no
idea what's actually inside their portfolio, especially their index funds.**

## What's built

Backend, tested end-to-end against SnapTrade's live sandbox:

- **`screens.js`** — the ethical screens. 12 flags, ~83 companies, each with a plain,
  checkable one-line reason. A curated set of widely-held names, not a complete database —
  the UI says so.
- **`funds.js`** — fund look-through. Major index funds (VOO, SPY, IVV, VTI, ITOT, QQQ, and
  the common mutual-fund equivalents) mapped to the screened companies they hold, from
  published constituents. Unknown funds stay "not analyzed."
- **`analyzer.js`** — pure function. Direct stocks get dollar attribution; funds get
  company-level look-through (we name the companies inside, never fake per-name dollars).
  Plus `lookupSymbol()` for the public one-ticker hero widget. 21 unit tests.
- **`snaptrade.js`** — read-only connection: register a user, mint a read-only portal, read
  positions. Official SDK (HMAC signing is the classic time-sink; we don't hand-roll it).
- **Routes:** public `GET /api/lookup` and `GET /api/screens`; session-gated
  `POST /api/screens/select`, `POST /api/brokerage/connect`, `GET /api/analysis`.

Frontend (`src/Analyzer.jsx`): a dark-green liquid-glass hero with a **live ticker
analyzer** (auto-loads VOO so a visitor instantly sees the S&P 500 holds 42 flagged
companies), then a light "paper" theme for auth and the signed-in dashboard.

## Honesty rules (non-negotiable — this is the whole premise)

- Every flag is a plain factual claim about what a company does. No opaque scores.
- We look inside the funds we **know**; unknown funds are "not analyzed," never "clean."
- A clean result means "none of the names we track," not "audited clean."
- We name the companies inside a fund; we never invent a per-company dollar figure.
- Index membership shifts over time — the constituent lists are published-holdings-based,
  and the UI discloses that.

---

## Roadmap

### Now — deepen the analyzer
- [x] Screens, fund look-through, read-only SnapTrade, live hero widget — all shipped.
- [ ] **Live holdings data.** The fund constituent lists are curated and can go stale.
      Pull real holdings from a data provider so a fund's contents are never out of date.
- [ ] **Wider coverage** — sector, ESG, international, and more mutual funds; more companies
      per screen.
- [ ] **Symbol normalization** — class shares differ by broker (`BRK.B` vs `BRK-B` vs
      `BRKB`); normalize before matching so nothing slips through on real connections.

### Later — giving (the RoundUp.org model)
When the analyzer has users, add giving as a **separate rail**: round-ups accrue as a
number, one monthly card charge via Stripe, funds to a third-party 501(c)(3) DAF that
receipts and disburses. **We never hold the money** — the agent-of-payee structure (a
written agency agreement with the sponsor) keeps this out of money-transmission territory.
Confirm with counsel before taking a dollar. First call: Change (getchange.io), the
infrastructure behind RoundUp.org. The round-up engine (integer-cent, 17 tests) already
exists for this. See [`compliance/REGULATORY.md`](compliance/REGULATORY.md).

### Later — trading (optional, only if it earns it)
SnapTrade can place orders "where enabled," but OAuth connections are read-only and
fractional support varies by broker. Only with explicit per-trade user approval
(discretionary authority is an adviser hallmark), and after verifying fractional coverage.

---

## Entity notes (Elevate Opportunity Inc.)

- **The platform needn't be a nonprofit.** RoundUp.org is a for-profit partnered with a
  separate foundation. Mission is served by where money goes, not the operator's tax status.
- **Two 501(c)(3) clocks:** Form 1023-EZ clears ~22 days but *disqualifies* any org that
  intends to sponsor donor-advised funds, and caps gross receipts at $50k. Full Form 1023 is
  ~6 months. So "be our own DAF sponsor" is the slow, heavy path — launch on a third-party
  sponsor and revisit only if there's reason to.
- The analyzer needs none of this; it's relevant only to the future giving rail.

## Config

`server/.env` (git-ignored): `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`.
For production email (verification / password reset): `RESEND_API_KEY` + a verified sending
domain, and `APP_URL` for the links. `DATABASE_URL` switches storage from a local JSON file
to Postgres. See [`SECURITY.md`](SECURITY.md).
