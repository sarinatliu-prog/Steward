# Regulatory posture

> Engineering's plain-English read of where Steward sits, not legal advice. Have counsel
> confirm before relying on it. It replaces the earlier CIP and AML drafts, which belonged
> to an abandoned model where Steward opened brokerage accounts and moved money — the
> analyzer does neither.

## The analyzer: why it's clear

Steward, as it exists today, **reads holdings and explains them.** That single fact keeps it
outside the three regimes that make fintech expensive.

### Not an investment adviser
The Investment Advisers Act turns on giving **advice** about securities, **for
compensation**, as a **business**. Steward gives no advice:

- The user chooses which ethical screens to apply. We don't recommend screens.
- The user already owns their portfolio. We don't select, allocate, weight, rank, or
  suggest securities — we report what's already there and why it's flagged.
- There is no "buy this / sell that." The output is descriptive, not advisory.

Because we fail the **advice** prong structurally, adviser status doesn't attach regardless
of how Steward is monetized later. (Keep it that way: never add "suggested" holdings, model
portfolios, allocations, or a buy/sell action without re-checking this.)

### Not a broker-dealer
We never take custody of securities, never execute or route orders, and never open an
account. The user's existing broker is the broker; SnapTrade is a read-only data connection.

### Not a money transmitter
No money moves through Steward at all. We don't hold, transfer, or disburse funds.

### Data / privacy
We collect an email and a password, and store one SnapTrade `userSecret` per connected user
(read-only access to their holdings). **No SSNs, no bank credentials, no card data, no
identity documents.** The brokerage credential the user enters lives with SnapTrade, never
with us. Standard consumer-privacy practices apply (a Privacy Policy and Terms of Service
are still to be written); there is no CIP/KYC obligation because we open no accounts.

### The one line to hold
Steward is a read-only analytics tool over accounts the user already owns. If a future
feature would give advice, take custody, or move money, it changes this analysis — treat any
such feature as a stop-and-check-with-counsel moment, not an incremental change.

---

## The future giving rail (not built)

If Steward later adds round-up giving, the money question returns — but there's a proven,
clean structure to copy (RoundUp.org):

- **Never hold the money.** Round-ups accrue as a *number*; one monthly card charge via
  Stripe sends funds to a third-party 501(c)(3) donor-advised-fund sponsor, which receipts
  the donor and disburses to the chosen nonprofit.
- **Agent-of-payee.** The structure that keeps this out of money-transmission licensing is a
  written agency agreement appointing Steward as the sponsor's agent to collect donations —
  so payment to us discharges the donor's obligation and we're collecting on the payee's
  behalf, not transmitting. Wording varies by state; this is a specific, cheap counsel
  question and the answer gates the whole rail.
- **Charitable solicitation.** Sourcing donations may trigger state charitable-solicitation
  registration; a sponsor absorbs most of it. Confirm.
- **First call:** Change (getchange.io) — the donation infrastructure behind RoundUp.org;
  its affiliated Our Change Foundation is the DAF. Then Ren/Renaissance Charitable and AEF,
  whose business is platform partnerships.

**Steward itself needn't be a nonprofit** for any of this — RoundUp.org is a for-profit
partnered with a separate foundation. See the entity notes in [`../PLAN.md`](../PLAN.md).

## Open items before either path scales

- Terms of Service and Privacy Policy (needed regardless).
- Counsel sign-off on the adviser analysis above, ideally with the "does it still hold if we
  charge a subscription?" question answered in writing.
- For the giving rail only: the agent-of-payee opinion and a sponsor agreement.
