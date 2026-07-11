// Multi-user persistent store (JSON file). One process, low volume — fine for a
// sandbox app; swap for Postgres before real scale. Holds users + sessions.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "db.json");

function empty() {
  return { users: {}, byEmail: {}, sessions: {} };
}

let db = load();

function load() {
  try {
    return { ...empty(), ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch {
    return empty();
  }
}

function save() {
  const dir = dirname(FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE);
}

// ── Users ─────────────────────────────────────────────────────────────────────
export function createUser({ email, passHash, salt }) {
  const id = randomUUID();
  const now = Date.now();
  db.users[id] = {
    id, email, passHash, salt, createdAt: now,
    profile: null,
    alpacaAccountId: null,
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
export const getSession = (token) => (token ? db.sessions[token] || null : null);
export function deleteSession(token) { delete db.sessions[token]; save(); }

export const allUsers = () => Object.values(db.users);
export const stats = () => ({ users: Object.keys(db.users).length, sessions: Object.keys(db.sessions).length });
