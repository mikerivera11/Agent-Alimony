/**
 * POST /api/cases/[caseId]/revisions/[revision]/restore
 *
 * Brings an earlier version back by saving it forward as a new revision.
 * Nothing is deleted, so restoring is itself undoable — which matters because
 * this is the one action in the app a person could otherwise use to destroy
 * financial answers they spent hours entering.
 */

import { NextResponse } from "next/server";

import { getDb } from "@/db/client";
import { CaseNotFoundError, restoreCaseRevision } from "@/server/persistence/case-history";
import { ConcurrencyConflictError } from "@/server/persistence/errors";
import { readSession } from "@/server/session/route-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const notFound = () =>
  NextResponse.json({ error: "Case not found." }, { status: 404, headers: NO_STORE });

export async function POST(
  _request: Request,
  context: { params: Promise<{ caseId: string; revision: string }> },
): Promise<Response> {
  const { caseId, revision } = await context.params;
  const target = Number.parseInt(revision, 10);
  if (!Number.isInteger(target) || target < 1) {
    return NextResponse.json({ error: "Invalid revision." }, { status: 400, headers: NO_STORE });
  }

  const session = await readSession();
  if (!session) return notFound();

  try {
    const restored = await restoreCaseRevision(
      getDb(),
      { sessionId: session.id, userId: session.userId },
      caseId,
      target,
    );
    return NextResponse.json(
      { revision: restored.revision, restoredFromRevision: target },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof CaseNotFoundError) return notFound();
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        { error: "This case changed while restoring. Reload and try again." },
        { status: 409, headers: NO_STORE },
      );
    }
    throw error;
  }
}
