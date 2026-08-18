// The Ethical Portfolio Analyzer — the whole app, one file.
//
// Flow: sign in → pick the ethical lines you care about → connect your brokerage
// (read-only, via SnapTrade) → see which holdings conflict, and why.
//
// We never trade and never move money. This is a read-and-explain tool.

import { useEffect, useState } from "react";

// ── Design tokens (kept in the family of the existing brand) ──────────────────
const C = {
  bg: "#F3EEE2", card: "#FBF8F0", line: "#E4DDCB",
  pine: "#14271F", pineSoft: "#1E3A2E", teal: "#0E6B57",
  ink: "#2C332E", muted: "#6B7168", faint: "#9AA095",
  brass: "#B48A4A", brassSoft: "#D8B67E", cream: "#F7F3E9",
  flag: "#B0563F", flagTint: "#B0563F14", good: "#3F7D5A",
};
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const serif = "'Iowan Old Style', Georgia, 'Times New Roman', serif";

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
  useEffect(() => {
    api("/api/me").then((d) => setUser(d.user)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <Splash />;
  if (!user) return <Auth onAuthed={setUser} />;
  return <Dashboard user={user} onSignOut={() => setUser(null)} />;
}

function Splash() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: C.pine }}>
      <span style={{ fontFamily: serif, fontSize: 26, color: C.brassSoft, letterSpacing: "-0.02em" }}>Steward</span>
    </div>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function Auth({ onAuthed }) {
  const [mode, setMode] = useState("signup"); // signup | login
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
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "64px 24px" }}>
        <h1 style={{ fontFamily: serif, fontSize: 30, color: C.pine, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p style={{ fontFamily: sans, fontSize: 14.5, color: C.muted, margin: "0 0 24px", lineHeight: 1.5 }}>
          See what's really inside your portfolio.
        </p>
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <div style={{ height: 12 }} />
        <Field label="Password" type="password" value={password} onChange={setPassword}
          placeholder={mode === "signup" ? "At least 10 characters" : "Your password"}
          onEnter={submit} />
        {err && <div style={{ marginTop: 12, fontFamily: sans, fontSize: 13, color: C.flag, background: C.flagTint, padding: "10px 12px", borderRadius: 10 }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={primaryBtn}>{busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}</button>
        <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); }}
          style={{ ...textBtn, marginTop: 16, display: "block", width: "100%", textAlign: "center" }}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </Shell>
  );
}

