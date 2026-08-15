import React, { useState, useMemo, useEffect, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import {
  Globe, Church, Moon, Heart, Sliders, ChevronRight, ChevronLeft,
  Check, Shield, Coins, PiggyBank, Sparkles, TrendingUp, Scale,
  Wallet, Receipt, Info, Leaf, BookOpen, Users, HeartHandshake, Landmark, Bird,
} from "lucide-react";

// Steward design system v1.0 — Manrope, teal / deep-green / amber.
// Amber is load-bearing: it marks the residue (money withheld and given away) and
// nothing else. Generic accents, active states and gains are teal.
const C = {
  bg: "#F7F5F1",        // page background
  card: "#FFFFFF",      // default container
  line: "#EBE7DF",      // card outline, 1px
  divider: "#F6F4EF",   // rows inside cards
  pine: "#0E3A33",      // deep green — hero surface, one per screen
  pineSoft: "#12564C",  // lifted deep green (gradients only)
  teal: "#0E7C6B",      // primary action, gains, active nav
  tealHover: "#0A6659",
  tealActive: "#085449",
  tealTint: "#EAF2F0",  // selected state, active nav
  mint: "#5FD3B0",      // positive figures on deep green
  brass: "#0E7C6B",     // generic accent → teal (amber is residue-only)
  brassSoft: "#5FD3B0", // on-dark accent → mint
  amber: "#946A1E",     // residue ONLY
  amberTint: "#FBF0DA", // residue badge / surface tint
  amberDark: "#F4C97A", // residue figure on a deep-green surface
  amberChart: "#D9A23D",// residue cells in the exposure grid
  ink: "#1A1D1C",       // headings, key figures
  muted: "#6E736F",     // body copy, labels
  faint: "#8E938F",     // timestamps, captions, outflow
  good: "#0E7C6B",      // gains
  warn: "#B4530A",      // warnings
  err:  "#C0392B",      // errors
};
// One typeface: Manrope. `serif` is kept as an alias so existing call sites that
// used it for headings now render Manrope too (weight/size carry the hierarchy).
const serif = "'Manrope', system-ui, sans-serif";
const sans  = "'Manrope', system-ui, sans-serif";

const FRAMEWORKS = {
  broad:      { name: "Broad Ethical",     icon: Globe,         blurb: "Established ESG & ethically screened funds.",               holdings: [{ t:"ESGV",  n:"US ESG Equity",           a:45},{ t:"VSGX",  n:"Intl ESG Equity",         a:25},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:20},{ t:"SUSA",  n:"MSCI USA ESG Select",     a:10}], sim:97.1, excl:214, tithe:2,    faith:false },
  climate:    { name: "Climate Conscious", icon: Leaf,          blurb: "Fossil-fuel-free, low-carbon, clean energy funds.",          holdings: [{ t:"ICLN",  n:"iShares Global Clean Energy",a:35},{ t:"VEGN",  n:"US Vegan Climate ETF",    a:25},{ t:"CRBN",  n:"MSCI Low Carbon Target",  a:25},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:15}], sim:94.8, excl:287, tithe:2,    faith:false },
  humanrights:{ name: "Human Rights",      icon: Users,         blurb: "Screens for labor rights, equality & supply-chain ethics.", holdings: [{ t:"ESGV",  n:"US ESG Equity",           a:40},{ t:"VSGX",  n:"Intl ESG Equity",         a:28},{ t:"JUST",  n:"JUST US Large Cap",       a:17},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:15}], sim:96.2, excl:243, tithe:2,    faith:false },
  animal:     { name: "Animal Welfare",    icon: Bird,          blurb: "Excludes factory farming, animal testing & fur trade.",      holdings: [{ t:"VEGN",  n:"US Vegan Climate ETF",    a:50},{ t:"ESGV",  n:"US ESG Equity",           a:25},{ t:"VSGX",  n:"Intl ESG Equity",         a:15},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:10}], sim:93.6, excl:331, tithe:2,    faith:false },
  christian:  { name: "Christian Values",  icon: Church,        blurb: "Biblically & Catholic-screened funds. Tithing tradition.",   holdings: [{ t:"BIBL",  n:"Inspire 100 ETF",         a:40},{ t:"PRAY",  n:"FIS Biblical Responsible", a:25},{ t:"FCATX", n:"Catholic Values Equity",  a:20},{ t:"FBND",  n:"Core Bond",               a:15}], sim:95.8, excl:268, tithe:10,   faith:true  },
  jewish:     { name: "Jewish Values",     icon: StarOfDavid,   blurb: "Tzedek-aligned screens; tzedakah giving.",                 holdings: [{ t:"ESGV",  n:"US ESG Equity",           a:42},{ t:"VSGX",  n:"Intl ESG Equity",         a:23},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:20},{ t:"SUSB",  n:"Short-Term ESG Bond",     a:15}], sim:96.4, excl:231, tithe:10,   faith:true  },
  islamic:    { name: "Islamic / Sharia",  icon: Moon,          blurb: "Sharia-compliant, interest-free. Zakat at 2.5%.",           holdings: [{ t:"SPUS",  n:"SP Funds S&P 500 Sharia", a:50},{ t:"HLAL",  n:"Wahed FTSE USA Sharia",   a:30},{ t:"SPSK",  n:"Dow Jones Sukuk",         a:20}],                                                                                                                   sim:93.2, excl:312, tithe:2.5,  faith:true  },
};

const FW_GROUPS = [
  { label: "Values-based",    keys: ["broad","climate","humanrights","animal"] },
  { label: "Faith traditions",keys: ["christian","jewish","islamic"] },
];

const SCREEN_EXCLUDES = {
  broad:       { light:["Tobacco","Weapons","Adult content"],                            moderate:["Gambling","Predatory lending","Private prisons"],              strong:["Fossil fuels","Exploitative labor","Severe env. harm"] },
  climate:     { light:["Coal","Tar sands","Arctic drilling"],                           moderate:["Oil & gas producers","Petrochemicals","Gas utilities"],        strong:["All fossil fuels","High-carbon aviation","Cement & steel"] },
  humanrights: { light:["Forced labor supply chains","Cluster munitions","Torture tech"],moderate:["Sweatshop apparel","Surveillance exports","Private prisons"],  strong:["Authoritarian-linked firms","Land grabbing","Migrant exploitation"] },
  animal:      { light:["Factory farming","Fur & exotic leather","Animal testing"],      moderate:["Industrial fishing","Trophy hunting","Foie gras producers"],   strong:["All animal agriculture","Zoos & captive breeding","Animal entertainment"] },
  christian:   { light:["Abortion providers","Adult content","Weapons"],                 moderate:["Gambling","Alcohol","Tobacco"],                                strong:["Contraceptives","Embryonic research","Predatory lending"] },
  jewish:      { light:["Weapons to hostile states","Adult content","Tobacco"],          moderate:["Gambling","Predatory lending","Non-kosher food corps"],        strong:["Settlements-linked firms","Discriminatory employers","Exploitative lending"] },
  islamic:     { light:["Alcohol","Pork products","Adult content"],                      moderate:["Interest-bearing banks","Gambling","Tobacco"],                 strong:["All conventional finance","Weapons","Speculative derivatives"] },
};

const SCREENS = {
  light:    { label:"Light",    reduction:78, simHit:0,   divHit:0, exclAdd:0  },
  moderate: { label:"Moderate", reduction:88, simHit:0.6, divHit:2, exclAdd:42 },
  strong:   { label:"Strong",   reduction:94, simHit:1.4, divHit:5, exclAdd:96 },
};

const OFFSET_BASIS = {
  gains:    { label:"Investment gains",           base:1180 },
  dividends:{ label:"Dividends",                  base:312  },
  roundups: { label:"Round-ups",                  base:268  },
  tithe:    { label:"Traditional tithe (of gains)",base:1180 },
};

const CAUSES = [
  { name:"Global Health",  ex:"Against Malaria, maternal care",   icon:Heart,         c:"#B0563F" },
  { name:"Education",      ex:"Literacy, tutoring, scholarships", icon:BookOpen,      c:"#3E6B4F" },
  { name:"Poverty Relief", ex:"GiveWell top charities",           icon:Coins,         c:C.brass   },
  { name:"Community",      ex:"Local orgs, mutual aid",           icon:Users,         c:"#5B6B8A" },
];

const GROWTH = [
  {m:"Jul",v:9800},{m:"Aug",v:10250},{m:"Sep",v:10180},{m:"Oct",v:10840},
  {m:"Nov",v:11460},{m:"Dec",v:11910},{m:"Jan",v:12380},{m:"Feb",v:12760},
  {m:"Mar",v:13050},{m:"Apr",v:13620},{m:"May",v:14210},{m:"Jun",v:14820},
];

const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
// Money to spec: always 2 decimals, thousands separators.
const fmt2 = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// The last `n` calendar months as short labels, oldest first (for time-series bars).
const lastMonths = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setMonth(d.getMonth() - (n - 1 - i));
  return d.toLocaleString("en-US", { month: "short" });
});

// Human labels for the audit-trail event names.
const AUDIT_LABEL = {
  account_signup: "Account created",
  login: "Signed in",
  brokerage_account_created: "Brokerage account opened",
  funding: "Account funded",
  sweep_invested: "Round-ups swept & invested",
  bank_linked: "Bank connected",
  config_changed: "Framework updated",
};

// True on desktop-width viewports, so the app can present a real web layout
// (top nav, wide content) instead of a phone-shaped column.
function useIsDesktop() {
  const q = "(min-width: 900px)";
  const [d, setD] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setD(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return d;
}

// Lightweight funnel tracking — fire-and-forget, aggregate counts only, no PII.
const track = (name) => {
  try {
    fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  } catch { /* never let analytics break the app */ }
};

// Auth: current user (undefined = loading, null = signed out, object = signed in).
function useAuth() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    fetch("/api/me").then(r => r.ok ? r.json() : null).then(d => setUser(d?.user ?? null)).catch(() => setUser(null));
  }, []);
  const call = (path, body) =>
    fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));
  const signup = async (email, password) => {
    const { ok, data } = await call("/api/signup", { email, password });
    if (ok) { track("signup"); setUser(data.user); } return { ok, error: data.error };
  };
  const login = async (email, password) => {
    const { ok, data } = await call("/api/login", { email, password });
    if (ok) setUser(data.user); return { ok, error: data.error };
  };
  const logout = async () => { await call("/api/logout"); setUser(null); };
  return { user, setUser, signup, login, logout };
}

// Live round-up/ledger data from server/api.mjs (via Vite proxy). Falls back to
// null while loading or if the API isn't running, so the UI degrades gracefully.
function useLiveData() {
  const [data, setData] = useState(null);
  const [buying, setBuying] = useState(false);
  const refresh = () =>
    fetch("/api/portfolio").then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, []);
  // `buying` gives the button immediate feedback — placing a real Alpaca order is a
  // network round-trip, and without it the tap feels broken.
  const addPurchase = () => {
    setBuying(true);
    return fetch("/api/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d); }).catch(() => {})
      .finally(() => setBuying(false));
  };
  const setConfig = (cfg) =>
    fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d); }).catch(() => {});
  const syncBank = () =>
    fetch("/api/plaid/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d); return d; }).catch(() => null);
  return { data, addPurchase, setConfig, buying, syncBank };
}

