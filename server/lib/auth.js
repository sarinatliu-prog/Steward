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
