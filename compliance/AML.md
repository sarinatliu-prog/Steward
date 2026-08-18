# Anti-Money Laundering (AML) Program

**Entity:** Good Steward (the "Company")
**Version:** 1.0 · **Adopted:** _[date]_ · **Approved by:** _[senior management / board]_
**AML Compliance Officer:** _[named individual — this must be a person, not a role]_
**Review cycle:** annually, plus independent testing (see §7).

> **This is a working draft prepared by the engineering team, not legal advice.** It
> exists so that counsel, and Alpaca's partner due-diligence review, have a concrete
> starting point that reflects what the platform actually does. It must be reviewed,
> completed, and adopted by a qualified AML/securities attorney or compliance firm
> before it is relied on. Sections marked _[decide]_ are open questions.

---

## 1. Purpose

The Company operates a round-up investing platform. Customer brokerage accounts are
carried by Alpaca Securities LLC ("Alpaca"), a registered broker-dealer and FINRA
member. Alpaca is the entity with the direct BSA/AML obligation for these accounts;
the Company operates onboarding, the round-up ledger, and the funding interface, and
therefore holds real AML risk and real visibility into customer behaviour.

This program describes the Company's controls and its coordination with Alpaca. It is
written to the five pillars expected of a BSA/AML program:

1. a designated compliance officer;
2. written policies, procedures, and internal controls;
3. ongoing training;
4. independent testing;
5. customer due diligence (CDD).

## 2. Designated AML Compliance Officer

_[to complete: name, title, reporting line, and the date of appointment.]_

The officer is responsible for the operation of this program, for the relationship with
Alpaca's compliance function, for escalation and reporting decisions, and for ensuring
the annual review and independent testing happen. The appointment must be made and
documented by senior management before production launch.

## 3. Risk assessment

**The product's risk profile is genuinely low, and the reasons are structural rather
than incidental:**

- **Round-up amounts are small.** Individual round-ups are cents; sweeps are $5.
- **Funding is closed-loop.** Money enters only from a bank account the customer has
  linked through Plaid and that Alpaca holds an ACH relationship for, and can only be
  withdrawn back to that same relationship. There is no path to a third party.
- **No cash, no wires, no crypto, no third-party transfers.**
- **US persons only**, verified by Alpaca's CIP.
- **The investable universe is a fixed set of screened ETFs**, not arbitrary securities.

**Where risk actually concentrates:**

| Risk | Why it matters here | Control |
|---|---|---|
| Deposit/withdraw with minimal trading | The classic pattern: use a brokerage account as a pass-through rather than to invest. | Monitoring rule §5.1 |
| Synthetic or stolen identity at onboarding | The account is opened remotely, with no in-person contact. | Alpaca CIP; §5.4 velocity limits |
| Account takeover | Compromised credentials used to redirect funds. | §6 security controls; withdrawal only to the linked relationship |
| Structuring below thresholds | Small, repeated deposits to stay under review triggers. | Monitoring rule §5.2 |
| Pooled residue in the sweep account | Customer-directed charitable amounts pool before disbursement. | §8, and an open question for counsel |

_[decide: whether the Company's risk assessment must be formally documented separately
and refreshed on a set cadence, or whether this section suffices.]_

## 4. Customer due diligence

**Onboarding CDD** is the CIP described in [`CIP.md`](./CIP.md): identity, address,
SSN, date of birth, citizenship, source of funds, and the four regulatory disclosures,
all collected from the customer and verified by Alpaca.

**Source of funds** is collected at onboarding as a structured value (employment
income, savings, investments, business income, inheritance, family). It is retained
and available to compliance review.

**Enhanced due diligence** applies where the customer answers "yes" to political
exposure or to immediate-family political exposure. _[to build: these answers are
captured and stored today but do not yet trigger a review workflow. Before launch,
a "yes" must route the application to manual review rather than proceeding
automatically.]_

**Beneficial ownership** (31 CFR 1010.230) does not currently apply: the Company
onboards natural persons only, not legal entities. If entity accounts are ever offered,
this program must be amended first.

**Ongoing CDD.** Customer activity is monitored per §5 for the life of the account.

## 5. Transaction monitoring

The platform sees every deposit, withdrawal, round-up, sweep, and order, and keeps an
append-only per-customer audit trail. The following rules are the minimum set to
implement before launch.

_[to build: the rules below are specified, not implemented. Each needs an alert that
reaches the AML Compliance Officer, and a documented disposition — reviewed, cleared,
escalated — that is itself retained.]_

**5.1 Pass-through activity.** A customer deposits and then withdraws a material share
of that deposit without a proportionate amount being invested, within a short window.
This is the highest-value rule for this product: it is the only reason to use a
round-up app as a money-movement channel.

**5.2 Structuring.** Repeated deposits clustered just beneath any review threshold, or
a pattern of deposits inconsistent with the stated source of funds.

**5.3 Volume inconsistent with profile.** Deposit volume materially out of step with
the source of funds declared at onboarding — for example, five-figure monthly deposits
against "savings" on an account whose purpose is investing spare change.

