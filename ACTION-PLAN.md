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

# Rail 2 — Giving (the RoundUp.org model)

RoundUp.org has already solved this exact problem in production, and their structure is
worth copying almost exactly. It also **corrects an assumption I had wrong earlier in this
document**: I flagged "platform collects from the user, then remits to a sponsor" as
money-transmission risk to be avoided. RoundUp.org does precisely that, at scale, as an
approved Visa/Mastercard partner. See "Why this isn't money transmission" below.

## How their model works

1. Donor links a Visa or Mastercard. Round-ups are calculated from **card transaction
   data**, not a bank feed.
2. Round-ups accrue as **a number only**. No money moves during the month.
3. On the 1st, **one card charge via Stripe** for the prior month's total.
4. That charge, net of fees, goes to **Our Change Foundation** — a third-party 501(c)(3)
   public charity and DAF sponsor.
5. The foundation distributes to the donor's chosen nonprofit by ACH or check, around the
   15th, and issues the tax receipt.

**Their economics:** $10 monthly minimum (charged even if round-ups total less), optional
donor-set cap, $2 platform fee per donation on a ~$32 average, nonprofit nets ~85% after
card processing and DAF admin. The DAF absorbs processing costs.

## Why this isn't money transmission

The likely mechanism is the **agent-of-payee exemption**, which most state money
transmitter statutes carry: if the platform is the authorized agent of the payee (the
charity), and payment to the agent discharges the payer's obligation, the platform isn't
transmitting money — it's collecting on the payee's behalf. This is the standard structure
for donation platforms.

**Confirm it, don't assume it.** The exemption's wording varies by state and depends on a
written agency agreement with the sponsor. It is a specific, cheap question for counsel,
and the answer determines the entire rail.

## What we copy, and what we change

**Copy:** accrue as a figure, single monthly charge, third-party DAF as recipient and
disburser, monthly minimum, donor-set cap, receipts from the sponsor.

**Change:** RoundUp.org needs Visa/Mastercard partner status because card transaction data
is their only input. **We already have Plaid reading transactions.** We can compute
round-ups from Plaid and charge a card on file through Stripe — same result, no card-network
approval, using a piece we have already built and tested.

Card-linking is worth revisiting later for accuracy and because it avoids bank
credentials, but it is not a launch dependency and I would not start there.

## Design decisions their FAQ forces us to make

| Decision | Their answer | Ours |
|---|---|---|
| Monthly minimum | $10, charged even if round-ups are less | Needed — micro-amounts don't clear card fees. Pick a number and say it plainly at signup |
| Donor cap | Optional, changeable | Copy it. Removes the main objection to linking a card |
| One nonprofit or many | One at a time | One is simpler and matches their finding |
| Purchases ending in .00 | Round up $1.00 | Copy it, and say so — otherwise it reads as a bug |
| Data exposure | Category + last 2 digits only | Copy. Steward's whole premise is not overstating; minimising what we see is on-brand |
| Failed charge | Retry, then pause the account | Copy |

## Sponsor: third party, or our own?

**Elevate Opportunity Inc.** — articles filed, no charity filings yet — could eventually be
our own DAF sponsor, capturing the whole rail. Worth noting first: **RoundUp.org didn't do
this.** They use a third-party foundation. That is a meaningful signal about the cost.

**The timeline fork — this is the whole decision.** There are two forms, and which one
Elevate can file depends entirely on whether it sponsors DAFs.

| | Form 1023-EZ | Form 1023 (full) |
|---|---|---|
| IRS processing | **80% within 22 days** | **80% within 191 days** (~6 months) |
| Can sponsor DAFs? | **No** | Yes |
| Gross receipts ceiling | ≤$50k/yr projected, ≤$250k assets | none |

