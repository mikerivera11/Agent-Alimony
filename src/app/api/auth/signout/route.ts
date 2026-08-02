/**
 * POST /api/auth/signout
 *
 * Revokes the session server-side as well as clearing the cookie. Clearing
 * only the cookie would leave a still-valid token that anyone holding a copy
 * could keep using, which is not what "sign out" means to the person clicking
 * it — especially on a shared computer, which this app should assume.
 *
 * POST only, so a link or image cannot sign someone out.
 */

import { NextResponse } from "next/server";

import { clearSessionCookie, readSession } from "@/server/session/route-session";
import { revokeSession } from "@/server/session/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const session = await readSession();
  if (session) {
    await revokeSession(session.id);
  }
  await clearSessionCookie();

  return NextResponse.json({ signedIn: false }, { headers: { "Cache-Control": "no-store" } });
}
