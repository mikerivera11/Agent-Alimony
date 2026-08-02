/**
 * GET /api/auth/google/callback
 *
 * Completes the OIDC flow and attaches the resulting identity to the browser
 * session, then rotates the session token because signing in is a privilege
 * change.
 *
 * Failures redirect back to a page with a short, non-specific reason rather
 * than rendering an error body. The detail of *why* a callback failed is
 * exactly the kind of thing that helps someone probing the endpoint and does
 * not help the person who just wanted to sign in.
 */

import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { getServerEnv } from "@/lib/env";
import {
  completeGoogleAuth,
  GoogleAuthError,
  isGoogleSignInConfigured,
  upsertGoogleUser,
} from "@/server/auth/google";
import { claimSessionCasesForUser } from "@/server/persistence/case-history";
import { readSession, writeSessionCookie } from "@/server/session/route-session";
import { linkSessionToUser } from "@/server/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrl(path: string): URL {
  return new URL(path, getServerEnv().APP_BASE_URL);
}

function failure(reason: string): Response {
  const url = appUrl("/");
  url.searchParams.set("signin", reason);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  if (!isGoogleSignInConfigured()) {
    return failure("unavailable");
  }

  const params = new URL(request.url).searchParams;

  // Google reports a declined consent screen here; it is a normal outcome, not
  // an error worth alarming anyone about.
  if (params.get("error")) {
    return failure("cancelled");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return failure("failed");
  }

  let completed;
  try {
    completed = await completeGoogleAuth({ code, state });
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return failure("failed");
    }
    throw error;
  }

  if (!completed.sessionId) {
    return failure("failed");
  }

  // The browser finishing the flow must be the same one that started it.
  //
  // Without this, an attacker could start a sign-in on their own machine and
  // then get a victim to load the resulting callback URL. The victim's browser
  // would be handed a token for the attacker's session, signed in as the
  // attacker — and would then type their divorce finances into the attacker's
  // account. `state` alone does not prevent that, because the attacker holds a
  // perfectly valid `state`; only binding it to the session does.
  const current = await readSession();
  if (!current || current.id !== completed.sessionId) {
    return failure("failed");
  }

  const user = await upsertGoogleUser(completed.identity);

  // Anything started before signing in is adopted by the account, so a draft
  // in progress is not stranded by the act of creating an account.
  await claimSessionCasesForUser(getDb(), completed.sessionId, user.id);

  const issued = await linkSessionToUser(completed.sessionId, user.id);
  if (!issued) {
    return failure("failed");
  }
  await writeSessionCookie(issued.token, issued.session.expiresAt);

  // Second check on the resolved origin. `sanitiseRedirectPath` already does
  // this, but an open redirect hanging off an authentication callback is worth
  // failing closed on twice rather than relying on one function staying right.
  const destination = appUrl(completed.redirectPath);
  if (destination.origin !== new URL(getServerEnv().APP_BASE_URL).origin) {
    return NextResponse.redirect(appUrl("/"), {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.redirect(destination, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
