/**
 * GET /api/auth/google/start
 *
 * Records a pending authorization request server-side and redirects to Google.
 * A session is created first if the visitor does not have one, so the case
 * they were working on anonymously can be attached to their account when they
 * come back through the callback.
 */

import { NextResponse } from "next/server";

import { isGoogleSignInConfigured, startGoogleAuth } from "@/server/auth/google";
import { requireSession } from "@/server/session/route-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isGoogleSignInConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured on this deployment." },
      { status: 501, headers: { "Cache-Control": "no-store" } },
    );
  }

  const session = await requireSession();
  const redirectPath = new URL(request.url).searchParams.get("redirect");

  const { authorizationUrl } = await startGoogleAuth({
    sessionId: session.id,
    redirectPath,
  });

  // The Location value is built entirely from validated server env and
  // server-generated randomness; `redirect` is only ever stored, and is
  // sanitised to a relative path before it is used on the way back.
  return NextResponse.redirect(authorizationUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
