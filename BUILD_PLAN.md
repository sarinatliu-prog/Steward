# Steward — Build Plan to a Product People Actually Want

*Status as of this report: deployed at good-steward-2w60.onrender.com · Alpaca sandbox
auth working · Postgres persistence live · multi-user · round-up engine placing real
sandbox orders.*

This document is the bridge from "it works" to "it's worth using." It's organized as:
where the product actually is today, the one idea that makes it worth building at all, and
a five-phase plan from the current stage to a product that is genuinely stunning, honest,
and likely to convert a stranger into a user.

---

## Part 1 — What Steward is today (verified, not claimed)

Every item here was tested against the live deployment or the codebase, not assumed.

**The hard part is done.** The thing that stalled this project for months — Alpaca
authentication — is solved. Alpaca migrated the Broker API to OAuth2 client-credentials,
and the old code was still using legacy Basic auth, which returned a bare `401` forever.
That's fixed, and the app now exchanges a token and places real orders in the sandbox.

**It is a real multi-user application, not a mockup.** Working today:

- **Accounts** — email + password signup, scrypt-hashed passwords, HttpOnly session
  cookies. Not a hardcoded demo user.
- **Durable state** — Postgres on Render. Users, portfolios, and their Alpaca account
  links survive restarts and redeploys. (The DB layer is fail-soft: if Postgres is ever
  unreachable it degrades to a file rather than crashing.)
- **Onboarding drives the engine** — the moral framework a user picks actually determines
  their holdings. Choose Islamic/Sharia and the money splits across SPUS/HLAL/SPSK;
  choose Christian Values and it's BIBL/PRAY/FCATX/FBND. This was previously fake
  (hardcoded to ESGV). It is now real. **This is the core differentiator, and it works.**
- **Real brokerage accounts** — onboarding creates a genuine per-user Alpaca sandbox
  account from the user's profile.
- **The round-up engine** — integer-cent math with no floating-point drift, a clearing
  ledger, a $5 sweep threshold, and allocation-weighted buys. Covered by 17 passing tests.
- **Honesty by design** — the ESG "similarity" and "exclusion" figures are now labelled
  *illustrative estimates* rather than presented as audited fact.

**What is not yet true** — and this is the honest gap list:

- **Funding is slow.** The firm-account ID (`ALPACA_FIRM_ACCOUNT_ID`) is not set in
  production, so new users are funded by simulated ACH, which takes 10–30 minutes to
  settle. Until it settles, orders sit "pending" and nothing shows in Alpaca. **This is
  the single most visible problem right now.**
- **A name-length validation gap.** Alpaca rejects account creation if a name is under two
  characters (a real `422` we hit in testing). Onboarding needs input validation.
- **The ESG stats are still invented numbers**, just labelled honestly. Not yet sourced
  from real fund holdings.
- **The donation / tithe flow is display-only.** "Redirect the residue" — arguably the
  most distinctive idea in the whole product — doesn't move any money yet.
- **No real bank feed.** Purchases are simulated by a button, not a Plaid connection.
- **The interface is a polished mockup, not a product surface.** It renders inside a phone
  frame on a desktop page. Good for a demo; not yet something a real user lands on and
  signs up through.

**The honest maturity read:** the plumbing is ~85% real and the surface is ~40% real. Most
capstones are the reverse — a beautiful shell over nothing. You have the harder half.

---

## Part 2 — The one idea that makes this worth building

Before any roadmap, the strategic point, because it determines everything downstream and
it's the difference between "another Acorns clone" and something people talk about.

**Round-up investing is not the product. The confession is.**

Acorns already rounds up spare change. ESG funds already exist. If Steward competes on
"invest your spare change ethically," it's a worse-funded copy of things that exist. That
path leads to generic fintech — and generic fintech is exactly what "AI slop" looks like:
a teal gradient, a balance number, a chart, a referral button. Forgettable.

Steward's actual, defensible idea is philosophical and it's unusual: **it refuses to
pretend ethical investing is clean.** The welcome screen says money is "stored agency."
The app computes "moral leakage" and shows you the residue you *can't* screen out. It asks
you to redirect that residue through a tithe. No competitor does this, because it requires
admitting imperfection — which most finance products are constitutionally incapable of.

That is the wedge. It's emotionally resonant, it's honest, it photographs well, and it
gives people a *reason to tell someone else*. "There's an investing app that admits you
can't be morally pure and helps you make peace with it" is a sentence that travels. "It's
Acorns but ESG" is not.

