# NEXT — project status & what's left

Snapshot of where Steward (the ethical portfolio analyzer) stands, and the work ahead.
Living doc — update as things land. See [`PLAN.md`](PLAN.md) for the why, this for the what.

---

## What's built and working

The analyzer is live, tested end-to-end, and deployed-ready.

- **Read-only brokerage connection** (SnapTrade) — verified against the live sandbox with
  real test credentials. Connect → read holdings → never trade, never move money.
- **Ethical screens** — 12 flags, ~83 hand-curated companies, each with a plain,
  checkable one-line reason.
- **Fund look-through** — we look inside known index funds (VOO, SPY, VTI, QQQ, and the
  common mutual funds) and surface the flagged companies hiding inside. VOO shows 42.
- **Live hero widget** — type any ticker, no login, see inside it instantly. Auto-loads
  VOO so a visitor immediately sees the S&P 500 surprise. Hits the real backend.
- **EDGAR enrichment layer** — free SEC data maps SIC industry codes to screens, scaling
  coverage toward the whole market (~10,400 filers) without hand-curation. Curated list
  stays precise; EDGAR fills breadth; a "last updated" stamp keeps it honest. Ships with a
  25-company seed dataset; the full run is one command.
- **Auth + security** — scrypt passwords, sessions, CSRF, rate limits, security headers,
  constant-time login, email verification/reset.
- **Design** — dark-green liquid-glass hero, light "paper" dashboard (two-tone so it
  doesn't blend).
- **49 passing tests**, clean build and lint.
- **Docs** — README, PLAN, SECURITY, compliance/REGULATORY all current.
- **Regulatorily clear** — no advice, no custody, no accounts: not an adviser,
  broker-dealer, or money transmitter.

---

## What's left

### Data depth — raises the product's ceiling
1. **Run the full EDGAR enrichment** — the ~10,400-company job (`node scripts/enrich-edgar.mjs`,
   ~20 min, no API key). Only 25 companies are in the shipped dataset today.
2. **Live ETF holdings** — fund constituent lists are hand-curated and can go stale. Wire a
   free source (Financial Modeling Prep free tier, or issuer-published holdings CSVs) so
   fund look-through is always current.
3. **AI enrichment pass** — use an LLM to classify the fuzzy screens SIC can't
   (surveillance, gambling, private prisons) across the market. The "last updated" stamp is
   already in place.
4. **Faith screen data** — gather data first. Exclusion lists for Christian / Jewish /
   Islamic; real **Sharia** also needs financial-ratio data (debt, interest income) from a
   fundamentals source (IdealRatings / Musaffa / Zoya are the reference points).
5. **Symbol normalization** — class shares differ by broker (`BRK.B` vs `BRK-B` vs `BRKB`);
   normalize before matching so nothing slips through on real brokerage connections.

### Product / business
6. **Paid trading tier** — SnapTrade can execute where the broker allows. Sell it as a paid
   convenience the user drives: strictly "execute what you chose," **never "sell this."**
   Needs counsel sign-off on that line before launch (it's the one feature that can pull us
   toward adviser status).
7. **Deploy for real** — confirm the Render deployment; paste SnapTrade + Resend keys;
   verify a sending domain for email links.
8. **Rotate the SnapTrade test key** — it passed through chat; rotate before production.

### Polish / hardening
9. **Encrypt the stored SnapTrade `userSecret`** at rest (it reads holdings, can't move
   money, but still).
10. **2FA**, durable error monitoring (Sentry/Datadog), Terms of Service + Privacy Policy.

### Much later
11. **Giving rail** (RoundUp.org model — round-ups → monthly Stripe charge → third-party DAF)
    only once the analyzer has users. See [`compliance/REGULATORY.md`](compliance/REGULATORY.md).

---

## Highest-leverage next step

**Live ETF holdings + the full EDGAR run.** Together they take the product from "curated
demo" to "works across the real market" — the biggest jump available for the least risk.

## Notes / decisions locked in

- **Information only.** We never say "sell this." The output describes what's there and why.
  Trading, if added, is a paid convenience the user initiates — not a recommendation.
- **Honesty rules** (see PLAN.md): plain factual flags, funds we don't know are "not
  analyzed" (never "clean"), we name companies inside funds but never fake per-company
  dollar amounts, and index membership shifts are disclosed.
- **Free data sources only** — EDGAR (no key), issuer holdings, FMP free tier.
- **The platform needn't be a nonprofit** — RoundUp.org is a for-profit partnered with a
  separate foundation. Entity notes in PLAN.md.
