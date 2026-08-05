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
- **Money** — all sandbox / play money. No real funds move.

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

## Known gaps (honest, with severity and the fix)
| Gap | Severity | Fix |
|---|---|---|
| **Reset/verify links have no email provider** — dev links gated by `ALLOW_DEV_MAIL_LINKS`. | Medium | Wire Postmark/SES; the token flow is already done. |
| **Error monitoring is in-memory** — the buffer is lost on restart. | Low | Ship errors to Sentry/Datadog in production; the capture point already exists. |
| **No CSRF tokens** — state-changing routes rely on the cookie. | Low | `SameSite=Lax` blocks the common cross-site cases; add per-form tokens before real money. |
| **Signup reveals whether an email exists** (409). | Low | Accept the UX tradeoff or switch to a neutral "check your email" response. |
| **Waitlist/event endpoints are unthrottled.** | Low | Add per-IP rate limiting; today they only append to a list/counter. |
| **No 2FA.** | Low | Expected before handling real money, not before a sandbox demo. |

None of these expose real money or real PII today, because there is neither — the app
runs entirely on Alpaca's sandbox.

## The honest scope line
Real money is genuinely gated, and not by neglect. It would make Steward an investment
adviser (RIA registration), require Alpaca's live-partner approval (typically a licensed
entity), and mandate KYC/AML — a multi-quarter, funded-company undertaking. That's out of
scope for a capstone *by design*. The security work above was built in the sandbox
specifically so that going live is a matter of flipping credentials and finishing the
email/monitoring wiring — not rebuilding the app.