**So the design and product north star is: make Steward feel like a considered object with
a point of view — closer to a beautifully-made journal or a piece of editorial writing than
to a banking dashboard.** Every phase below serves that. When a choice arises between
"more features" and "more conviction," choose conviction.

---

## Part 3 — What "stunning, not AI slop" concretely means

So this isn't hand-waving, here is the operational definition the build will hold itself to.

**AI slop looks like:** a centered hero with a gradient, three feature cards with icons, a
dashboard of stat tiles, Inter everywhere, purple-to-blue gradients, emoji headers,
rounded-everything, and copy that says "Empower your financial journey." It's competent,
generic, and instantly forgettable because it has no point of view.

**Stunning looks like:** a strong typographic voice (a real serif with character for the
editorial moments, a precise sans for the data), restraint with color, generous whitespace,
one or two memorable moments executed perfectly rather than ten mediocre ones, motion that
clarifies rather than decorates, and copy written like a human with a belief wrote it. The
current earthy green/bone/brass palette is already a good instinct — it doesn't look like a
crypto app, and that's an asset. The work is to push it from "nice mockup" to "designed
object."

**The test for every screen:** *could you screenshot this and would someone stop scrolling?*
If it looks like a template, it fails, no matter how functional.

---

## Part 4 — The build plan, in five phases

Each phase is shippable on its own. Do them in order — later phases assume earlier ones.

### Phase 0 — Make the live demo undeniable (this week)

*Goal: a stranger signs up and, within 30 seconds, sees a real order in a real brokerage
account. No caveats, no waiting.*

The product is 90% there; a few sharp edges undercut it. Close them:

1. **Set `ALPACA_FIRM_ACCOUNT_ID` in Render and switch funding to instant journals.** This
   is the highest-leverage single action left. It turns "orders appear in 20 minutes" into
   "orders appear in 3 seconds." Get the ID from the Broker dashboard → Firm Balance.
2. **Add onboarding input validation** — names ≥ 2 chars, valid DOB, required fields — so
   account creation never 422s in front of a user.
3. **Verify the full loop on the live URL** — sign up → onboard → tap "Make a purchase" a
   few times → confirm a real order lands, and that the dashboard's "orders placed" and
   Alpaca's Orders tab agree.
4. **Handle the closed-market and empty states gracefully** — a first-time user with no
   orders yet should see an inviting "make your first purchase" state, not zeros.

**Expected outcome:** the demo works end-to-end with zero verbal caveats. This is the
minimum bar for showing anyone — a grader, a friend, an investor.

---

### Phase 1 — Make the product honest and whole (1–2 weeks)

*Goal: everything the UI claims is actually true, and the signature feature is real.*

1. **Make "redirect the residue" real.** Right now the tithe is a number on a screen. Use
   Alpaca journals to actually move the tithe percentage into a designated "charitable"
   sandbox account, and show it accumulating. This is the soul of the product — it should
   *do something*, not just display a percentage. Even in sandbox, seeing real dollars
   route to the residue account is the emotional payoff the whole concept promises.
2. **Source or honestly frame the ESG numbers.** Either pull real exclusion/holdings data
   from the fund providers (best), or reframe the stats as clearly-modelled "estimated
   impact" with a short, honest methodology note. The current "illustrative" label is a
   floor, not a finish.
3. **Real transaction feed (Plaid sandbox).** Replace the "Make a purchase" button with a
   Plaid-linked simulated bank feed so round-ups come from realistic transaction data. Keep
   the manual button as a demo affordance.
4. **Statement as a keepsake.** The monthly "Wealth · Impact · Restoration" statement is a
   genuinely original idea. Make it a real, exportable artifact (PDF) a user would want to
   keep or share — this is latent marketing.

**Expected outcome:** nothing in the app is a placeholder. The distinctive ideas —
stewardship score, moral leakage, redirected residue — are all backed by real behavior.

---

### Phase 2 — Make it stunning (2–4 weeks) — the phase that earns attention

*Goal: the interface becomes the reason people share it. This is where "not AI slop" is
won or lost.*

This is a design-led phase. Budget real time for it; it's the differentiator between a
working capstone and a product people want.

1. **Define a real identity.** A wordmark, a typographic system (one characterful serif for
   editorial voice, one precise sans for data), a tightened palette, and a small set of
   custom marks/icons. Not an icon library. Give it the feeling of a considered brand.
2. **Rewrite every word.** Copy is design. Replace all generic finance phrasing with the
   product's actual voice — plain, a little literary, morally serious without being preachy.
   The welcome screen's "money is stored agency" is the tone; make the whole app sound like
   that one sentence.
