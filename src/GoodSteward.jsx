import React, { useState, useMemo, useEffect } from "react";
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
    if (ok) setUser(data.user); return { ok, error: data.error };
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
  const refresh = () =>
    fetch("/api/portfolio").then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, []);
  const addPurchase = () =>
    fetch("/api/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d); }).catch(() => {});
  const setConfig = (cfg) =>
    fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) })
      .then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d); }).catch(() => {});
  return { data, addPurchase, setConfig };
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
  const { user, setUser, signup, login, logout } = useAuth();
  const { data: live, addPurchase, setConfig } = useLiveData();

  const framework = frameworks[0];
  const fw = FRAMEWORKS[framework];
  const sc = SCREENS[screen];

  // Drive the stage from auth: signed out → welcome; signed in without a profile →
  // onboarding; fully set up → the app.
  useEffect(() => {
    if (user === undefined) return;
    if (!user) setStage("welcome");
    else if (!user.hasProfile) setStage("onboard");
    else setStage("app");
  }, [user]);

  // Finish onboarding: send profile + chosen framework, create the sandbox account.
  const openAccount = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          config: { framework: fw.name, holdings: fw.holdings.map(h => ({ symbol: h.t, a: h.a })), tithePct: pct, contribution, screen },
        }),
      });
      if (res.ok) setUser(u => ({ ...u, hasProfile: true })); // → stage effect moves to app
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
        <Scale size={30} color={C.brassSoft} strokeWidth={1.5} />
      </div>
    </Frame>
  );

  /* ── AUTH (sign up / log in) ── */
  if (!user && stage === "auth") return <AuthScreen signup={signup} login={login} onBack={() => setStage("welcome")} />;

  /* ── WELCOME ── */
  if (stage === "welcome") return (
    <Frame>
      <FontInjector />
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"44px 28px 36px", background:`radial-gradient(120% 80% at 50% 0%, ${C.pineSoft} 0%, ${C.pine} 55%, #14271F 100%)`, color:"#F3EEE2", position:"relative", overflow:"hidden" }}>
        <Grain />
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <Scale size={20} color={C.brassSoft} strokeWidth={1.6} />
            <span style={{ fontFamily:sans, letterSpacing:"0.22em", fontSize:11, textTransform:"uppercase", color:C.brassSoft }}>Good Steward</span>
          </div>
        </div>
        <div style={{ position:"relative", zIndex:1 }}>
          <p style={{ fontFamily:sans, fontSize:12.5, letterSpacing:"0.16em", textTransform:"uppercase", color:C.brassSoft, marginBottom:18 }}>A stewardship layer for your money</p>
          <h1 style={{ fontFamily:serif, fontWeight:500, fontSize:39, lineHeight:1.06, margin:0, letterSpacing:"-0.01em" }}>Money is<br /><em style={{ color:C.brassSoft, fontStyle:"italic" }}>stored agency.</em></h1>
          <p style={{ fontFamily:sans, fontSize:15, lineHeight:1.55, color:"#D9D2C2", marginTop:18, maxWidth:300 }}>Invest it to reduce foreseeable harm, accept that perfect purity is impossible, and redirect the residue toward human flourishing.</p>
        </div>
        <div style={{ position:"relative", zIndex:1 }}>
          <Btn onClick={() => setStage("auth")} dark>Begin <ChevronRight size={17} /></Btn>
          <p style={{ fontFamily:sans, fontSize:11.5, color:"#9FB3A4", textAlign:"center", marginTop:14 }}>No claim of moral purity. Ethical investing is asymptotic.</p>
        </div>
      </div>
    </Frame>
  );

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
              {step > 0 && <button onClick={() => setStep(step-1)} style={iconBtn}><ChevronLeft size={18} color={C.pine} /></button>}
              <Dots n={steps.length} active={step} />
            </div>
          </div>
          <div style={{ flex:1, overflowY:"scroll", overflowX:"hidden", padding:"0 22px 20px", WebkitOverflowScrolling:"touch" }}>
            {steps[step]()}
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
  return (
    <Frame>
      <FontInjector />
      <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden" }}>
        <div style={{ flex:1, overflowY:"auto", paddingBottom:8 }}>
          {tab === "home"      && renderHome()}
          {tab === "portfolio" && renderPortfolio()}
          {tab === "impact"    && renderImpact()}
          {tab === "report"    && renderReport()}
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
        <P>Risk tolerance shapes the equity-to-bond balance. You can change it anytime.</P>
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
              <button onClick={() => setShowRoundupsInfo(v => !v)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"grid", placeItems:"center" }}>
                <Info size={14} color={showRoundupsInfo ? C.pine : C.muted} />
              </button>
            </div>
            <div onClick={() => setRoundups(v => !v)} style={{ width:44, height:26, borderRadius:13, background:roundups ? C.pine : C.line, cursor:"pointer", position:"relative", transition:"background .25s", flexShrink:0 }}>
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
        <P>Select one or more. Your portfolio will be screened against all chosen standards.</P>
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
        <P>Perfect disentanglement is impossible. Automatically route a share toward human flourishing.</P>
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
        <P>We use this to open your account with our brokerage partner (Alpaca). This is a sandbox — it creates a real test account, no real money or identity.</P>
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
        <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.5, marginTop:14 }}>
          By continuing you agree to the customer agreement. No real KYC or money is used in sandbox.
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
              <div style={{ fontFamily:serif, fontSize:40, fontWeight:500, marginTop:4, letterSpacing:"-0.01em" }}>{live ? live.display.portfolioValue : fmt(14820)}</div>
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
              <Row icon={Wallet} label={`Live · Alpaca ${live.mode === "alpaca" ? "sandbox" : "demo"}`} right={
                <InfoTag>{live.mode === "alpaca" ? "real account" : "simulated"}</InfoTag>
              } />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
                <LiveStat label={`Invested · ${live.etf}`} value={live.display.invested} />
                <LiveStat label="In clearing" value={live.display.clearing} />
                <LiveStat label="Rounded up (mo)" value={live.display.roundupsThisMonth} />
                <LiveStat label={live.display.pending ? "Pending (settling)" : "Orders placed"}
                          value={live.display.pending ?? String(live.ordersPlaced)} />
              </div>
              {live.display.pending && (
                <p style={{ fontFamily:sans, fontSize:11.5, color:C.muted, lineHeight:1.5, margin:"10px 0 0" }}>
                  {live.display.pending} of round-ups is queued to invest — Alpaca's sandbox bank transfer is still settling. It auto-invests the moment funds land.
                </p>
              )}
            </Card>
          )}

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
              Your actual holdings and orders (below and in your statement) are real.
            </p>
          </Card>

          <Card>
            <Row icon={Scale} label="Moral leakage" right={<InfoTag>honest</InfoTag>} />
            <Meter label="Direct exposure removed" value={derived.reduction} color={C.good} />
            <Meter label="Residual market entanglement" value={derived.residual} color={C.warn} caption="unavoidable" />
            <p style={{ fontFamily:sans, fontSize:12.5, color:C.muted, lineHeight:1.5, margin:"10px 0 0" }}>
              Complete disentanglement is impossible. We name the residue rather than hide it — and the offset below answers it.
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
              <Scale size={22} color={C.brass} strokeWidth={1.5} style={{ margin:"0 auto" }} />
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
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError("");
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
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <Scale size={22} color={C.brass} strokeWidth={1.6} />
            <span style={{ fontFamily:sans, letterSpacing:"0.2em", fontSize:11, textTransform:"uppercase", color:C.brass }}>Good Steward</span>
          </div>
          <h1 style={{ fontFamily:serif, fontSize:30, fontWeight:500, color:C.pine, margin:0, letterSpacing:"-0.01em" }}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <div style={{ display:"grid", gap:10, marginTop:4 }}>
            <ProfileInput label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            <ProfileInput label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          {error && <div style={{ fontFamily:sans, fontSize:12.5, color:"#B0563F", background:"#B0563F14", padding:"9px 12px", borderRadius:10 }}>{error}</div>}
          <Btn onClick={submit}>{busy ? "…" : mode === "signup" ? "Create account" : "Sign in"} <ChevronRight size={17} /></Btn>
          <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}
            style={{ ...textLink, justifyContent:"center", alignSelf:"center" }}>
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }) {
  return (
    <div style={{ minHeight:"100vh", width:"100%", display:"flex", justifyContent:"center", alignItems:"center", padding:"20px 0", background:`repeating-linear-gradient(45deg,#E7E0D0 0 2px,#EAE3D4 2px 4px)`, fontFamily:sans }}>
      <div style={{ width:390, maxWidth:"94vw", height:800, maxHeight:"92vh", background:"#F3EEE2", borderRadius:40, overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 70px -20px rgba(20,39,31,0.5), 0 0 0 10px #14271F, 0 0 0 11px #2C4F40", position:"relative" }}>
        {children}
      </div>
    </div>
  );
}
function FontInjector() {
  return <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap'); *::-webkit-scrollbar{width:0;height:0}`}</style>;
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
