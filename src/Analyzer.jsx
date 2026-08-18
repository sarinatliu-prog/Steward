// The Ethical Portfolio Analyzer — the whole app, one file.
//
// Flow: sign in → pick the ethical lines you care about → connect your brokerage
// (read-only, via SnapTrade) → see which holdings conflict, and why.
//
// We never trade and never move money. This is a read-and-explain tool.
//
// Visual language: "green liquid glass" — frosted translucent panels floating over a
// deep-green gradient canvas, with soft depth and a restrained brass accent.

import { useEffect, useState } from "react";

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  ink: "#EAF3EE", muted: "#9FB6AB", faint: "#708C7F",
  mint: "#63D6A6", emerald: "#0E6B57", brass: "#D8B67E", brassSoft: "#ECD6A6",
  glass: "rgba(255,255,255,0.055)",
  glassStrong: "rgba(255,255,255,0.10)",
  glassBorder: "rgba(255,255,255,0.14)",
  flag: "#F2A98F", flagBg: "rgba(238,120,86,0.13)", flagBorder: "rgba(238,120,86,0.34)",
  good: "#63D6A6",
};
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const serif = "'Iowan Old Style', Georgia, 'Times New Roman', serif";

// Reusable frosted-glass surface. saturate + blur is what gives the "liquid" read.
const glass = (o = {}) => ({
  background: C.glass,
  backdropFilter: "blur(22px) saturate(150%)",
  WebkitBackdropFilter: "blur(22px) saturate(150%)",
  border: `1px solid ${C.glassBorder}`,
  borderRadius: 20,
  boxShadow: "0 14px 44px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.09)",
  ...o,
});

// ── Tiny API helper ───────────────────────────────────────────────────────────
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const money = (cents) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Analyzer() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [showAuth, setShowAuth] = useState(false);
  useEffect(() => {
    api("/api/me").then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <Splash />;
  if (user) return <Dashboard user={user} onSignOut={() => { setUser(null); setShowAuth(false); }} />;
  if (showAuth) return <Auth onAuthed={setUser} onBack={() => setShowAuth(false)} />;
  return <Landing onStart={() => setShowAuth(true)} />;
}

// ── The canvas: deep-green gradient + floating blurred orbs ──────────────────
function Canvas() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", background: "#081410" }}>
      <div style={{ position: "absolute", inset: 0, background:
        "radial-gradient(1200px 700px at 12% -8%, #124d3c 0%, transparent 55%)," +
        "radial-gradient(1000px 800px at 92% 8%, #0b5f4c 0%, transparent 50%)," +
        "radial-gradient(1100px 900px at 60% 110%, #0d3b2e 0%, transparent 55%)," +
        "linear-gradient(160deg, #0a1f18 0%, #081712 60%, #060f0c 100%)" }} />
      {/* soft orbs give the glass something to refract */}
      <Orb x="8%" y="14%" s={340} c="rgba(99,214,166,0.16)" />
      <Orb x="82%" y="22%" s={420} c="rgba(14,107,87,0.30)" />
      <Orb x="66%" y="82%" s={380} c="rgba(216,182,126,0.10)" />
      {/* faint top sheen */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240,
        background: "linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)" }} />
    </div>
  );
}
const Orb = ({ x, y, s, c }) => (
  <div style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: "50%",
    background: c, filter: "blur(90px)", transform: "translate(-50%,-50%)" }} />
);

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100dvh", fontFamily: sans, color: C.ink, position: "relative" }}>
      <Canvas />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function Splash() {
  return (
    <Shell>
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <span style={{ fontFamily: serif, fontSize: 28, color: C.brassSoft, letterSpacing: "-0.02em" }}>Steward</span>
      </div>
    </Shell>
  );
}