A sponsoring organization under §4966(d)(1) that maintains — or **intends to maintain** —
donor-advised funds is [explicitly disqualified from Form 1023-EZ](https://www.irs.gov/instructions/i1023ez).
So "501(c)(3) in about six weeks" is accurate for a plain charity on the EZ track, and
simply unavailable if the plan is to sponsor DAFs. That path is the full 1023, and the IRS
[publishes 191 days for 80% of determinations](https://www.irs.gov/charities-non-profits/charitable-organizations/wheres-my-application-for-tax-exempt-status).
Simple merit-track cases can clear in ~90 days; complex ones run past a year.

**A second trap on the fast track:** Form 1023-EZ caps projected gross receipts at $50k/yr.
If donations are *received by* Elevate, they count toward that ceiling, and a round-up
platform that works will blow through it quickly. The EZ track is only genuinely available
if Elevate is not the entity receiving the donations.

Beyond the form, a DAF sponsor also carries: the public support test, §4966/§4967/§4958
excise rules, Form 990 Schedule D, state charitable solicitation registration in ~40 states,
an independent board, and grant due diligence on every recipient.

## The structural question nobody asked yet

**Does Steward need to be a nonprofit at all?**

RoundUp.org is a for-profit company. It retains $2 per donation. The charity — Our Change
Foundation — is a separate organisation it partners with. The mission is served by where
the money goes, not by the tax status of the company routing it.

That means the cleanest structure is likely:

- **The platform** (for-profit or nonprofit, your choice) operates the product and takes a
  transparent fee.
- **A third-party DAF sponsor** (Ren, AEF, Our Change Foundation) receives donations, issues
  receipts, and disburses.
- **Elevate Opportunity** becomes whatever is most useful — a recipient nonprofit, the
  operating entity, or eventually a sponsor — without any of it blocking launch.

**Recommendation: launch on a third-party sponsor, build Elevate Opportunity in parallel.**

- We cannot wait ~6 months for a full 1023 determination to ship anything, and the 22-day
  EZ track is closed to DAF sponsors.
- Even RoundUp.org, at scale, chose not to run their own.
- Operating on someone else's rail first teaches us what the obligations actually are
  before we assume them.
- If Elevate gets its determination, migrating the sponsor is a vendor swap behind one
  interface — which is why Phase 3 puts it behind a `GivingSponsor` abstraction.

**A cheaper interim role for Elevate:** it does not have to be the *sponsor*. It could be
the designated *recipient* nonprofit, or work under a **fiscal sponsor** — an existing
501(c)(3) that accepts funds on a project's behalf for a fee, typically 5–8%. That gets
Elevate operating in months rather than a year, without the DAF-sponsor burden.

## Candidate third-party sponsors

| Option | Model | Why it might fit | What to check |
|---|---|---|---|
| **Our Change Foundation / Change** | The DAF behind RoundUp.org | Purpose-built for distributing to nonprofits of any size, already proven on this exact use case | Whether they take other platforms as partners, or are exclusive to RoundUp.org |
| **[Goodstack](https://goodstack.io/)** (formerly Percent) | Donation API; vets causes and disburses | Names **round-ups in-app** as a supported donation type; owns vetting through disbursement | Fee schedule; agent-of-payee posture; whether they'll contract as our agent |
| **[Every.org](https://docs.every.org/docs/intro)** | Free nonprofit/donation APIs; 501(c)(3) | Free APIs, 1M+ nonprofits searchable | Whether the API supports programmatic threshold/recurring donations, not just hosted links |
| **[Daffy](https://www.daffy.org/)** | Modern DAF, low minimums | Built for small amounts; user-owned DAF makes the donor unambiguous | Third-party API availability is unconfirmed |
| **[Endaoment](https://endaoment.org/)** | Onchain DAF, 501(c)(3) | Explicitly serves fintech platforms with white-label and custom integrations | Onchain settlement may not suit a consumer spare-change product |

**Contact first: Our Change Foundation** (proven on this exact model), then Goodstack and
Every.org.

## How our round-up flows

1. Plaid reads transactions → we compute spare change. **A number, not money.**
2. Month closes. Total is compared against the minimum and the donor's cap.
3. **One Stripe charge** to the donor's card on file.
4. Funds settle to the sponsor per the agency agreement; sponsor disburses and receipts.

## Second-order issues

- **Irrevocability.** DAF contributions are legally irrevocable. Current copy promises users
  they can change their rate or opt out — true only while nothing is disbursed. It must
  change the day it isn't. Note RoundUp.org handles this by letting donors switch nonprofit
  and pause future giving, never by refunding.
- **Tax receipts** come from the sponsor. Never imply a deduction we don't control.
- **PCI.** We store a card on file. Use Stripe's vault and tokenisation and stay out of
  scope — never touch a PAN.
- **Fee transparency.** RoundUp.org publishes theirs ($2, ~85% net). Given Steward's premise,
  ours should be at least as legible.

# Migration

## Phase 0 — Diligence (blocks everything; do first)

- [ ] SnapTrade: commercial trading coverage by broker; fractional/notional support by
      broker; pricing; production approval requirements
- [ ] Giving sponsors: agency agreement, fee schedule, minimums, API maturity — contact
      Our Change Foundation first, then Goodstack and Every.org
- [ ] Elevate Opportunity: what a 501(c)(3) determination actually requires, and whether a
      fiscal sponsor is the faster interim route
- [ ] Counsel: does this structure clear both adviser status and money transmission
      (one hour, with `compliance/` and this document in hand)

**Do not start Phase 3 until the agent-of-payee answer is in writing.**

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

- [ ] Sponsor integration behind a `GivingSponsor` interface (so Elevate can replace the
      third party later without touching anything else)
- [ ] Stripe card-on-file with tokenisation; never handle a PAN
- [ ] Nonprofit selection from the sponsor's catalogue (one at a time)
- [ ] Monthly close: total, apply minimum and cap, single charge
- [ ] Failed-charge retry then pause
- [ ] Donation history + receipts surfaced from the sponsor
- [ ] Copy rewrite: irrevocability, who the donor is, where the receipt comes from, the fee

## Phase 4 — Repositioning

- [ ] Hero and marketing copy: giving is the product, investing is the alignment layer
- [ ] `SECURITY.md` and `compliance/AML.md` cut down to what the giving rail requires
- [ ] Retire `GO-LIVE.md`'s Alpaca track

---

# Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Fractional trading unsupported at most brokers | **High** — investing rail may not work | Phase 0 diligence. Fallback: whole-share investing on a monthly batch, or investing-rail-optional |
| Agent-of-payee exemption doesn't hold in some states | **High** — would reintroduce money transmission | Counsel question in Phase 0; written agency agreement with the sponsor |
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