**5.4 Onboarding velocity.** Multiple account applications from one IP or device, or a
burst of applications in a short window. Signup is rate-limited per IP, and that limit
being hit repeatedly is itself a signal worth surfacing.

**5.5 Account-takeover indicators.** Password reset followed by a bank-relationship
change followed by a withdrawal, in quick succession.

**Thresholds** _[decide with counsel and Alpaca — they should be set jointly so the two
monitoring layers do not both assume the other is catching something.]_

## 6. Security controls relied on by this program

Monitoring is only meaningful if the account belongs to who it claims to. The following
are implemented:

- scrypt password hashing with per-user salt; constant-time comparison
- constant-time handling of unknown accounts at login, so response timing does not
  reveal which emails are registered
- rate limiting on signup, login (per email and per IP), password reset, and
  verification email
- one-time, expiring, single-use email tokens; issuing a new one revokes the previous
- HttpOnly, SameSite=Lax, Secure session cookies
- cross-site state-changing requests rejected before any handler runs
- Content Security Policy, HSTS, and clickjacking protection on every response
- append-only per-customer audit trail of money- and security-relevant events
- withdrawals only to the customer's own established ACH relationship

**Two-factor authentication is not yet implemented and is the most significant open
security gap in this program.** For a product that moves customer money, credential
compromise is the realistic attack, and a password is the only thing standing in front
of it today. §5.5 monitoring partially compensates but is detective, not preventive.
_[decide: whether 2FA is a launch blocker. The recommendation of this document is that
it is — at minimum TOTP enrolment with recovery codes, ideally required before the first
withdrawal.]_

## 7. Training and independent testing

**Training.** Everyone with access to customer data or account operations receives AML
training at onboarding and annually: what the product's risks are, what the monitoring
rules exist to catch, how to escalate, and the prohibition on tipping off. _[to build:
materials, and an attendance record.]_

**Independent testing.** An annual review by someone independent of day-to-day AML
operations — an outside compliance firm, given the size of the team. _[to schedule.]_

## 8. Charitable residue and the sweep account

Customers set a stewardship rate: a percentage of each sweep held back rather than
invested. That amount accrues in the **sweep account** and is disbursed to a charity
partner off the brokerage rail. Alpaca journals move firm↔customer only, never
customer→customer, which is why the residue routes through the sweep account rather
than directly to a charitable brokerage account.

**Open questions, all of which belong to counsel and Alpaca rather than to
engineering:**

- Whether pooled, undisbursed customer-directed funds in the sweep account raise custody
  questions.
- Who is the donor of record — the customer or the Company — and the tax consequence of
  that answer.
- What diligence is owed on the charity partner itself, and on the disbursement rail.
- Whether the disbursement flow needs its own monitoring, or falls under §5.

**Until these are answered, giving ships as a beta feature:** the rate applies and the
amount accrues visibly to the customer, and **nothing is disbursed**. The customer is
told this in the product, is told they will be notified before any first payment, and
can change the rate or opt out until then.

## 9. Suspicious activity reporting

Alpaca, as the broker-dealer, files SARs. The Company's obligation is to escalate
promptly and completely, and never to alert the customer that a report may be made.

**Procedure:** a monitoring alert or a staff observation goes to the AML Compliance
Officer, who documents the review and its outcome; where escalation is warranted, the
matter is referred to Alpaca's compliance contact under the process in the Broker API
agreement, and the referral and its date are recorded.

_[decide: whether the Company has any independent SAR obligation, or only a referral
obligation. This is a direct question for counsel and should be settled in writing with
Alpaca rather than assumed.]_

**Tipping off is prohibited.** No one may tell a customer that their activity has been
reviewed, escalated, or reported.

## 10. Recordkeeping

- CIP records: five years after account closure (see [`CIP.md`](./CIP.md) §5).
- Transaction and audit records: five years.
- Escalations, reviews, and their dispositions: five years.
- Training records and independent testing reports: five years.

_[decide: retention is currently expressed in the design but not enforced by any
automated policy. Note that the per-customer audit trail is capped at the most recent
200 events, which does not satisfy a five-year retention requirement and needs to be
addressed before launch.]_

## 11. Sanctions screening

OFAC screening is performed by Alpaca as part of CIP. The Company performs none
independently. _[decide: confirm in writing with Alpaca that their screening covers
ongoing list changes and not only onboarding.]_

---

## Before this program can be relied on

1. Name and appoint the AML Compliance Officer.
2. Have counsel or a compliance firm review, complete, and adopt this document and
   [`CIP.md`](./CIP.md).
3. Settle every _[decide]_ item — several change what has to be built.
4. Build the §5 monitoring rules and the EDD workflow for politically exposed answers.
5. Fix audit-trail retention (§10).
6. Decide whether 2FA blocks launch (§6).
7. Reconcile all of the above with Alpaca's own partner requirements during production
   onboarding.
