import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { browserSessions } from "@/db/schema";

import {
  generateOpaqueSecret,
  hashOpaqueSecret,
  secretMatchesHash,
  SessionTokenError,
  signSessionToken,
  verifySessionTokenSignature,
} from "./tokens";

if (typeof window !== "undefined") {
  throw new Error(
    "src/server/session/service.ts is server-only and must not be imported from browser code.",
  );
}

/** Total lifetime of a session row/token: 30 days. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthenticatedSession {
  id: string;
  expiresAt: Date;
  /** Null for anonymous sessions, which remain a fully supported mode. */
  userId: string | null;
}

export interface IssuedSession {
  token: string;
  session: AuthenticatedSession;
}

/** Creates a brand-new anonymous browser session and its bearer token. */
export async function createSession(): Promise<IssuedSession> {
  const db = getDb();
  const secret = generateOpaqueSecret();
  const tokenHash = hashOpaqueSecret(secret);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const [row] = await db
    .insert(browserSessions)
    .values({ tokenHash, expiresAt })
    .returning();

  const token = await signSessionToken({ sessionId: row.id, secret }, expiresAt);
  return { token, session: toSession(row) };
}

/**
 * Verifies a bearer token end-to-end: JWS signature/expiry/issuer/audience
 * (via tokens.ts), then the server-side hashed binding, revocation, and row
 * expiry against the database. Returns `null` uniformly on any failure —
 * callers must not distinguish "tampered" from "expired" from "unknown" to
 * avoid turning session verification into an oracle.
 */
export async function verifySession(token: string): Promise<AuthenticatedSession | null> {
  let payload;
  try {
    payload = await verifySessionTokenSignature(token);
  } catch (error) {
    if (error instanceof SessionTokenError) {
      return null;
    }
    throw error;
  }

  const db = getDb();
  const row = await db.query.browserSessions.findFirst({
    where: eq(browserSessions.id, payload.sessionId),
  });

  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (!secretMatchesHash(payload.secret, row.tokenHash)) {
    return null;
  }

  await db
    .update(browserSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(browserSessions.id, row.id));

  return toSession(row);
}

/**
 * Issues a replacement token bound to a new session row and revokes the
 * current one. Used for periodic rotation and for privilege-relevant events
 * (e.g. immediately after any successful verification of an older token).
 */
export async function rotateSession(currentSessionId: string): Promise<IssuedSession | null> {
  const db = getDb();
  const current = await db.query.browserSessions.findFirst({
    where: eq(browserSessions.id, currentSessionId),
  });
  if (!current || current.revokedAt) {
    return null;
  }

  const secret = generateOpaqueSecret();
  const tokenHash = hashOpaqueSecret(secret);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Identity carries across rotation. Rotation happens for hygiene as well as
  // for privilege changes, so dropping it here would silently sign people out.
  const [row] = await db
    .insert(browserSessions)
    .values({ tokenHash, expiresAt, rotatedFromId: current.id, userId: current.userId })
    .returning();

  await db
    .update(browserSessions)
    .set({ revokedAt: new Date() })
    .where(eq(browserSessions.id, current.id));

  const token = await signSessionToken({ sessionId: row.id, secret }, expiresAt);
  return { token, session: toSession(row) };
}

/** Immediately revokes a session (logout / explicit sign-out equivalent). */
export async function revokeSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(browserSessions)
    .set({ revokedAt: new Date() })
    .where(eq(browserSessions.id, sessionId));
}

/**
 * Attaches a signed-in identity to a session and rotates it in one step.
 *
 * Rotation is not optional here. Signing in is a privilege change, so the
 * token that existed before the change must stop working — otherwise a token
 * captured while the person was anonymous would silently gain access to their
 * account.
 */
export async function linkSessionToUser(
  sessionId: string,
  userId: string,
): Promise<IssuedSession | null> {
  const db = getDb();
  const updated = await db
    .update(browserSessions)
    .set({ userId })
    .where(eq(browserSessions.id, sessionId))
    .returning({ id: browserSessions.id });

  if (updated.length === 0) return null;
  return rotateSession(sessionId);
}

function toSession(row: {
  id: string;
  expiresAt: Date;
  userId: string | null;
}): AuthenticatedSession {
  return { id: row.id, expiresAt: row.expiresAt, userId: row.userId };
}

export { SESSION_COOKIE_NAME, buildClearedSessionCookie, buildSessionCookie } from "./cookies";