export default function GoodSteward() {
  const [stage, setStage]               = useState("welcome");
  const [step, setStep]                 = useState(0);
  const [frameworks, setFrameworks]     = useState(["broad"]);
  const [screen, setScreen]             = useState("moderate");
  const [basis, setBasis]               = useState("gains");
  const [pct, setPct]                   = useState(2);
  const [tab, setTab]                   = useState("home");
  const [risk, setRisk]                 = useState("balanced");
  const [contribution, setContribution] = useState(500);
  const [roundups, setRoundups]         = useState(true);
  const [showRoundupsInfo, setShowRoundupsInfo] = useState(false);
  const [showResidueInfo, setShowResidueInfo] = useState(false);
  const [profile, setProfile]           = useState({ firstName:"", lastName:"", dob:"", address:"", city:"", state:"", postal:"" });
  const [creating, setCreating]         = useState(false);
  const [profileError, setProfileError] = useState("");
  const { user, setUser, signup, login, logout } = useAuth();
  const isDesktop = useIsDesktop();
  // Client-side routing for the logged-out marketing site, so every tab has its own
  // URL you can deep-link to and refresh on. A password-reset link (/?reset=…) lands
  // straight on the sign-in view. The server already serves index.html for unknown
  // paths, so a hard refresh on /how-it-works works too.
  const [route, setRoute] = useState(() => {
    if (typeof window === "undefined") return "/";
    if (new URLSearchParams(window.location.search).get("reset")) return "/signin";
    return window.location.pathname;
  });
  const navigate = (path) => {
    if (typeof window !== "undefined") {
      if (path !== window.location.pathname) window.history.pushState({}, "", path);
      window.scrollTo(0, 0);
    }
    setRoute(path);
  };
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Once signed in, drop the /signin URL so the address bar isn't stale.
  useEffect(() => {
    if (user && typeof window !== "undefined" && window.location.pathname === "/signin") {
      window.history.replaceState({}, "", "/");
      setRoute("/");
    }
  }, [user]);
  const [verifyLink, setVerifyLink] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const justVerified = new URLSearchParams(window.location.search).get("verified") === "1";
  const requestVerify = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    const r = await fetch("/api/verify/request", { method: "POST" }).then(r => r.json()).catch(() => ({}));
    setVerifyLink(r.devLink || (r.emailed ? "emailed" : "sent"));
    setVerifyBusy(false);
  };
  const { data: live, addPurchase, setConfig, buying, syncBank } = useLiveData();
  const [linkToken, setLinkToken] = useState(null);
  const [syncing, setSyncing]     = useState(false);
  const [activity, setActivity]   = useState([]);

  // Pull the account's audit trail so the Statement can show what actually happened.
  useEffect(() => {
    if (stage !== "app") return;
    fetch("/api/audit").then(r => r.ok ? r.json() : null).then(d => { if (d?.events) setActivity(d.events); }).catch(() => {});
  }, [stage, live]);

  // Fetch a Plaid link token once the user is onboarded and Plaid is configured but
  // no bank is linked yet — so the "Link your bank" button is ready to open instantly.
  useEffect(() => {
    if (user?.hasProfile && user?.plaidEnabled && !user?.bankLinked && !linkToken) {
      fetch("/api/plaid/link-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
        .then(r => r.ok ? r.json() : null).then(d => { if (d?.linkToken) setLinkToken(d.linkToken); }).catch(() => {});
    }
  }, [user, linkToken]);

  // Plaid Link: on success, exchange the public token → mark the bank linked, then sync.
  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      const res = await fetch("/api/plaid/exchange", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      if (res.ok) { setUser(u => ({ ...u, bankLinked: true })); runSync(); }
    },
  });

  const runSync = async () => { setSyncing(true); await syncBank(); setSyncing(false); };

  const framework = frameworks[0];
  const fw = FRAMEWORKS[framework];
  const sc = SCREENS[screen];

  // Drive the stage from auth: signed out → welcome; signed in without a profile →
  // onboarding; fully set up → the app.
  useEffect(() => {
    if (user === undefined) return;
    if (!user) setStage("landing");
    else if (!user.hasProfile) setStage("onboard");
    else setStage("app");
  }, [user]);

  // Finish onboarding: send profile + chosen framework, create the sandbox account.
  const openAccount = async () => {
    setProfileError("");
    setCreating(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          config: { framework: fw.name, holdings: fw.holdings.map(h => ({ symbol: h.t, a: h.a })), tithePct: pct, contribution, screen },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { track("onboarding_done"); setUser(u => ({ ...u, hasProfile: true })); } // → stage effect moves to app
      else setProfileError(data.error || "Couldn't open your account. Please check your details.");
    } catch {
      setProfileError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const toggleFramework = (k) => {
    setFrameworks(prev =>
      prev.includes(k)
        ? prev.length > 1 ? prev.filter(f => f !== k) : prev
        : [...prev, k]
    );
  };

  // Export the monthly statement as a keepsake PDF (opens a clean printable page →
  // the browser's "Save as PDF"). Zero dependencies.
  const printStatement = () => {
    const w = window.open("", "_blank", "width=760,height=980");
    if (!w) return;
    const name = profile.firstName ? `${profile.firstName} ${profile.lastName}` : (user?.email ?? "");
    const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const d = live ? live.display : {};
    const rows = [
      ["Portfolio value", d.portfolioValue ?? "$0.00"],
      ["Invested to date", d.invested ?? "$0.00"],
      ["Rounded up this month", d.roundupsThisMonth ?? "$0.00"],
      ["Given away", d.donated ?? "$0.00", "amber"],
      ["In clearing", d.clearing ?? "$0.00"],
      ["Framework", fw.name],
      ["Stewardship rate", `${pct}%`],
    ];
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Steward · ${month} Statement</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        body{font-family:'Manrope',system-ui,sans-serif;color:#1A1D1C;background:#F7F5F1;margin:0;padding:48px;font-variant-numeric:tabular-nums}
        .card{max-width:620px;margin:0 auto;background:#fff;border:1px solid #EBE7DF;border-radius:16px;padding:40px}
        .kick{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#0E7C6B;font-weight:700}
        h1{font-weight:700;color:#1A1D1C;font-size:26px;margin:6px 0 2px;letter-spacing:-.03em}
        .sub{color:#6E736F;font-size:13px;margin-bottom:20px}
        .row{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #F6F4EF}
        .row:last-child{border-bottom:none}
        .k{color:#6E736F;font-size:13.5px}
        .v{color:#1A1D1C;font-weight:700;font-size:15px}
        .v.amber{color:#946A1E}
        .quote{color:#6E736F;font-size:14px;line-height:1.6;margin-top:24px;border-top:1px solid #EBE7DF;padding-top:20px}
        @media print{body{background:#fff;padding:0}.card{border:none}}
      </style></head><body><div class="card">
      <div class="kick">Steward · ${month}</div>
      <h1>Wealth · Impact · Restoration</h1>
      <div class="sub">${name}: a fuller account than "you made 8.2%."</div>
      ${rows.map(([k, v, cls]) => `<div class="row"><span class="k">${k}</span><span class="v${cls ? " " + cls : ""}">${v}</span></div>`).join("")}
      <div class="quote">Stewardship: minimize foreseeable harm, preserve practical effectiveness, and direct the unavoidable residue toward the common good.</div>
      </div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  // Shareable artifact — a card a user would actually post: "here's the residue I
  // redirected this month." Uses the native share sheet when available, otherwise
  // opens a clean card to screenshot and copies the line to the clipboard.
  const shareStatement = async () => {
    track("share_open");
    const d = live ? live.display : {};
    const donated = d.donated ?? "$0.00", invested = d.invested ?? "$0.00";
    const line = `This month with Steward I invested ${invested} of spare change by my values, and redirected ${donated} of the residue to giving.`;
    const url = window.location.origin;
    if (navigator.share) {
      try { await navigator.share({ title: "Steward", text: line, url }); return; } catch { /* cancelled — fall through */ }
    }
    try { await navigator.clipboard?.writeText(line + " " + url); } catch { /* ignore */ }
    const w = window.open("", "_blank", "width=620,height=680");
    if (!w) return;
    const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Steward</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        html,body{margin:0;height:100%} body{display:grid;place-items:center;background:#0A2620;font-family:'Manrope',sans-serif;font-variant-numeric:tabular-nums}
        .card{width:520px;max-width:92vw;aspect-ratio:1/1.15;background:#0E3A33;border-radius:18px;padding:44px;box-sizing:border-box;color:#EAF2F0;display:flex;flex-direction:column;justify-content:space-between}
        .kick{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8FB5AC;font-weight:700}
        .big{font-weight:800;font-size:30px;line-height:1.15;letter-spacing:-.04em;margin:18px 0 0}
        .row{display:flex;gap:28px;margin-top:26px}
        .stat .n{font-weight:700;font-size:34px;letter-spacing:-.035em;color:#EAF2F0}
        .stat .l{font-size:12px;color:#8FB5AC;margin-top:2px}
        .amber{color:#F4C97A}
        .foot{font-size:12.5px;color:#8FB5AC;display:flex;justify-content:space-between;align-items:center}
      </style></head><body><div class="card">
      <div><div class="kick">Steward · ${month}</div>
      <div class="big">Spare change, invested by my values, and the residue given on purpose.</div></div>
      <div class="row">
        <div class="stat"><div class="n">${invested}</div><div class="l">invested this month</div></div>
        <div class="stat"><div class="n amber">${donated}</div><div class="l">given away</div></div>
      </div>
      <div class="foot"><span>Money is stored agency.</span><span>${url.replace(/^https?:\/\//,"")}</span></div>
      </div></body></html>`);
    w.document.close();
  };

  const derived = useMemo(() => {
    const avgExcl      = Math.round(frameworks.reduce((s,k) => s + FRAMEWORKS[k].excl, 0) / frameworks.length) + sc.exclAdd;
    const avgSim       = +(frameworks.reduce((s,k) => s + FRAMEWORKS[k].sim, 0) / frameworks.length - sc.simHit).toFixed(1);
    const hasFaith     = frameworks.some(k => FRAMEWORKS[k].faith);
    const suggestedTithe = Math.max(...frameworks.map(k => FRAMEWORKS[k].tithe));
    const reduction    = sc.reduction;
    const residual     = 100 - reduction;
    const annualDonation = (OFFSET_BASIS[basis].base * pct) / 100;
    const harm         = Math.round((reduction / 100) * 40);
    const diversification = Math.max(0, 20 - sc.divHit + (avgSim > 96 ? 0 : -1));
    const returns      = Math.round((avgSim / 100) * 20);
    const redistribution = Math.min(20, Math.round(pct * 2));
    const score        = Math.min(99, harm + diversification + returns + redistribution);
    return { excluded:avgExcl, similarity:avgSim, reduction, residual, annualDonation, harm, diversification, returns, redistribution, score, hasFaith, suggestedTithe };
  }, [frameworks, screen, basis, pct, sc]);

  // Push the user's choices to the backend so round-ups actually buy the chosen
  // framework's ETFs and the tithe/contribution feed real numbers.
  useEffect(() => {
    if (stage !== "app") return;
    setConfig({
      framework: fw.name,
      holdings: fw.holdings.map(h => ({ symbol: h.t, a: h.a })),
      tithePct: pct,
      contribution,
      screen,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, framework, screen, pct, contribution]);

  /* ── LOADING (auth check in flight) ── */
  if (user === undefined) return (
    <Frame>
      <FontInjector />
      <div style={{ flex:1, display:"grid", placeItems:"center", background:C.pine }}>
        <Mark size={34} color={C.mint} counter={C.pine} />
      </div>
    </Frame>
  );

  /* ── MARKETING + AUTH (logged out, driven by the URL) ── */
  if (!user) {
    if (route === "/signin") return <AuthScreen signup={signup} login={login} onBack={() => navigate("/")} />;
    return <Marketing route={route} navigate={navigate} />;
  }

  /* ── ONBOARDING ── */
  if (stage === "onboard") {
    const steps = [renderRisk, renderFramework, renderScreen, renderTithe, renderProfile];
    const last = steps.length - 1;
    const profileOk = profile.firstName && profile.lastName && profile.dob;
    return (
      <Frame>
        <FontInjector />
        <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden", minHeight:0 }}>
          <div style={{ padding:"20px 22px 8px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              {step > 0 && <button onClick={() => setStep(step-1)} aria-label="Go back a step" style={iconBtn}><ChevronLeft size={18} color={C.pine} /></button>}
              <Dots n={steps.length} active={step} />
              <button onClick={logout} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:sans, fontSize:12.5, fontWeight:600, color:C.muted, flexShrink:0 }}>Sign out</button>
            </div>
          </div>
          <div style={{ flex:1, overflowY:"scroll", overflowX:"hidden", padding:"0 22px 20px", WebkitOverflowScrolling:"touch" }}>
            <div key={step} style={{ animation:"stepIn .45s cubic-bezier(.22,.61,.36,1)" }}>
              {steps[step]()}
            </div>
          </div>
          <div style={{ padding:"12px 22px 24px", borderTop:`1px solid ${C.line}`, background:C.card }}>
            <Btn onClick={() => step < last ? setStep(step+1) : (profileOk && !creating && openAccount())}>
              {creating ? "Opening account…" : step < last ? "Continue" : "Open my account"} <ChevronRight size={17} />
            </Btn>
          </div>
        </div>
      </Frame>
    );
  }

  /* ── MAIN APP ── */
  const verifyBanner = (
    <>
      {justVerified && (
        <div style={{ margin:"10px 22px 0", padding:"10px 14px", background:C.pine + "12", borderRadius:12, fontFamily:sans, fontSize:12.5, color:C.pine }}>
          ✓ Email verified. Thank you.
        </div>
      )}
      {user && !user.emailVerified && !justVerified && (
        <div style={{ margin:"10px 22px 0", padding:"10px 14px", background:"#B48A4A14", borderRadius:12, fontFamily:sans, fontSize:12.5, color:C.ink, display:"flex", flexWrap:"wrap", alignItems:"center", gap:8 }}>
          <span>Verify your email to secure your account.</span>
          {verifyLink === null && (
            <button onClick={requestVerify} style={{ background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:sans, fontSize:12.5, color:C.brass, textDecoration:"underline" }}>
              {verifyBusy ? "Sending…" : "Send verification link"}
            </button>
          )}
          {verifyLink && verifyLink !== "sent" && verifyLink !== "emailed" && (
            <a href={verifyLink} style={{ fontFamily:sans, fontSize:12.5, color:C.brass, textDecoration:"underline" }}>
              Open verification link (shown here; the demo has no email provider)
            </a>
          )}
          {verifyLink === "emailed" && <span style={{ color:C.pine }}>✓ Verification link sent. Check your inbox.</span>}
          {verifyLink === "sent" && <span style={{ color:C.muted }}>Link issued. Check the server log.</span>}
        </div>
      )}
    </>
  );
  const tabBody = (
    <>
      {tab === "home"      && renderHome()}
      {tab === "portfolio" && renderPortfolio()}
      {tab === "impact"    && renderImpact()}
      {tab === "report"    && renderReport()}
    </>
  );

  // Desktop: a real web layout — top navigation, wide content, page scroll.
  if (isDesktop) {
    const nav = [
      { k:"home", label:"Home", icon:Scale }, { k:"portfolio", label:"Portfolio", icon:Wallet },
      { k:"impact", label:"Impact", icon:HeartHandshake }, { k:"report", label:"Statement", icon:Receipt },
    ];
    return (
      <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:sans }}>
        <FontInjector />
        <header style={{ position:"sticky", top:0, zIndex:10, background:"#F7F5F1f2", backdropFilter:"blur(8px)", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ maxWidth:920, margin:"0 auto", padding:"12px 26px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}><Mark size={22} color={C.teal} /><span style={{ fontFamily:sans, fontSize:19, fontWeight:700, color:C.ink, letterSpacing:"-0.02em" }}>Steward</span></div>
            <nav style={{ display:"flex", alignItems:"center", gap:2 }}>
              {nav.map(n => { const Icon = n.icon; const on = tab === n.k; return (
                <button key={n.k} onClick={() => setTab(n.k)} style={{ background:on?C.tealTint:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:7, padding:"7px 14px", borderRadius:9, fontFamily:sans, fontSize:14, fontWeight:on?700:600, color:on?C.teal:C.muted }}><Icon size={16} color={on?C.teal:C.muted} strokeWidth={on?2.1:1.7} />{n.label}</button>
              ); })}
            </nav>
            <button onClick={logout} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:sans, fontSize:13.5, fontWeight:600, color:C.muted }}>Sign out</button>
          </div>
        </header>
        <main style={{ maxWidth:680, margin:"0 auto", padding:"14px 0 90px" }}>
          {verifyBanner}
          {tabBody}
        </main>
      </div>
    );
  }

  // Mobile: the single-column app with a bottom tab bar.
  return (
    <Frame>
      <FontInjector />
      <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden" }}>
        <div style={{ flex:1, overflowY:"auto", paddingBottom:8 }}>
          {verifyBanner}
          {tabBody}
        </div>
        <TabBar tab={tab} setTab={setTab} />
      </div>
    </Frame>
  );

  /* ══ ONBOARDING SCREENS ══ */

  function renderRisk() {
    return (
      <div>
        <Kicker>Step 1 · The basics</Kicker>
        <H2>How should we steward the funds?</H2>
        <P>More stock means more growth and more swing; more bonds, the steadier ride. Nothing here is fixed. Change it whenever.</P>
        <div style={{ marginTop:20, display:"grid", gap:10 }}>
          {[
            { k:"conservative", t:"Conservative", d:"Steadier, more bonds"       },
            { k:"balanced",     t:"Balanced",     d:"A measured middle path"      },
            { k:"growth",       t:"Growth",       d:"More equity, longer horizon" },
          ].map(o => <SelectCard key={o.k} active={risk===o.k} onClick={() => setRisk(o.k)} title={o.t} desc={o.d} />)}
        </div>

        <Field
          label="Monthly contribution"
          value={`$${contribution} / mo`}
          editable
          onEdit={v => { const n = parseInt(v.replace(/\D/g,"")); if (!isNaN(n)) setContribution(n); }}
        />

        {/* Round-ups toggle */}
        <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:12, padding:"13px 15px", marginTop:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>Round-ups</span>
              <button onClick={() => setShowRoundupsInfo(v => !v)} aria-label="What are round-ups?" style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"grid", placeItems:"center" }}>
                <Info size={14} color={showRoundupsInfo ? C.pine : C.muted} />
              </button>
            </div>
            <div onClick={() => setRoundups(v => !v)} role="switch" aria-checked={roundups} aria-label="Round-ups" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRoundups(v => !v); } }} style={{ width:44, height:26, borderRadius:13, background:roundups ? C.pine : C.line, cursor:"pointer", position:"relative", transition:"background .25s", flexShrink:0 }}>
              <div style={{ position:"absolute", top:3, left:roundups ? 21 : 3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .25s", boxShadow:"0 1px 4px rgba(0,0,0,0.18)" }} />
            </div>
          </div>
          {showRoundupsInfo && (
            <div style={{ marginTop:10, padding:"10px 12px", background:C.brass+"15", borderRadius:10, fontFamily:sans, fontSize:12.5, color:C.ink, lineHeight:1.55 }}>
              <b style={{ color:C.pine }}>Optional add-on.</b> Your monthly contribution is the core of the app; round-ups are just a bonus on top. Every purchase gets rounded up to the nearest dollar and the spare change is swept into your portfolio. e.g. a $3.60 coffee → 40¢ invested. Toggle off if you'd rather keep spending separate.
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderFramework() {
    return (
      <div>
        <Kicker>Step 2 · The marketplace</Kicker>
        <H2>Choose your moral frameworks</H2>
        <P>Pick the tradition or values you invest by. Everything you hold gets measured against it, and you can hold more than one.</P>
        <div style={{ marginTop:18, display:"grid", gap:18 }}>
          {FW_GROUPS.map(grp => (
            <div key={grp.label}>
              <div style={{ fontFamily:sans, fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, fontWeight:700, marginBottom:8 }}>{grp.label}</div>
              <div style={{ display:"grid", gap:9 }}>
                {grp.keys.map(k => {
                  const v = FRAMEWORKS[k]; const Icon = v.icon; const on = frameworks.includes(k);
                  return (
                    <button key={k} onClick={() => toggleFramework(k)} style={{ ...rowCard, borderColor:on?C.teal:C.line, borderWidth:1.5, background:on?C.tealTint:C.card }}>
                      <div style={{ width:40, height:40, borderRadius:11, flexShrink:0, display:"grid", placeItems:"center", background:on?C.pine:"#EDE6D5" }}>
                        <Icon size={19} color={on?C.brassSoft:C.pine} strokeWidth={1.7} />
                      </div>
                      <div style={{ textAlign:"left", flex:1 }}>
                        <div style={{ fontFamily:serif, fontSize:16, color:C.ink, fontWeight:500 }}>{v.name}</div>
                        <div style={{ fontFamily:sans, fontSize:12, color:C.muted, marginTop:1 }}>{v.blurb}</div>
                      </div>
                      <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${on?C.pine:C.line}`, background:on?C.pine:"transparent", display:"grid", placeItems:"center", flexShrink:0 }}>
                        {on && <Check size={13} color="#F3EEE2" strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {frameworks.length > 1 && (
          <div style={{ marginTop:14, padding:"10px 14px", background:C.brass+"18", borderRadius:12, fontFamily:sans, fontSize:12.5, color:C.brass, lineHeight:1.5 }}>
            ✦ Combined screen: {frameworks.map(k => FRAMEWORKS[k].name).join(" + ")}. Holdings will reflect the strictest shared standard.
          </div>
        )}
      </div>
    );
  }

  function renderScreen() {
    return (
      <div>
        <Kicker>Step 3 · The screen</Kicker>
        <H2>How strict should the screen be?</H2>
        <P>Stricter screens cut more harm, but drift slightly from the market. We show you the tradeoff honestly.</P>
        <div style={{ marginTop:18, display:"grid", gap:10 }}>
          {Object.entries(SCREENS).map(([k, v]) => {
            const on = screen === k;
            const fwKey = frameworks[0];
            const ex = SCREEN_EXCLUDES[fwKey];
            const chips = k === "light" ? ex.light : k === "moderate" ? [...ex.light,...ex.moderate] : [...ex.light,...ex.moderate,...ex.strong];
            return (
              <button key={k} onClick={() => setScreen(k)} style={{ ...rowCard, alignItems:"flex-start", flexDirection:"column", gap:8, borderColor:on?C.teal:C.line, borderWidth:1.5, background:on?C.tealTint:C.card }}>
                <div style={{ display:"flex", width:"100%", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontFamily:serif, fontSize:16.5, color:C.ink, fontWeight:500 }}>{v.label}</span>
                  {on && <Check size={17} color={C.pine} />}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {chips.map(e => <span key={e} style={chip}>{e}</span>)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderTithe() {
    return (
      <div>
        <Kicker>Step 4 · The offset</Kicker>
        <H2>Redirect the residue</H2>
        <P>No screen catches everything; some harm always slips through. Set aside a share of what you make and send it somewhere good.</P>
        <div style={{ marginTop:18, fontFamily:sans, fontSize:12.5, color:C.muted, marginBottom:8 }}>Apply to</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {Object.entries(OFFSET_BASIS).map(([k,v]) => (
            <button key={k} onClick={() => setBasis(k)} style={{ ...miniCard, borderColor:basis===k?C.teal:C.line, background:basis===k?C.tealTint:C.card }}>
              <span style={{ fontFamily:sans, fontSize:12.5, fontWeight:600, color:C.ink }}>{v.label}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop:20, display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          <span style={{ fontFamily:sans, fontSize:12.5, color:C.muted }}>Stewardship rate · suggested {derived.suggestedTithe}%</span>
          <InfoDot on={showResidueInfo} onClick={() => setShowResidueInfo(v => !v)} label="What does the stewardship rate do?" accent={C.amber} />
        </div>
        {showResidueInfo && (
          <div style={{ marginBottom:14, padding:"10px 12px", background:C.amber+"15", borderRadius:10, fontFamily:sans, fontSize:12.5, color:C.ink, lineHeight:1.55 }}>
            <b style={{ color:C.amber }}>The residue</b> is the harm no screen can fully catch, even a strict fund still touches something you wouldn't choose. The stewardship rate is the slice of every $5 sweep held back and given away instead of invested. At {pct}%, that's {fmt2((pct/100)*5)} given and {fmt2(5-(pct/100)*5)} invested per sweep, automatically.
          </div>
        )}
        <input type="range" min={0} max={10} step={0.5} value={pct} onChange={e => setPct(+e.target.value)} style={{ width:"100%", accentColor:C.pine }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 }}>
          <span style={{ fontFamily:sans, fontSize:30, color:C.amber, fontWeight:700, letterSpacing:"-0.03em" }}>{pct}%</span>
          <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>≈ {fmt(derived.annualDonation)}/yr to causes</span>
        </div>
      </div>
    );
  }

  function renderProfile() {
    const set = (k) => (e) => setProfile(p => ({ ...p, [k]: e.target.value }));
    return (
      <div>
        <Kicker>Step 5 · Your profile</Kicker>
        <H2>Open your brokerage account</H2>
        <P>We use this to open your brokerage account with our partner, Alpaca.</P>
        <div style={{ marginTop:18, display:"grid", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <ProfileInput label="First name" value={profile.firstName} onChange={set("firstName")} />
            <ProfileInput label="Last name" value={profile.lastName} onChange={set("lastName")} />
          </div>
          <ProfileInput label="Date of birth" type="date" value={profile.dob} onChange={set("dob")} />
          <ProfileInput label="Street address" value={profile.address} onChange={set("address")} placeholder="123 Main St" />
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10 }}>
            <ProfileInput label="City" value={profile.city} onChange={set("city")} />
            <ProfileInput label="State" value={profile.state} onChange={set("state")} placeholder="CA" />
            <ProfileInput label="ZIP" value={profile.postal} onChange={set("postal")} placeholder="94105" />
          </div>
        </div>
        {profileError && (
          <div style={{ marginTop:12, fontFamily:sans, fontSize:12.5, color:"#B0563F", background:"#B0563F14", padding:"10px 12px", borderRadius:10 }}>
            {profileError}
          </div>
        )}
        <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.5, marginTop:14 }}>
          By continuing you agree to the customer agreement.
        </p>
      </div>
    );
  }

  /* ══ APP SCREENS ══ */

  function renderHome() {
    return (
      <div>
        <Header title="Stewardship" sub={`Good morning${profile.firstName ? ", " + profile.firstName : ""}`} />
        <div style={{ padding:"0 18px" }}>
          <div style={{ background:C.pine, borderRadius:18, padding:"22px 22px 6px", color:"#EAF2F0", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"relative", zIndex:1 }}>
              <span style={{ fontFamily:sans, fontSize:12.5, fontWeight:600, color:"#8FB5AC" }}>Portfolio value</span>
              <div style={{ fontFamily:sans, fontSize:38, fontWeight:700, marginTop:4, letterSpacing:"-0.035em", color:"#EAF2F0" }}>{live ? <AnimatedMoney cents={live.portfolioValueCents} /> : fmt(14820)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                <TrendingUp size={15} color={C.mint} />
                <span style={{ fontFamily:sans, fontSize:13.5, color:C.mint }}>
                  {live ? `${live.display.roundupsThisMonth} rounded up this month` : `+${fmt(1180)} · +8.66% this year`}
                </span>
              </div>
            </div>
            <div style={{ height:86, marginTop:8, marginLeft:-8, marginRight:-8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={live && live.growth && live.growth.length > 1 ? live.growth : GROWTH} margin={{ top:6, right:6, bottom:0, left:6 }}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.brassSoft} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={C.brassSoft} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={C.brassSoft} strokeWidth={2} fill="url(#g)" />
                  <XAxis dataKey="m" hide />
                  <Tooltip contentStyle={{ background:C.pine, border:"none", borderRadius:8, fontFamily:sans, fontSize:12 }} labelStyle={{ color:C.brassSoft }} itemStyle={{ color:"#fff" }} formatter={v => [fmt(v),"Value"]} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {live && (
            <Card>
              <Row icon={Wallet} label="Your account" right={
                <InfoTag>{live.mode === "alpaca" ? "live" : "demo"}</InfoTag>
              } />
              {live.txCount > 0 ? (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
                    <LiveStat label={`Invested · ${live.etf}`} value={live.display.invested} />
                    <LiveStat label="In clearing" value={live.display.clearing} />
                    <LiveStat label="Given away" value={live.display.donated} accent={C.amber} />
                    <LiveStat label={live.display.pending ? "Pending (settling)" : "Orders placed"}
                              value={live.display.pending ?? String(live.ordersPlaced)} />
                  </div>
                  {live.display.pending && (
                    <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.5, margin:"10px 0 0" }}>
                      {live.display.pending} of round-ups is queued. Your transfer is still settling, and it invests automatically the moment the funds land.
                    </p>
                  )}
                </>
              ) : (
                <div style={{ marginTop:12, padding:"14px 15px", background:C.bg, border:`1px dashed ${C.line}`, borderRadius:12, textAlign:"center" }}>
                  <div style={{ fontFamily:sans, fontSize:16, color:C.ink, fontWeight:700, letterSpacing:"-0.02em" }}>Your account is ready.</div>
                  <div style={{ fontFamily:sans, fontSize:13, color:C.muted, lineHeight:1.5, marginTop:4 }}>
                    Simulate your first purchase below. The spare change rounds up, and every $5 buys your {fw.name} ETFs.
                  </div>
                </div>
              )}

              {/* The core interaction of the whole product: spend money → spare change
                  rounds up → sweeps at $5 → buys your framework's ETFs. This used to be a
                  small text link buried in the Impact tab, which meant nobody ever found
                  the one button that demonstrates what Steward actually does. */}
              <button
                onClick={addPurchase}
                disabled={buying}
                style={{
                  width: "100%", marginTop: 14, padding: "14px 20px",
                  background: buying ? C.tealActive : C.teal, color: "#fff",
                  border: "none", borderRadius: 11, cursor: buying ? "default" : "pointer",
                  fontFamily: sans, fontSize: 13.5, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {buying ? "Rounding up…" : <>Simulate a purchase <ChevronRight size={16} /></>}
              </button>

              {/* Real bank feed via Plaid: link once, then Sync pulls actual transactions
                  through the same round-up engine. The manual button above stays for demos. */}
              {user?.plaidEnabled && (
                user?.bankLinked ? (
                  <button onClick={runSync} disabled={syncing}
                    style={{ width:"100%", marginTop:9, padding:"12px 16px", background:"transparent", color:C.teal,
                      border:`1px solid ${C.teal}`, borderRadius:11, cursor: syncing ? "default" : "pointer",
                      fontFamily:sans, fontSize:14, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    {syncing ? "Syncing…" : <>Sync transactions <Receipt size={15} /></>}
                  </button>
                ) : (
                  <button onClick={() => plaidReady && openPlaid()} disabled={!plaidReady}
                    style={{ width:"100%", marginTop:9, padding:"12px 16px", background:"transparent", color:C.teal,
                      border:`1px solid ${C.teal}`, borderRadius:11, cursor: plaidReady ? "pointer" : "default",
                      fontFamily:sans, fontSize:14, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <Landmark size={15} /> Link your bank
                  </button>
                )
              )}

              <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.45, margin:"8px 0 0", textAlign:"center" }}>
                {user?.bankLinked
                  ? "Your bank is linked. Sync pulls real transactions into the round-up engine."
                  : <>Simulates a card purchase. Spare change rounds up, and every $5 buys your
                     {" ETFs."}</>}
              </p>
            </Card>
          )}

          {live && <FlowStrip live={live} />}

          <Card>
            <Row icon={Globe} label="Market tracking" right={<InfoTag>illustrative</InfoTag>} />
            <p style={{ fontFamily:sans, fontSize:14, color:C.ink, lineHeight:1.5, margin:"8px 0 0" }}>
              Your portfolio tracks the US market at <b style={{ color:C.pine }}>{derived.similarity}% similarity</b> while excluding <b style={{ color:C.pine }}>{derived.excluded} companies</b> that violate your {fw.name} · {SCREENS[screen].label} standard.
            </p>
            {/* Honesty note: these two figures are modelled placeholders, not sourced from
                fund holdings data. Steward's whole premise is refusing to overstate its own
                purity — so we say so rather than quietly implying these are audited numbers. */}
            <p style={{ fontFamily:sans, fontSize:11.5, color:C.faint, lineHeight:1.45, margin:"10px 0 0" }}>
              Estimates modelled from published screens, not audited holdings. We model them from each
              fund family's published screening categories (what they exclude and how strictly), scaled
              by your chosen screen level, not computed from live holdings. Your actual holdings and
              orders (below and in your statement) are real.
            </p>
          </Card>

          <Card>
            <Row icon={Scale} label="Exposure" right={<InfoTag>estimate</InfoTag>} />
            <div style={{ marginTop:14 }}>
              <ExposureGrid residue={derived.residual} screenedLabel="removed by your screen" residueLabel="the residue" />
            </div>
            <p style={{ fontFamily:sans, fontSize:12.5, color:C.muted, lineHeight:1.6, margin:"14px 0 0" }}>
              {derived.residual} of every 100 holdings survive the screen. No portfolio is clean, so rather than
              hide the part that isn't, we mark it, and the residue is what your giving, below, is for.
            </p>
          </Card>

          <Card>
            <Row icon={Sparkles} label="Stewardship score" right={
              <span style={{ fontFamily:sans, fontSize:26, fontWeight:700, color:C.ink, letterSpacing:"-0.03em" }}>{derived.score}<span style={{ fontSize:14, color:C.muted, fontWeight:600 }}>/100</span></span>
            } />
            <div style={{ marginTop:8, display:"grid", gap:9 }}>
              <ScoreBar label="Harm reduction"          v={derived.harm}           max={40} />
              <ScoreBar label="Diversification"         v={derived.diversification} max={20} />
              <ScoreBar label="Long-term returns"       v={derived.returns}        max={20} />
              <ScoreBar label="Charitable redistribution" v={derived.redistribution} max={20} />
            </div>
          </Card>

          <Card>
            <Row icon={HeartHandshake} label="Auto-tithe engine" />
            <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginTop:8 }}>
              <span style={{ fontFamily:sans, fontSize:28, fontWeight:700, color:C.amber, letterSpacing:"-0.03em" }}>{pct}%</span>
              <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>of {OFFSET_BASIS[basis].label.toLowerCase()}</span>
            </div>
            <p style={{ fontFamily:sans, fontSize:13.5, color:C.ink, margin:"6px 0 0" }}>
              ≈ <b style={{ color:C.amber }}>{fmt(derived.annualDonation)}/yr</b> given away automatically.
            </p>
            <button onClick={() => setTab("impact")} style={{ ...textLink, marginTop:10 }}>Adjust and see causes <ChevronRight size={14} /></button>
          </Card>
          <div style={{ height:14 }} />
        </div>
      </div>
    );
  }

  function renderPortfolio() {
    const kpis = [
      { label:"Portfolio value", value: live ? live.display.portfolioValue : fmt(14820) },
      { label:"Invested",        value: live ? live.display.invested : fmt(12100) },
      { label:"Market similarity", value: `${derived.similarity}%` },
      { label:"Given away",      value: live ? live.display.donated : fmt(240), accent:C.amber },
    ];
    return (
      <div>
        <Header title="Holdings" sub={`${fw.name} · ${SCREENS[screen].label} screen`} />
        <div style={{ padding:"0 18px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {kpis.map(k => <KpiTile key={k.label} {...k} />)}
          </div>

          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12, borderBottom:`1px solid ${C.divider}` }}>
              <span style={{ fontFamily:sans, fontSize:14, fontWeight:700, color:C.ink }}>Funds</span>
              <span style={{ fontFamily:sans, fontSize:11, color:C.muted, fontWeight:600, letterSpacing:"0.04em" }}>Target · Value · Return</span>
            </div>
            <div>
              {fw.holdings.map((h,i) => {
                const liveH = live && live.holdings ? live.holdings.find(x => x.symbol === h.t) : null;
                return (
                  <div key={h.t} style={{ display:"grid", gridTemplateColumns:"1fr 46px 66px 36px", gap:10, alignItems:"center", padding:"12px 0", borderBottom:i<fw.holdings.length-1?`1px solid ${C.divider}`:"none" }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontFamily:sans, fontWeight:700, fontSize:13.5, color:C.ink }}>{h.t}</div>
                      <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.n}</div>
                    </div>
                    <div style={{ fontFamily:sans, fontSize:13, fontWeight:600, color:C.muted, textAlign:"right" }}>{h.a}%</div>
                    <div style={{ fontFamily:sans, fontSize:13, fontWeight:700, color:C.ink, textAlign:"right" }}>{liveH ? liveH.investedDisplay : fmt(0)}</div>
                    <div style={{ fontFamily:sans, fontSize:13, fontWeight:600, color:C.faint, textAlign:"right" }}>—</div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontFamily:sans, fontSize:11, color:C.faint, lineHeight:1.5, margin:"10px 0 0" }}>Per-fund returns aren't tracked in the sandbox yet. Target and value are real.</p>
          </Card>

          <Card>
            <Row icon={Shield} label="Screen strictness" />
            <Segmented options={Object.entries(SCREENS).map(([k,v]) => ({ k, label:v.label }))} value={screen} onChange={setScreen} />
            <Meter label="Direct exposure removed" value={derived.reduction} color={C.teal} style={{ marginTop:14 }} />
          </Card>

          <Card>
            <Row icon={Scale} label="Exposure" right={<InfoTag>estimate</InfoTag>} />
            <div style={{ marginTop:14 }}>
              <ExposureGrid residue={derived.residual} screenedLabel="removed by your screen" residueLabel="the residue" />
            </div>
            <p style={{ fontFamily:sans, fontSize:11.5, color:C.faint, lineHeight:1.5, margin:"12px 0 0" }}>Estimates modelled from published screens, not audited holdings.</p>
          </Card>

          <Card>
            <Row icon={Sliders} label="Switch framework" />
            <div style={{ marginTop:12, display:"grid", gap:14 }}>
              {FW_GROUPS.map(grp => (
                <div key={grp.label}>
                  <div style={{ fontFamily:sans, fontSize:10.5, letterSpacing:"0.13em", textTransform:"uppercase", color:C.muted, fontWeight:700, marginBottom:7 }}>{grp.label}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                    {grp.keys.map(k => {
                      const on = frameworks.includes(k);
                      return <button key={k} onClick={() => toggleFramework(k)} style={{ ...chipBtn, borderColor:on?C.teal:C.line, background:on?C.teal:"transparent", color:on?"#fff":C.ink }}>{FRAMEWORKS[k].name}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div style={{ height:14 }} />
        </div>
      </div>
    );
  }

  function renderImpact() {
    const annualDonation = live ? live.annualDonationCents / 100 : derived.annualDonation;
    const split = annualDonation / CAUSES.length;
    const givenToDate = live ? live.donatedCents / 100 : 0;
    const mons = lastMonths(6);
    const givingSeries = mons.map((m, i) => ({ m, v: (givenToDate || annualDonation / 12) * ((i + 1) / 6) }));
    return (
      <div>
        <Header title="Giving" sub="The residue, redirected" />
        <div style={{ padding:"0 18px" }}>
          <div style={{ background:C.pine, borderRadius:18, padding:"20px 22px", color:"#EAF2F0" }}>
            <span style={{ fontFamily:sans, fontSize:12.5, fontWeight:600, color:"#8FB5AC" }}>Given to date</span>
            <div style={{ marginTop:4 }}>
              {live
                ? <AnimatedMoney cents={live.donatedCents} style={{ fontFamily:sans, fontSize:38, fontWeight:700, letterSpacing:"-0.035em", color:C.amberDark }} />
                : <span style={{ fontFamily:sans, fontSize:38, fontWeight:700, letterSpacing:"-0.035em", color:C.amberDark }}>{fmt(0)}</span>}
            </div>
            <div style={{ fontFamily:sans, fontSize:13, color:"#8FB5AC", marginTop:2 }}>held back from your sweeps and given away</div>
            <div style={{ marginTop:16 }}>
              <ExposureGrid cols={25} dark residue={derived.residual} screenedLabel="invested" residueLabel="given away" />
            </div>
          </div>

          <Card>
            <Row icon={HeartHandshake} label="Stewardship rate" right={
              <InfoDot on={showResidueInfo} onClick={() => setShowResidueInfo(v => !v)} label="What does the stewardship rate do?" accent={C.amber} />
            } />
            {showResidueInfo && (
              <div style={{ marginTop:12, padding:"10px 12px", background:C.amber+"15", borderRadius:10, fontFamily:sans, fontSize:12.5, color:C.ink, lineHeight:1.55 }}>
                <b style={{ color:C.amber }}>The residue</b> is the harm no screen can fully catch, even a strict fund still touches something you wouldn't choose. The stewardship rate is the slice of every $5 sweep held back and given away instead of invested. At {pct}%, that's {fmt2((pct/100)*5)} given and {fmt2(5-(pct/100)*5)} invested per sweep, automatically.
              </div>
            )}
            <input type="range" min={0} max={10} step={0.5} value={pct} onChange={e => setPct(+e.target.value)} style={{ width:"100%", accentColor:C.teal, marginTop:14 }} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 }}>
              <span style={{ fontFamily:sans, fontSize:30, color:C.amber, fontWeight:700, letterSpacing:"-0.03em" }}>{pct}%</span>
              <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>≈ {fmt(annualDonation)}/yr given away</span>
            </div>
            <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted, fontWeight:600, margin:"14px 0 7px" }}>Applied to</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.entries(OFFSET_BASIS).map(([k,v]) => (
                <button key={k} onClick={() => setBasis(k)} style={{ ...chipBtn, fontSize:11.5, borderColor:basis===k?C.teal:C.line, background:basis===k?C.teal:"transparent", color:basis===k?"#fff":C.ink }}>{v.label}</button>
              ))}
            </div>
          </Card>

          <Card>
            <Row icon={Coins} label="Cause split" />
            <div style={{ marginTop:10, display:"grid", gap:10 }}>
              {CAUSES.map(c => {
                const Icon = c.icon;
                return (
                  <div key={c.name} style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:c.c+"22", display:"grid", placeItems:"center", flexShrink:0 }}>
                      <Icon size={17} color={c.c} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:sans, fontSize:13.5, fontWeight:600, color:C.ink }}>{c.name}</div>
                      <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted }}>{c.ex}</div>
                    </div>
                    <span style={{ fontFamily:sans, fontSize:13, fontWeight:700, color:C.amber, letterSpacing:"-0.02em" }}>{fmt(split)}</span>
                  </div>
                );
              })}
              {derived.hasFaith && (
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:C.teal+"22", display:"grid", placeItems:"center", flexShrink:0 }}>
                    <Landmark size={17} color={C.teal} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:sans, fontSize:13.5, fontWeight:600, color:C.ink }}>Faith community</div>
                    <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted }}>Your congregation or mission</div>
                  </div>
                  <span style={{ fontFamily:sans, fontSize:12, color:C.muted }}>optional</span>
                </div>
              )}
            </div>
            {live && (
              <p style={{ fontFamily:sans, fontSize:11.5, color:C.faint, lineHeight:1.5, margin:"12px 0 0" }}>
                {live.charity
                  ? <>{"$" + ((live.donationRoutedCents ?? 0) / 100).toFixed(2)} journaled to the giving account <b>{live.charity}</b>{(live.donationPendingCents ?? 0) > 0 ? `, $${(live.donationPendingCents / 100).toFixed(2)} on its way` : ""}.</>
                  : "Your residue is accumulating. Once your brokerage account is active it's transferred to a dedicated giving account."}
              </p>
            )}
          </Card>

          <Card>
            <Row icon={TrendingUp} label="Giving over time" right={<InfoTag>illustrative</InfoTag>} />
            <MiniBars data={givingSeries} />
          </Card>
          <div style={{ height:14 }} />
        </div>
      </div>
    );
  }

  function renderReport() {
    const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const closing  = live ? live.portfolioValueCents / 100 : 14820;
    const invested = live ? live.investedCents / 100 : 12100;
    const given    = live ? (live.donatedCents ?? 0) / 100 : 240;
    const change   = +(closing - invested).toFixed(2); // portion not explained by contributions (illustrative)
    const recon = [
      ["Opening value",           fmt2(0),                                      C.ink,  false],
      ["Invested via round-ups",  "+" + fmt2(invested),                         C.teal, false],
      ["Market change",           (change >= 0 ? "+" : "−") + fmt2(Math.abs(change)), change >= 0 ? C.teal : C.err, false],
      ["Given away",              "−" + fmt2(given),                            C.amber, false],
      ["Closing value",           fmt2(closing),                                C.ink,  true],
    ];
    return (
      <div>
        <Header title="Statement" sub={`${month} · monthly report`} />
        <div style={{ padding:"0 18px" }}>
          <div style={{ background:C.pine, borderRadius:18, padding:"20px 22px", color:"#EAF2F0" }}>
            <span style={{ fontFamily:sans, fontSize:12.5, fontWeight:600, color:"#8FB5AC" }}>Closing value</span>
            <div style={{ fontFamily:sans, fontSize:38, fontWeight:700, marginTop:4, letterSpacing:"-0.035em" }}>{fmt2(closing)}</div>
            <div style={{ fontFamily:sans, fontSize:13, color:C.mint, marginTop:2 }}>a fuller account than "you made 8.2%"</div>
          </div>

          <Card>
            <Row icon={Receipt} label="Opening to closing" />
            <div style={{ marginTop:6 }}>
              {recon.map(([k,v,col,strong],i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderTop:strong?`1px solid ${C.line}`:"none", borderBottom:(i<recon.length-1&&!strong)?`1px solid ${C.divider}`:"none" }}>
                  <span style={{ fontFamily:sans, fontSize:13.5, color:strong?C.ink:C.muted, fontWeight:strong?700:400 }}>{k}</span>
                  <span style={{ fontFamily:sans, fontSize:strong?17:14, fontWeight:700, color:col, letterSpacing:"-0.02em" }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:14 }}>
            <TriTile label="Wealth" value={fmt2(closing)} sub="portfolio" />
            <TriTile label="Impact" value={`${derived.reduction}%`} sub="harm removed" />
            <TriTile label="Restoration" value={fmt2(given)} accent={C.amber} sub="given away" />
          </div>

          <Card>
            <Row icon={Receipt} label="Past statements" />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0 0" }}>
              <span style={{ fontFamily:sans, fontSize:13.5, color:C.ink, fontWeight:600 }}>{month}</span>
              <span style={chip}>current</span>
            </div>
            <p style={{ fontFamily:sans, fontSize:11.5, color:C.faint, margin:"10px 0 0", lineHeight:1.5 }}>Prior months appear here as they close.</p>
          </Card>

          {activity.length > 0 && (
            <Card>
              <Row icon={Shield} label="Account activity" right={<InfoTag>audit trail</InfoTag>} />
              <div style={{ marginTop:10, display:"grid", gap:2 }}>
                {activity.slice(0, 6).map((e, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"8px 0", borderBottom:i<Math.min(6,activity.length)-1?`1px solid ${C.divider}`:"none" }}>
                    <span style={{ fontFamily:sans, fontSize:13, color:C.ink }}>{AUDIT_LABEL[e.event] || e.event.replace(/_/g," ")}</span>
                    <span style={{ fontFamily:sans, fontSize:11.5, color:C.faint }}>{new Date(e.ts).toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <p style={{ fontFamily:sans, fontSize:14, fontWeight:500, color:C.ink, lineHeight:1.6, margin:0 }}>
              Stewardship: minimize foreseeable harm, preserve practical effectiveness, and direct the unavoidable residue toward the common good.
            </p>
          </Card>

          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button onClick={shareStatement} style={{ flex:1, padding:"14px 16px", background:C.teal, color:"#fff", border:"none", borderRadius:11, cursor:"pointer", fontFamily:sans, fontSize:13.5, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <HeartHandshake size={16} /> Share this month
            </button>
            <button onClick={printStatement} style={{ flex:1, padding:"14px 16px", background:"transparent", color:C.teal, border:`1px solid ${C.teal}`, borderRadius:11, cursor:"pointer", fontFamily:sans, fontSize:13.5, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Receipt size={16} /> Save PDF
            </button>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, padding:"0 4px" }}>
            <span style={{ fontFamily:sans, fontSize:12, color:C.muted }}>{user?.email}</span>
            <button onClick={logout} style={{ ...textLink, color:C.err }}>Sign out</button>
          </div>
          <div style={{ height:14 }} />
        </div>
      </div>
    );
  }
}

/* ── SHARED COMPONENTS ── */

function ProfileInput({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label style={{ display:"block" }}>
      <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted, marginBottom:4 }}>{label}</div>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width:"100%", fontFamily:sans, fontSize:14, color:C.ink, background:C.card, border:`1px solid ${C.line}`, borderRadius:10, padding:"11px 12px", outline:"none" }} />
    </label>
  );
}

function AuthScreen({ signup, login, onBack }) {
  // If the page was opened from a password-reset link (/?reset=TOKEN), start there.
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  const [mode, setMode] = useState(resetToken ? "reset" : "signup"); // signup | login | forgot | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devLink, setDevLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    if (mode === "forgot") {
      const r = await fetch("/api/reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }).then(r => r.json()).catch(() => ({}));
      setNotice(r.message || "If that address has an account, a reset link has been issued.");
      setDevLink(r.devLink || null);
      setBusy(false);
      return;
    }
    if (mode === "reset") {
      const r = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password }) }).then(r => r.json()).catch(() => ({}));
      if (r.ok) {
        window.history.replaceState({}, "", "/"); // burn the token from the URL
        setMode("login"); setPassword(""); setNotice(r.message);
      } else setError(r.error || "Something went wrong.");
      setBusy(false);
      return;
    }
    const { ok, error } = await (mode === "signup" ? signup : login)(email.trim(), password);
    if (!ok) { setError(error || "Something went wrong."); setBusy(false); }
    // on success the auth state updates and the app re-routes automatically
  };
  return (
    <Frame>
      <FontInjector />
      <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, padding:"26px 26px 30px" }}>
        <button onClick={onBack} style={{ ...iconBtn, alignSelf:"flex-start" }}><ChevronLeft size={18} color={C.pine} /></button>
        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Mark size={24} color={C.teal} />
            <span style={{ fontFamily:sans, fontSize:19, fontWeight:700, color:C.ink, letterSpacing:"-0.02em" }}>Steward</span>
          </div>
          <h1 style={{ fontFamily:sans, fontSize:26, fontWeight:700, color:C.ink, margin:0, letterSpacing:"-0.03em" }}>
            {mode === "signup" ? "Create your account" : mode === "login" ? "Welcome back"
              : mode === "forgot" ? "Reset your password" : "Choose a new password"}
          </h1>
          <div style={{ display:"grid", gap:10, marginTop:4 }}>
            {mode !== "reset" && <ProfileInput label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />}
            {mode !== "forgot" && <ProfileInput label={mode === "reset" ? "New password" : "Password"} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />}
          </div>
          {error && <div style={{ fontFamily:sans, fontSize:12.5, color:"#B0563F", background:"#B0563F14", padding:"9px 12px", borderRadius:10 }}>{error}</div>}
          {notice && <div style={{ fontFamily:sans, fontSize:12.5, color:C.pine, background:C.pine + "10", padding:"9px 12px", borderRadius:10 }}>{notice}</div>}
          {devLink && (
            <a href={devLink} style={{ fontFamily:sans, fontSize:12.5, color:C.brass, textDecoration:"underline" }}>
              Open the reset link (shown here because this demo has no email provider)
            </a>
          )}
          <Btn onClick={submit}>{busy ? "…" : mode === "signup" ? "Create account" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Set new password"} <ChevronRight size={17} /></Btn>
          {(mode === "signup" || mode === "login") && (
            <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setNotice(""); }}
              style={{ ...textLink, justifyContent:"center", alignSelf:"center" }}>
              {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
          )}
          {mode === "login" && (
            <button onClick={() => { setMode("forgot"); setError(""); setNotice(""); }} style={{ ...textLink, justifyContent:"center", alignSelf:"center" }}>
              Forgot your password?
            </button>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <button onClick={() => { setMode("login"); setError(""); setNotice(""); setDevLink(null); }} style={{ ...textLink, justifyContent:"center", alignSelf:"center" }}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </Frame>
  );
}

// The app is a real, full-viewport responsive website — not a phone mockup. On a
// phone it fills the screen; on desktop the content sits in a comfortable centered
// column (the layout is a single column by design) against the app background.
// Steward's mark — a hand-drawn balance, not an icon-library glyph. A beam that
// tips toward whichever pan holds more weight; here it rests level.
// The Steward mark: a rounded teal square framing a centered outlined square.
// `color` is the container fill; `counter` is the inner stroke. On a deep-green
// surface pass color={C.mint} counter={C.pine}. Below 16px it drops to a solid
// square, per the spec.
function Mark({ size = 22, color = C.teal, counter = "#FFFFFF" }) {
  const r = size * 0.34;
  if (size < 16) return <span style={{ display: "block", width: size, height: size, borderRadius: r, background: color }} aria-hidden="true" />;
  const inner = size * 0.38, off = (size - inner) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: "block" }}>
      <rect width={size} height={size} rx={r} fill={color} />
      <rect x={off} y={off} width={inner} height={inner} rx={size * 0.125} fill="none" stroke={counter} strokeWidth={size * 0.0625} />
    </svg>
  );
}

// A Star of David — lucide-react has no hexagram, so this is a small outline icon
// built to match the lucide API (size/color/strokeWidth) used everywhere else icons
// are rendered. Two overlapping triangles, stroke only, no fill.
function StarOfDavid({ size = 24, color = "currentColor", strokeWidth = 1.8 }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <path d="M12 4 L18.93 16 L5.07 16 Z" {...p} />
      <path d="M12 20 L5.07 8 L18.93 8 Z" {...p} />
    </svg>
  );
}

// Money in motion: eases a cent value from its previous number to the next so a
// round-up visibly *lands* instead of snapping. Motion that explains the model.
function money(cents) { return "$" + (cents / 100).toFixed(2); }
function AnimatedMoney({ cents = 0, style }) {
  const [shown, setShown] = useState(cents);
  const from = useRef(cents);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = cents, dur = 700;
    if (a === b) return;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (b - a) * eased));
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cents]);
  return <span style={style}>{money(shown)}</span>;
}

// The model, in motion. Three stops — Spend → Clearing → Invested — with giving
// branching below. When a round-up lands a coin travels Spend→Clearing; when the
// clearing balance sweeps, a coin runs Clearing→Invested and a smaller one peels
// off to Give. Motion that shows how the money moves, not decoration.
function FlowStrip({ live }) {
  const [pulse, setPulse] = useState(null); // { seq, type }
  const prev = useRef(null);
  const seq = useRef(0);
  useEffect(() => {
    if (!live) return;
    const p = prev.current;
    if (p) {
      if (live.investedCents > p.investedCents) setPulse({ seq: ++seq.current, type: "sweep" });
      else if (live.clearingBalanceCents !== p.clearingBalanceCents || live.roundupsThisMonthCents !== p.roundupsThisMonthCents)
        setPulse({ seq: ++seq.current, type: "purchase" });
    }
    prev.current = live;
  }, [live]);

  const Node = ({ icon: Icon, label, value, popKey }) => (
    <div style={{ textAlign: "center", width: 92, position: "relative", zIndex: 1 }}>
      <div key={popKey} style={{ width: 40, height: 40, borderRadius: "50%", background: C.pine, display: "grid", placeItems: "center", margin: "0 auto", animation: popKey ? "nodePop .5s ease" : "none" }}>
        <Icon size={18} color={C.brassSoft} strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: sans, fontSize: 11.5, fontWeight: 700, color: C.ink, marginTop: 7 }}>{label}</div>
      <div style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{value}</div>
    </div>
  );
  const p = pulse;
  const coinAnim = p ? (p.type === "sweep" ? "flowToInvested .9s cubic-bezier(.5,0,.5,1) forwards" : "flowToClearing .9s cubic-bezier(.4,0,.4,1) forwards") : null;

  return (
    <Card>
      <Row icon={TrendingUp} label="How the money moves" />
      <div style={{ position: "relative", height: 128, marginTop: 14 }}>
        {/* track */}
        <div style={{ position: "absolute", top: 20, left: "13%", right: "13%", height: 2, background: C.line }} />
        {/* connector down to giving */}
        <div style={{ position: "absolute", left: "47%", top: 40, width: 2, height: 46, background: C.line }} />
        {/* nodes */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Node icon={Wallet} label="Spend" value="a purchase" popKey={p ? `s${p.seq}` : null} />
          <Node icon={PiggyBank} label="Clearing" value={live ? live.display.clearing : "$0.00"} popKey={p ? `c${p.seq}` : null} />
          <Node icon={TrendingUp} label="Invested" value={live ? live.display.invested : "$0.00"} popKey={p && p.type === "sweep" ? `i${p.seq}` : null} />
        </div>
        {/* give branch */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 92, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <HeartHandshake size={13} color={C.brass} />
          <span style={{ fontFamily: sans, fontSize: 11.5, color: C.muted }}>Give · {live ? live.display.donated : "$0.00"}</span>
        </div>
        {/* traveling coin(s) */}
        {p && (
          <span key={`coin${p.seq}`} style={{ position: "absolute", top: 14, width: 14, height: 14, borderRadius: "50%", background: C.brass, boxShadow: `0 0 0 3px ${C.brass}22`, animation: coinAnim }} />
        )}
        {p && p.type === "sweep" && (
          <span key={`give${p.seq}`} style={{ position: "absolute", left: "47%", top: 20, width: 10, height: 10, borderRadius: "50%", background: C.brassSoft, animation: "flowToGive .9s ease forwards" }} />
        )}
      </div>
    </Card>
  );
}

// Waitlist — real money is gated behind compliance, so capture demand honestly.
function WaitlistForm({ dark = false }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [msg, setMsg] = useState("");
  const submit = async () => {
    if (state === "loading" || !email) return;
    setState("loading");
    try {
      const r = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setState("done"); track("waitlist_join"); }
      else { setState("error"); setMsg(d.error || "Something went wrong."); }
    } catch { setState("error"); setMsg("Network error. Try again."); }
  };
  if (state === "done")
    return <p style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: dark ? C.brassSoft : C.pine, textAlign: "center", margin: 0 }}>You're on the list. We'll write the day we open.</p>;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 440, margin: "0 auto" }}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" aria-label="Email for the waitlist"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ flex: "1 1 220px", fontFamily: sans, fontSize: 15, padding: "13px 14px", borderRadius: 12, border: `1px solid ${dark ? "#3a5346" : C.line}`, background: dark ? "rgba(255,255,255,0.06)" : C.card, color: dark ? "#F3EEE2" : C.ink, outline: "none" }} />
      <button onClick={submit} style={{ background: C.teal, color: "#fff", border: "none", borderRadius: 11, padding: "13px 22px", fontFamily: sans, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{state === "loading" ? "…" : "Join the waitlist"}</button>
      {state === "error" && <div style={{ flexBasis: "100%", textAlign: "center", fontFamily: sans, fontSize: 12.5, color: "#E0A090" }}>{msg}</div>}
    </div>
  );
}

// The logged-out marketing site. Three tabs, each with its own URL you can deep-link
// and refresh on: / (home), /how-it-works, /trust. A shared top nav switches between
// them without a full page reload.
function MarketingNav({ route, navigate }) {
  const tabs = [
    { path: "/", label: "Home" },
    { path: "/how-it-works", label: "How it works" },
    { path: "/trust", label: "What's real" },
  ];
  const go = (p) => (e) => { if (e) e.preventDefault(); navigate(p); };
  const link = (on) => ({ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: 14, fontWeight: 600, color: on ? C.pine : C.muted, textDecoration: "none", paddingBottom: 3, borderBottom: on ? `2px solid ${C.brass}` : "2px solid transparent" });
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 20, background: "#F7F5F1f2", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <a href="/" onClick={go("/")} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Mark size={24} color={C.brass} />
          <span style={{ fontFamily: sans, fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Steward</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <a key={t.path} href={t.path} onClick={go(t.path)} style={link(route === t.path)}>{t.label}</a>
          ))}
          <a href="/signin" onClick={go("/signin")} style={{ background: C.teal, color: "#fff", textDecoration: "none", borderRadius: 9, padding: "9px 18px", fontFamily: sans, fontSize: 14, fontWeight: 700 }}>Open your account</a>
        </div>
      </div>
    </nav>
  );
}

function MarketingFooter({ navigate }) {
  const go = (p) => (e) => { if (e) e.preventDefault(); navigate(p); };
  const foot = { fontFamily: sans, fontSize: 12.5, color: C.muted, textDecoration: "none" };
  return (
    <footer style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Mark size={18} color={C.muted} /><span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.muted }}>Steward</span></div>
      <div style={{ display: "flex", gap: 20 }}>
        <a href="/how-it-works" onClick={go("/how-it-works")} style={foot}>How it works</a>
        <a href="/trust" onClick={go("/trust")} style={foot}>What's real</a>
      </div>
    </footer>
  );
}

