/**
 * GET /api/auth/session
 *
 * Tells the browser who is signed in and whether sign-in is even available on
 * this deployment, so the header can render honestly instead of offering a
 * button that cannot work.
 *
 * Read-only: it never creates a session, so loading a page as a first-time
 * visitor still leaves no server-side trace.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { isGoogleSignInConfigured } from "@/server/auth/google";
import { readSession } from "@/server/session/route-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(): Promise<Response> {
  const googleConfigured = isGoogleSignInConfigured();
  const session = await readSession();

  if (!session?.userId) {
    return NextResponse.json(
      { signedIn: false, googleConfigured, userId: null },
      { headers: NO_STORE },
    );
  }

  const user = await getDb().query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { email: true, displayName: true },
  });

  return NextResponse.json(
    {
      signedIn: true,
      googleConfigured,
      // The caller's own id. Returned so the browser can notice that a
      // *different* person is now signed in and drop the local mirror rather
      // than showing them the previous person's answers.
      userId: session.userId,
      email: user?.email ?? null,
      displayName: user?.displayName ?? null,
    },
    { headers: NO_STORE },
  );
}
