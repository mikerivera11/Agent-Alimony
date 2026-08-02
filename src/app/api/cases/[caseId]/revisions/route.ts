/**
 * GET /api/cases/[caseId]/revisions — the saved version history.
 */

import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { CaseNotFoundError, listCaseRevisions } from "@/server/persistence/case-history";
import { readSession } from "@/server/session/route-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const notFound = () =>
  NextResponse.json({ error: "Case not found." }, { status: 404, headers: NO_STORE });

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  const { caseId } = await context.params;
  const session = await readSession();
  if (!session) return notFound();

  try {
    const revisions = await listCaseRevisions(
      getDb(),
      { sessionId: session.id, userId: session.userId },
      caseId,
    );
    return NextResponse.json({ revisions }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof CaseNotFoundError) return notFound();
    throw error;
  }
}
