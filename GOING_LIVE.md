# Steward: what "going live" actually requires

You asked what it takes to take Steward live with real money. This is the honest map.

**I am not a lawyer and this is not legal advice.** Everything below is sourced from
Alpaca's own documentation and public SEC/regulatory guidance, and it's meant to tell you
the *shape* of the problem so you can have an informed conversation with an actual
securities attorney. Do not act on this document alone.

**The headline:** going live is not a technical step. The code change is one line
(`broker-api.sandbox` → `broker-api`). Everything that stands between you and real money is
legal, and it is substantial. Two hard gates, neither of which you can code your way past.

---

## Gate 1 — Alpaca will not give you live credentials on request

Live Broker API access is **not self-serve** like the sandbox. Per Alpaca's onboarding
guide, partners move through staged approval:

```
Sandbox  →  Alpaca vets your app  →  "Limited Live" (beta, restricted users)
         →  Full compliance review (~1 week)  →  Full Live approval  →  launch
```

To even enter that pipeline you need:

- **A real legal entity** — certificate of incorporation, tax ID. Not a person, not a school project.
- **A signed business agreement** with Alpaca, plus negotiated **commercial terms** through their sales team.
- **A documented CIP/KYC program** (Customer Identification Program / Know Your Customer).
- And the big one — Alpaca states that partners are **typically required to be a fully-disclosed broker-dealer, licensed in their jurisdiction.**

That last line is the wall. Alpaca's ~150 partners (Lightyear, Midas, Gotrade, Spaceship,
Abyan) are funded, licensed financial companies — not solo builders. Alpaca absorbs the
*clearing and custody* burden; it does not absorb *your* licensing obligation.

---

## Gate 2 — Steward is legally an investment adviser

This is the part people miss, and it's the one that matters most for Steward specifically.

Under US law, if you provide advice about securities for compensation, you're an investment
adviser. The regulatory guidance is blunt about what triggers this: **if your product
suggests specific securities based on user input, or uses an algorithm to generate a
personalized portfolio, you are offering investment advice.**

That is a precise description of Steward's core feature. The user picks a moral framework
and a risk level; Steward maps that to specific ETF tickers and allocations, then buys them
on the user's behalf and rebalances. That is discretionary portfolio management. Steward is
not a neutral pipe — it *decides*, which is exactly the thing that is regulated.

Consequences of getting this wrong are not theoretical. Operating as an unregistered
investment adviser is a **federal violation**: SEC enforcement, monetary penalties,
disgorgement of fees, and potential criminal liability.

### So you'd need to register as an RIA

Two routes:

**State registration** — the default if you're under $100M AUM. Rules vary by state; you
register where you operate and where your clients are.

**SEC registration via the Internet Adviser Exemption** — this is the route robo-advisers
historically used to register federally *regardless of AUM*. But the SEC **narrowed it in
March 2024** (compliance required by March 31, 2025) after widespread misuse. Now you must:

- maintain **at all times** an operational interactive website through which you deliver
  digital advice on an ongoing basis to **more than one client**, and
- advise **all** of your clients **exclusively** through that website — the old *de minimis*
  exception for a handful of offline clients is **gone**.

So you can't mix in human advice for a few friends. It's all-website or you don't qualify.

Either way, registering makes you a **fiduciary**: legally bound to put clients' interests
ahead of your own, including in how your algorithm is designed.

### The realistic structure

The Acorns-style pattern is: an **RIA entity** that provides the advice, using a
**broker-dealer** (Alpaca) for execution and custody. That's almost certainly Steward's
shape — you become the RIA, Alpaca is the BD. Becoming a broker-dealer yourself means a
FINRA new-member application: far heavier, longer, and capital-intensive.

---

## Steward-specific risks worth naming

**1. The ESG numbers are currently fabricated — this is the most dangerous thing in the repo.**

