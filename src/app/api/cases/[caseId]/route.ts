/**
 * /api/cases/[caseId] — read and save one case draft.
 *
 * PUT requires the caller's `expectedRevision` to still match what is stored.
 * Two tabs, or a phone and a laptop, saving the same case is an ordinary thing
 * for this app; without the check the later save would silently erase the
 * earlier one's answers. On conflict the caller is told the current revision
 * so it can reload rather than guess.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db/client";
import { buildOwnedCaseQuery, saveOwnedCaseDraft } from "@/server/persistence/case-history";
import { ConcurrencyConflictError } from "@/server/persistence/errors";
import { readSession } from "@/server/session/route-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const saveSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  draft: z.unknown(),
  title: z.string().trim().max(200).nullable().optional(),
});

const notFound = () =>
  NextResponse.json({ error: "Case not found." }, { status: 404, headers: NO_STORE });

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  const { caseId } = await context.params;
  const session = await readSession();
  if (!session) return notFound();

  const row = await buildOwnedCaseQuery(
    getDb(),
    { sessionId: session.id, userId: session.userId },
    caseId,
  );
  if (!row) return notFound();

  return NextResponse.json(
    {
      id: row.id,
      title: row.title,
      draft: row.draft,
      revision: row.revision,
      updatedAt: row.updatedAt,
    },
    { headers: NO_STORE },
  );
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  const { caseId } = await context.params;
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: NO_STORE });
  }

  const session = await readSession();
  if (!session) return notFound();

  try {
    const saved = await saveOwnedCaseDraft(
      getDb(),
      { sessionId: session.id, userId: session.userId },
      {
        caseId,
        expectedRevision: parsed.data.expectedRevision,
        draft: parsed.data.draft,
        title: parsed.data.title,
      },
    );
    return NextResponse.json(saved, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      const current = await buildOwnedCaseQuery(
        getDb(),
        { sessionId: session.id, userId: session.userId },
        caseId,
      );
      if (!current) return notFound();
      return NextResponse.json(
        {
          error: "This case changed somewhere else since you loaded it.",
          revision: current.revision,
        },
        { status: 409, headers: NO_STORE },
      );
    }
    throw error;
  }
}
