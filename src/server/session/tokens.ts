import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { getServerEnv } from "@/lib/env";

if (typeof window !== "undefined") {
  throw new Error(
    "src/server/session/tokens.ts is server-only and must not be imported from browser code.",
  );
}

const JWT_ALG = "HS256";
const JWT_ISSUER = "florida-support-guide";
const JWT_AUDIENCE = "browser-session";

/** Bytes of randomness for the opaque per-session secret. 256 bits. */
const OPAQUE_SECRET_BYTES = 32;

let cachedKey: Uint8Array | undefined;

function getSigningKey(): Uint8Array {
  if (!cachedKey) {
    cachedKey = new TextEncoder().encode(getServerEnv().SESSION_SIGNING_SECRET);
  }
  return cachedKey;
}

/** Thrown for any signature, expiry, issuer/audience, or shape failure. Callers must treat this uniformly as "not authenticated" and must not branch on the reason (avoids oracle behavior). */
export class SessionTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SessionTokenError";
  }
}

/** Generates a fresh, cryptographically random opaque session secret. Never derived from user input. */
export function generateOpaqueSecret(): string {
  return randomBytes(OPAQUE_SECRET_BYTES).toString("base64url");
}

/** One-way hash of the opaque secret for server-side storage (the "binding"). The raw secret is never persisted. */
export function hashOpaqueSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("base64url");
}

/**
 * Constant-time comparison of a presented secret against its stored hash.
 * Recomputes the hash (fixed-length output) and uses `timingSafeEqual` so
 * comparison time never leaks how many leading bytes matched.
 */
export function secretMatchesHash(secret: string, storedHash: string): boolean {
  const computed = Buffer.from(hashOpaqueSecret(secret));
  const expected = Buffer.from(storedHash);
  if (computed.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(computed, expected);
}

export interface SessionTokenPayload {
  sessionId: string;
  secret: string;
}

/**
 * Produces a signed, opaque bearer token: a compact JWS whose payload
 * carries only a session id and a random secret (no case data, no PII).
 * Signature verification uses jose's constant-time HMAC comparison.
 */
export async function signSessionToken(
  payload: SessionTokenPayload,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT({ sid: payload.sessionId, sec: payload.secret })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSigningKey());
}

/**
 * Verifies token signature, issuer/audience, and expiry. Does NOT consult
 * the database — callers (src/server/session/service.ts) must additionally
 * check the server-side hashed binding, revocation, and row expiry. Any
 * failure (tampered signature, expired token, wrong issuer/audience,
 * malformed payload) surfaces uniformly as `SessionTokenError`.
 */
export async function verifySessionTokenSignature(
  token: string,
): Promise<SessionTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALG],
    });
    const sessionId = payload.sid;
    const secret = payload.sec;
    if (typeof sessionId !== "string" || typeof secret !== "string") {
      throw new SessionTokenError("Malformed session token payload.");
    }
    return { sessionId, secret };
  } catch (cause) {
    if (cause instanceof SessionTokenError) {
      throw cause;
    }
    throw new SessionTokenError("Session token signature invalid or expired.", { cause });
  }
}
