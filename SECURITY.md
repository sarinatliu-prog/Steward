# Security

Steward is a read-only analyzer. It holds far less sensitive data than a typical fintech —
no money, no SSNs, no brokerage credentials — which shrinks the attack surface to two
things worth protecting: **user accounts** and the **SnapTrade connection secret**.

## What the app handles

- **Credentials** — email + password logins (hashed, never stored in plaintext).
- **A SnapTrade `userSecret`** per connected user — the token that can read their holdings.
- **Holdings data** — read-only positions, fetched on demand. We do not place orders or
  move money.
- **What we deliberately never touch** — no SSNs, no bank credentials, no card numbers, no
  ability to trade or transfer. Your brokerage credentials go to SnapTrade, never to us.

## What's hardened

- **Passwords** — scrypt with a per-user random salt; constant-time comparison. Minimum 10
  characters, a common-password blocklist, all-numeric rejected.
- **Sessions** — random 256-bit tokens in an **HttpOnly**, **SameSite=Lax** cookie, marked
  **Secure** in production. 30-day expiry, server-side revocable.
- **Login can't be used to enumerate emails** — a miss runs the same scrypt work as a hit,
  so response timing doesn't reveal which addresses are registered.
- **CSRF** — every state-changing request must prove same-origin (`Sec-Fetch-Site` /
  `Origin`) before any handler runs. Cookie possession alone isn't enough to act.
- **Security headers on every response** — Content-Security-Policy (no inline scripts),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`,
  `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- **Rate limiting** — per-IP limits on signup, login (also per-email), password reset, the
  verification mailer, and the public `/api/lookup`.
- **Single-use, expiring tokens** — email verification and password reset; issuing a new
  one revokes the previous, so a leaked old link stops working.
- **Secrets stay in env vars** — `server/.env` is git-ignored; the SnapTrade consumer key
  never reaches the client, and the server never returns a stack trace to a client.
- **Audit trail** — an append-only per-user log of security-relevant events.
- **Trusted-proxy discipline** — `X-Forwarded-For` is believed only when `TRUST_PROXY=1`,
  so a caller can't forge the IP used for rate-limiting.

## Known gaps (honest, with severity and fix)

| Gap | Severity | Fix |
|---|---|---|
| **`userSecret` stored in plaintext** in the DB. | Medium | It can read holdings, not move money, but encrypt at rest before scale (KMS/app-level). |
| **No 2FA.** | Medium | Lower stakes than a money app (no trading, no transfers), but expected before large scale. TOTP + recovery codes. |
| **Rate limits are per-process, in memory** — reset on restart, not shared across instances. | Low–Med | Move to Redis when running more than one instance. |
| **Error monitoring is in-memory** — a ring buffer lost on restart. | Low | Ship to Sentry/Datadog; the capture point already exists. |
| **Signup reveals whether an email exists** (409). | Low | Login no longer leaks it; switch signup to a neutral "check your email" if it matters. |
| **Audit trail capped at recent events.** | Low | Fine for now; add durable retention if it's ever needed for support/disputes. |

## The honest scope line

There is no investment-adviser, broker-dealer, or money-transmitter surface here, because
Steward gives no advice, holds no money, and opens no accounts — see
[`compliance/REGULATORY.md`](compliance/REGULATORY.md). The security work above is about
protecting logins and the one read-only token per user, which is the real exposure.

## Compliance

- [`compliance/REGULATORY.md`](compliance/REGULATORY.md) — why the analyzer is clear, and
  what the future giving rail would require.
