/**
 * Google sign-in, implemented directly against the OpenID Connect
 * authorization-code flow with PKCE.
 *
 * Why not an auth library: this app already has a database-backed session
 * layer with hashed opaque secrets, signed tokens, rotation, and revocation
 * (see src/server/session). A framework like Auth.js brings its own session
 * model, and running two would mean two sources of truth about who is signed
 * in — the kind of ambiguity that produces authorization bugs. What is left
 * once sessions are already solved is one standard flow, so it is written out
 * explicitly here where its security properties can be read and tested.
 *
 * What is checked on the way back in, and why each matters:
 *  - **state**, stored server-side as a hash and deleted on first use, so a
 *    cross-site request cannot start a login the person did not ask for and a
 *    replayed callback URL fails closed.
 *  - **PKCE verifier**, so an intercepted authorization code is useless
 *    without the secret half that never left this server.
 *  - **ID token signature**, verified against Google's published JWKS.
 *  - **issuer and audience**, so a token minted for a different application
 *    cannot be presented here.
 *  - **nonce**, binding the returned token to this specific request.
 *
 * The `sub` claim is what identifies the account. Email is display metadata:
 * it can change or be reassigned, and treating it as the key would eventually
 * let one person inherit another's financial case.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { eq, lt } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { getDb } from "@/db/client";
import { authRequests, users } from "@/db/schema";
import { getServerEnv } from "@/lib/env";

if (typeof window !== "undefined") {
  throw new Error(
    "src/server/auth/google.ts is server-only and must not be imported from browser code.",
  );
}

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

/** An authorization request is a few seconds of work; ten minutes is generous. */
const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;

/** Cached across requests so every sign-in does not refetch Google's keys. */
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  jwks ??= createRemoteJWKSet(GOOGLE_JWKS_URL);
  return jwks;
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Returns null rather than throwing when Google is not configured. Sign-in is
 * an optional capability: the whole app works anonymously, so an unconfigured
 * deployment should hide the button, not fail.
 */
export function getGoogleConfig(): GoogleConfig | null {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.APP_BASE_URL.replace(/\/$/, "")}/api/auth/google/callback`,
  };
}

export function isGoogleSignInConfigured(): boolean {
  return getGoogleConfig() !== null;
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Only relative, single-slash paths are accepted. Returning to a caller-
 * supplied absolute URL would make this endpoint an open redirect, which is
 * the classic way an OAuth callback gets turned into a phishing primitive.
 */
export function sanitiseRedirectPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export interface StartedAuth {
  authorizationUrl: string;
  state: string;
}

/**
 * Creates the pending authorization request and returns the URL to send the
 * browser to. The verifier and nonce stay in the database; only the opaque
 * `state` travels through the browser.
 */
export async function startGoogleAuth(options: {
  sessionId?: string;
  redirectPath?: string | null;
}): Promise<StartedAuth> {
  const config = getGoogleConfig();
  if (!config) throw new GoogleAuthError("Google sign-in is not configured.");

  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(32));
  const nonce = base64Url(randomBytes(16));
  const codeChallenge = base64Url(sha256(codeVerifier));

  const db = getDb();
  await db.insert(authRequests).values({
    stateHash: base64Url(sha256(state)),
    codeVerifier,
    nonce,
    redirectPath: sanitiseRedirectPath(options.redirectPath),
    sessionId: options.sessionId,
    expiresAt: new Date(Date.now() + AUTH_REQUEST_TTL_MS),
  });

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  // No Google API is called on the person's behalf, so nothing beyond identity
  // is requested. A narrower scope is a smaller consent prompt and less data.
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return { authorizationUrl: url.toString(), state };
}

export interface GoogleIdentity {
  subject: string;
  email: string | null;
  displayName: string | null;
}

export interface CompletedAuth {
  identity: GoogleIdentity;
  redirectPath: string;
  sessionId: string | null;
}

/**
 * Consumes the pending request and exchanges the code. The request row is
 * deleted before the code is exchanged, so a replayed callback cannot reuse
 * the same verifier even if the exchange itself is slow.
 */
export async function completeGoogleAuth(params: {
  code: string;
  state: string;
}): Promise<CompletedAuth> {
  const config = getGoogleConfig();
  if (!config) throw new GoogleAuthError("Google sign-in is not configured.");

  const db = getDb();
  const stateHash = base64Url(sha256(params.state));

  const [pending] = await db
    .delete(authRequests)
    .where(eq(authRequests.stateHash, stateHash))
    .returning();

  if (!pending) {
    throw new GoogleAuthError("This sign-in link is no longer valid. Please try again.");
  }
  if (pending.expiresAt.getTime() <= Date.now()) {
    throw new GoogleAuthError("This sign-in request expired. Please try again.");
  }

  const body = new URLSearchParams({
    code: params.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: pending.codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    // The body can echo client configuration detail, so only the status is
    // surfaced. Nothing in it is useful to the person anyway.
    throw new GoogleAuthError(`Google rejected the sign-in (status ${response.status}).`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) {
    throw new GoogleAuthError("Google did not return an identity token.");
  }

  const { payload } = await jwtVerify(tokens.id_token, getJwks(), {
    issuer: GOOGLE_ISSUERS,
    audience: config.clientId,
  });

  const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
  if (!constantTimeEquals(nonce, pending.nonce)) {
    throw new GoogleAuthError("The sign-in response did not match the request.");
  }

  const subject = typeof payload.sub === "string" ? payload.sub : "";
  if (!subject) {
    throw new GoogleAuthError("Google did not identify the account.");
  }

  // An unverified email would be attacker-chosen display text, so it is
  // dropped rather than shown. Identity still rests on `sub`, so dropping it
  // costs nothing but a friendlier label.
  const emailVerified = payload.email_verified === true;
  const email = emailVerified && typeof payload.email === "string" ? payload.email : null;
  const displayName = typeof payload.name === "string" ? payload.name : null;

  return {
    identity: { subject, email, displayName },
    redirectPath: sanitiseRedirectPath(pending.redirectPath),
    sessionId: pending.sessionId,
  };
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Creates the user on first sign-in, or refreshes display metadata after. */
export async function upsertGoogleUser(identity: GoogleIdentity): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(users)
    .values({
      provider: "google",
      subject: identity.subject,
      email: identity.email,
      displayName: identity.displayName,
    })
    .onConflictDoUpdate({
      target: [users.provider, users.subject],
      set: {
        email: identity.email,
        displayName: identity.displayName,
        lastLoginAt: new Date(),
      },
    })
    .returning({ id: users.id });

  return row;
}

/** Housekeeping for abandoned sign-ins, which are the common case. */
export async function purgeExpiredAuthRequests(now: Date = new Date()): Promise<number> {
  const db = getDb();
  const deleted = await db
    .delete(authRequests)
    .where(lt(authRequests.expiresAt, now))
    .returning({ id: authRequests.id });
  return deleted.length;
}
