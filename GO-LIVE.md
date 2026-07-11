# Good Steward — Go-Live Roadmap (sandbox → real money)

How to get from "works on sandbox" to "moves real money," step by step.

**Owner tags:** `[You]` you do it · `[Legal]` securities/fintech attorney · `[Alpaca]`
Alpaca's process · `[Build]` I can build it. Two tracks run **in parallel**: the
**paperwork track** (legal + Alpaca approval + KYC setup) and the **build track**
(everything on sandbox). The build finishes long before the paperwork; the final
go-live switch is gated by the paperwork.

> Reminder on scope: this covers the two gates that are *not* the RIA question —
> **Alpaca production approval** and **KYC/AML** (a separate federal requirement to
> open any brokerage account). RIA is set aside per your decision; keep your
> no-compensation memo (below) as the thing that backs that decision.

---

## Phase 0 — Where you are ✅
- [x] Sandbox auth working (OAuth2 client-credentials)
- [x] Round-up engine + clearing-account ledger (17 tests)
- [x] Frontend wired to live ledger data
- [x] `alpaca-*.mjs` scripts prove create-account / fund / place-order on sandbox
- [x] App is deploy-ready (single Render service)

---

## Phase 1 — Legal & entity  `[You] [Legal]`  (start now, runs in background)
1. **Confirm the structure in writing.** One paid consult + a short memo from a
   securities/fintech attorney that your no-compensation model actually keeps you
   out of adviser status — federal **and** in each state you'll operate, including
   the "holding out" risk. Hand them your compensation checklist. This is the memo
   that backs your "ignore RIA" decision.
2. **Business entity + EIN** ready (you said you have a company — confirm it's the
   entity that will contract with Alpaca).
3. **Draft user-facing legal docs:** Terms of Service, Privacy Policy, and the
   disclosures Alpaca requires you to present (customer agreement, etc.).
4. **AML program on paper:** a written Customer Identification Program (CIP) and
   AML policy. Alpaca requires partners to have this; the attorney/compliance firm
   provides a template.

## Phase 2 — Alpaca production approval  `[You] [Alpaca]`  (start now; longest lead time)
1. **Apply for Broker API production** via Alpaca (not self-serve like sandbox).
2. **Due diligence:** entity docs, ownership, your compliance/AML program, expected
   volumes, and your regulatory posture (this is where your Phase 1 memo matters).
3. **Sign the Broker API / correspondent agreements.**
4. **Confirm the money terms in writing** (your own checklist): $0 payment-for-order-flow
   to you, no revenue share, float interest not shared to you.
5. **Get production credentials** (`CLIENT_ID` / `CLIENT_SECRET`) + production hosts
   (`authx.alpaca.markets`, `broker-api.alpaca.markets`).

## Phase 3 — KYC/AML wiring  `[Build] [Alpaca]`  (mandatory — the non-skippable gate)
1. **Collect CIP fields at onboarding:** legal name, DOB, SSN/tax ID, address,
   citizenship, funding source. (Handled by Alpaca's account API — we pass them
   through, never store SSN ourselves in plaintext.)
2. **Capture disclosures & signed agreements** with timestamp + IP (control person,
   politically exposed, affiliated, customer agreement).
3. **Identity verification:** Alpaca runs CIP/KYC via their provider; handle the
   "pending / needs documents" states (upload passport/ID when required).
4. **Handle KYC outcomes** in the UI: approved, pending, rejected, more-info-needed.

## Phase 4 — The real per-user build  `[Build]`  (all on sandbox first)
1. **User accounts + auth** — real login (email/password or OAuth). Right now it's
   one hardcoded user; real money needs per-user identity.
2. **Production-configurable** — sandbox↔production is pure env vars, no code fork.
3. **Per-user brokerage account** — onboarding creates a real Alpaca account per user
   (create → verify), stored against their login.
4. **Bank linking + funding** — round-ups need *actual dollars*. Link the user's bank
   with **Plaid**, read transactions to compute round-ups, then **ACH-pull** the swept
   amount into their Alpaca account. (This is how Acorns funds round-ups.)
5. **Invest** — sweep triggers a real fractional ETF order in their account.
6. **Persistence** — real database (Postgres) for users, ledgers, accounts, transfers.
   No more in-memory.
7. **Security & PII** — secrets in a manager, encryption at rest, never log SSNs,
   least-privilege, audit trail.

## Phase 5 — Test, review, launch  `[You] [Build] [Alpaca]`
1. **Full end-to-end on sandbox:** signup → KYC → account → link bank → round-ups →
   funding → invest → statements.
2. **Security & compliance review** (and the attorney's final sign-off).
3. **Alpaca go-live checklist** with your Alpaca contact.
4. **Flip env to production**, deploy, verify with a small real transaction of your own.
5. **Monitoring & support:** error alerting, transfer-failure handling, a way for
   users to get help and withdraw funds.

---

## Suggested order of attack
- **Today:** kick off Phase 1 (book the attorney) and Phase 2 (start the Alpaca
  application) — these have the longest lead times and block go-live.
- **In parallel, I build:** Phase 4 #2 (production-config) → #1 (auth) → #3 (per-user
  accounts) → Phase 3 (KYC onboarding) → #4 (Plaid + ACH funding) → #6 (persistence).
- **When Alpaca approves + attorney signs off:** Phase 5, flip to production.

The paperwork is the critical path. The code will be ready first.
