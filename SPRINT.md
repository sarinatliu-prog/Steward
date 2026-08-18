# Sprint to Live — Giving Rail

**Goal:** a working product that takes real round-ups from real people and delivers real
money to real nonprofits, as fast as honestly possible.
**Scope:** giving only. Investing is deferred — it still has the unresolved
fractional-share risk, and it isn't needed to ship something true.

---

## What "live" looks like

A person can, unassisted:

1. Sign up and verify their email.
2. Search a directory and pick **one nonprofit** — any US 501(c)(3) in good standing.
3. Link their bank so we can see purchases, and put a card on file.
4. Spend normally for a month while round-ups accrue **as a number**, visible to them,
   with a cap they set.
5. On the 1st, get **one card charge** for the prior month's total.
6. Receive a **tax receipt from the sponsoring 501(c)(3)**.
7. The nonprofit gets the money.
8. Pause, cap, switch nonprofit, or cancel at any time, from their dashboard.

That is the whole product. Everything else is later.

**The thing that makes this small:** per RoundUp.org's nonprofit FAQ, **nonprofits do not
sign up.** Every US 501(c)(3) in good standing with the IRS already has a listing; they only
register with the foundation when there's money to collect. There is no supply side to
build and no cold-start problem — the directory comes from IRS data or the sponsor's
catalogue on day one.

---

## Critical path

Everything is gated by one thing:

> **A signed agreement with a 501(c)(3) DAF sponsor.**

Without it there is no recipient, no receipts, no disbursement, and no legal basis for
collecting. Nothing else on this list matters until it exists. **Start it today.**

| Dependency | Owner | Realistic time | Blocks |
|---|---|---|---|
| **DAF sponsor agreement** | You | 2–6 weeks | Everything |
| Counsel: agent-of-payee opinion | You | 1–2 weeks | Taking real money |
| Stripe account, donation use case declared | You | days | The charge |
| Plaid production access | Teammate | 1–3 weeks | Round-up calculation only |
| Resend key + verified sending domain | Teammate | days | Verification and receipts email |
| Build | Me | ~3 weeks | — |

The build finishes before the paperwork. It always does. **Sponsor first.**

---

## Two ways to sequence it

### Option A — Prove the rail first (fastest to live)

Ship **fixed monthly giving** before round-ups: pick a nonprofit, set $10/month, card
charged monthly, sponsor disburses, receipt issued.

- **Live in ~2 weeks after the sponsor signs.** No Plaid dependency at all.
- De-risks the money path — sponsor, Stripe, disbursement, receipts, failed charges — with
  the simplest possible input.
- Round-ups then become a change to *how the monthly number is computed*, not a change to
  how money moves. Much safer second step.
- Cost: the differentiator isn't there on day one. You're a donation app until the
  round-ups land.

### Option B — Round-ups from the start

Everything above, with Plaid computing the monthly total.

- **Live in ~4–6 weeks after the sponsor signs**, gated by Plaid production.
- The real product on day one.
- Cost: you debug the money path and the round-up path simultaneously, on real money.

**Recommendation: Option A.** The round-up engine is already written and tested — it isn't
the risk. The money path is the risk, and it's worth proving alone. You also get a live
product, real donors, and real feedback ~3 weeks earlier.

---

## Sprint plan

### Sprint 0 — Unblock (this week, mostly not code)

**You:**
- [ ] Contact **Our Change Foundation** — proven on this exact model; ask whether they take
      other platforms or are exclusive to RoundUp.org
