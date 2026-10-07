import "server-only";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { currentUserId } from "./context";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "./session";
import { store, type StoredUser } from "./store";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export class AuthError extends Error {}

const toPublic = (u: StoredUser): PublicUser => ({ id: u.id, email: u.email, name: u.name });

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Simple brute-force protection: at most 8 failed logins per e-mail in 15 minutes. */
async function checkAttempts(email: string, failed: boolean) {
  const key = `login-attempts:${email}`;
  const entry = (await store.getKv<{ count: number; since: number }>(key)) ?? { count: 0, since: Date.now() };
  const fresh = Date.now() - entry.since > 15 * 60_000 ? { count: 0, since: Date.now() } : entry;
  if (!failed) {
    if (fresh.count >= 8) throw new AuthError("Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.");
    return;
  }
  await store.setKv(key, { ...fresh, count: fresh.count + 1 });
}

export async function register(input: { name: string; email: string; password: string }): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) throw new AuthError("Bitte einen Namen mit 2 bis 60 Zeichen angeben.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) throw new AuthError("Bitte eine gültige E-Mail-Adresse angeben.");
  if (input.password.length < 8 || input.password.length > 128) throw new AuthError("Das Passwort braucht mindestens 8 Zeichen.");

  const user: StoredUser = { id: randomUUID(), email, name, passwordHash: await hashPassword(input.password), createdAt: new Date().toISOString() };
  if (!(await store.createUser(user))) throw new AuthError("Zu dieser E-Mail-Adresse gibt es bereits ein Konto.");
  await startSession(user.id);
  return toPublic(user);
}

export async function login(input: { email: string; password: string }): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  await checkAttempts(email, false);
  const user = await store.getUserByEmail(email);
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    await checkAttempts(email, true);
    throw new AuthError("E-Mail-Adresse oder Passwort ist falsch.");
  }
  await startSession(user.id);
  return toPublic(user);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const uid = currentUserId();
  const user = uid ? await store.getUserById(uid) : null;
  return user ? toPublic(user) : null;
}
