# Action Plan — Two Rails

**Status:** proposed, not started. Supersedes the Alpaca Broker API track in `GO-LIVE.md`.
**Date:** 2026-08-18

---

## The idea in one paragraph

Steward has two mechanics — round-ups and values-aligned investing — and has been trying
to run both over a single rail (a brokerage account we administer). That rail is what
forces us into Alpaca Broker API partner approval, a CIP/AML program, money-movement
plumbing, and the adviser question. **Split them.** Round-ups fund *giving*, over a
donation rail built for micro-amounts. Investing happens in a brokerage account the user
*already has*, connected read-and-trade, with their existing money. Neither rail requires
us to hold customer funds or open customer accounts.

## What this eliminates

| Gone | Why |
|---|---|
| Alpaca Broker API partner approval | We stop opening accounts; months off the critical path |
| Our CIP program | The user's existing broker already did it |
| SSNs on our servers | Never collected |
| ACH relationships, deposits, withdrawals | We never move money into a brokerage account |
| Firm/sweep account and journaling | Nothing to journal |
| `AUTO_FUND_NEW_ACCOUNTS` | Nothing to fund |
| Charity registration for us | The sponsor is the 501(c)(3) |
| Adviser status | User picks funds, sets allocation, approves each trade |

## What we give up — read this before agreeing

1. **"Round up your spare change and invest it" stops being literally true.** Spare change
   *gives*. The existing portfolio *aligns*. That is a different product and a different
   pitch, and the hero copy changes again.
2. **Investing requires the user to already have a brokerage account.** No account, no
   investing half. That's a real segment of the market gone.
3. **We can never auto-invest new money.** Any investing happens over cash already in
   their account.
4. **We inherit each broker's API limits** — fractional support, order types, rate limits.
5. **Two vendor dependencies** (SnapTrade + a giving sponsor) instead of one.

---

# Rail 1 — Investing (SnapTrade)

## What SnapTrade is

A brokerage aggregator: Plaid, but for brokerage accounts. We are an API customer, not a
partner of a broker-dealer. There is no securities approval process — a dashboard signup,
a commercial API key, and an approval + billing step before production.

