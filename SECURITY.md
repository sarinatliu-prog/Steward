# Security review

A plain review of Good Steward's security posture: what's hardened, what's a known
gap, and — since the whole product is about honesty — the parts that are deliberately
out of scope for a capstone rather than quietly missing. For the *legal* path to real
money (RIA registration, live Alpaca approval, KYC/AML), see `GO-LIVE.md`; this file is
the engineering side.

## What the app handles
- **Credentials** — email + password logins.
- **PII** — onboarding collects name, DOB, and address to open a brokerage account.
  (SSN/tax id is passed straight to Alpaca and never stored by us.)
- **Money** — sandbox while Alpaca credentials point at sandbox hosts. The code
  path is the production one.

## What's hardened (done)
- **Passwords** are hashed with `scrypt` and a per-user random salt; comparison is
  constant-time (`timingSafeEqual`). Plaintext is never stored or logged.
- **Sessions** are random 256-bit tokens in an **HttpOnly**, **SameSite=Lax** cookie,
  **Secure** in production (behind HTTPS). They **expire after 30 days**, checked on
  every request; expired tokens are dropped.
- **Login throttling** — 8 failed attempts per email in 10 minutes returns `429`,
  which slows credential-stuffing.
- **No secret leakage** — API keys live only in env vars, git-ignored; the server
  never returns a stack trace to a client (a top-level handler catches everything and
  responds with a generic 500), and errors are captured to an in-memory buffer.
- **Injection-safe** — Postgres access is parameterized (no string-built SQL), and the
  static file server normalizes paths and confines them to `dist/` (no traversal).
- **Input validation** — credentials and the onboarding profile are validated server
  side before anything is created (names ≥ 2 chars, valid DOB/state/ZIP, etc.).
- **Audit trail** — an append-only per-user log of the money- and security-relevant
  events (signup, login, account created, funding, sweeps, bank link), readable at
  `GET /api/audit`. A real launch needs this for support and disputes; it's here now.
- **Email verification & password reset** — single-use, expiring, typed 256-bit
  tokens; a reset invalidates every existing session for the account. No email
  provider is wired (sandbox), so links are logged server-side and surfaced in the
  UI only when `ALLOW_DEV_MAIL_LINKS=1` (an explicit demo switch) or in local dev.
  Wiring Postmark/SES later replaces the dev link with a real send — a credential
  change, not a rewrite.
- **Least data on the client** — `/api/funnel` exposes only aggregate counts, never
  emails or PII; login failures are generic ("Wrong email or password").

## The one that matters most: no 2FA

**Not built. Deliberately deferred, not overlooked — and it is the largest remaining
security gap in this product.**

Everything else here hardens the edges. This is the middle. For an application that
moves customer money, credential compromise is the realistic attack, not a clever
exploit of the session layer — and today a password is the only thing in front of a
customer's account and their withdrawal path. Rate limiting slows an online guessing
attack; it does nothing against a password reused from a site that has already been
breached.

What partially compensates today, and why it isn't enough:
- Withdrawals can only go to the customer's own established ACH relationship, so an
  attacker cannot simply redirect funds to themselves.
- The audit trail records the reset → bank-change → withdrawal sequence.

Both are **detective**. They tell you it happened. Neither prevents it.

**Recommended shape when it is built:** TOTP enrolment with recovery codes, required
before the first withdrawal rather than at signup, so it does not add friction to the
one step that has nothing to protect yet. Step-up re-authentication on bank-relationship
changes and withdrawals.

See [`compliance/AML.md`](compliance/AML.md) §6 — the AML program's monitoring rules
assume the account belongs to who it claims to, which is an assumption 2FA is what
actually backs.

## Other known gaps (honest, with severity and the fix)
| Gap | Severity | Fix |
|---|---|---|
| **Rate limits are per-process, in memory** — they reset on restart and don't coordinate across instances. | Medium | Move the counters to Redis when the service runs on more than one instance. |
| **Error monitoring is in-memory** — the buffer is lost on restart. | Low | Ship errors to Sentry/Datadog in production; the capture point already exists. |
| **Signup reveals whether an email exists** (409). | Low | Login no longer leaks it (constant-time miss), but signup still does. Switch to a neutral "check your email" response if this matters more than the UX cost. |
| **No account-recovery path if the mail provider is down.** | Low | Verification and reset both depend on Resend. Add a support-side manual path. |

## What changed in the last hardening pass
- **CSRF** — every non-GET request must prove same-origin via `Sec-Fetch-Site`/`Origin`
  before any handler runs. Cookie auth alone is no longer sufficient to act.
- **Security headers** on every response: CSP (no `unsafe-inline` scripts), `nosniff`,
  `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- **Rate limiting** on signup, login (by IP as well as by email), password reset,
  waitlist, and the verification mailer.
- **Login timing** — a miss now runs the same scrypt work as a hit, so response time
  can't be used to enumerate registered emails.
- **Passwords** — 10-character minimum, common-password blocklist, all-numeric rejected.
- **One-time tokens** — issuing a new verification or reset link revokes the previous
  one, so an old link in an old inbox stops working.
- **SSNs are never stored.** The tax id goes straight to Alpaca on the account
  application; only the last four digits are kept.
- **`AUTO_FUND_NEW_ACCOUNTS` is off**, and the server refuses to boot if it is ever
  enabled alongside live Alpaca credentials.
- **`X-Forwarded-For` is only trusted when `TRUST_PROXY=1`**, so the IP recorded on a
  signed customer agreement can't be forged by the caller.

## The honest scope line
Real money is gated by paperwork, not by missing code: Alpaca production approval,
the RIA question, and a written CIP/AML program. The application now collects and
transmits real CIP data rather than synthetic placeholders, so what stands between
this and live money is the approval process — see `GO-LIVE.md`.

## Compliance documents
- [`compliance/CIP.md`](compliance/CIP.md) — Customer Identification Program
- [`compliance/AML.md`](compliance/AML.md) — Anti-Money Laundering program

Both are engineering drafts describing what the software actually does. They require
review and adoption by counsel before launch.
