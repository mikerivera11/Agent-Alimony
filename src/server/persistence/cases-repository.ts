import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { cases } from "@/db/schema";

import { ConcurrencyConflictError } from "./errors";

export interface CaseRecord {
  id: string;
  sessionId: string;
  draft: unknown;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Every read in this repository filters by `sessionId` in addition to the
 * primary key, so a case belonging to another browser session is
 * indistinguishable from a case that does not exist (no existence leak).
 */
export async function createCaseForSession(
  db: Database,
  sessionId: string,
): Promise<CaseRecord> {
  const [row] = await db.insert(cases).values({ sessionId }).returning();
  return row;
}

export async function getCaseForSession(
  db: Database,
  sessionId: string,
  caseId: string,
): Promise<CaseRecord | undefined> {
  return buildGetCaseForSessionQuery(db, sessionId, caseId);
}

/**
 * Exposed separately (unexecuted) so tests can assert, via `.toSQL()`, that
 * the compiled query always scopes by `sessionId` — without needing a live
 * database connection to run it.
 */
export function buildGetCaseForSessionQuery(db: Database, sessionId: string, caseId: string) {
  return db.query.cases.findFirst({
    where: and(eq(cases.id, caseId), eq(cases.sessionId, sessionId)),
  });
}

export async function listCasesForSession(
  db: Database,
  sessionId: string,
): Promise<CaseRecord[]> {
  return db.query.cases.findMany({ where: eq(cases.sessionId, sessionId) });
}

/**
 * Optimistic-concurrency draft save: the UPDATE predicate requires the
 * caller's `expectedRevision` to still match the stored value, so two tabs
 * racing to save the same case cannot silently overwrite one another. A
 * zero-row result — whether from a stale revision or a foreign session —
 * throws `ConcurrencyConflictError` uniformly.
 */
export async function saveCaseDraft(
  db: Database,
  sessionId: string,
  caseId: string,
  expectedRevision: number,
  draft: unknown,
): Promise<CaseRecord> {
  const [row] = await buildSaveCaseDraftQuery(db, sessionId, caseId, expectedRevision, draft);

  if (!row) {
    throw new ConcurrencyConflictError();
  }
  return row;
}

/**
 * Exposed separately (unexecuted) so tests can assert, via `.toSQL()`, that
 * the compare-and-swap predicate requires both the owning `sessionId` and
 * the expected `revision` — without needing a live database connection.
 */
export function buildSaveCaseDraftQuery(
  db: Database,
  sessionId: string,
  caseId: string,
  expectedRevision: number,
  draft: unknown,
) {
  return db
    .update(cases)
    .set({ draft, revision: expectedRevision + 1, updatedAt: new Date() })
    .where(
      and(
        eq(cases.id, caseId),
        eq(cases.sessionId, sessionId),
        eq(cases.revision, expectedRevision),
      ),
    )
    .returning();
}

export async function deleteCaseForSession(
  db: Database,
  sessionId: string,
  caseId: string,
): Promise<boolean> {
  const rows = await db
    .delete(cases)
    .where(and(eq(cases.id, caseId), eq(cases.sessionId, sessionId)))
    .returning({ id: cases.id });
  return rows.length > 0;
}