Per [SnapTrade's getting-started docs](https://docs.snaptrade.com/docs/getting-started),
the commercial model is:

1. Create a **Commercial API key** in their dashboard.
2. Register each end user → receive a `userId` + `userSecret` pair we store.
3. Generate a **Connection Portal URL**; the user authenticates with their own broker there.
4. Read accounts, positions, balances, order history.
5. Place orders "where enabled."

Coverage is [20+ retail brokerages](https://snaptrade.com/brokerage-integrations),
including Robinhood, Schwab, Fidelity, E\*TRADE, Webull, Public, Alpaca, Questrade.

## The three things to verify before writing code

These are not details — any one of them can sink the investing rail.

**1. Trading support per broker.** The docs say trading is available "where enabled," and
that **OAuth connections are currently read-only**. Read coverage is much broader than
trade coverage. Get the list of brokers where *commercial* trading is enabled, and confirm
which connection type each uses.

**2. Fractional orders.** A $5 round-up split across three funds is $1–2 per fund. The API
exposes a fractionability flag per instrument (and returns `null` when unknown), and order
quantities accept decimals — so the plumbing exists. What we need is **which brokers
actually accept fractional/notional ETF orders through the API**. If the answer is "two of
twenty," the investing rail only works for those users.

**3. Pricing.** Per-connected-user billing. Get the number before designing onboarding,
because it sets the floor on unit economics.

## What we build

- A `Broker` interface with one implementation, `SnapTradeBroker`, replacing
  `AlpacaBroker`. `FakeBroker` stays for tests.
- User registration → store `userId` / `userSecret` (secrets, encrypted at rest).
- Connection Portal launch + return handling, plus reconnection when a link breaks.
- Read holdings and cash balance; surface both.
- Place orders **only on explicit user approval** (see below).

## The approval step is a feature, not friction

Every trade must be user-initiated: we show the amount, the funds, the split they chose,
and they press invest. Discretionary authority over someone's account is a hallmark of an
advisory relationship, and it is the thing we are structurally avoiding. An approval tap
is what makes "self-directed" true rather than asserted.

This also reduces order volume, which softens the fractional-share exposure.

---

# Rail 2 — Giving

## The question that decides the whole design

**Who is the payer of record, and does money ever rest with us?**

If Steward charges the user and then remits to a sponsor, we are holding funds belonging
to others for transmission to a third party. That is the money transmitter fact pattern:
state-by-state licensing, surety bonds, minimum capital, audits. **Worse than the RIA
problem we started with.**

If the sponsor (or their processor) charges the user directly, with the user as payer of
record and the sponsor as recipient, we are a referrer and never touch the money.

Every vendor below must be evaluated against that single question first. Note the trap:
[Goodstack's Donations API](https://docs.goodstack.io/docs/guides/Monetary%20donations/donations-api)
describes creating donation records and Goodstack then **"request[ing] payment from you"** —
which reads as *platform-funded*, i.e. we collect from users and pay them. That is the
model we must not accept without restructuring. Ask each vendor for the donor-direct flow
explicitly.

## Candidate sponsors

| Option | Model | Why it might fit | What to check |
|---|---|---|---|
| **[Goodstack](https://goodstack.io/) (formerly Percent)** | Donation API; vets causes and disburses | Explicitly supports **round-ups in-app** as a donation type; owns nonprofit onboarding through disbursement; 13M+ causes | The payer-of-record question above. Whether a donor-direct flow exists, or only platform-funded |
| **[Every.org](https://docs.every.org/docs/intro)** | Free nonprofit/donation APIs; 501(c)(3) | Free APIs, 1M+ nonprofits searchable, donate-link and donate-button flows put the charge on their side | Whether the API supports programmatic recurring/threshold donations, not just hosted links. Their docs don't state fund custody — ask directly |
| **[Daffy](https://www.daffy.org/)** | Modern DAF, low minimums, flat monthly fee | Built for small amounts, which is exactly our shape; the user owns the DAF so they are unambiguously the donor | API availability for third-party apps is not clearly public — treat as unconfirmed until they confirm |
| **[Endaoment](https://endaoment.org/)** | Onchain DAF, 501(c)(3) | Explicitly serves fintech platforms with custom integrations, SSO, and white-label | Onchain settlement may be a poor fit for a spare-change consumer product; check fiat-in/fiat-out |
| **Charityvest** | DAF for individuals and companies | Another low-minimum DAF | API maturity for third-party integration |
| Fidelity / Schwab / Vanguard Charitable | Traditional DAF | Scale and trust | No third-party app APIs; $50-ish grant minimums; not viable for micro-amounts |

**Shortlist to actually contact: Goodstack, Every.org, Daffy.** Goodstack because round-ups
are a named use case; Every.org because free and API-first; Daffy because user-owned DAFs
sidestep both the money-transmission and donor-of-record problems at once.

## How the round-up actually flows

1. Plaid reads transactions → we compute spare change. **This is a number, not money.**
2. The accrued figure crosses a threshold (say $5, or a monthly batch).
3. We call the sponsor's API to create a donation for that amount.
4. **The sponsor's processor charges the user's linked payment method**, user as payer of
   record.
5. The sponsor disburses to the cause and issues the receipt.

At no point does a dollar sit in a Steward account. If a vendor cannot support step 4 in
that shape, they are the wrong vendor.

## Second-order issues

- **Irrevocability.** DAF contributions are legally irrevocable. Current copy promises users
  they can change their rate or opt out — true only while nothing is disbursed. That copy
  must change the day it is.
- **Tax receipts.** The sponsor issues them. We must never imply a deduction we don't
  control.
- **Are we still soliciting?** A sponsor moves most of the state charitable-solicitation
  burden, but actively promoting giving may still count somewhere. One question for counsel.
- **Fees on micro-amounts.** Percentage fees on $0.40 are brutal. Ask about minimums,
  per-transaction fees, and whether batching monthly materially improves the economics.

---

# Migration

## Phase 0 — Diligence (blocks everything; do first)

- [ ] SnapTrade: commercial trading coverage by broker; fractional/notional support by
      broker; pricing; production approval requirements
- [ ] Giving sponsors: payer-of-record flow, fee schedule, minimums, API maturity — contact
      Goodstack, Every.org, Daffy
- [ ] Counsel: does this structure clear both adviser status and money transmission
      (one hour, with `compliance/` and this document in hand)

**Do not start Phase 2 until the payer-of-record answer is in writing.**

## Phase 1 — Teardown (safe to start now; identical under any funding model)

Delete:
- `server/lib/account-service.js` — account creation, CIP payload, journaling, ACH,
  deposits, withdrawals, the charity account
- `/api/profile` account-creation branch; `/api/bank/*`, `/api/deposit`, `/api/withdraw`,
  `/api/transfers`
- CIP collection in onboarding (SSN, disclosures, agreement) — **the whole reason that
  work existed goes away**
- The funding screen in `src/GoodSteward.jsx`
- `AUTO_FUND_NEW_ACCOUNTS`, `ALPACA_*` env vars, the firm-account machinery
- `compliance/CIP.md` (retire with a note explaining why, don't just delete)

Keep: auth, sessions, security hardening, the round-up engine and its 17 tests, the
ledger, Plaid transaction sync, the statement.

## Phase 2 — Investing rail

- [ ] `SnapTradeBroker` behind the existing `Broker` interface
- [ ] User registration + `userSecret` storage (encrypted)
- [ ] Connection Portal launch, return, and reconnection
- [ ] Holdings + cash balance display
- [ ] Explicit per-investment approval flow
- [ ] Graceful degradation when a broker doesn't support fractional orders

## Phase 3 — Giving rail

- [ ] Sponsor integration behind a `GivingSponsor` interface (so we can switch vendors)
- [ ] Cause selection from the sponsor's catalogue
- [ ] Threshold or monthly batch trigger
- [ ] Donation history + receipts surfaced from the sponsor
- [ ] Copy rewrite: irrevocability, who the donor is, where the receipt comes from

## Phase 4 — Repositioning

- [ ] Hero and marketing copy: giving is the product, investing is the alignment layer
- [ ] `SECURITY.md` and `compliance/AML.md` cut down to what the giving rail requires
- [ ] Retire `GO-LIVE.md`'s Alpaca track

---

# Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Fractional trading unsupported at most brokers | **High** — investing rail may not work | Phase 0 diligence. Fallback: whole-share investing on a monthly batch, or investing-rail-optional |
| Sponsor requires platform-funded donations | **High** — reintroduces money transmission | Reject that model; shortlist has three candidates for this reason |
| Users don't have brokerage accounts | Medium | Giving rail works standalone; investing becomes an upgrade |
| Two vendor dependencies | Medium | Interface both behind our own abstractions from day one |
| Brokerage connections break and need re-auth | Medium | Reconnection flow in Phase 2, not later |
| Copy over-promises again | Medium | Nothing ships claiming automatic investing of new money |

---

# The bet

The current architecture is a fintech that does charity as a feature, and it requires
becoming a regulated financial institution to ship. The proposed one is a giving product
with an investing layer, and it requires integrating two APIs. The second is a company
this team can actually operate.

The honest cost is the tagline. "Round up your spare change and invest it" was the pitch.
The version that ships is "your spare change gives, and your portfolio aligns."
