/**
 * Ownership-aware case access and version history.
 *
 * A case can be reached two ways, and both must keep working at once:
 *  - by the **browser session** that created it, which is how anonymous use
 *    works and how someone's in-progress draft survives a page reload before
 *    they have ever signed in;
 *  - by the **user account**, which is what lets the same case come back on a
 *    different device, and which is the whole point of signing in.
 *
 * Every query below is scoped by an owner predicate that means "mine by
 * session OR mine by account". Anything not matching is treated as
 * nonexistent rather than forbidden, so the API never reveals that someone
 * else's case exists.
 *
 * Once a case is claimed by an account, the session route is closed off. A
 * shared or borrowed browser must not keep reading a case after the person
 * signed in and walked away, and that is exactly the situation the session
 * predicate would otherwise cover.
 */

import { and, desc, eq, isNull, or, type SQL } from "drizzle-orm";

import type { Database } from "@/db/client";
import { caseRevisions, cases } from "@/db/schema";

import { ConcurrencyConflictError } from "./errors";

export interface CaseOwner {
  sessionId: string;
  /** Null while browsing anonymously. */
  userId: string | null;
}

export interface CaseSummary {
  id: string;
  title: string | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseRevisionRecord {
  id: string;
  caseId: string;
  revision: number;
  draft: unknown;
  restoredFromRevision: number | null;
  createdAt: Date;
}

export class CaseNotFoundError extends Error {
  constructor() {
    super("Case not found.");
    this.name = "CaseNotFoundError";
  }
}

/**
 * The single ownership predicate. Kept in one place deliberately: an
 * authorization rule that is re-derived at each call site is an authorization
 * rule that will eventually be wrong at one of them.
 */
export function ownerPredicate(owner: CaseOwner): SQL | undefined {
  if (!owner.userId) {
    // Anonymous callers only ever reach unclaimed cases from their own session.
    return and(eq(cases.sessionId, owner.sessionId), isNull(cases.userId));
  }
  return or(
    eq(cases.userId, owner.userId),
    and(eq(cases.sessionId, owner.sessionId), isNull(cases.userId)),
  );
}

export function buildOwnedCaseQuery(db: Database, owner: CaseOwner, caseId: string) {
  return db.query.cases.findFirst({
    where: and(eq(cases.id, caseId), ownerPredicate(owner)),
  });
}

export async function listOwnedCases(db: Database, owner: CaseOwner): Promise<CaseSummary[]> {
  return db.query.cases.findMany({
    where: ownerPredicate(owner),
    orderBy: [desc(cases.updatedAt)],
    columns: { id: true, title: true, revision: true, createdAt: true, updatedAt: true },
  });
}

/**
 * Creates a case and its revision 1 snapshot together, so history has no gap
 * at the start and "restore to the beginning" is always available.
 */
export async function createOwnedCase(
  db: Database,
  owner: CaseOwner,
  input: { draft?: unknown; title?: string | null } = {},
): Promise<{ id: string; revision: number }> {
  const draft = input.draft ?? {};
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(cases)
      .values({
        sessionId: owner.sessionId,
        userId: owner.userId,
        title: input.title ?? null,
        draft,
      })
      .returning({ id: cases.id, revision: cases.revision });

    await tx.insert(caseRevisions).values({
      caseId: row.id,
      revision: row.revision,
      draft,
    });

    return row;
  });
}

/**
 * Compare-and-swap save that also appends the snapshot. Both happen in one
 * transaction: a save whose history row failed to write would look complete
 * while quietly making that version unrecoverable, which is the failure this
 * whole feature exists to prevent.
 */
export async function saveOwnedCaseDraft(
  db: Database,
  owner: CaseOwner,
  params: {
    caseId: string;
    expectedRevision: number;
    draft: unknown;
    title?: string | null;
    restoredFromRevision?: number;
  },
): Promise<{ revision: number }> {
  const nextRevision = params.expectedRevision + 1;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(cases)
      .set({
        draft: params.draft,
        revision: nextRevision,
        updatedAt: new Date(),
        ...(params.title === undefined ? {} : { title: params.title }),
      })
      .where(
        and(
          eq(cases.id, params.caseId),
          eq(cases.revision, params.expectedRevision),
          ownerPredicate(owner),
        ),
      )
      .returning({ revision: cases.revision });

    // A stale revision and a case belonging to someone else are indistinguishable
    // here on purpose; the caller retries or is told it is gone, and neither
    // answer confirms the case exists.
    if (!row) throw new ConcurrencyConflictError();

    await tx.insert(caseRevisions).values({
      caseId: params.caseId,
      revision: nextRevision,
      draft: params.draft,
      restoredFromRevision: params.restoredFromRevision ?? null,
    });

    return row;
  });
}

/** History list. Drafts are omitted — they are large and not needed to choose. */
export async function listCaseRevisions(
  db: Database,
  owner: CaseOwner,
  caseId: string,
): Promise<Omit<CaseRevisionRecord, "draft">[]> {
  const owned = await buildOwnedCaseQuery(db, owner, caseId);
  if (!owned) throw new CaseNotFoundError();

  return db.query.caseRevisions.findMany({
    where: eq(caseRevisions.caseId, caseId),
    orderBy: [desc(caseRevisions.revision)],
    columns: {
      id: true,
      caseId: true,
      revision: true,
      restoredFromRevision: true,
      createdAt: true,
    },
  });
}

export async function getCaseRevision(
  db: Database,
  owner: CaseOwner,
  caseId: string,
  revision: number,
): Promise<CaseRevisionRecord> {
  const owned = await buildOwnedCaseQuery(db, owner, caseId);
  if (!owned) throw new CaseNotFoundError();

  const row = await db.query.caseRevisions.findFirst({
    where: and(eq(caseRevisions.caseId, caseId), eq(caseRevisions.revision, revision)),
  });
  if (!row) throw new CaseNotFoundError();
  return row;
}

/**
 * Restores by saving the old snapshot forward as a new revision. Nothing is
 * deleted, so the restore can itself be undone by restoring the revision that
 * preceded it.
 */
export async function restoreCaseRevision(
  db: Database,
  owner: CaseOwner,
  caseId: string,
  revision: number,
): Promise<{ revision: number }> {
  const snapshot = await getCaseRevision(db, owner, caseId, revision);
  const current = await buildOwnedCaseQuery(db, owner, caseId);
  if (!current) throw new CaseNotFoundError();

  return saveOwnedCaseDraft(db, owner, {
    caseId,
    expectedRevision: current.revision,
    draft: snapshot.draft,
    restoredFromRevision: revision,
  });
}

/**
 * Attaches cases created before sign-in to the account that just signed in.
 *
 * Only unclaimed cases from this exact session are taken, so signing in on a
 * shared computer cannot sweep up a previous person's draft.
 */
export async function claimSessionCasesForUser(
  db: Database,
  sessionId: string,
  userId: string,
): Promise<number> {
  const rows = await db
    .update(cases)
    .set({ userId })
    .where(and(eq(cases.sessionId, sessionId), isNull(cases.userId)))
    .returning({ id: cases.id });
  return rows.length;
}
