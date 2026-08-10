import React, { useState, useMemo, useEffect, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import {
  Globe, Church, Star, Moon, Heart, Sliders, ChevronRight, ChevronLeft,
  Check, Shield, Coins, PiggyBank, Sparkles, TrendingUp, Scale,
  Wallet, Receipt, Info, Leaf, BookOpen, Users, HeartHandshake, Landmark, Bird,
} from "lucide-react";

const C = {
  bg: "#F3EEE2", card: "#FBF8F0", pine: "#1C3A2E", pineSoft: "#2C4F40",
  brass: "#B48A4A", brassSoft: "#D8B877", ink: "#1F1C16", muted: "#7A7263",
  line: "#E3DBC9", good: "#3E6B4F", warn: "#B07A3A",
};
const serif = "'Fraunces', Georgia, serif";
const sans  = "'Hanken Grotesk', system-ui, sans-serif";

const FRAMEWORKS = {
  broad:      { name: "Broad Ethical",     icon: Globe,         blurb: "Established ESG & ethically screened funds.",               holdings: [{ t:"ESGV",  n:"US ESG Equity",           a:45},{ t:"VSGX",  n:"Intl ESG Equity",         a:25},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:20},{ t:"SUSA",  n:"MSCI USA ESG Select",     a:10}], sim:97.1, excl:214, tithe:2,    faith:false },
  climate:    { name: "Climate Conscious", icon: Leaf,          blurb: "Fossil-fuel-free, low-carbon, clean energy funds.",          holdings: [{ t:"ICLN",  n:"iShares Global Clean Energy",a:35},{ t:"VEGN",  n:"US Vegan Climate ETF",    a:25},{ t:"CRBN",  n:"MSCI Low Carbon Target",  a:25},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:15}], sim:94.8, excl:287, tithe:2,    faith:false },
  humanrights:{ name: "Human Rights",      icon: Users,         blurb: "Screens for labor rights, equality & supply-chain ethics.", holdings: [{ t:"ESGV",  n:"US ESG Equity",           a:40},{ t:"VSGX",  n:"Intl ESG Equity",         a:28},{ t:"JUST",  n:"JUST US Large Cap",       a:17},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:15}], sim:96.2, excl:243, tithe:2,    faith:false },
  animal:     { name: "Animal Welfare",    icon: Bird,          blurb: "Excludes factory farming, animal testing & fur trade.",      holdings: [{ t:"VEGN",  n:"US Vegan Climate ETF",    a:50},{ t:"ESGV",  n:"US ESG Equity",           a:25},{ t:"VSGX",  n:"Intl ESG Equity",         a:15},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:10}], sim:93.6, excl:331, tithe:2,    faith:false },
  christian:  { name: "Christian Values",  icon: Church,        blurb: "Biblically & Catholic-screened funds. Tithing tradition.",   holdings: [{ t:"BIBL",  n:"Inspire 100 ETF",         a:40},{ t:"PRAY",  n:"FIS Biblical Responsible", a:25},{ t:"FCATX", n:"Catholic Values Equity",  a:20},{ t:"FBND",  n:"Core Bond",               a:15}], sim:95.8, excl:268, tithe:10,   faith:true  },
  jewish:     { name: "Jewish Values",     icon: Star,          blurb: "Tzedek-aligned screens; tzedakah giving.",                  holdings: [{ t:"ESGV",  n:"US ESG Equity",           a:42},{ t:"VSGX",  n:"Intl ESG Equity",         a:23},{ t:"EAGG",  n:"ESG Aggregate Bond",      a:20},{ t:"SUSB",  n:"Short-Term ESG Bond",     a:15}], sim:96.4, excl:231, tithe:10,   faith:true  },
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
  const [profile, setProfile]           = useState({ firstName:"", lastName:"", dob:"", address:"", city:"", state:"", postal:"" });
  const [creating, setCreating]         = useState(false);
  const [profileError, setProfileError] = useState("");
  const { user, setUser, signup, login, logout } = useAuth();
  const isDesktop = useIsDesktop();
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
      setProfileError("Network error — please try again.");
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
      ["Residue redirected", d.donated ?? "$0.00"],
      ["In clearing", d.clearing ?? "$0.00"],
      ["Framework", fw.name],
      ["Stewardship rate", `${pct}%`],
    ];
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Good Steward — ${month} Statement</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
        body{font-family:'Hanken Grotesk',system-ui,sans-serif;color:#1F1C16;background:#F3EEE2;margin:0;padding:48px}
        .card{max-width:620px;margin:0 auto;background:#FBF8F0;border:1px solid #E3DBC9;border-radius:20px;padding:40px}
        .kick{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#B48A4A;font-weight:700}
        h1{font-family:'Fraunces',Georgia,serif;font-weight:500;color:#1C3A2E;font-size:30px;margin:6px 0 2px;letter-spacing:-.01em}
        .sub{color:#7A7263;font-size:13px;margin-bottom:20px}
        .row{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #E3DBC9}
        .row:last-child{border-bottom:none}
        .k{color:#7A7263;font-size:13.5px}
        .v{color:#1C3A2E;font-weight:600;font-size:15px}
        .quote{font-family:'Fraunces',Georgia,serif;font-style:italic;color:#1C3A2E;font-size:15px;line-height:1.5;margin-top:24px;border-top:1px solid #E3DBC9;padding-top:20px}
        @media print{body{background:#fff;padding:0}.card{border:none}}
      </style></head><body><div class="card">
      <div class="kick">Good Steward · ${month}</div>
      <h1>Wealth · Impact · Restoration</h1>
      <div class="sub">${name} — a fuller account than "you made 8.2%."</div>
      ${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}
      <div class="quote">"Stewardship: minimize foreseeable harm, preserve practical effectiveness, and direct the unavoidable residue toward the common good."</div>
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
    const line = `This month with Good Steward I invested ${invested} of spare change by my values — and redirected ${donated} of the residue to giving.`;
    const url = window.location.origin;
    if (navigator.share) {
      try { await navigator.share({ title: "Good Steward", text: line, url }); return; } catch { /* cancelled — fall through */ }
    }
    try { await navigator.clipboard?.writeText(line + " " + url); } catch { /* ignore */ }
    const w = window.open("", "_blank", "width=620,height=680");
    if (!w) return;
    const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Good Steward</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Hanken+Grotesk:wght@400;600;700&display=swap');
        html,body{margin:0;height:100%} body{display:grid;place-items:center;background:#14271F;font-family:'Hanken Grotesk',sans-serif}
        .card{width:520px;max-width:92vw;aspect-ratio:1/1.15;background:radial-gradient(120% 90% at 50% -10%,#2C4F40 0%,#1C3A2E 55%,#14271F 100%);border-radius:26px;padding:44px;box-sizing:border-box;color:#F3EEE2;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
        .kick{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#D8B877;font-weight:700}
        .big{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:26px;line-height:1.25;letter-spacing:-.01em;margin:18px 0 0}
        .row{display:flex;gap:28px;margin-top:26px}
        .stat .n{font-family:'Fraunces',serif;font-weight:600;font-size:34px;color:#fff}
        .stat .l{font-size:12px;color:#9FB3A4;margin-top:2px}
        .brass{color:#D8B877}
        .foot{font-size:12.5px;color:#9FB3A4;display:flex;justify-content:space-between;align-items:center}
      </style></head><body><div class="card">
      <div><div class="kick">Good Steward · ${month}</div>
      <div class="big">Spare change, invested by my values — and the residue given on purpose.</div></div>
      <div class="row">
        <div class="stat"><div class="n">${invested}</div><div class="l">invested this month</div></div>
        <div class="stat"><div class="n brass">${donated}</div><div class="l">residue redirected</div></div>
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
        <Mark size={34} color={C.brassSoft} />
      </div>
    </Frame>
  );

  /* ── AUTH (sign up / log in) ── */
  if (!user && stage === "auth") return <AuthScreen signup={signup} login={login} onBack={() => setStage("landing")} />;

  /* ── TRUST (how it works · what's real) ── */
  if (!user && stage === "trust")
    return <TrustPage onBack={() => setStage("landing")} onStart={() => setStage("auth")} />;

  /* ── LANDING (the real marketing front door) ── */
  if (!user && (stage === "landing" || stage === "welcome"))
    return <LandingPage onStart={() => setStage("auth")} onTrust={() => setStage("trust")} />;

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
              Open verification link (shown here — demo has no email provider)
            </a>
          )}
          {verifyLink === "emailed" && <span style={{ color:C.pine }}>✓ Verification link sent — check your inbox.</span>}
          {verifyLink === "sent" && <span style={{ color:C.muted }}>Link issued — check the server log.</span>}
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
        <header style={{ position:"sticky", top:0, zIndex:10, background:"#F3EEE2f2", backdropFilter:"blur(8px)", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ maxWidth:920, margin:"0 auto", padding:"13px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}><Mark size={22} color={C.brass} /><span style={{ fontFamily:serif, fontSize:19, fontWeight:600, color:C.pine, letterSpacing:"-0.01em" }}>Good Steward</span></div>
            <nav style={{ display:"flex", alignItems:"center", gap:2 }}>
              {nav.map(n => { const Icon = n.icon; const on = tab === n.k; return (
                <button key={n.k} onClick={() => setTab(n.k)} style={{ background:on?C.pine+"10":"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:7, padding:"8px 13px", borderRadius:10, fontFamily:sans, fontSize:14, fontWeight:on?700:600, color:on?C.pine:C.muted }}><Icon size={16} color={on?C.pine:C.muted} strokeWidth={on?2.1:1.7} />{n.label}</button>
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
        <P>More stock means more growth and more swing; more bonds, the steadier ride. Nothing here is fixed — change it whenever.</P>
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
              <b style={{ color:C.pine }}>Optional add-on.</b> Your monthly contribution is the core of the app — round-ups are just a bonus on top. Every purchase gets rounded up to the nearest dollar and the spare change is swept into your portfolio. e.g. a $3.60 coffee → 40¢ invested. Toggle off if you'd rather keep spending separate.
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
        <P>Pick the tradition or values you invest by. Everything you hold gets measured against it — you can hold more than one.</P>
        <div style={{ marginTop:18, display:"grid", gap:18 }}>
          {FW_GROUPS.map(grp => (
            <div key={grp.label}>
              <div style={{ fontFamily:sans, fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, fontWeight:700, marginBottom:8 }}>{grp.label}</div>
              <div style={{ display:"grid", gap:9 }}>
                {grp.keys.map(k => {
                  const v = FRAMEWORKS[k]; const Icon = v.icon; const on = frameworks.includes(k);
                  return (
                    <button key={k} onClick={() => toggleFramework(k)} style={{ ...rowCard, borderColor:on?C.pine:C.line, background:on?"#EEF1E9":C.card, boxShadow:on?`0 0 0 1px ${C.pine}`:"none" }}>
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
        <P>Stricter screens cut more harm — but drift slightly from the market. We show you the tradeoff honestly.</P>
        <div style={{ marginTop:18, display:"grid", gap:10 }}>
          {Object.entries(SCREENS).map(([k, v]) => {
            const on = screen === k;
            const fwKey = frameworks[0];
            const ex = SCREEN_EXCLUDES[fwKey];
            const chips = k === "light" ? ex.light : k === "moderate" ? [...ex.light,...ex.moderate] : [...ex.light,...ex.moderate,...ex.strong];
            return (
              <button key={k} onClick={() => setScreen(k)} style={{ ...rowCard, alignItems:"flex-start", flexDirection:"column", gap:8, borderColor:on?C.pine:C.line, background:on?"#EEF1E9":C.card, boxShadow:on?`0 0 0 1px ${C.pine}`:"none" }}>
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
            <button key={k} onClick={() => setBasis(k)} style={{ ...miniCard, borderColor:basis===k?C.pine:C.line, background:basis===k?"#EEF1E9":C.card }}>
              <span style={{ fontFamily:sans, fontSize:12.5, fontWeight:600, color:C.ink }}>{v.label}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop:20, fontFamily:sans, fontSize:12.5, color:C.muted, marginBottom:10 }}>
          Stewardship rate · suggested {derived.suggestedTithe}%
        </div>
        <input type="range" min={0} max={10} step={0.5} value={pct} onChange={e => setPct(+e.target.value)} style={{ width:"100%", accentColor:C.pine }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 }}>
          <span style={{ fontFamily:serif, fontSize:30, color:C.pine, fontWeight:600 }}>{pct}%</span>
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
          <div style={{ background:`linear-gradient(155deg, ${C.pine} 0%, #16302479 60%, #14271F 100%)`, borderRadius:22, padding:"22px 22px 6px", color:"#F3EEE2", position:"relative", overflow:"hidden" }}>
            <Grain />
            <div style={{ position:"relative", zIndex:1 }}>
              <span style={{ fontFamily:sans, fontSize:12, letterSpacing:"0.14em", textTransform:"uppercase", color:C.brassSoft }}>Portfolio value</span>
              <div style={{ fontFamily:serif, fontSize:40, fontWeight:500, marginTop:4, letterSpacing:"-0.01em" }}>{live ? <AnimatedMoney cents={live.portfolioValueCents} /> : fmt(14820)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                <TrendingUp size={15} color={C.brassSoft} />
                <span style={{ fontFamily:sans, fontSize:13.5, color:"#CFE0D2" }}>
                  {live ? `${live.display.roundupsThisMonth} rounded up this month` : `+${fmt(1180)} (8.7%) this year`}
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
                    <LiveStat label="Redirected residue" value={live.display.donated} />
                    <LiveStat label={live.display.pending ? "Pending (settling)" : "Orders placed"}
                              value={live.display.pending ?? String(live.ordersPlaced)} />
                  </div>
                  {live.display.pending && (
                    <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.5, margin:"10px 0 0" }}>
                      {live.display.pending} of round-ups is queued — your transfer is still settling. It invests automatically the moment the funds land.
                    </p>
                  )}
                </>
              ) : (
                <div style={{ marginTop:12, padding:"14px 15px", background:C.bg, border:`1px dashed ${C.line}`, borderRadius:12, textAlign:"center" }}>
                  <div style={{ fontFamily:serif, fontSize:17, color:C.pine, fontWeight:500 }}>Your account is ready.</div>
                  <div style={{ fontFamily:sans, fontSize:13, color:C.muted, lineHeight:1.5, marginTop:4 }}>
                    Make your first purchase below — the spare change rounds up, and every $5 buys your {fw.name} ETFs.
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
                  width: "100%", marginTop: 14, padding: "13px 16px",
                  background: buying ? C.stone : C.pine, color: "#fff",
                  border: "none", borderRadius: 12, cursor: buying ? "default" : "pointer",
                  fontFamily: sans, fontSize: 14.5, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {buying ? "Rounding up…" : <>Make a purchase <ChevronRight size={16} /></>}
              </button>

              {/* Real bank feed via Plaid: link once, then Sync pulls actual transactions
                  through the same round-up engine. The manual button above stays for demos. */}
              {user?.plaidEnabled && (
                user?.bankLinked ? (
                  <button onClick={runSync} disabled={syncing}
                    style={{ width:"100%", marginTop:9, padding:"12px 16px", background:"transparent", color:C.pine,
                      border:`1px solid ${C.pine}`, borderRadius:12, cursor: syncing ? "default" : "pointer",
                      fontFamily:sans, fontSize:14, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    {syncing ? "Syncing…" : <>Sync transactions <Receipt size={15} /></>}
                  </button>
                ) : (
                  <button onClick={() => plaidReady && openPlaid()} disabled={!plaidReady}
                    style={{ width:"100%", marginTop:9, padding:"12px 16px", background:"transparent", color:C.pine,
                      border:`1px solid ${C.pine}`, borderRadius:12, cursor: plaidReady ? "pointer" : "default",
                      fontFamily:sans, fontSize:14, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <Landmark size={15} /> Link your bank
                  </button>
                )
              )}

              <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.45, margin:"8px 0 0", textAlign:"center" }}>
                {user?.bankLinked
                  ? "Your bank is linked — Sync pulls real transactions into the round-up engine."
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
            <p style={{ fontFamily:sans, fontSize:11.5, color:C.stone, lineHeight:1.45, margin:"10px 0 0" }}>
              Similarity and exclusion counts are <b>illustrative estimates</b>, not audited fund data.
              How we estimate them: modelled from each fund family's published screening categories
              (what they exclude and how strictly), scaled by your chosen screen level — not computed
              from live holdings. They indicate the kind and scale of screening, not a precise count.
              Your actual holdings and orders (below and in your statement) are real.
            </p>
          </Card>

          <Card>
            <Row icon={Scale} label="Moral leakage" right={<InfoTag>honest</InfoTag>} />
            {/* One bar, split honestly: what your screen removes, and the residue it can't. */}
            <div style={{ display:"flex", height:16, borderRadius:8, overflow:"hidden", marginTop:14, background:C.line }}>
              <div style={{ width:`${derived.reduction}%`, background:C.good, transition:"width .5s ease" }} />
              <div style={{ width:`${derived.residual}%`, background:C.warn, transition:"width .5s ease" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
              <div>
                <div style={{ fontFamily:serif, fontSize:20, fontWeight:600, color:C.good }}>{derived.reduction}%</div>
                <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted }}>harm removed</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:serif, fontSize:20, fontWeight:600, color:C.warn }}>{derived.residual}%</div>
                <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted }}>residue we can't screen out</div>
              </div>
            </div>
            <p style={{ fontFamily:sans, fontSize:12.5, color:C.muted, lineHeight:1.5, margin:"12px 0 0" }}>
              No portfolio is clean. We show you the part that isn't rather than pretend it away — and the residue is what your giving, below, is for.
            </p>
          </Card>

          <Card>
            <Row icon={Sparkles} label="Stewardship Score" right={
              <span style={{ fontFamily:serif, fontSize:26, fontWeight:600, color:C.pine }}>{derived.score}<span style={{ fontSize:14, color:C.muted }}>/100</span></span>
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
              <span style={{ fontFamily:serif, fontSize:28, fontWeight:600, color:C.pine }}>{pct}%</span>
              <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>of {OFFSET_BASIS[basis].label.toLowerCase()}</span>
            </div>
            <p style={{ fontFamily:sans, fontSize:13.5, color:C.ink, margin:"6px 0 0" }}>
              ≈ <b>{fmt(derived.annualDonation)}/yr</b> routed automatically to flourishing.
            </p>
            <button onClick={() => setTab("impact")} style={{ ...textLink, marginTop:10 }}>Adjust & see causes <ChevronRight size={14} /></button>
          </Card>
          <div style={{ height:14 }} />
        </div>
      </div>
    );
  }

  function renderPortfolio() {
    return (
      <div>
        <Header title="Portfolio" sub={`${fw.name} · ${SCREENS[screen].label} screen`} />
        <div style={{ padding:"0 18px" }}>
          <Card>
            <Row icon={Wallet} label="Holdings" right={<InfoTag>{derived.similarity}% market</InfoTag>} />
            <div style={{ marginTop:10, display:"grid", gap:12 }}>
              {fw.holdings.map(h => {
                const liveH = live && live.holdings ? live.holdings.find(x => x.symbol === h.t) : null;
                return (
                <div key={h.t}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                    <div>
                      <span style={{ fontFamily:sans, fontWeight:700, fontSize:13.5, color:C.ink }}>{h.t}</span>
                      <span style={{ fontFamily:sans, fontSize:12.5, color:C.muted, marginLeft:8 }}>{h.n}</span>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      {liveH && <span style={{ fontFamily:sans, fontSize:13, fontWeight:600, color:C.pine }}>{liveH.investedDisplay}</span>}
                      <span style={{ fontFamily:sans, fontSize:12, color:C.muted, marginLeft:liveH?8:0 }}>{h.a}%</span>
                    </div>
                  </div>
                  <div style={{ height:6, background:C.line, borderRadius:6, marginTop:5, overflow:"hidden" }}>
                    <div style={{ width:`${h.a}%`, height:"100%", background:C.pineSoft, borderRadius:6 }} />
                  </div>
                </div>
              );})}
            </div>
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
                      return <button key={k} onClick={() => toggleFramework(k)} style={{ ...chipBtn, borderColor:on?C.pine:C.line, background:on?C.pine:"transparent", color:on?"#F3EEE2":C.ink }}>{FRAMEWORKS[k].name}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <Row icon={Shield} label="Screen strictness" />
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              {Object.entries(SCREENS).map(([k,v]) => (
                <button key={k} onClick={() => setScreen(k)} style={{ flex:1, ...chipBtn, borderColor:screen===k?C.pine:C.line, background:screen===k?C.pine:"transparent", color:screen===k?"#F3EEE2":C.ink }}>{v.label}</button>
              ))}
            </div>
            <Meter label="Direct exposure removed" value={derived.reduction} color={C.good} style={{ marginTop:14 }} />
          </Card>
          <div style={{ height:14 }} />
        </div>
      </div>
    );
  }

  function renderImpact() {
    const annualDonation = live ? live.annualDonationCents / 100 : derived.annualDonation;
    const split = annualDonation / CAUSES.length;
    return (
      <div>
        <Header title="Impact" sub="Where the residue goes" />
        <div style={{ padding:"0 18px" }}>
          <Card>
            <Row icon={HeartHandshake} label="Stewardship rate" />
            <input type="range" min={0} max={10} step={0.5} value={pct} onChange={e => setPct(+e.target.value)} style={{ width:"100%", accentColor:C.pine, marginTop:12 }} />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 }}>
              <span style={{ fontFamily:serif, fontSize:30, color:C.pine, fontWeight:600 }}>{pct}%</span>
              <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>≈ {fmt(annualDonation)}/yr</span>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
              {Object.entries(OFFSET_BASIS).map(([k,v]) => (
                <button key={k} onClick={() => setBasis(k)} style={{ ...chipBtn, fontSize:11.5, borderColor:basis===k?C.pine:C.line, background:basis===k?C.pine:"transparent", color:basis===k?"#F3EEE2":C.ink }}>{v.label}</button>
              ))}
            </div>
          </Card>

          {live && (
            <Card>
              <Row icon={HeartHandshake} label="Residue redirected" right={<InfoTag>real</InfoTag>} />
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginTop:8 }}>
                <AnimatedMoney cents={live.donatedCents} style={{ fontFamily:serif, fontSize:34, fontWeight:600, color:C.pine }} />
                <span style={{ fontFamily:sans, fontSize:12.5, color:C.muted }}>diverted from your sweeps so far</span>
              </div>
              <p style={{ fontFamily:sans, fontSize:12, color:C.muted, lineHeight:1.5, margin:"8px 0 0" }}>
                {live.config.tithePct}% of every $5 swept is held back from investment and routed to the residue — real, accumulating money, not just a percentage on a screen.
              </p>
              {live.charity ? (
                <p style={{ fontFamily:sans, fontSize:12, color:C.pine, lineHeight:1.5, margin:"6px 0 0" }}>
                  {"$" + ((live.donationRoutedCents ?? 0) / 100).toFixed(2)} journaled to the designated charitable
                  account <b>{live.charity}</b> at the broker{(live.donationPendingCents ?? 0) > 0 ? ` — $${(live.donationPendingCents / 100).toFixed(2)} on its way` : ""}.
                </p>
              ) : (
                <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.5, margin:"6px 0 0" }}>
                  Your residue is accumulating. Once your brokerage account is active it's
                  transferred to a dedicated giving account.
                </p>
              )}
            </Card>
          )}

          <Card>
            <Row icon={Coins} label="Routed to flourishing" />
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
                    <span style={{ fontFamily:sans, fontSize:13, fontWeight:600, color:C.pine }}>{fmt(split)}</span>
                  </div>
                );
              })}
              {derived.hasFaith && (
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:C.brass+"22", display:"grid", placeItems:"center", flexShrink:0 }}>
                    <Landmark size={17} color={C.brass} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:sans, fontSize:13.5, fontWeight:600, color:C.ink }}>Faith community</div>
                    <div style={{ fontFamily:sans, fontSize:11.5, color:C.muted }}>Your congregation or mission</div>
                  </div>
                  <span style={{ fontFamily:sans, fontSize:12, color:C.muted }}>optional</span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <Row icon={PiggyBank} label="Round-ups this month" right={
              live ? <InfoTag>live</InfoTag> : null
            } />
            {live ? (
              <>
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginTop:8 }}>
                  <span style={{ fontFamily:serif, fontSize:28, fontWeight:600, color:C.pine }}>{live.display.roundupsThisMonth}</span>
                  <span style={{ fontFamily:sans, fontSize:12.5, color:C.muted }}>{live.display.clearing} in clearing → {live.etf}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, fontFamily:sans, fontSize:13, flexWrap:"wrap", gap:8 }}>
                  {live.byCategory.slice(0,4).map(c => (
                    <div key={c.category} style={{ textAlign:"center", flex:1 }}>
                      <div style={{ color:C.muted, fontSize:11.5 }}>{c.category}</div>
                      <div style={{ color:C.pine, fontWeight:600 }}>{c.display}</div>
                    </div>
                  ))}
                </div>
                <button onClick={addPurchase} style={{ ...textLink, marginTop:12 }}>
                  Simulate a purchase <ChevronRight size={14} />
                </button>
              </>
            ) : (
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontFamily:sans, fontSize:13 }}>
                {[["Coffee","$0.75"],["Books","$0.40"],["Transit","$0.10"],["Groceries","$0.62"]].map(([a,b]) => (
                  <div key={a} style={{ textAlign:"center" }}>
                    <div style={{ color:C.muted, fontSize:11.5 }}>{a}</div>
                    <div style={{ color:C.pine, fontWeight:600 }}>{b}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div style={{ height:14 }} />
        </div>
      </div>
    );
  }

  function renderReport() {
    const annualDonation = live ? live.annualDonationCents / 100 : derived.annualDonation;
    const rows = [
      ["Invested to date",   live ? live.display.invested : fmt(contribution * 12), true ],
      ["Rounded up this month", live ? live.display.roundupsThisMonth : "+"+fmt(298), false],
      ["In clearing account", live ? live.display.clearing : fmt(0),  false],
      ["Donations routed",   fmt(annualDonation / 12),           true ],
      ["Companies screened", String(derived.excluded),           false],
      ["Direct harm reduced",SCREENS[screen].label+" · "+derived.reduction+"%", false],
      ["Stewardship Score",  String(derived.score),              true ],
    ];
    return (
      <div>
        <Header title="Statement" sub="June · Monthly Stewardship Report" />
        <div style={{ padding:"0 18px" }}>
          <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:20, padding:22 }}>
            <div style={{ textAlign:"center", borderBottom:`1px solid ${C.line}`, paddingBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"center" }}><Mark size={26} color={C.brass} /></div>
              <div style={{ fontFamily:serif, fontSize:21, color:C.pine, fontWeight:500, marginTop:6 }}>Wealth · Impact · Restoration</div>
              <div style={{ fontFamily:sans, fontSize:12, color:C.muted, marginTop:2 }}>Not "you made 8.2%." A fuller account.</div>
            </div>
            <div style={{ marginTop:8 }}>
              {rows.map(([k,v,hl],i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0", borderBottom:i<rows.length-1?`1px solid ${C.line}`:"none" }}>
                  <span style={{ fontFamily:sans, fontSize:13.5, color:C.muted }}>{k}</span>
                  <span style={{ fontFamily:hl?serif:sans, fontSize:hl?19:14.5, fontWeight:600, color:hl?C.pine:C.ink }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <Card>
            <p style={{ fontFamily:serif, fontStyle:"italic", fontSize:15.5, color:C.pine, lineHeight:1.5, margin:0 }}>
              "Stewardship: minimize foreseeable harm, preserve practical effectiveness, and direct the unavoidable residue toward the common good."
          </p>
          </Card>
          {activity.length > 0 && (
            <Card>
              <Row icon={Receipt} label="Account activity" right={<InfoTag>audit trail</InfoTag>} />
              <div style={{ marginTop:10, display:"grid", gap:2 }}>
                {activity.slice(0, 6).map((e, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"7px 0", borderBottom:i<Math.min(6,activity.length)-1?`1px solid ${C.line}`:"none" }}>
                    <span style={{ fontFamily:sans, fontSize:13, color:C.ink }}>{AUDIT_LABEL[e.event] || e.event.replace(/_/g," ")}</span>
                    <span style={{ fontFamily:sans, fontSize:11.5, color:C.muted }}>{new Date(e.ts).toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button onClick={shareStatement} style={{ flex:1, padding:"13px 16px", background:C.pine, color:"#fff", border:"none", borderRadius:12, cursor:"pointer", fontFamily:sans, fontSize:14.5, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <HeartHandshake size={16} /> Share this month
            </button>
            <button onClick={printStatement} style={{ flex:1, padding:"13px 16px", background:"transparent", color:C.pine, border:`1px solid ${C.pine}`, borderRadius:12, cursor:"pointer", fontFamily:sans, fontSize:14.5, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Receipt size={16} /> Save PDF
            </button>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, padding:"0 4px" }}>
            <span style={{ fontFamily:sans, fontSize:12, color:C.muted }}>{user?.email}</span>
            <button onClick={logout} style={{ ...textLink, color:"#B0563F" }}>Sign out</button>
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
            <Mark size={24} color={C.brass} />
            <span style={{ fontFamily:serif, fontSize:19, fontWeight:600, color:C.pine, letterSpacing:"-0.01em" }}>Good Steward</span>
          </div>
          <h1 style={{ fontFamily:serif, fontSize:30, fontWeight:500, color:C.pine, margin:0, letterSpacing:"-0.01em" }}>
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
// Good Steward's mark — a hand-drawn balance, not an icon-library glyph. A beam that
// tips toward whichever pan holds more weight; here it rests level.
function Mark({ size = 22, color = C.brass, strokeWidth = 1.5 }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <path d="M12 3.2 V20.4" {...p} />
      <path d="M8.2 20.4 H15.8" {...p} />
      <path d="M4.6 7.4 H19.4" {...p} />
      <circle cx="12" cy="3.2" r="1.5" fill={color} />
      <path d="M4.6 7.4 L2.4 12.4 A2.3 2.3 0 0 0 6.8 12.4 Z" {...p} />
      <path d="M19.4 7.4 L17.2 12.4 A2.3 2.3 0 0 0 21.6 12.4 Z" {...p} />
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
    } catch { setState("error"); setMsg("Network error — try again."); }
  };
  if (state === "done")
    return <p style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: dark ? C.brassSoft : C.pine, textAlign: "center", margin: 0 }}>You're on the list. We'll write the day we open.</p>;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 440, margin: "0 auto" }}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" aria-label="Email for the waitlist"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ flex: "1 1 220px", fontFamily: sans, fontSize: 15, padding: "13px 14px", borderRadius: 12, border: `1px solid ${dark ? "#3a5346" : C.line}`, background: dark ? "rgba(255,255,255,0.06)" : C.card, color: dark ? "#F3EEE2" : C.ink, outline: "none" }} />
      <button onClick={submit} style={{ background: C.brass, color: "#1F1C16", border: "none", borderRadius: 12, padding: "13px 22px", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{state === "loading" ? "…" : "Join the waitlist"}</button>
      {state === "error" && <div style={{ flexBasis: "100%", textAlign: "center", fontFamily: sans, fontSize: 12.5, color: "#E0A090" }}>{msg}</div>}
    </div>
  );
}

// Full-width marketing landing page — the front door a stranger hits first. Not the
// app in a phone frame: a real page that states the philosophy, shows the product,
// and has one clear call to action.
function LandingPage({ onStart, onTrust }) {
  const wrap = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
  useEffect(() => { track("landing_view"); }, []);
  const start = () => { track("cta_click"); onStart(); };
  const Step = ({ icon: Icon, n, title, body }) => (
    <div style={{ flex: "1 1 260px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: "26px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: C.pine, display: "grid", placeItems: "center" }}><Icon size={20} color={C.brassSoft} strokeWidth={1.7} /></div>
        <span style={{ fontFamily: sans, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.brass, fontWeight: 700 }}>{n}</span>
      </div>
      <h3 style={{ fontFamily: serif, fontSize: 21, fontWeight: 500, color: C.pine, margin: "16px 0 6px" }}>{title}</h3>
      <p style={{ fontFamily: sans, fontSize: 14.5, lineHeight: 1.55, color: C.muted, margin: 0 }}>{body}</p>
    </div>
  );
  const cta = (label) => (
    <button onClick={start} style={{ background: C.brass, color: "#1F1C16", border: "none", borderRadius: 14, padding: "15px 28px", fontFamily: sans, fontSize: 16, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>{label} <ChevronRight size={18} /></button>
  );
  return (
    <div style={{ background: C.bg, minHeight: "100dvh", fontFamily: sans, color: C.ink }}>
      <FontInjector />
      <nav style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Mark size={24} color={C.brass} />
          <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.pine, letterSpacing: "-0.01em" }}>Good Steward</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button onClick={onTrust} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.muted }}>How it works</button>
          <button onClick={start} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.pine }}>Sign in</button>
        </div>
      </nav>

      <header style={{ background: `radial-gradient(120% 90% at 50% -10%, ${C.pineSoft} 0%, ${C.pine} 55%, #14271F 100%)`, color: "#F3EEE2", position: "relative", overflow: "hidden" }}>
        <Grain />
        <div style={{ ...wrap, position: "relative", zIndex: 1, textAlign: "center", padding: "clamp(56px,10vw,110px) 24px" }}>
          <p style={{ fontFamily: sans, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: C.brassSoft, marginBottom: 22 }}>A stewardship layer for your money</p>
          <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(40px,7vw,74px)", lineHeight: 1.03, margin: 0, letterSpacing: "-0.02em" }}>Money is <em style={{ color: C.brassSoft, fontStyle: "italic" }}>stored agency.</em></h1>
          <p style={{ fontFamily: sans, fontSize: "clamp(16px,2vw,19px)", lineHeight: 1.55, color: "#D9D2C2", margin: "24px auto 0", maxWidth: 560 }}>Round up your spare change and invest it to reduce foreseeable harm — by your own values — then redirect the unavoidable residue toward human flourishing.</p>
          <div style={{ marginTop: 36 }}>{cta("Open your account")}</div>
          <p style={{ fontFamily: sans, fontSize: 12.5, color: "#9FB3A4", marginTop: 18 }}>No claim of moral purity. Ethical investing is asymptotic.</p>
        </div>
      </header>

      <section style={{ ...wrap, padding: "clamp(56px,8vw,90px) 24px" }}>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4vw,40px)", fontWeight: 500, color: C.pine, textAlign: "center", margin: "0 0 8px", letterSpacing: "-0.01em" }}>Three moves, quietly, in the background.</h2>
        <p style={{ fontFamily: sans, fontSize: 16, color: C.muted, textAlign: "center", maxWidth: 560, margin: "0 auto 44px", lineHeight: 1.55 }}>You spend as you always do. Steward turns the remainder into a small, deliberate act.</p>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Step icon={Coins} n="01 · Round up" title="Spare change, gathered" body="Every purchase rounds up to the nearest dollar. A $3.60 coffee sets aside 40¢ — invisible to you, meaningful in aggregate." />
          <Step icon={Scale} n="02 · Invest by your values" title="Your framework, your holdings" body="Choose a moral framework — from broad ESG to Christian, Jewish, or Islamic screens. Your round-ups buy the ETFs that fit it." />
          <Step icon={HeartHandshake} n="03 · Redirect the residue" title="Answer what you can't avoid" body="Perfect purity is impossible. A share of every sweep is routed to human flourishing — the residue, given on purpose." />
        </div>
      </section>

      <section style={{ background: C.card, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...wrap, padding: "clamp(56px,8vw,90px) 24px" }}>
          <p style={{ fontFamily: sans, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.brass, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>Invest by what you believe</p>
          <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4vw,40px)", fontWeight: 500, color: C.pine, textAlign: "center", margin: "0 0 40px", letterSpacing: "-0.01em" }}>A marketplace of moral frameworks.</h2>
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

      <section style={{ ...wrap, padding: "clamp(64px,9vw,110px) 24px", textAlign: "center", maxWidth: 820 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><Mark size={32} color={C.brass} /></div>
        <blockquote style={{ fontFamily: serif, fontStyle: "italic", fontSize: "clamp(22px,3.4vw,32px)", lineHeight: 1.4, color: C.pine, margin: 0, letterSpacing: "-0.01em" }}>
          "Minimize foreseeable harm, preserve practical effectiveness, and direct the unavoidable residue toward the common good."
        </blockquote>
        <p style={{ fontFamily: sans, fontSize: 15, color: C.muted, marginTop: 22, lineHeight: 1.6 }}>We name the residue rather than hide it. A monthly statement gives you a fuller account than "you made 8.2%" — wealth, impact, and restoration, side by side.</p>
      </section>

      <section style={{ background: C.pine, color: "#F3EEE2", position: "relative", overflow: "hidden" }}>
        <Grain />
        <div style={{ ...wrap, position: "relative", zIndex: 1, textAlign: "center", padding: "clamp(56px,8vw,88px) 24px" }}>
          <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4.5vw,44px)", fontWeight: 500, margin: "0 0 20px", letterSpacing: "-0.01em" }}>Begin stewarding.</h2>
          {cta("Open your account")}
          <p style={{ fontFamily: sans, fontSize: 12.5, color: "#9FB3A4", marginTop: 18 }}>Free to try. No money leaves your pocket — <b style={{ fontWeight: 600 }}>see exactly how it works</b>.</p>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 40, paddingTop: 34 }}>
            <p style={{ fontFamily: sans, fontSize: 15, color: "#D9D2C2", margin: "0 auto 16px", maxWidth: 460, lineHeight: 1.55 }}>
              We're not open for deposits yet. Leave your email and we'll write the day we are — nothing before then.
            </p>
            <WaitlistForm dark />
          </div>
        </div>
      </section>

      <footer style={{ ...wrap, padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Mark size={18} color={C.muted} /><span style={{ fontFamily: serif, fontSize: 15, fontWeight: 600, color: C.muted }}>Good Steward</span></div>
        <button onClick={onTrust} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: 12, color: C.muted, textDecoration: "underline" }}>How it works · what's real</button>
      </footer>
    </div>
  );
}

// The honest trust story. For a product whose whole premise is naming the residue
// rather than hiding it, the trust page owns the limits out loud.
function TrustPage({ onBack, onStart }) {
  const wrap = { maxWidth: 820, margin: "0 auto", padding: "0 24px" };
  const Block = ({ title, children }) => (
    <section style={{ ...wrap, padding: "18px 24px 6px" }}>
      <h2 style={{ fontFamily: serif, fontSize: "clamp(22px,3.4vw,28px)", fontWeight: 500, color: C.pine, margin: "0 0 12px", letterSpacing: "-0.01em" }}>{title}</h2>
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
    <div style={{ background: C.bg, minHeight: "100dvh", fontFamily: sans, color: C.ink, paddingBottom: 60 }}>
      <FontInjector />
      <nav style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <ChevronLeft size={18} color={C.pine} /><span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: C.pine }}>Good Steward</span>
        </button>
        <button onClick={onStart} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.pine }}>Open your account</button>
      </nav>

      <header style={{ ...wrap, padding: "clamp(28px,6vw,56px) 24px 20px" }}>
        <p style={{ fontFamily: sans, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: C.brass, fontWeight: 700, marginBottom: 12 }}>How it works · what's real</p>
        <h1 style={{ fontFamily: serif, fontSize: "clamp(30px,5vw,46px)", fontWeight: 500, color: C.pine, margin: 0, lineHeight: 1.08, letterSpacing: "-0.01em" }}>We'd rather tell you the limits than hide them.</h1>
        <p style={{ ...p, marginTop: 16, color: C.muted }}>The whole idea here is naming the residue instead of pretending it away. It would be strange to be dishonest about the product itself. So here's exactly what happens, what's real, and what isn't yet.</p>
      </header>

      <Block title="How it works">
        <p style={{ ...p, margin: 0 }}>You spend as you always do. Each purchase rounds up to the next dollar and the spare change collects in a clearing balance. When it reaches $5 it's swept and split across the ETFs of the moral framework you chose — and a slice of every sweep is held back and redirected to giving. Your statement shows all three at once: what you kept, what you invested, and what you gave.</p>
      </Block>

      <Block title="What's real">
        <Item good k="Your account and login" v="Real email-and-password accounts with hashed passwords and sessions, stored in a real database that survives restarts." />
        <Item good k="A real brokerage account" v="Onboarding opens a genuine brokerage account in your name through Alpaca — the same system a live product runs on." />
        <Item good k="Real orders" v="Round-ups place real fractional ETF orders in that account, split by your framework's allocation. You can watch them land in Alpaca's dashboard." />
        <Item good k="The round-up math" v="Integer-cent accounting with no floating-point drift, covered by a passing test suite." />
        <Item good k="The redirected residue" v="The tithe is real money movement in the ledger, not a number on a screen — it accumulates as you use the app." />
      </Block>

      <Block title="What isn't real yet">
        <Item k="The money isn't yours yet" v="Your account is funded with practice money, so nothing leaves your pocket and nothing can be lost. Everything else behaves exactly as it will on the day we open." />
        <Item k="The ESG figures" v="The 'market similarity' and 'companies excluded' numbers are modelled estimates, labelled as such in the app — not sourced from live fund-holdings data yet." />
        <Item k="Speed" v="A brand-new account takes a minute or two to be approved and funded, so your very first order may not appear instantly." />
      </Block>

      <Block title="Why you can't put real money in yet">
        <p style={{ ...p, margin: "0 0 12px" }}>Choosing a portfolio on your behalf is, legally, advice — and giving advice about money is a regulated thing to do, for good reasons. We'd rather do that properly than quietly. So before we take a single real dollar, the structure gets reviewed by a securities lawyer.</p>
        <p style={{ ...p, margin: 0 }}>Opening a real account also means verifying who you are, which the law requires and we wouldn't skip anyway. That's the work standing between today and opening day — not a missing button.</p>
      </Block>

      <section style={{ ...wrap, padding: "34px 24px 10px", textAlign: "center" }}>
        <p style={{ ...p, color: C.muted, marginBottom: 18 }}>Try the whole thing now, free — or leave your email and we'll write the day we open.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 26 }}>
          <button onClick={onStart} style={{ background: C.pine, color: "#F3EEE2", border: "none", borderRadius: 14, padding: "14px 26px", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Open your account</button>
        </div>
        <WaitlistForm />
      </section>
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
  return <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap'); *::-webkit-scrollbar{width:0;height:0}
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
  return <div style={{ padding:"26px 22px 14px" }}><div style={{ fontFamily:sans, fontSize:12, color:C.muted, letterSpacing:"0.04em" }}>{sub}</div><h1 style={{ fontFamily:serif, fontSize:30, fontWeight:500, color:C.pine, margin:"2px 0 0", letterSpacing:"-0.01em" }}>{title}</h1></div>;
}
function Card({ children }) {
  return <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:18, padding:18, marginTop:14 }}>{children}</div>;
}
function Row({ icon: Icon, label, right }) {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><div style={{ display:"flex", alignItems:"center", gap:9 }}><Icon size={16} color={C.brass} strokeWidth={1.9} /><span style={{ fontFamily:sans, fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, fontWeight:600 }}>{label}</span></div>{right}</div>;
}
function Meter({ label, value, color, caption, style }) {
  return <div style={{ marginTop:12, ...style }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}><span style={{ fontFamily:sans, fontSize:12.5, color:C.ink }}>{label}</span><span style={{ fontFamily:sans, fontSize:13, fontWeight:700, color }}>{value}%{caption&&<span style={{ fontWeight:400, color:C.muted, fontSize:11 }}> · {caption}</span>}</span></div><div style={{ height:7, background:C.line, borderRadius:6, marginTop:5, overflow:"hidden" }}><div style={{ width:`${value}%`, height:"100%", background:color, borderRadius:6, transition:"width .35s ease" }} /></div></div>;
}
function ScoreBar({ label, v, max }) {
  return <div><div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontFamily:sans, fontSize:12.5, color:C.ink }}>{label}</span><span style={{ fontFamily:sans, fontSize:12.5, color:C.muted }}>{v}/{max}</span></div><div style={{ height:6, background:C.line, borderRadius:6, marginTop:4, overflow:"hidden" }}><div style={{ width:`${(v/max)*100}%`, height:"100%", background:C.pineSoft, borderRadius:6, transition:"width .35s ease" }} /></div></div>;
}
function TabBar({ tab, setTab }) {
  const items = [
    { k:"home",      label:"Home",      icon:Scale        },
    { k:"portfolio", label:"Portfolio", icon:Wallet       },
    { k:"impact",    label:"Impact",    icon:HeartHandshake},
    { k:"report",    label:"Statement", icon:Receipt      },
  ];
  return <div style={{ display:"flex", borderTop:`1px solid ${C.line}`, background:C.card, paddingBottom:18, paddingTop:8 }}>{items.map(it => { const Icon=it.icon; const on=tab===it.k; return <button key={it.k} onClick={() => setTab(it.k)} style={{ flex:1, background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"4px 0" }}><Icon size={20} color={on?C.pine:C.muted} strokeWidth={on?2.1:1.7} /><span style={{ fontFamily:sans, fontSize:10.5, fontWeight:on?700:500, color:on?C.pine:C.muted, letterSpacing:"0.02em" }}>{it.label}</span></button>; })}</div>;
}
function Btn({ children, onClick, dark }) {
  return <button onClick={onClick} style={{ width:"100%", padding:"15px", borderRadius:14, border:"none", cursor:"pointer", background:dark?C.brass:C.pine, color:dark?"#1F1C16":"#F3EEE2", fontFamily:sans, fontSize:15, fontWeight:700, letterSpacing:"0.01em", display:"flex", alignItems:"center", justifyContent:"center", gap:6, boxShadow:"0 8px 20px -8px rgba(28,58,46,0.6)" }}>{children}</button>;
}
function SelectCard({ active, onClick, title, desc }) {
  return <button onClick={onClick} style={{ ...rowCard, borderColor:active?C.pine:C.line, background:active?"#EEF1E9":C.card, boxShadow:active?`0 0 0 1px ${C.pine}`:"none" }}><div style={{ textAlign:"left", flex:1 }}><div style={{ fontFamily:serif, fontSize:16.5, color:C.ink, fontWeight:500 }}>{title}</div><div style={{ fontFamily:sans, fontSize:12.5, color:C.muted, marginTop:1 }}>{desc}</div></div>{active&&<Check size={18} color={C.pine} />}</button>;
}
function Field({ label, value, editable, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState("");
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.card, border:`1px solid ${editing?C.pine:C.line}`, borderRadius:12, padding:"13px 15px", marginTop:10, transition:"border-color .2s" }}>
      <span style={{ fontFamily:sans, fontSize:13, color:C.muted }}>{label}</span>
      {editable && editing
        ? <input autoFocus value={raw} onChange={e => setRaw(e.target.value)} onBlur={() => { onEdit(raw); setEditing(false); }} onKeyDown={e => { if (e.key==="Enter") { onEdit(raw); setEditing(false); } }} style={{ fontFamily:sans, fontSize:13.5, fontWeight:600, color:C.ink, border:"none", outline:"none", background:"transparent", textAlign:"right", width:100 }} />
        : <span onClick={() => editable&&(setRaw(value.replace(/[^0-9]/g,"")),setEditing(true))} style={{ fontFamily:sans, fontSize:13.5, fontWeight:600, color:C.ink, cursor:editable?"text":"default", borderBottom:editable?`1px dashed ${C.muted}`:"none" }}>{value}</span>
      }
    </div>
  );
}
function Dots({ n, active }) {
  return <div style={{ display:"flex", gap:6, flex:1 }}>{Array.from({length:n}).map((_,i) => <div key={i} style={{ flex:1, height:4, borderRadius:4, background:i<=active?C.pine:C.line, transition:"background .3s" }} />)}</div>;
}
function Kicker({ children }) { return <div style={{ fontFamily:sans, fontSize:11.5, letterSpacing:"0.16em", textTransform:"uppercase", color:C.brass, fontWeight:700, marginTop:6 }}>{children}</div>; }
function H2({ children })     { return <h2 style={{ fontFamily:serif, fontSize:26, fontWeight:500, color:C.pine, margin:"8px 0 0", lineHeight:1.12, letterSpacing:"-0.01em" }}>{children}</h2>; }
function P({ children })      { return <p style={{ fontFamily:sans, fontSize:14, color:C.muted, lineHeight:1.5, margin:"8px 0 0" }}>{children}</p>; }
function InfoTag({ children }) { return <span style={{ fontFamily:sans, fontSize:10.5, letterSpacing:"0.08em", textTransform:"uppercase", color:C.brass, background:C.brass+"1A", padding:"3px 8px", borderRadius:20, fontWeight:700 }}>{children}</span>; }
function LiveStat({ label, value }) { return <div style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:12, padding:"11px 13px" }}><div style={{ fontFamily:sans, fontSize:11, color:C.muted }}>{label}</div><div style={{ fontFamily:serif, fontSize:20, fontWeight:600, color:C.pine, marginTop:2 }}>{value}</div></div>; }

const rowCard  = { display:"flex", alignItems:"center", gap:13, width:"100%", padding:"14px 15px", borderRadius:14, border:`1px solid ${C.line}`, background:C.card, cursor:"pointer" };
const miniCard = { padding:"13px 12px", borderRadius:12, border:`1px solid ${C.line}`, background:C.card, cursor:"pointer", textAlign:"left" };
const chip     = { fontFamily:sans, fontSize:11, color:C.pineSoft, background:"#E7EDE3", padding:"4px 9px", borderRadius:20, fontWeight:500 };
const chipBtn  = { fontFamily:sans, fontSize:12.5, fontWeight:600, padding:"9px 13px", borderRadius:20, border:`1px solid ${C.line}`, cursor:"pointer" };
const iconBtn  = { width:32, height:32, borderRadius:10, border:`1px solid ${C.line}`, background:C.card, display:"grid", placeItems:"center", cursor:"pointer" };
const textLink = { fontFamily:sans, fontSize:13, fontWeight:600, color:C.pine, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:3, padding:0 };
