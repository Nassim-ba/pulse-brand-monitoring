import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless sessions: a signed cookie holding the user id and expiry. Used by
 * the proxy (page access) and the API (data access), so it has no server-only
 * dependencies.
 */

export const SESSION_COOKIE = "pulse_session";
export const SESSION_DAYS = 30;

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  // Fallback so the app works before AUTH_SECRET is set: derived from other secrets.
  const seed = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.ANTHROPIC_API_KEY ?? "pulse-local-dev";
  return createHash("sha256").update(`pulse-session:${seed}`).digest("hex");
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: string; exp?: number };
    if (!uid || !exp || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}