The exclusion counts, the similarity %, and the stewardship score are hardcoded placeholder
constants in `GoodSteward.jsx`. In a prototype that's fine. Shipped to real investors as
statements about where their money went, unsubstantiated ESG claims are a live SEC
enforcement priority (greenwashing). Presenting invented ethics data to paying customers
isn't a rough edge — it's potentially fraud.

There's a bitter irony here worth sitting with: Steward's entire pitch is *honesty about
moral compromise*. The welcome screen promises users you won't pretend to a purity you don't
have. Right now the code does exactly that. **Fix this regardless of whether you ever go
live** — either source the numbers from real fund data, or label them plainly as
illustrative.

**2. The tithe/donation flow moves customer money to third parties.** Routing client funds to
charities raises its own questions — how it's characterized, tax treatment, and potentially
money-transmission rules. Flag it early with counsel; don't bolt it on late.

**3. Faith-based framing invites scrutiny of accuracy.** If you tell a Muslim user their
portfolio is Sharia-compliant or a Christian user it's biblically screened, that claim needs
to be *true* and *substantiated*, not approximated by an ETF ticker you picked. Getting this
wrong harms the exact people the product is meant to serve.

---

## Realistic cost and timeline

Rough, and you should verify with counsel — but so you're not blindsided:

| Item | Reality |
|---|---|
| RIA registration (legal + filings) | Months, not weeks. Meaningful legal fees. |
| Broker-dealer registration (if needed) | Much longer, capital requirements, FINRA membership |
| Alpaca commercial agreement | Negotiated; expect minimums/fees |
| Compliance program, Form ADV, Form CRS | Ongoing obligation, not one-time |
| Alpaca staged approval | Sandbox → limited live → full live |

**This is not achievable on a capstone timeline, and that is not a failure.** It's a
multi-quarter, funded-company undertaking. Recognizing that *is* the mature engineering
judgment — and writing it down, as you're doing here, is worth more in a capstone than
pretending otherwise.

---

## What I'd actually do

**Ship the sandbox version, publicly and well.** You now have a real, authenticated
brokerage integration placing real fractional orders against a real broker's API. That is
genuinely more than most capstones achieve. Deployed to a URL, with the round-up engine
live end-to-end, it demos *identically* to the real product.

Then close the three gaps that make it real software rather than a mockup:

1. **Wire onboarding → engine.** Today the ETF is hardcoded to `ESGV` no matter which moral
   framework the user picks. Your entire differentiator is currently an illusion — the
   moral framework marketplace doesn't reach the backend at all. **This is the single
   highest-value thing left to build.**
2. **Add persistence.** SQLite. Right now every restart wipes all balances, orders, and
   config.
3. **Fix the ESG numbers.** Source them or label them. Non-negotiable — see above.

Include this document in your capstone. "Here is the regulatory path to production, and
here is why we deliberately stopped at sandbox" is a stronger, more credible story than a
demo that quietly pretends the law doesn't exist.

---

## Sources

- Alpaca, *Getting Started with Broker API: A Guide to our Onboarding Process* — https://alpaca.markets/broker-resources/guide/getting-started-with-broker-api-guide-to-onboarding-process
- Alpaca, *Getting Started with Broker API* (docs) — https://docs.alpaca.markets/us/docs/getting-started-with-broker-api
- Alpaca, *Authentication* — https://docs.alpaca.markets/us/docs/authentication
- SEC, *SEC Adopts Reforms Relating to Investment Advisers Operating Exclusively Through the Internet* (March 27, 2024) — https://www.sec.gov/newsroom/press-releases/2024-42
- K&L Gates, *The SEC Limits the Internet Adviser Exemption* — https://www.klgates.com/The-SEC-Limits-the-Internet-Adviser-Exemption-4-15-2024
- SEC, *Investor Bulletin: Robo-Advisers* — https://www.sec.gov/oiea/investor-alerts-bulletins/ib_robo-advisers
- InnReg, *SEC RIA Registration: Key Steps and Requirements* — https://www.innreg.com/blog/sec-ria-registration-steps-and-requirements

*Again: not legal advice. Talk to a securities attorney before moving real money.*
