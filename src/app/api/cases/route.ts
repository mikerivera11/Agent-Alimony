/**
 * /api/cases — list and create saved cases.
 *
 * Ownership is always taken from the session cookie, never from the request
 * body. A caller-supplied owner id would be an authorization decision made by
 * the caller, which is no authorization at all.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { createOwnedCase, listOwnedCases } from "@/server/persistence/case-history";
import { readSession, requireSession } from "@/server/session/route-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const createSchema = z.object({
  title: z.string().trim().max(200).optional(),
  draft: z.unknown().optional(),
});

export async function GET(): Promise<Response> {
  const session = await readSession();
  if (!session) {
    // No session yet means nothing has been saved yet. An empty list is the
    // truthful answer and avoids minting a session just to read.
    return NextResponse.json({ cases: [] }, { headers: NO_STORE });
  }

  const cases = await listOwnedCases(getDb(), {
    sessionId: session.id,
    userId: session.userId,
  });
  return NextResponse.json({ cases }, { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE });
  }

  const session = await requireSession();
  const created = await createOwnedCase(
    getDb(),
    { sessionId: session.id, userId: session.userId },
    { title: parsed.data.title ?? null, draft: parsed.data.draft ?? {} },
  );

  return NextResponse.json(created, { status: 201, headers: NO_STORE });
}
