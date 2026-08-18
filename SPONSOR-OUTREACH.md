# Getting a DAF Sponsor — How To Actually Do It

The gate on the whole product. This is the playbook: who to email, what to send, what
they'll ask you, what you must ask them, and what has to be in the agreement.

**Send the first emails today.** They are not perfect-able, and the clock only starts when
one lands in an inbox.

---

## 1. Who to contact

Three tiers, and you should have live conversations in at least two of them. Never
negotiate with one counterparty.

### Tier 1 — Built for exactly this

**[Ren / Renaissance Charitable Foundation](https://renaissancecharitable.org/)** — a
501(c)(3) that has sponsored $10B+ in DAF assets, whose whole partner pitch is that you
don't have to find or establish your own sponsoring organization. Ren is the operational
platform behind DAF programs at major wealth firms. They do
[white-label DAF partnerships](https://www.reninc.com/blog/white-label-donor-advised-fund-faqs/)
as a product line.

**American Endowment Foundation (AEF)** — independent national DAF sponsor, does turnkey
partner programs.

These two are the most likely to say yes, because partnering *is* their business model. Start
here.

### Tier 2 — Proven on this exact use case

**Our Change Foundation** — the DAF behind RoundUp.org. They have already solved your
problem in production. The only real question is whether they take other platforms or are
effectively exclusive. Reach them through Change / RoundUp.org's partnerships contact. Even a
no is useful: ask who else they'd point you to.

### Tier 3 — API-first, lighter weight

**[Goodstack](https://goodstack.io/)** (formerly Percent) — names in-app round-ups as a
supported donation type; owns nonprofit vetting through disbursement.
**[Every.org](https://docs.every.org/docs/intro)** — free APIs, 1M+ nonprofits, 501(c)(3).
**[Daffy](https://www.daffy.org/)**, **[Endaoment](https://endaoment.org/)** — modern DAFs,
low minimums, unconfirmed third-party API depth.

Faster to integrate, but confirm they'll sign an **agency agreement** and not just hand you
API keys. The paperwork is the point, not the API.

---

## 2. The email

Short, specific, and honest about stage. Do not oversell — everything you claim gets checked
in diligence, and being caught inflating numbers ends the conversation.

> **Subject:** Partnership enquiry — round-up giving platform seeking DAF sponsor
>
> Hi [name],
>
> I'm [name], founder of [entity], building a round-up giving platform: donors link a card,
> everyday purchases round up to the next dollar, and the accrued total is charged once
> monthly and directed to a nonprofit of the donor's choosing.
>
> We're looking for a 501(c)(3) DAF sponsor to receive those donations, issue tax receipts,
> and disburse to recipient nonprofits — structurally similar to how RoundUp.org works with
> Our Change Foundation.
>
> Where we are: the round-up engine, bank-transaction integration, and donor accounts are
> built and tested. We are pre-launch with no donors yet, and we're choosing a sponsor before
> we take a single dollar rather than after.
>
> What we'd need:
> - An agency agreement appointing us to collect donations on your behalf
> - Receipting and disbursement to donor-selected US 501(c)(3)s
> - Ideally an API for creating donation records; batch/manual works for a pilot
>
> Would you have 30 minutes in the next two weeks? Happy to send our security
> documentation and product walkthrough in advance.
>
> [name] · [entity] · [phone]

**Send it to all three tiers on the same day.** Parallel, not sequential. Sequential
outreach is how a six-week timeline becomes six months.

---

## 3. What they will ask you — have it ready

Assume every one of these comes up on the first call.

- **Entity.** Which legal entity contracts with them, incorporation state, EIN. *(Elevate
  Opportunity Inc. — articles filed. Have that document to hand and be clear about what's
  filed and what isn't.)*
- **Principals.** Who you are, backgrounds. Small team is fine; vague is not.
- **The money flow.** Who charges the donor, who is merchant of record, when funds reach
  them, in what form. Draw it on the call.
- **Volume.** Expected donors year one, average monthly donation, total annual. Estimate
  honestly and say it's an estimate. RoundUp.org's ~$32/month average is a defensible anchor.
- **Donor acquisition.** How people find you. They care because their name is attached.
- **Security.** Card handling (Stripe-tokenised, no PAN on our servers), data protection,
  auth. **You have real answers here** — point at `SECURITY.md`.
- **Terms of Service and Privacy Policy.** Needed before launch regardless; drafting them
  now removes a blocker.
- **Compliance posture.** `compliance/AML.md` exists and is honest about what's draft. Send
  it. Sponsors trust a document that marks its own open questions more than one that doesn't.

---

## 4. What you must ask them

Bring this list to every call. The first three decide whether the deal works at all.

**Structural — ask first**

1. **Will you sign an agency agreement appointing us to collect donations on your behalf?**
   *This is the money-transmission question. If no, the deal may not work — get counsel
   before proceeding.*
2. **Who is merchant of record on the donor's card charge — us or you?** Their being MOR is
   cleaner for us; ours is more common. Either can work, but the agreement must say which.
3. **Do you require exclusivity, or restrict who else we work with?**

**Economics**

4. Fee schedule — flat, percentage, or both? Who absorbs card processing?
5. Minimum donation you'll accept, and minimum grant you'll disburse.
6. Any volume commitment or minimum annual fee?

**Operations**

7. How do recipient nonprofits register to receive funds, and what happens to a donation
   designated for one that never registers?
8. Disbursement timing and method — ACH, check, cadence.
9. Who issues the tax receipt, when, and in what format? Can it carry our branding?
10. Is there an API for creating donation records, or is it batch/manual? Sandbox available?
11. What donor data do you require, and what do you do with it?

**Risk**

12. Which states are you registered for charitable solicitation in, and does your
    registration cover donations we source?
13. What happens to in-flight donations if either side terminates?
14. Under what circumstances would you reject a designated nonprofit, and how are donors
    told? *(RoundUp.org notifies the donor and lets them re-designate — copy that.)*
15. Do you carry insurance relevant to this arrangement?

---

## 5. What the agreement must contain

Have counsel review before signing. Non-negotiables:

- **Agency appointment**, in explicit language, with payment to us discharging the donor's
  obligation. This is the sentence the money-transmission analysis rests on.
- **Fee schedule**, fixed or with a notice period on changes.
- **Disbursement obligations and timing.**
- **Receipting obligations** — who, when, what it says.
- **Data protection** — what they may do with donor data.
- **Termination and wind-down**, including in-flight donations.
- **Who bears the loss on chargebacks and failed charges.** Ask early; it's often unaddressed
  until it happens.

---

## 6. Red flags

| Signal | Why it matters |
|---|---|
| Won't sign an agency agreement | The money-transmission structure may not hold |
| Percentage fee with no cap on small donations | On a $12 donation, percentage fees are brutal |
| No written disbursement timeline | Donors will ask where their money is and you'll have no answer |
| Requires you to guarantee volume | Pre-launch, you cannot honestly commit |
| Vague about state charitable registration | Their exposure becomes yours |
| Wants control of the donor relationship | You'd be building their funnel |

---

## 7. Timeline

| Week | What happens |
|---|---|
| 0 | Emails to all three tiers. Same day. |
| 1–2 | First calls. Expect one no and one slow reply — that's why you sent three. |
| 2–3 | Diligence: they review your entity, security, and ToS. Their questions land here. |
| 3–5 | Term sheet or draft agreement. Counsel reviews. |
| 4–6 | Signed. |

**In parallel, not after:** counsel on agent-of-payee, the Stripe account, and Plaid
production. None of them wait for a signature.

---

## 8. If everyone says no

**Fiscal sponsorship.** An existing 501(c)(3) accepts funds on your project's behalf for
typically 5–8%. Slower per-dollar and less elegant, but it gets you legally receiving
donations in weeks rather than a year, and it does not require Elevate Opportunity to have
its own determination letter.

That is the fallback. It is not the plan — start with Tier 1.
