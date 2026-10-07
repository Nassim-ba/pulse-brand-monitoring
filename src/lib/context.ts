import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** The signed-in user for the current request, available to the store without passing it around. */
const userContext = new AsyncLocalStorage<{ userId: string }>();

export const currentUserId = (): string | null => userContext.getStore()?.userId ?? null;

export class UnauthorizedError extends Error {}

/** Runs `fn` as the signed-in user, or answers 401 when there is no valid session. */
export async function withUser(fn: () => Promise<Response>): Promise<Response> {
  const userId = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return Response.json({ error: "Bitte melde dich an." }, { status: 401 });
  return userContext.run({ userId }, fn);
}
