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

export function sessionCookie(token, { clear = false } = {}) {
  const base = "sid=" + (clear ? "" : token) + "; HttpOnly; Path=/; SameSite=Lax";
  return clear ? base + "; Max-Age=0" : base + "; Max-Age=" + 60 * 60 * 24 * 30;
}

// Basic validation shared by signup.
export function validateCredentials(email, password) {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Enter a valid email address.";
  if (!password || password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

// Validate an onboarding profile BEFORE we ask Alpaca to open an account, so a bad
// input (e.g. a 1-char name) surfaces as a friendly message instead of a raw 422.
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
  return null;
}
