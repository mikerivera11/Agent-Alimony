/**
 * Bridges the framework-agnostic session service to Next.js route handlers.
 *
 * Sessions are created lazily on first write rather than for every visitor, so
 * merely reading a page does not put a row in the database or a cookie on the
 * browser. That keeps the anonymous, no-account path genuinely low-footprint,
 * which is the privacy posture the rest of the app is built around.
 */

import { cookies } from "next/headers";

import {
  buildClearedSessionCookie,
  buildSessionCookie,
  createSession,
  SESSION_COOKIE_NAME,
  verifySession,
  type AuthenticatedSession,
} from "@/server/session/service";

export async function readSession(): Promise<AuthenticatedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Reads the current session, creating one if the caller does not have a valid one. */
export async function requireSession(): Promise<AuthenticatedSession> {
  const existing = await readSession();
  if (existing) return existing;

  const issued = await createSession();
  await writeSessionCookie(issued.token, issued.session.expiresAt);
  return issued.session;
}

export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const descriptor = buildSessionCookie(token, expiresAt);
  const store = await cookies();
  store.set(descriptor.name, descriptor.value, descriptor.attributes);
}

export async function clearSessionCookie(): Promise<void> {
  const descriptor = buildClearedSessionCookie();
  const store = await cookies();
  store.set(descriptor.name, descriptor.value, descriptor.attributes);
}