// ── Dashboard: the three steps ─────────────────────────────────────────────────
function Dashboard({ user, onSignOut }) {
  const [screens, setScreens] = useState(null);   // catalogue
  const [selected, setSelected] = useState(new Set());
  const [saved, setSaved] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Load the screen catalogue and any existing analysis on mount.
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

  // If we just came back from the SnapTrade portal (?connected=1), poll for holdings.
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
    if (analysis) refresh(); // re-screen existing holdings against the new selection
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
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 80px" }}>

        {/* Step 1 — flags */}
        <Section n="1" title="Choose your ethical lines" sub="Turn on the ones you care about. We only flag what you flag.">
          {!screens ? <Muted>Loading…</Muted> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              {screens.map((s) => {
                const on = selected.has(s.key);
                return (
                  <button key={s.key} onClick={() => toggle(s.key)} style={{
                    textAlign: "left", cursor: "pointer", borderRadius: 14, padding: "13px 14px",
                    border: `1.5px solid ${on ? C.teal : C.line}`, background: on ? "#0E6B5710" : C.card,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink }}>{s.label}</span>
                      <span style={{ fontFamily: sans, fontSize: 15, color: on ? C.teal : C.faint }}>{on ? "✓" : "+"}</span>
                    </div>
                    <div style={{ fontFamily: sans, fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{s.blurb}</div>
                    <div style={{ fontFamily: sans, fontSize: 11, color: C.faint, marginTop: 6 }}>{s.count} companies tracked</div>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={saveScreens} disabled={!selected.size} style={{ ...primaryBtn, marginTop: 0, width: "auto", padding: "11px 20px", opacity: selected.size ? 1 : 0.5 }}>
              Save {selected.size ? `(${selected.size})` : ""}
            </button>
            {saved && <span style={{ fontFamily: sans, fontSize: 13, color: C.good }}>Saved ✓</span>}
          </div>
        </Section>

        {/* Step 2 — connect */}
        <Section n="2" title="Connect your brokerage" sub="Read-only, through SnapTrade. We can see your holdings — never trade, never move money.">
          {analysis ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: sans, fontSize: 14, color: C.ink }}>
              <span style={{ color: C.good, fontWeight: 700 }}>✓ Connected</span>
              <span style={{ color: C.muted }}>· {analysis.accounts.map((a) => a.name).join(", ")}</span>
              <button onClick={connect} style={{ ...textBtn, marginLeft: "auto" }}>Reconnect</button>
            </div>
          ) : loading ? (
            <Muted>Reading your holdings… this can take a few seconds.</Muted>
          ) : (
            <>
              <button onClick={connect} style={{ ...primaryBtn, marginTop: 0, width: "auto", padding: "13px 22px" }}>
                Connect brokerage →
              </button>
              <p style={{ fontFamily: sans, fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
                You'll authorize the connection on SnapTrade, then come back here. Supports Robinhood,
                Schwab, Fidelity, E*TRADE, Webull, and more.
              </p>
            </>
          )}
          {err && <div style={{ marginTop: 12, fontFamily: sans, fontSize: 13, color: C.flag, background: C.flagTint, padding: "10px 12px", borderRadius: 10 }}>{err}</div>}
        </Section>

        {/* Step 3 — results */}
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
      {/* headline */}
      <div style={{ background: C.pine, borderRadius: 16, padding: "20px 22px", color: C.cream, marginBottom: 16 }}>
        {clean ? (
          <div style={{ fontFamily: serif, fontSize: 22, letterSpacing: "-0.01em" }}>
            No conflicts among the names we track.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: sans, fontSize: 13, color: C.brassSoft, fontWeight: 600 }}>Conflicts found</div>
            <div style={{ fontFamily: serif, fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 2 }}>
              {money(summary.conflictedValueCents)}
            </div>
            <div style={{ fontFamily: sans, fontSize: 13.5, color: "#C9D6CE", marginTop: 2 }}>
              across {summary.conflictedCount} holding{summary.conflictedCount === 1 ? "" : "s"} · {summary.conflictedPct}% of your portfolio
            </div>
          </>
        )}
      </div>

      {/* per-flag exposure */}
      {summary.byFlag.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {summary.byFlag.map((f) => (
            <span key={f.key} style={{ fontFamily: sans, fontSize: 12.5, fontWeight: 600, color: C.flag, background: C.flagTint, borderRadius: 20, padding: "6px 12px" }}>
              {f.label}: {money(f.valueCents)}
            </span>
          ))}
        </div>
      )}

      {/* conflicted holdings, detailed */}
      {conflicted.map((h) => (
        <div key={h.account + h.symbol} style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.flag}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10, background: C.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div>
              <span style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: C.ink }}>{h.symbol}</span>
              <span style={{ fontFamily: sans, fontSize: 13, color: C.muted }}> · {h.description}</span>
            </div>
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: C.ink }}>{money(h.valueCents)}</span>
          </div>
          <div style={{ fontFamily: sans, fontSize: 11.5, color: C.faint, marginTop: 1 }}>{h.account} · {h.units} shares</div>
          <div style={{ marginTop: 9, display: "grid", gap: 6 }}>
            {h.flags.map((f) => (
              <div key={f.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: C.flag, background: C.flagTint, borderRadius: 6, padding: "2px 7px", flexShrink: 0, whiteSpace: "nowrap" }}>{f.label}</span>
                <span style={{ fontFamily: sans, fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>{f.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* the honest footer — what we did and didn't judge */}
      <div style={{ marginTop: 14, padding: "13px 15px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <div style={{ fontFamily: sans, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          We screened <b style={{ color: C.ink }}>{summary.analyzedCount}</b> individual stock{summary.analyzedCount === 1 ? "" : "s"} against a
          curated list of widely-held companies. We did <b>not</b> look inside your{" "}
          <b style={{ color: C.ink }}>{summary.fundCount}</b> fund{summary.fundCount === 1 ? "" : "s"} — a broad index fund holds
          hundreds of companies, and we don't claim to see inside one yet. A clean result means
          "none of the names we track," not "audited clean."
        </div>
      </div>

      {/* full holdings list, muted */}
      <details style={{ marginTop: 14 }}>
        <summary style={{ fontFamily: sans, fontSize: 13, color: C.teal, cursor: "pointer", fontWeight: 600 }}>
          See all {holdings.length} holdings
        </summary>
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {holdings.map((h) => (
            <div key={h.account + h.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: sans, fontSize: 13, padding: "7px 2px", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ color: C.ink }}>
                <b>{h.symbol}</b> <span style={{ color: C.muted }}>{h.description}</span>
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {h.conflicted ? <span style={{ color: C.flag, fontSize: 11, fontWeight: 700 }}>● flagged</span>
                  : h.analyzable ? <span style={{ color: C.good, fontSize: 11 }}>clear</span>
                  : <span style={{ color: C.faint, fontSize: 11 }}>not analyzed</span>}
                <span style={{ color: C.muted, minWidth: 76, textAlign: "right" }}>{money(h.valueCents)}</span>
              </span>
            </div>
          ))}
        </div>
      </details>
    </Section>
  );
}

// ── Small shared pieces ─────────────────────────────────────────────────────────
function Shell({ children }) {
  return <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: sans, color: C.ink }}>{children}</div>;
}
function TopBar({ email, onSignOut }) {
  const signOut = async () => { try { await api("/api/logout", { method: "POST" }); } catch { /* noop */ } onSignOut(); };
  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, background: "#F7F5F1" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.pine, letterSpacing: "-0.02em" }}>Steward</span>
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
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: serif, fontSize: 15, color: C.brass, fontWeight: 700 }}>{n}</span>
        <h2 style={{ fontFamily: serif, fontSize: 21, color: C.pine, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
      </div>
      {sub && <p style={{ fontFamily: sans, fontSize: 13.5, color: C.muted, margin: "5px 0 14px", lineHeight: 1.5 }}>{sub}</p>}
      {!sub && <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}
function Field({ label, type = "text", value, onChange, placeholder, onEnter }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontFamily: sans, fontSize: 11.5, color: C.muted, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
        style={{ width: "100%", fontFamily: sans, fontSize: 14, color: C.ink, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 13px", outline: "none" }} />
    </label>
  );
}
const Muted = ({ children }) => <div style={{ fontFamily: sans, fontSize: 13.5, color: C.muted }}>{children}</div>;
const primaryBtn = { marginTop: 20, width: "100%", background: C.teal, color: "#fff", border: "none", borderRadius: 11, padding: "13px 18px", fontFamily: sans, fontSize: 15, fontWeight: 700, cursor: "pointer" };
const textBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.teal };
