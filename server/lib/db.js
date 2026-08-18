// Multi-user persistent store.
//
// TWO BACKENDS, chosen automatically:
//
//   DATABASE_URL set  → Postgres. Durable. Use this in production.
//   otherwise         → JSON file (server/data/db.json). Fine for local dev.
//
// WHY THIS MATTERS: on Render's free plan the filesystem is EPHEMERAL and the
// service sleeps after ~15 min idle. With the JSON file, every deploy *and every
// wake-from-sleep* wipes all users, sessions, portfolios and their Alpaca account
// links — users would silently lose their accounts, and we'd orphan a brand-new
// Alpaca brokerage account on every re-signup. Postgres fixes that.
//
// The whole DB is small (a sandbox demo), so we keep it in memory and persist it
// as a single JSON blob. That keeps every call site synchronous — only boot and
// the background flush are async.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "db.json");
const DATABASE_URL = process.env.DATABASE_URL;

function empty() {
  return { users: {}, byEmail: {}, sessions: {}, waitlist: [], events: {}, meta: {}, tokens: {} };
}

let db = empty();
let pool = null;
let dirty = false;
let flushing = false;

// ── Boot: load whatever is already stored ────────────────────────────────────
//
// FAIL-SOFT BY DESIGN: if Postgres is misconfigured or unreachable, we log loudly
// and fall back to the JSON file rather than crashing. A deploy that boots with
// degraded (ephemeral) storage is recoverable; a deploy that won't boot at all,
// during a demo, is not.
export async function initDb() {
  if (DATABASE_URL) {
    try {
      const { default: pg } = await import("pg");
      pool = new pg.Pool({
        connectionString: DATABASE_URL,
        // Render's managed Postgres requires TLS with a cert Node won't verify by
        // default; this is the standard setting for their connection strings.
        ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      });
      await pool.query(`CREATE TABLE IF NOT EXISTS steward_state (
        id INT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      const { rows } = await pool.query("SELECT data FROM steward_state WHERE id = 1");
      db = rows.length ? { ...empty(), ...rows[0].data } : empty();

      // Persist on an interval rather than on every mutation, so a burst of round-ups
      // doesn't become a burst of writes.
      setInterval(() => { flush().catch(() => {}); }, 2000).unref();

      console.log(`db: postgres — ${Object.keys(db.users).length} users restored`);
      return { backend: "postgres", users: Object.keys(db.users).length };
    } catch (err) {
      pool = null;
      console.error("╔══════════════════════════════════════════════════════════════");
      console.error("║ DATABASE_URL is set but Postgres failed:");
      console.error("║   " + err.message);
      console.error("║ Falling back to the local JSON file so the app still boots.");
      console.error("║ ⚠ On Render this storage is EPHEMERAL — users will be lost");
      console.error("║   on the next deploy or wake-from-sleep. Fix the database.");
      console.error("╚══════════════════════════════════════════════════════════════");
    }
  }

  try {
    db = { ...empty(), ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch {
    db = empty();
  }
  console.log(
    `db: json file — ${Object.keys(db.users).length} users restored` +
    (DATABASE_URL ? " (DEGRADED: postgres unavailable)" : " (set DATABASE_URL for durable storage)")
  );
  return { backend: "json", users: Object.keys(db.users).length };
}

async function flush() {
  if (!dirty || flushing || !pool) return;
  flushing = true;
  dirty = false;
  try {
    await pool.query(
      `INSERT INTO steward_state (id, data, updated_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
      [JSON.stringify(db)]
    );
  } catch (err) {
    dirty = true; // retry on the next tick
    console.error("db flush failed:", err.message);
  } finally {
    flushing = false;
  }
}

function save() {
  if (pool) {
    dirty = true; // picked up by the interval flush
    return;
  }
  const dir = dirname(FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE); // atomic replace
}

/** Persist right now rather than waiting for the interval. Used for writes we can't
 *  afford to lose to a restart — e.g. the charitable account id. */
export async function flushNow() {
  if (pool) await flush();
  else save();
}

/** Force a final write (called on shutdown so we don't lose the last few seconds). */
export async function closeDb() {
  if (pool) {
    await flush();
    await pool.end();
  } else {
    save();
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────
export function createUser({ email, passHash, salt }) {
  const id = randomUUID();
  const now = Date.now();
  db.users[id] = {
    id, email, passHash, salt, createdAt: now,
    profile: null,
    alpacaAccountId: null,
    // Plaid bank connection: the saved access token, and the sync cursor that
    // remembers which transactions we've already counted (so nothing double-counts).
    plaidAccess: null,   // { accessToken, itemId } once a bank is linked
    plaidCursor: null,   // Plaid /transactions/sync cursor
    // Real funding: the Alpaca ACH relationship created from a Plaid processor
    // token (see server/lib/account-service.js), once the user picks a bank
    // account to fund from. `transfers` mirrors deposits/withdrawals for the UI.
    achRelationshipId: null,
    bankName: null,
    transfers: [],
    // SnapTrade read-only brokerage connection. userSecret is a credential issued
    // once by SnapTrade; in production it must be encrypted at rest.
    snaptrade: null,      // { userId, userSecret, connectedAt } once registered
    // Which ethical screens the user turned on, e.g. ["fossil_fuels","weapons"].
    screens: [],
    // per-user portfolio state
    config: {
      framework: "Broad Ethical",
      holdings: [{ symbol: "ESGV", a: 45 }, { symbol: "VSGX", a: 25 }, { symbol: "EAGG", a: 20 }, { symbol: "SUSA", a: 10 }],
      tithePct: 2, contribution: 500, screen: "moderate",
    },
    transactions: [],
    clearingCents: 0,
    investedCents: 0,
    investedBySymbol: {},
    pendingInvestCents: 0,
    pendingBySymbol: {},   // per-symbol remainder waiting to reach Alpaca's $1 minimum
    orders: [],
  };
  db.byEmail[email.toLowerCase()] = id;
  save();
  return db.users[id];
}

export const getUser = (id) => db.users[id] || null;
export const getUserByEmail = (email) => (email ? db.users[db.byEmail[email.toLowerCase()]] || null : null);
export function saveUser(user) { db.users[user.id] = user; save(); }

// ── Sessions ──────────────────────────────────────────────────────────────────
export function createSession(userId, token) {
  db.sessions[token] = { userId, createdAt: Date.now() };
  save();
  return token;
}
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export function getSession(token) {
  if (!token) return null;
  const s = db.sessions[token];
  if (!s) return null;
  if (Date.now() - (s.createdAt || 0) > SESSION_TTL_MS) { delete db.sessions[token]; save(); return null; }
  return s;
}
export function deleteSession(token) { delete db.sessions[token]; save(); }

// ── Per-user audit trail ────────────────────────────────────────────────────
// Append-only record of the security- and money-relevant events on an account.
// A real go-live needs this for support, disputes, and compliance; building it in
// sandbox now means it's already there when it matters. Capped so it can't grow
// unbounded in the JSON store.
export function audit(user, event, detail = {}) {
  if (!user) return;
  user.audit = user.audit || [];
  user.audit.push({ ts: Date.now(), event, ...detail });
  if (user.audit.length > 200) user.audit = user.audit.slice(-200);
  db.users[user.id] = user;
  save();
}

export const allUsers = () => Object.values(db.users);

// ── App-level metadata (e.g. the charitable account id) ────────────────────
export const getMeta = (k) => (db.meta || {})[k] ?? null;
export function setMeta(k, v) { db.meta = db.meta || {}; db.meta[k] = v; save(); }

// ── One-time tokens (email verification, password reset) ───────────────────
// Random 256-bit, typed, expiring, single-use. Stored server-side only.
import { randomBytes as _rb } from "node:crypto";
export function createToken(type, userId, ttlMs) {
  const token = _rb(32).toString("hex");
  db.tokens = db.tokens || {};
  db.tokens[token] = { type, userId, exp: Date.now() + ttlMs };
  save();
  return token;
}
/** Drop every outstanding token of a type for a user (called before issuing a new
 *  one, so only the newest link is ever redeemable). */
export function revokeTokens(type, userId) {
  if (!db.tokens) return;
  for (const [tok, t] of Object.entries(db.tokens)) {
    if (t.type === type && t.userId === userId) delete db.tokens[tok];
  }
  save();
}
export function useToken(token, type) {
  const t = (db.tokens || {})[token];
  if (!t || t.type !== type) return null;
  delete db.tokens[token]; // single-use, burned even if expired
  save();
  if (Date.now() > t.exp) return null;
  return t;
}
// Invalidate every session for a user (called after a password reset).
export function deleteUserSessions(userId) {
  for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === userId) delete db.sessions[tok];
  save();
}

// ── Waitlist + funnel events ────────────────────────────────────────────────
// Real money is gated behind compliance, so capture demand now and learn where
// people drop. Deliberately lightweight — a list and a counter, no third party.
export function addWaitlist(email) {
  const e = String(email).toLowerCase().trim();
  db.waitlist = db.waitlist || [];
  const already = db.waitlist.some((w) => w.email === e);
  if (!already) { db.waitlist.push({ email: e, at: Date.now() }); save(); }
  return { added: !already, total: db.waitlist.length };
}
export function logEvent(name) {
  db.events = db.events || {};
  db.events[name] = (db.events[name] || 0) + 1;
  save();
}
export const funnel = () => ({ ...(db.events || {}), waitlist: (db.waitlist || []).length });

export const stats = () => ({
  users: Object.keys(db.users).length,
  sessions: Object.keys(db.sessions).length,
  backend: pool ? "postgres" : "json",
});