3. **Turn onboarding into a narrative, not a form.** Right now it's steps. Make choosing a
   moral framework feel like a meaningful act — because for the user, it is. One idea per
   screen, beautiful transitions, language that respects the weight of the choice.
4. **Design the three signature moments to be screenshot-worthy:** the moral-leakage
   visualization, the stewardship score, and the monthly statement. Each should be a small
   piece of information design someone would post.
5. **Motion with intent.** A round-up animating from purchase → clearing → invested. The
   residue visibly routing to charity. Motion that *explains the model*, never decoration.
6. **Ship a real landing page.** Not the app in a phone frame — an actual marketing page
   that states the philosophy, shows the product, and has one clear call to action. This is
   what a stranger hits first and it decides whether they sign up.

**Expected outcome:** the product looks like it was made by people with taste and a
conviction. Screenshots stop the scroll. This is the phase that makes it *attractive*, in
the literal sense of attracting people.

---

### Phase 3 — Make it trustworthy and shareable (2–3 weeks)

*Goal: reduce the friction and doubt between "interested" and "using," and give momentum a
way to compound.*

1. **A confident, honest trust story.** A short, well-designed page on how it works, what's
   real, what's simulated, and — critically — the regulatory reality (see `GO-LIVE.md`).
   Owning the limits *builds* trust for a product about honesty; hiding them would be
   self-defeating.
2. **A shareable artifact.** Let a user share their stewardship statement or a
   "here's the residue I redirected this month" card. The confession is the viral hook —
   give it a surface.
3. **Waitlist + analytics.** If real money is gated behind compliance (it is), capture
   demand now. A waitlist with a clear promise, plus basic funnel analytics so you learn
   where people drop.
4. **Accessibility and polish pass.** Contrast, focus states, keyboard nav, mobile-real
   (not phone-frame-on-desktop). Stunning includes usable.

**Expected outcome:** a stranger can understand it, trust it, try it, and pass it on — and
you can measure each of those steps.

---

### Phase 4 — The path to real (ongoing, gated by law, not code)

*Goal: know exactly what "real money" requires, and build toward it deliberately.*

This phase is mostly not engineering. As documented in `GO-LIVE.md`: taking real money
makes Steward an investment adviser and requires Alpaca live approval (typically a licensed
entity), RIA registration, KYC/AML, and a fiduciary posture. That is a multi-quarter,
funded-company undertaking and **explicitly out of scope for a capstone** — which is a
strength to state plainly, not a gap to hide.

The engineering that *does* belong here and is worth doing regardless: hardened auth
(password reset, email verification), per-order audit trails, real error monitoring, and a
security review. Build these in sandbox so the eventual switch is a credential change, not a
rewrite.

**Expected outcome:** a credible, documented answer to "what would it take to go live?" —
which, in a capstone, is a more impressive story than pretending you already have.

---

## Part 5 — Roadmap at a glance

| Phase | Theme | Core outcome | Rough effort |
|---|---|---|---|
| **0** | Undeniable demo | Instant funding, real orders, no caveats | Days |
| **1** | Honest & whole | Every feature real, tithe actually moves money | 1–2 weeks |
| **2** | Stunning | Identity, narrative onboarding, screenshot-worthy moments, landing page | 2–4 weeks |
| **3** | Trust & sharing | Trust story, shareable statement, waitlist, a11y | 2–3 weeks |
| **4** | Path to real | Documented compliance path, hardened auth | Ongoing |

---

## Part 6 — What would actually make people use it

The blunt version, because it's what matters.

People will not use Steward because it rounds up spare change — they can get that elsewhere.
They will use it if it makes them *feel something true* about their money: that it's an
extension of their values, that perfection is impossible, and that there's a graceful,
honest way to act anyway. That feeling is the product. The round-ups are just how it's
delivered.

So the ranked priorities are:

1. **Make the demo instantly work** (Phase 0) — nothing else matters if it stutters.
2. **Make the confession real and beautiful** — the tithe that actually moves, the moral
   leakage you can see, the statement you'd keep (Phases 1–2).
3. **Give people the words and images to share it** (Phases 2–3) — the philosophy is the
   marketing.

Everything else is in service of those three. Resist the urge to add features; the risk to
this product is never "too few features," it's "not enough conviction." Keep it opinionated,
keep it honest, make it beautiful, and it will not look like anything a template produced.

---

*Sandbox only. Real money involves securities and money-transmission regulation — see
`GO-LIVE.md`. Not legal advice.*