// A reusable brass CTA button that jumps to sign-up.
function OpenAccountButton({ navigate, label = "Open your account" }) {
  return (
    <button onClick={() => { track("cta_click"); navigate("/signin"); }} style={{ background: C.teal, color: "#fff", border: "none", borderRadius: 11, padding: "15px 28px", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>{label} <ChevronRight size={18} /></button>
  );
}

// Home: just the green front door and one clear action.
function MarketingHome({ navigate }) {
  const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
  useEffect(() => { track("landing_view"); }, []);
  return (
    <header style={{ background: `radial-gradient(120% 90% at 50% -10%, ${C.pineSoft} 0%, ${C.pine} 55%, #14271F 100%)`, color: "#F3EEE2", position: "relative", overflow: "hidden", minHeight: "calc(100dvh - 62px)", display: "flex", alignItems: "center" }}>
      <Grain />
      <div style={{ ...wrap, position: "relative", zIndex: 1, textAlign: "center", padding: "clamp(56px,10vw,110px) 24px", width: "100%" }}>
        <p style={{ fontFamily: sans, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: C.brassSoft, marginBottom: 22 }}>A stewardship layer for your money</p>
        <h1 style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(40px,7vw,72px)", lineHeight: 1.02, margin: 0, letterSpacing: "-0.045em" }}>Money is <span style={{ color: C.brassSoft }}>stored agency.</span></h1>
        <p style={{ fontFamily: sans, fontSize: "clamp(16px,2vw,19px)", lineHeight: 1.55, color: "#D9D2C2", margin: "24px auto 0", maxWidth: 520 }}>Round up your spare change and invest it to reduce foreseeable harm.</p>
        <div style={{ marginTop: 36, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <OpenAccountButton navigate={navigate} />
          <button onClick={() => navigate("/how-it-works")} style={{ background: "rgba(255,255,255,0.08)", color: "#F3EEE2", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 14, padding: "15px 26px", fontFamily: sans, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>See how it works</button>
        </div>
        <p style={{ fontFamily: sans, fontSize: 12.5, color: "#9FB3A4", marginTop: 18 }}>No claim of moral purity. Ethical investing is asymptotic.</p>
      </div>
    </header>
  );
}

// How it works: the three steps, the framework marketplace, and the honest statement.
function MarketingHowItWorks({ navigate }) {
  const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
  const Step = ({ icon: Icon, n, body }) => (
    <div style={{ flex: "1 1 260px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "26px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: C.pine, display: "grid", placeItems: "center" }}><Icon size={20} color={C.brassSoft} strokeWidth={1.7} /></div>
        <span style={{ fontFamily: sans, fontSize: 20, letterSpacing: "0.04em", textTransform: "uppercase", color: C.brass, fontWeight: 700 }}>{n}</span>
      </div>
      <p style={{ fontFamily: sans, fontSize: 14.5, lineHeight: 1.55, color: C.muted, margin: "14px 0 0" }}>{body}</p>
    </div>
  );
  return (
    <div>
      <section style={{ ...wrap, padding: "clamp(44px,7vw,76px) 24px 0", textAlign: "center" }}>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(30px,5vw,44px)", fontWeight: 700, color: C.ink, margin: "0 0 10px", letterSpacing: "-0.03em" }}>How it works</h1>
        <p style={{ fontFamily: sans, fontSize: 17, color: C.muted, maxWidth: 540, margin: "0 auto", lineHeight: 1.5 }}>three steps that run in the background while you spend as usual.</p>
      </section>

      <section style={{ ...wrap, padding: "clamp(30px,5vw,52px) 24px" }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Step icon={Coins} n="01 · Round up" body="Every purchase rounds up to the nearest dollar. A $3.60 coffee sets aside 40¢, invisible to you but meaningful in aggregate." />
          <Step icon={Scale} n="02 · Invest by your values" body="Choose a moral framework, from broad ESG to Christian, Jewish, or Islamic screens. Your round-ups buy the ETFs that fit it." />
          <Step icon={HeartHandshake} n="03 · Give what's left" body="No investment is perfectly clean. A set share of every $5 sweep goes to a cause you choose, so the part you can't screen out still does some good." />
        </div>
      </section>

      <section style={{ background: C.card, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...wrap, padding: "clamp(48px,7vw,80px) 24px" }}>
          <p style={{ fontFamily: sans, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.brass, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>Invest by what you believe</p>
          <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,4vw,38px)", fontWeight: 700, color: C.ink, textAlign: "center", margin: "0 0 40px", letterSpacing: "-0.03em" }}>A marketplace of moral frameworks.</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {Object.values(FRAMEWORKS).map((f) => { const Icon = f.icon; return (
              <div key={f.name} style={{ flex: "1 1 240px", maxWidth: 340, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px", display: "flex", gap: 13, alignItems: "flex-start" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: C.pine, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={18} color={C.brassSoft} strokeWidth={1.7} /></div>
                <div><div style={{ fontFamily: serif, fontSize: 16.5, fontWeight: 500, color: C.ink }}>{f.name}</div><div style={{ fontFamily: sans, fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{f.blurb}</div></div>
              </div>
            ); })}
          </div>
        </div>
      </section>

      <section style={{ ...wrap, padding: "clamp(56px,8vw,96px) 24px", textAlign: "center", maxWidth: 760 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><Mark size={30} color={C.brass} /></div>
        <blockquote style={{ fontFamily: sans, fontSize: "clamp(19px,2.6vw,26px)", lineHeight: 1.5, fontWeight: 500, color: C.pine, margin: 0, letterSpacing: "-0.005em" }}>
          Minimize foreseeable harm, preserve practical effectiveness, and direct the unavoidable residue toward the common good.
        </blockquote>
        <p style={{ fontFamily: sans, fontSize: 15.5, color: C.muted, marginTop: 22, lineHeight: 1.6 }}>Your monthly statement shows more than a return. It puts three numbers side by side: what you kept, what you invested, and what you gave.</p>
      </section>

      <section style={{ background: C.pine, color: "#F3EEE2", position: "relative", overflow: "hidden" }}>
        <Grain />
        <div style={{ ...wrap, position: "relative", zIndex: 1, textAlign: "center", padding: "clamp(56px,8vw,88px) 24px" }}>
          <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,4.5vw,40px)", fontWeight: 700, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Begin stewarding.</h2>
          <OpenAccountButton navigate={navigate} />
          <p style={{ fontFamily: sans, fontSize: 12.5, color: "#9FB3A4", marginTop: 18 }}>Free to try. No money leaves your pocket.</p>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 40, paddingTop: 34 }}>
            <p style={{ fontFamily: sans, fontSize: 15, color: "#D9D2C2", margin: "0 auto 16px", maxWidth: 460, lineHeight: 1.55 }}>
              We're not open for deposits yet. Leave your email and we'll write the day we are.
            </p>
            <WaitlistForm dark />
          </div>
        </div>
      </section>
    </div>
  );
}

// What's real: the honest account of what's built, what's simulated, and why real
// money is gated.
function MarketingTrust({ navigate }) {
  const wrap = { maxWidth: 820, margin: "0 auto", padding: "0 24px" };
  const Block = ({ title, children }) => (
    <section style={{ ...wrap, padding: "18px 24px 6px" }}>
      <h2 style={{ fontFamily: serif, fontSize: "clamp(20px,3.4vw,26px)", fontWeight: 700, color: C.ink, margin: "0 0 12px", letterSpacing: "-0.01em" }}>{title}</h2>
      {children}
    </section>
  );
  const Item = ({ good, k, v }) => (
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ width: 20, flexShrink: 0, color: good ? C.good : C.warn, fontWeight: 700, fontFamily: sans }}>{good ? "✓" : "◐"}</div>
      <div>
        <div style={{ fontFamily: sans, fontSize: 14.5, fontWeight: 600, color: C.ink }}>{k}</div>
        <div style={{ fontFamily: sans, fontSize: 13.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{v}</div>
      </div>
    </div>
  );
  const p = { fontFamily: sans, fontSize: 15, lineHeight: 1.6, color: C.ink };
  return (
    <div style={{ paddingBottom: 40 }}>
      <header style={{ ...wrap, padding: "clamp(28px,6vw,56px) 24px 20px" }}>
        <p style={{ fontFamily: sans, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.brass, fontWeight: 700, marginBottom: 12 }}>What's real, what's simulated</p>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(28px,5vw,42px)", fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.08, letterSpacing: "-0.01em" }}>We'd rather tell you the limits than hide them.</h1>
        <p style={{ ...p, marginTop: 16, color: C.muted }}>The whole idea here is naming the residue instead of pretending it away. It would be strange to be dishonest about the product itself. So here's exactly what happens, what's real, and what isn't yet.</p>
      </header>

      <Block title="How it works">
        <p style={{ ...p, margin: 0 }}>You spend as you always do. Each purchase rounds up to the next dollar and the spare change collects in a clearing balance. When it reaches $5 it's swept and split across the ETFs of the moral framework you chose, and a slice of every sweep is held back and redirected to giving. Your statement shows all three at once: what you kept, what you invested, and what you gave.</p>
      </Block>

      <Block title="What's real">
        <Item good k="Your account and login" v="Real email-and-password accounts with hashed passwords and sessions, stored in a real database that survives restarts." />
        <Item good k="A real brokerage account" v="Onboarding opens a genuine brokerage account in your name through Alpaca, the same system a live product runs on." />
        <Item good k="Real orders" v="Round-ups place real fractional ETF orders in that account, split by your framework's allocation. You can watch them land in Alpaca's dashboard." />
        <Item good k="The round-up math" v="Integer-cent accounting with no floating-point drift, covered by a passing test suite." />
        <Item good k="The redirected residue" v="The tithe is real money movement in the ledger, not a number on a screen. It accumulates as you use the app." />
      </Block>

      <Block title="What isn't real yet">
        <Item k="The money isn't yours yet" v="Your account is funded with practice money, so nothing leaves your pocket and nothing can be lost. Everything else behaves exactly as it will on the day we open." />
        <Item k="The ESG figures" v="The 'market similarity' and 'companies excluded' numbers are modelled estimates, labelled as such in the app, not sourced from live fund-holdings data yet." />
        <Item k="Speed" v="A brand-new account takes a minute or two to be approved and funded, so your very first order may not appear instantly." />
      </Block>

      <Block title="Why you can't put real money in yet">
        <p style={{ ...p, margin: "0 0 12px" }}>Choosing a portfolio on your behalf is, legally, advice, and giving advice about money is a regulated thing to do, for good reasons. We'd rather do that properly than quietly. So before we take a single real dollar, the structure gets reviewed by a securities lawyer.</p>
        <p style={{ ...p, margin: 0 }}>Opening a real account also means verifying who you are, which the law requires and we wouldn't skip anyway. That's the work standing between today and opening day, not a missing button.</p>
      </Block>

      <section style={{ ...wrap, padding: "34px 24px 10px", textAlign: "center" }}>
        <p style={{ ...p, color: C.muted, marginBottom: 18 }}>Try the whole thing now, free, or leave your email and we'll write the day we open.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 26 }}>
          <button onClick={() => { track("cta_click"); navigate("/signin"); }} style={{ background: C.teal, color: "#fff", border: "none", borderRadius: 11, padding: "14px 26px", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Open your account</button>
        </div>
        <WaitlistForm />
      </section>
    </div>
  );
}

// The marketing shell: shared nav + the page for the current route + footer.
function Marketing({ route, navigate }) {
  const page = route === "/how-it-works" ? <MarketingHowItWorks navigate={navigate} />
    : route === "/trust" ? <MarketingTrust navigate={navigate} />
    : <MarketingHome navigate={navigate} />;
  return (
    <div style={{ background: C.bg, minHeight: "100dvh", fontFamily: sans, color: C.ink }}>
      <FontInjector />
      <MarketingNav route={route} navigate={navigate} />
      {page}
      {route !== "/" && <MarketingFooter navigate={navigate} />}
    </div>
  );
}

function Frame({ children }) {
  const isDesktop = useIsDesktop();
  // Desktop: a centered card, so sign-in / onboarding read as a web page, not a
  // tall phone strip. Mobile: fill the viewport as a single column.
  if (isDesktop) {
    return (
      <div style={{ minHeight:"100dvh", width:"100%", display:"flex", justifyContent:"center", alignItems:"center", background:C.bg, fontFamily:sans, padding:"36px 20px" }}>
        <div style={{ width:"100%", maxWidth:480, maxHeight:"88vh", background:C.bg, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden", borderRadius:24, border:`1px solid ${C.line}`, boxShadow:"0 30px 80px -34px rgba(20,39,31,0.42)" }}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ minHeight:"100dvh", width:"100%", display:"flex", justifyContent:"center", background:C.bg, fontFamily:sans }}>
      <div style={{ width:"100%", maxWidth:520, height:"100dvh", background:C.bg, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden", boxShadow:"0 0 80px -40px rgba(20,39,31,0.25)" }}>
        {children}
      </div>
    </div>
  );
}
function FontInjector() {
  return <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap'); *::-webkit-scrollbar{width:0;height:0}
    :root{font-variant-numeric:tabular-nums}
    @keyframes stepIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
    @keyframes riseIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
    @keyframes flowToClearing { 0% { left:9%; opacity:0; transform:scale(.6) } 15% { opacity:1; transform:scale(1) } 100% { left:47%; opacity:1; transform:scale(1) } }
    @keyframes flowToInvested { 0% { left:47%; opacity:1 } 100% { left:85%; opacity:1 } }
    @keyframes flowToGive { 0% { left:47%; top:20px; opacity:1; transform:scale(.9) } 100% { left:47%; top:84px; opacity:0; transform:scale(.7) } }
    @keyframes nodePop { 0% { transform:scale(1) } 40% { transform:scale(1.14) } 100% { transform:scale(1) } }`}</style>;
}
function Grain() {
  return <div style={{ position:"absolute", inset:0, opacity:0.06, pointerEvents:"none", backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />;
}
function Header({ title, sub }) {
  return <div style={{ padding:"26px 22px 14px" }}><div style={{ fontFamily:sans, fontSize:12.5, color:C.muted, fontWeight:500 }}>{sub}</div><h1 style={{ fontFamily:sans, fontSize:22, fontWeight:700, color:C.ink, margin:"3px 0 0", letterSpacing:"-0.03em" }}>{title}</h1></div>;
}
function Card({ children }) {
  return <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:16, padding:20, marginTop:14 }}>{children}</div>;
}
function Row({ icon: Icon, label, right }) {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><div style={{ display:"flex", alignItems:"center", gap:9 }}><Icon size={16} color={C.teal} strokeWidth={1.9} /><span style={{ fontFamily:sans, fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, fontWeight:600 }}>{label}</span></div>{right}</div>;
}
function Meter({ label, value, color, caption, style }) {
  return <div style={{ marginTop:12, ...style }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}><span style={{ fontFamily:sans, fontSize:12.5, color:C.ink }}>{label}</span><span style={{ fontFamily:sans, fontSize:13, fontWeight:700, color }}>{value}%{caption&&<span style={{ fontWeight:400, color:C.muted, fontSize:11 }}> · {caption}</span>}</span></div><div style={{ height:7, background:C.line, borderRadius:6, marginTop:5, overflow:"hidden" }}><div style={{ width:`${value}%`, height:"100%", background:color, borderRadius:6, transition:"width .35s ease" }} /></div></div>;
}
function ScoreBar({ label, v, max }) {
  return <div><div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontFamily:sans, fontSize:12.5, color:C.ink }}>{label}</span><span style={{ fontFamily:sans, fontSize:12.5, color:C.muted }}>{v}/{max}</span></div><div style={{ height:6, background:C.line, borderRadius:6, marginTop:4, overflow:"hidden" }}><div style={{ width:`${(v/max)*100}%`, height:"100%", background:C.teal, borderRadius:6, transition:"width .35s ease" }} /></div></div>;
}
// The signature graphic: 100 cells, the last `residue` of them amber (the part the
// screen can't reach, redirected to giving), the rest neutral. Always paired with a
// two-item numeric legend. Light and dark (deep-green surface) variants.
function ExposureGrid({ total = 100, residue = 12, cols = 20, dark = false, screenedLabel, residueLabel }) {
  const screened = total - residue;
  const neutral = dark ? "rgba(234,242,240,0.22)" : "#CFE3DE";
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:2 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ height:8, borderRadius:2, background: i >= screened ? C.amberChart : neutral }} />
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:9, fontFamily:sans, fontSize:12, fontWeight:600 }}>
        <span style={{ color: dark ? "rgba(234,242,240,0.72)" : C.muted }}>{screened} {screenedLabel ?? "screened"}</span>
        <span style={{ color: dark ? C.amberDark : C.amber }}>{residue} {residueLabel ?? "given away"}</span>
      </div>
    </div>
  );
}
function TabBar({ tab, setTab }) {
  const items = [
    { k:"home",      label:"Home",      icon:Scale        },
    { k:"portfolio", label:"Portfolio", icon:Wallet       },
    { k:"impact",    label:"Impact",    icon:HeartHandshake},
    { k:"report",    label:"Statement", icon:Receipt      },
  ];
  return <div style={{ display:"flex", borderTop:`1px solid ${C.line}`, background:C.card, paddingBottom:22, paddingTop:10 }}>{items.map(it => { const Icon=it.icon; const on=tab===it.k; return <button key={it.k} onClick={() => setTab(it.k)} style={{ flex:1, background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"4px 0" }}><Icon size={20} color={on?C.teal:C.faint} strokeWidth={on?2.1:1.7} /><span style={{ fontFamily:sans, fontSize:10.5, fontWeight:on?700:600, color:on?C.teal:C.faint, letterSpacing:"0.02em" }}>{it.label}</span></button>; })}</div>;
}
function Btn({ children, onClick, dark }) {
  return <button onClick={onClick} style={{ width:"100%", padding:"14px 20px", borderRadius:11, border:dark?`1px solid ${C.line}`:"none", cursor:"pointer", background:dark?C.card:C.teal, color:dark?C.teal:"#fff", fontFamily:sans, fontSize:13.5, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>{children}</button>;
}
function SelectCard({ active, onClick, title, desc }) {
  return <button onClick={onClick} style={{ ...rowCard, borderWidth:1.5, borderColor:active?C.teal:C.line, background:active?C.tealTint:C.card }}><div style={{ textAlign:"left", flex:1 }}><div style={{ fontFamily:sans, fontSize:15, color:C.ink, fontWeight:700 }}>{title}</div><div style={{ fontFamily:sans, fontSize:12.5, color:C.muted, marginTop:1 }}>{desc}</div></div>{active&&<Check size={18} color={C.teal} />}</button>;
}
function Field({ label, value, editable, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState("");
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, border:`1px solid ${editing?C.teal:C.line}`, borderRadius:11, padding:"13px 15px", marginTop:10, transition:"border-color .2s" }}>
      <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>{label}</span>
      {editable && editing
        ? <input autoFocus value={raw} onChange={e => setRaw(e.target.value)} onBlur={() => { onEdit(raw); setEditing(false); }} onKeyDown={e => { if (e.key==="Enter") { onEdit(raw); setEditing(false); } }} style={{ fontFamily:sans, fontSize:13.5, fontWeight:700, color:C.ink, border:"none", outline:"none", background:"transparent", textAlign:"right", width:100 }} />
        : <span onClick={() => editable&&(setRaw(value.replace(/[^0-9]/g,"")),setEditing(true))} style={{ fontFamily:sans, fontSize:13.5, fontWeight:600, color:C.ink, cursor:editable?"text":"default", borderBottom:editable?`1px dashed ${C.muted}`:"none" }}>{value}</span>
      }
    </div>
  );
}
function Dots({ n, active }) {
  return <div style={{ display:"flex", gap:6, flex:1 }}>{Array.from({length:n}).map((_,i) => <div key={i} style={{ flex:1, height:4, borderRadius:4, background:i<=active?C.teal:C.line, transition:"background .3s" }} />)}</div>;
}
function Kicker({ children }) { return <div style={{ fontFamily:sans, fontSize:11.5, letterSpacing:"0.16em", textTransform:"uppercase", color:C.teal, fontWeight:700, marginTop:6 }}>{children}</div>; }
// A small "i" toggle that reveals an inline explanation. `on` colors it active;
// pass an accent (e.g. C.amber for residue-related copy) to match the topic.
function InfoDot({ on, onClick, label, accent = C.teal }) {
  return (
    <button onClick={onClick} aria-label={label} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"grid", placeItems:"center", flexShrink:0 }}>
      <Info size={14} color={on ? accent : C.muted} />
    </button>
  );
}
function H2({ children })     { return <h2 style={{ fontFamily:sans, fontSize:22, fontWeight:700, color:C.ink, margin:"8px 0 0", lineHeight:1.15, letterSpacing:"-0.03em" }}>{children}</h2>; }
function P({ children })      { return <p style={{ fontFamily:sans, fontSize:13.5, fontWeight:500, color:C.muted, lineHeight:1.6, margin:"8px 0 0" }}>{children}</p>; }
function InfoTag({ children }) { return <span style={{ fontFamily:sans, fontSize:10.5, letterSpacing:"0.08em", textTransform:"uppercase", color:C.muted, background:C.divider, padding:"3px 8px", borderRadius:20, fontWeight:700 }}>{children}</span>; }
function LiveStat({ label, value, accent }) { return <div style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:12, padding:"11px 13px" }}><div style={{ fontFamily:sans, fontSize:11, color:C.muted, fontWeight:500 }}>{label}</div><div style={{ fontFamily:sans, fontSize:20, fontWeight:700, color:accent ?? C.ink, marginTop:2, letterSpacing:"-0.03em" }}>{value}</div></div>; }
// KPI tile for the 4-up hero row (Holdings). Stat is a big tabular figure.
function KpiTile({ label, value, accent }) {
  return <div style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:12, padding:"12px 13px" }}><div style={{ fontFamily:sans, fontSize:11.5, color:C.muted, fontWeight:500 }}>{label}</div><div style={{ fontFamily:sans, fontSize:22, fontWeight:700, color:accent ?? C.ink, marginTop:3, letterSpacing:"-0.035em" }}>{value}</div></div>;
}
// The wealth / impact / restoration triptych on the statement.
function TriTile({ label, value, sub, accent }) {
  return <div style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:12, padding:"14px 8px", textAlign:"center" }}><div style={{ fontFamily:sans, fontSize:10.5, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div><div style={{ fontFamily:sans, fontSize:18, fontWeight:700, color:accent ?? C.ink, marginTop:5, letterSpacing:"-0.03em" }}>{value}</div>{sub && <div style={{ fontFamily:sans, fontSize:10.5, color:C.faint, marginTop:2 }}>{sub}</div>}</div>;
}
// Segmented control: track with an active teal pill.
function Segmented({ options, value, onChange }) {
  return <div style={{ display:"flex", background:"#F3F1EB", borderRadius:11, padding:3, gap:3, marginTop:10 }}>{options.map(o => { const on = value === o.k; return <button key={o.k} onClick={() => onChange(o.k)} style={{ flex:1, border:"none", cursor:"pointer", borderRadius:9, padding:"9px 6px", background:on?C.teal:"transparent", color:on?"#fff":C.muted, fontFamily:sans, fontSize:13, fontWeight:on?700:600 }}>{o.label}</button>; })}</div>;
}
// Giving-over-time: short amber bars with month labels.
function MiniBars({ data, color = C.amberChart }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:76, marginTop:8 }}>{data.map((d, i) => <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}><div style={{ width:"100%", height:Math.max(3, (d.v / max) * 54), background:color, borderRadius:3 }} /><span style={{ fontFamily:sans, fontSize:10, color:C.faint }}>{d.m}</span></div>)}</div>;
}

const rowCard  = { display:"flex", alignItems:"center", gap:13, width:"100%", padding:"14px 15px", borderRadius:12, border:`1px solid ${C.line}`, background:C.card, cursor:"pointer" };
const miniCard = { padding:"13px 12px", borderRadius:12, border:`1px solid ${C.line}`, background:C.card, cursor:"pointer", textAlign:"left" };
const chip     = { fontFamily:sans, fontSize:11, color:C.teal, background:C.tealTint, padding:"4px 9px", borderRadius:20, fontWeight:600 };
const chipBtn  = { fontFamily:sans, fontSize:12.5, fontWeight:600, padding:"9px 13px", borderRadius:20, border:`1px solid ${C.line}`, cursor:"pointer" };
const iconBtn  = { width:32, height:32, borderRadius:11, border:`1px solid ${C.line}`, background:C.card, display:"grid", placeItems:"center", cursor:"pointer" };
const textLink = { fontFamily:sans, fontSize:13, fontWeight:600, color:C.teal, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:3, padding:0 };