// ── Landing ─────────────────────────────────────────────────────────────────
function Landing({ onStart }) {
  const wrap = { maxWidth: 980, margin: "0 auto", padding: "0 24px" };
  const steps = [
    { n: "01", t: "Choose your lines", b: "Fossil fuels, weapons, tobacco, surveillance, gambling — turn on the ones you care about. We only ever flag what you flag." },
    { n: "02", t: "Connect, read-only", b: "Link your brokerage through SnapTrade. We can see your holdings — we can never trade them or move your money." },
    { n: "03", t: "See what you own", b: "The individual stocks that cross your lines, each with a plain reason. No score to argue with — just the facts." },
  ];
  return (
    <Shell>
      <nav style={{ ...glass({ borderRadius: 0, boxShadow: "none", background: "rgba(255,255,255,0.03)", borderLeft: "none", borderRight: "none", borderTop: "none" }), position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px" }}>
          <span style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Steward</span>
          <button onClick={onStart} style={brassBtn(9, "9px 18px", 14)}>Get started</button>
        </div>
      </nav>

      <header>
        <div style={{ ...wrap, textAlign: "center", padding: "clamp(72px,12vw,132px) 24px" }}>
          <p style={{ fontFamily: sans, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: C.brassSoft, marginBottom: 22 }}>The ethical portfolio analyzer</p>
          <h1 style={{ fontFamily: serif, fontWeight: 800, fontSize: "clamp(40px,7.5vw,74px)", lineHeight: 1.02, margin: 0, letterSpacing: "-0.045em", color: "#F4FAF6" }}>
            You don't know<br /><span style={{ color: C.mint }}>what you own.</span>
          </h1>
          <p style={{ fontFamily: sans, fontSize: "clamp(16px,2vw,19px)", lineHeight: 1.55, color: C.muted, margin: "26px auto 0", maxWidth: 520 }}>
            Connect your brokerage and we'll show you which of your holdings cross the ethical lines you care about — and exactly why.
          </p>
          <div style={{ marginTop: 38, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onStart} style={brassBtn(14, "16px 32px", 16)}>Analyze my portfolio →</button>
          </div>
          <p style={{ fontFamily: sans, fontSize: 12.5, color: C.faint, marginTop: 20 }}>Read-only. We never trade, and never move your money.</p>
        </div>
      </header>

      <section style={{ ...wrap, padding: "clamp(20px,4vw,40px) 24px clamp(56px,9vw,96px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 18 }}>
          {steps.map((s) => (
            <div key={s.n} style={glass({ padding: "26px 24px" })}>
              <div style={{ fontFamily: serif, fontSize: 15, color: C.brassSoft, fontWeight: 700, marginBottom: 10 }}>{s.n}</div>
              <div style={{ fontFamily: serif, fontSize: 21, color: C.ink, fontWeight: 700, letterSpacing: "-0.01em" }}>{s.t}</div>
              <p style={{ fontFamily: sans, fontSize: 14, color: C.muted, lineHeight: 1.6, margin: "11px 0 0" }}>{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...wrap, maxWidth: 720, padding: "0 24px clamp(56px,9vw,96px)" }}>
        <div style={glass({ padding: "clamp(34px,5vw,52px)", textAlign: "center" })}>
          <h2 style={{ fontFamily: serif, fontSize: "clamp(24px,4vw,34px)", color: C.ink, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>We'd rather under-claim than mislead.</h2>
          <p style={{ fontFamily: sans, fontSize: 16, color: C.muted, lineHeight: 1.7, margin: "18px 0 0" }}>
            We screen individual stocks against a curated list of companies, and tell you the reason for every flag. We don't look inside broad index funds and pretend we can — an unanalyzed fund is marked as such, not called clean. A clean result means "none of the names we track," never "audited pure." You draw the lines; we just show you where your money already sits.
          </p>
        </div>
      </section>

      <section style={{ ...wrap, textAlign: "center", padding: "0 24px clamp(64px,10vw,110px)" }}>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4.5vw,42px)", color: C.ink, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>See what you own.</h2>
        <button onClick={onStart} style={brassBtn(14, "16px 32px", 16)}>Get started</button>
      </section>

      <footer style={{ ...wrap, borderTop: `1px solid ${C.glassBorder}`, padding: "22px 24px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.muted }}>Steward</span>
        <span style={{ fontFamily: sans, fontSize: 12.5, color: C.faint }}>Read-only portfolio analysis. Not investment advice.</span>
      </footer>
    </Shell>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function Auth({ onAuthed, onBack }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const d = await api(mode === "signup" ? "/api/signup" : "/api/login", { method: "POST", body: { email, password } });
      onAuthed(d.user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Shell>
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "40px 20px" }}>
        <div style={glass({ width: "100%", maxWidth: 420, padding: "34px 32px" })}>
          {onBack && <button onClick={onBack} style={{ ...textBtn, marginBottom: 20, color: C.muted }}>← Back</button>}
          <h1 style={{ fontFamily: serif, fontSize: 30, color: C.ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p style={{ fontFamily: sans, fontSize: 14.5, color: C.muted, margin: "0 0 24px", lineHeight: 1.5 }}>
            See what's really inside your portfolio.
          </p>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <div style={{ height: 12 }} />
          <Field label="Password" type="password" value={password} onChange={setPassword}
            placeholder={mode === "signup" ? "At least 10 characters" : "Your password"} onEnter={submit} />
          {err && <ErrBox>{err}</ErrBox>}
          <button onClick={submit} disabled={busy} style={{ ...mintBtn(), marginTop: 20, width: "100%" }}>
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); }}
            style={{ ...textBtn, marginTop: 16, display: "block", width: "100%", textAlign: "center" }}>
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ user, onSignOut }) {
  const [screens, setScreens] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [saved, setSaved] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/screens").then((d) => setScreens(d.screens)).catch(() => {});
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      const d = await api("/api/analysis");
      if (d.connected) setAnalysis(d);
      if (Array.isArray(d.screens) && d.screens.length) setSelected(new Set(d.screens));
    } catch { /* not connected yet */ }
  };

  useEffect(() => {
    if (new URLSearchParams(location.search).get("connected") !== "1") return;
    history.replaceState({}, "", "/");
    setLoading(true);
    let tries = 0;
    const id = setInterval(async () => {
      tries++;
      try {
        const d = await api("/api/analysis");
        if (d.connected) { setAnalysis(d); setLoading(false); clearInterval(id); }
      } catch { /* keep trying */ }
      if (tries > 12) { setLoading(false); clearInterval(id); }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const toggle = (key) => {
    setSaved(false);
    setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };
  const saveScreens = async () => {
    await api("/api/screens/select", { method: "POST", body: { screens: [...selected] } });
    setSaved(true);
    if (analysis) refresh();
  };
  const connect = async () => {
    setErr("");
    try {
      const { url } = await api("/api/brokerage/connect", { method: "POST" });
      window.location.href = url;
    } catch (e) { setErr(e.message); }
  };

  return (
    <Shell>
      <TopBar onSignOut={onSignOut} email={user.email} />
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "26px 20px 90px" }}>

        <Section n="1" title="Choose your ethical lines" sub="Turn on the ones you care about. We only flag what you flag.">
          {!screens ? <Muted>Loading…</Muted> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(226px,1fr))", gap: 11 }}>
              {screens.map((s) => {
                const on = selected.has(s.key);
                return (
                  <button key={s.key} onClick={() => toggle(s.key)} style={glass({
                    textAlign: "left", cursor: "pointer", padding: "14px 15px", borderRadius: 16,
                    background: on ? "rgba(99,214,166,0.14)" : C.glass,
                    border: `1px solid ${on ? "rgba(99,214,166,0.45)" : C.glassBorder}`,
                    boxShadow: on ? "0 8px 30px -14px rgba(99,214,166,0.5), inset 0 1px 0 rgba(255,255,255,0.10)" : "inset 0 1px 0 rgba(255,255,255,0.07)",
                    transition: "all .15s ease",
                  })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink }}>{s.label}</span>
                      <span style={{ fontFamily: sans, fontSize: 15, color: on ? C.mint : C.faint }}>{on ? "✓" : "+"}</span>
                    </div>
                    <div style={{ fontFamily: sans, fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>{s.blurb}</div>
                    <div style={{ fontFamily: sans, fontSize: 11, color: C.faint, marginTop: 7 }}>{s.count} companies tracked</div>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={saveScreens} disabled={!selected.size} style={{ ...mintBtn(), opacity: selected.size ? 1 : 0.45 }}>
              Save {selected.size ? `(${selected.size})` : ""}
            </button>
            {saved && <span style={{ fontFamily: sans, fontSize: 13, color: C.good }}>Saved ✓</span>}
          </div>
        </Section>

        <Section n="2" title="Connect your brokerage" sub="Read-only, through SnapTrade. We can see your holdings — never trade, never move money.">
          {analysis ? (
            <div style={glass({ padding: "15px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" })}>
              <span style={{ color: C.good, fontWeight: 700, fontFamily: sans, fontSize: 14 }}>✓ Connected</span>
              <span style={{ color: C.muted, fontFamily: sans, fontSize: 14 }}>· {analysis.accounts.map((a) => a.name).join(", ")}</span>
              <button onClick={connect} style={{ ...textBtn, marginLeft: "auto" }}>Reconnect</button>
            </div>
          ) : loading ? (
            <div style={glass({ padding: "15px 18px" })}><Muted>Reading your holdings… this can take a few seconds.</Muted></div>
          ) : (
            <>
              <button onClick={connect} style={brassBtn(12, "14px 24px", 15)}>Connect brokerage →</button>
              <p style={{ fontFamily: sans, fontSize: 12, color: C.faint, marginTop: 11, lineHeight: 1.5 }}>
                You'll authorize the connection on SnapTrade, then come back here. Supports Robinhood, Schwab, Fidelity, E*TRADE, Webull, and more.
              </p>
            </>
          )}
          {err && <ErrBox>{err}</ErrBox>}
        </Section>

        {analysis && <Results analysis={analysis} />}
      </div>
    </Shell>
  );
}

function Results({ analysis }) {
  const { summary, conflicted, holdings } = analysis;
  const clean = summary.conflictedCount === 0 && summary.analyzedCount > 0;

  return (
    <Section n="3" title="What we found" sub={null}>
      {/* headline panel with a green inner glow */}
      <div style={glass({ padding: "24px 24px", marginBottom: 16, position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, rgba(14,107,87,0.28), rgba(255,255,255,0.05))" })}>
        {clean ? (
          <div style={{ fontFamily: serif, fontSize: 23, letterSpacing: "-0.01em", color: C.ink }}>
            No conflicts among the names we track.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: sans, fontSize: 13, color: C.brassSoft, fontWeight: 600 }}>Conflicts found</div>
            <div style={{ fontFamily: serif, fontSize: 38, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 3, color: "#F4FAF6" }}>
              {money(summary.conflictedValueCents)}
            </div>
            <div style={{ fontFamily: sans, fontSize: 13.5, color: C.muted, marginTop: 3 }}>
              across {summary.conflictedCount} holding{summary.conflictedCount === 1 ? "" : "s"} · {summary.conflictedPct}% of your portfolio
            </div>
          </>
        )}
      </div>

      {summary.byFlag.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {summary.byFlag.map((f) => (
            <span key={f.key} style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 600, color: C.flag,
              background: C.flagBg, border: `1px solid ${C.flagBorder}`, borderRadius: 20, padding: "6px 13px" }}>
              {f.label}: {money(f.valueCents)}
            </span>
          ))}
        </div>
      )}

      {conflicted.map((h) => (
        <div key={h.account + h.symbol} style={glass({ padding: "15px 17px", marginBottom: 10,
          borderLeft: `3px solid ${C.flag}` })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div>
              <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.ink }}>{h.symbol}</span>
              <span style={{ fontFamily: sans, fontSize: 13, color: C.muted }}> · {h.description}</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink }}>{money(h.valueCents)}</span>
          </div>
          <div style={{ fontFamily: sans, fontSize: 11.5, color: C.faint, marginTop: 2 }}>{h.account} · {h.units} shares</div>
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {h.flags.map((f) => (
              <div key={f.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: C.flag, background: C.flagBg,
                  border: `1px solid ${C.flagBorder}`, borderRadius: 6, padding: "2px 7px", flexShrink: 0, whiteSpace: "nowrap" }}>{f.label}</span>
                <span style={{ fontFamily: sans, fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>{f.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={glass({ padding: "14px 16px", marginTop: 14, background: "rgba(255,255,255,0.035)" })}>
        <div style={{ fontFamily: sans, fontSize: 12.5, color: C.muted, lineHeight: 1.65 }}>
          We screened <b style={{ color: C.ink }}>{summary.analyzedCount}</b> individual stock{summary.analyzedCount === 1 ? "" : "s"} against a
          curated list of widely-held companies. We did <b>not</b> look inside your{" "}
          <b style={{ color: C.ink }}>{summary.fundCount}</b> fund{summary.fundCount === 1 ? "" : "s"} — a broad index fund holds
          hundreds of companies, and we don't claim to see inside one yet. A clean result means
          "none of the names we track," not "audited clean."
        </div>
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ fontFamily: sans, fontSize: 13, color: C.mint, cursor: "pointer", fontWeight: 600 }}>
          See all {holdings.length} holdings
        </summary>
        <div style={glass({ marginTop: 10, padding: "6px 16px" })}>
          {holdings.map((h, i) => (
            <div key={h.account + h.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: sans, fontSize: 13, padding: "9px 2px", borderBottom: i < holdings.length - 1 ? `1px solid rgba(255,255,255,0.08)` : "none" }}>
              <span style={{ color: C.ink }}>
                <b>{h.symbol}</b> <span style={{ color: C.muted }}>{h.description}</span>
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {h.conflicted ? <span style={{ color: C.flag, fontSize: 11, fontWeight: 700 }}>● flagged</span>
                  : h.analyzable ? <span style={{ color: C.good, fontSize: 11 }}>clear</span>
                  : <span style={{ color: C.faint, fontSize: 11 }}>not analyzed</span>}
                <span style={{ color: C.muted, minWidth: 78, textAlign: "right" }}>{money(h.valueCents)}</span>
              </span>
            </div>
          ))}
        </div>
      </details>
    </Section>
  );
}

// ── Shared pieces ─────────────────────────────────────────────────────────────
function TopBar({ email, onSignOut }) {
  const signOut = async () => { try { await api("/api/logout", { method: "POST" }); } catch { /* noop */ } onSignOut(); };
  return (
    <div style={{ ...glass({ borderRadius: 0, boxShadow: "none", background: "rgba(255,255,255,0.03)", borderLeft: "none", borderRight: "none", borderTop: "none" }), position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>Steward</span>
        <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: sans, fontSize: 12.5, color: C.muted }}>{email}</span>
          <button onClick={signOut} style={textBtn}>Sign out</button>
        </span>
      </div>
    </div>
  );
}
function Section({ n, title, sub, children }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 11 }}>
        <span style={{ fontFamily: serif, fontSize: 15, color: C.brassSoft, fontWeight: 700 }}>{n}</span>
        <h2 style={{ fontFamily: serif, fontSize: 22, color: C.ink, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
      </div>
      {sub && <p style={{ fontFamily: sans, fontSize: 13.5, color: C.muted, margin: "6px 0 15px", lineHeight: 1.5 }}>{sub}</p>}
      {!sub && <div style={{ height: 13 }} />}
      {children}
    </section>
  );
}
function Field({ label, type = "text", value, onChange, placeholder, onEnter }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontFamily: sans, fontSize: 11.5, color: C.muted, marginBottom: 5 }}>{label}</div>
      <input type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
        style={{ width: "100%", fontFamily: sans, fontSize: 14, color: C.ink,
          background: "rgba(255,255,255,0.06)", border: `1px solid ${C.glassBorder}`, borderRadius: 11,
          padding: "12px 13px", outline: "none",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
    </label>
  );
}
const Muted = ({ children }) => <div style={{ fontFamily: sans, fontSize: 13.5, color: C.muted }}>{children}</div>;
const ErrBox = ({ children }) => (
  <div style={{ marginTop: 12, fontFamily: sans, fontSize: 13, color: C.flag,
    background: C.flagBg, border: `1px solid ${C.flagBorder}`, padding: "10px 12px", borderRadius: 10 }}>{children}</div>
);

// Buttons — a mint "glass pill" primary and a brass CTA.
const mintBtn = () => ({
  background: "linear-gradient(180deg, rgba(99,214,166,0.95), rgba(14,107,87,0.95))",
  color: "#06231A", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 12,
  padding: "12px 20px", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 8px 24px -10px rgba(99,214,166,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
});
const brassBtn = (r = 12, pad = "14px 24px", fs = 15) => ({
  backgroundImage: "linear-gradient(180deg, #E7CE9E, #C9A16A)",
  color: "#241A0A", border: "1px solid rgba(255,255,255,0.3)", borderRadius: r,
  padding: pad, fontFamily: sans, fontSize: fs, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 8px 24px -10px rgba(216,182,126,0.6), inset 0 1px 0 rgba(255,255,255,0.45)",
});
const textBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.mint };