- [ ] In parallel: [Goodstack](https://goodstack.io/) and [Every.org](https://docs.every.org/docs/intro)
- [ ] Ask every sponsor the same four questions: agency agreement terms, fee schedule,
      minimum donation, and how nonprofits are onboarded to receive funds
- [ ] Counsel, one hour: agent-of-payee exemption, and whether we're "soliciting" in states
      where the sponsor isn't registered
- [ ] Open a Stripe account and declare the donation use case honestly up front

**Teammate:**
- [ ] Plaid production request (needed for Option B, not Option A)
- [ ] Resend key and a verified sending domain

**Me:**
- [ ] **Teardown.** Delete the Alpaca Broker API surface: account creation, the CIP
      collection, ACH relationships, deposits, withdrawals, the funding screen, firm-account
      journaling, `AUTO_FUND_NEW_ACCOUNTS`, all `ALPACA_*` config. Retire `compliance/CIP.md`
      with a note explaining why rather than deleting it silently.
- [ ] Strip the investing UI to a "coming later" state — frameworks, allocations, holdings,
      portfolio, statement.
- [ ] `GivingSponsor` interface with a fake implementation, so everything downstream can be
      built and tested before a sponsor signs.

Nothing here waits on anyone.

### Sprint 1 — The money path

- [ ] Stripe card-on-file via Elements. **Tokenised; a PAN never touches our servers.**
- [ ] Nonprofit directory: search, listing page, selection. One at a time.
- [ ] Monthly close job: total the period, apply minimum and cap, create one charge.
- [ ] Sponsor integration behind the interface: record the donation, hand off the funds.
- [ ] Failed charge → retry → pause the account, with a clear message.
- [ ] Receipts surfaced from the sponsor.
- [ ] Dashboard: pause, cap, switch nonprofit, cancel.

**Exit:** a test card charges on schedule and a test donation reaches a real nonprofit.

### Sprint 2 — Round-ups on top (Option B, or v1.1)

- [ ] Reconnect Plaid sync to the existing round-up engine — **already written, 17 tests
      passing, integer-cent math with no float drift.**
- [ ] Accrual display: what's accrued so far this month, against the cap.
- [ ] Purchases ending in `.00` round up a full $1.00 — say so in the UI, or it reads as a bug.
- [ ] Switch the monthly close from a fixed amount to the accrued total.

### Sprint 3 — Honest launch

- [ ] Copy rewrite. Giving is the product now. The hero changes again.
- [ ] Publish the fee plainly. RoundUp.org publishes theirs; given our premise, ours should
      be at least as legible.
- [ ] Irrevocability stated clearly — donors can pause, cap, and switch, but not claw back.
- [ ] Terms of Service and Privacy Policy (counsel).
- [ ] `SECURITY.md` and `compliance/AML.md` cut down to what this rail actually requires.
- [ ] Beta with people you know, real cards, small caps.

---

## Already built — the reuse inventory

This is why three weeks is credible and not optimism:

| Asset | State |
|---|---|
| Auth: scrypt, sessions, verification, reset | Done and hardened |
| Security: CSRF, rate limits, CSP/HSTS, constant-time login | Done this week |
| Round-up engine | Done, 17 tests, integer-cent, no float drift |
| Ledger and accrual | Done |
| Plaid transaction sync | Done, needs production keys |
| Postgres persistence, audit trail | Done |
| Marketing site | Done, needs a copy pass |

## Being deleted

Account creation, the CIP collection and SSN handling, ACH relationships, deposits,
withdrawals, transfers, the funding screen, firm-account journaling, the charity brokerage
account, `AUTO_FUND_NEW_ACCOUNTS`, every `ALPACA_*` variable, and — for now — the whole
investing UI.

`compliance/CIP.md` stops being our obligation. `compliance/AML.md` shrinks to what a
donation platform needs, which is much less.

---

## Design decisions to make before Sprint 1

| Decision | RoundUp.org's answer | Ours |
|---|---|---|
| Monthly minimum | $10, charged even if round-ups are less | **Needed.** Micro-amounts don't clear card fees |
| Donor cap | Optional, changeable any time | Copy it — removes the main objection to linking a card |
| One nonprofit or several | One at a time | One. Simpler, and it's what they landed on |
| Our fee | $2 flat per monthly donation | Decide before launch, publish it |
| Anonymity | Donor chooses whether the nonprofit sees them | Copy it |
| Data exposure | Category and last 2 digits only | Copy — minimising what we see is on-brand |

---

## Risks to the timeline

| Risk | Severity | Mitigation |
|---|---|---|
| No sponsor will contract with us | **Critical** — no product | Three in parallel from day one. If all decline, a fiscal sponsor is the fallback |
| Agent-of-payee doesn't hold cleanly | High | Counsel in Sprint 0, before real money |
| Plaid production denied or slow | Medium | Option A doesn't need it |
| Stripe flags the donation use case | Medium | Declare it honestly at signup, not after |
| Fees make small donations uneconomic | Medium | The minimum exists for this; model it before setting one |
| Copy over-promises again | Medium | Nothing ships claiming money moves that hasn't |

---

## The honest summary

The fastest path to live is **sponsor agreement → fixed monthly giving → round-ups on top.**
The code is roughly three weeks and most of the hard parts already exist. The gate is a
signature from a 501(c)(3), and that clock starts the day you send the first email.

Everything I can do without waiting on anyone is in Sprint 0 and can start immediately.
