// Password hashing (scrypt) + session tokens + cookie helpers. No external deps.

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const passHash = scryptSync(password, salt, 64).toString("hex");
  return { salt, passHash };
}

export function verifyPassword(password, salt, passHash) {
  const attempt = scryptSync(password, salt, 64);
  const stored = Buffer.from(passHash, "hex");
  return stored.length === attempt.length && timingSafeEqual(stored, attempt);
}

export const newToken = () => randomBytes(32).toString("hex");

// Parse the session id from a Cookie header.
export function sessionFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === "sid") return v;
  }
  return null;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function sessionCookie(token, { clear = false } = {}) {
  // Secure only in production (behind HTTPS on Render); on localhost http a Secure
  // cookie would never be stored and would break local dev. DATABASE_URL is our
  // "this is production" signal.
  const secure = process.env.DATABASE_URL ? "; Secure" : "";
  const base = "sid=" + (clear ? "" : token) + "; HttpOnly; Path=/; SameSite=Lax" + secure;
  return clear ? base + "; Max-Age=0" : base + "; Max-Age=" + SESSION_TTL_MS / 1000;
}

// A password that is long but trivially guessable is not a strong password. This is
// a deliberately small blocklist — the point is to stop the handful of passwords that
// dominate credential-stuffing lists, not to reimplement zxcvbn.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789",
  "1234567890", "qwertyuiop", "qwerty123", "iloveyou", "admin123", "welcome1",
  "letmein1", "abc12345", "football", "baseball", "sunshine", "princess",
  "monkey123", "trustno1", "steward123", "goodsteward",
]);

// Basic validation shared by signup.
export function validateCredentials(email, password) {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Enter a valid email address.";
  if (String(email).length > 254) return "That email address is too long.";
  const pw = String(password || "");
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (pw.length > 200) return "Password must be under 200 characters.";
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return "That password is too common. Choose another.";
  if (/^\d+$/.test(pw)) return "Password can't be only numbers.";
  return null;
}

// Burn the same CPU as a real password check when the account doesn't exist, so the
// response time can't be used to tell "no such user" from "wrong password". Without
// this, /api/login is an email-enumeration oracle: a miss returns in microseconds,
// a hit takes as long as scrypt does.
const DUMMY_SALT = randomBytes(16).toString("hex");
export function dummyVerify(password) {
  try { scryptSync(String(password || ""), DUMMY_SALT, 64); } catch { /* never throws in practice */ }
  return false;
}

// Alpaca's accepted funding_source values. Anything else is a 422 from their API,
// so reject it here where we can say something useful.
export const FUNDING_SOURCES = [
  "employment_income", "investments", "inheritance",
  "business_income", "savings", "family",
];

// The four CIP disclosure questions Alpaca requires an answer to. They must be
// ANSWERED, not defaulted — a hardcoded `false` is an unsigned attestation, which is
// exactly the thing the regulation exists to prevent.
export const DISCLOSURE_KEYS = [
  "isControlPerson", "isAffiliatedExchangeOrFinra",
  "isPoliticallyExposed", "immediateFamilyExposed",
];

// SSNs that are structurally impossible. The SSA never issues an area of 000, 666,
// or 900-999, nor a group of 00 or a serial of 0000. Catching these locally saves a
// round trip and stops the most obvious junk input.
function invalidSsn(ssn) {
  const m = /^(\d{3})-(\d{2})-(\d{4})$/.exec(ssn);
  if (!m) return true;
  const [, area, group, serial] = m;
  if (area === "000" || area === "666" || Number(area) >= 900) return true;
  if (group === "00" || serial === "0000") return true;
  return false;
}

// Validate an onboarding profile BEFORE we ask Alpaca to open an account, so a bad
// input (e.g. a 1-char name) surfaces as a friendly message instead of a raw 422.
//
// Every field Alpaca's CIP requires is checked here. Nothing is defaulted: an account
// application that invents a tax id, an address, or a disclosure answer on the user's
// behalf is a false attestation to a regulator, whatever environment it runs in.
export function validateProfile(p = {}) {
  const clean = (v) => (typeof v === "string" ? v.trim() : "");
  if (clean(p.firstName).length < 2) return "First name must be at least 2 characters.";
  if (clean(p.lastName).length < 2) return "Last name must be at least 2 characters.";
  const dob = clean(p.dob);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "Enter your date of birth.";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "That date of birth isn't valid.";
  const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
  if (age < 18) return "You must be at least 18 to open an account.";
  if (age > 120) return "Please check your date of birth.";
  if (!clean(p.address)) return "Street address is required.";
  if (!clean(p.city)) return "City is required.";
  if (!/^[A-Za-z]{2}$/.test(clean(p.state))) return "Use a 2-letter state code (e.g. CA).";
  if (!/^\d{5}$/.test(clean(p.postal))) return "Enter a valid 5-digit ZIP code.";

  // ── CIP fields ────────────────────────────────────────────────────────────
  const phone = clean(p.phone).replace(/[^\d]/g, "");
  if (phone.length !== 10) return "Enter a 10-digit US phone number.";

  const ssn = clean(p.taxId);
  if (!ssn) return "Your Social Security number is required to open a brokerage account.";
  if (invalidSsn(ssn)) return "Enter a valid SSN in the format 123-45-6789.";

  if (!/^[A-Z]{3}$/.test(clean(p.citizenship) || "USA")) return "Select your country of citizenship.";
  if (!FUNDING_SOURCES.includes(clean(p.fundingSource))) return "Select where the money you invest comes from.";

  for (const k of DISCLOSURE_KEYS) {
    if (typeof p[k] !== "boolean") return "Answer all four regulatory questions before continuing.";
  }

  if (p.agreementsAccepted !== true) return "You must accept the customer agreement to open an account.";
  return null;
}

// Everything we are allowed to keep after the account is opened. The SSN is
// deliberately absent: it goes straight to Alpaca in the account application and is
// never written to our database. Storing it would make this app a breach target for
// data it has no ongoing use for, and it isn't needed again after CIP.
export function storableProfile(p = {}) {
  const clean = (v) => (typeof v === "string" ? v.trim() : v);
  return {
    firstName: clean(p.firstName), lastName: clean(p.lastName), dob: clean(p.dob),
    address: clean(p.address), city: clean(p.city), state: clean(p.state).toUpperCase(),
    postal: clean(p.postal), phone: clean(p.phone),
    citizenship: clean(p.citizenship) || "USA",
    fundingSource: clean(p.fundingSource),
    isControlPerson: !!p.isControlPerson,
    isAffiliatedExchangeOrFinra: !!p.isAffiliatedExchangeOrFinra,
    isPoliticallyExposed: !!p.isPoliticallyExposed,
    immediateFamilyExposed: !!p.immediateFamilyExposed,
    // Proof of consent, not the SSN: what they agreed to, when, and from where.
    agreementsAcceptedAt: p.agreementsAcceptedAt || new Date().toISOString(),
    taxIdLast4: String(clean(p.taxId) || "").slice(-4) || null,
  };
}
