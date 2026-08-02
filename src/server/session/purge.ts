/**
 * Session housekeeping.
 *
 * This exists so that deleting old sessions has *one* safe way to be done.
 * `cases.session_id` is `ON DELETE SET NULL` precisely so that a careless
 * `DELETE FROM browser_sessions` cannot take a signed-in person's financial
 * answers with it — but that also means a naive purge would leave anonymous
 * cases stranded with no owner at all. This function removes them explicitly,
 * in the right order, so neither failure happens.
 *
 * Account-owned cases are never touched. Someone's session expiring is not
 * them asking to delete their data.
 */

import { and, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { browserSessions, cases } from "@/db/schema";

export interface PurgeResult {
  anonymousCasesDeleted: number;
  sessionsDeleted: number;
}

export async function purgeExpiredSessions(
  db: Database,
  now: Date = new Date(),
): Promise<PurgeResult> {
  return db.transaction(async (tx) => {
    const expired = or(lt(browserSessions.expiresAt, now), sql`${browserSessions.revokedAt} is not null`);

    // Anonymous cases go first and only while their session still exists; once
    // the session row is gone the link is null and they can no longer be
    // identified as belonging to that session.
    const deletedCases = await tx
      .delete(cases)
      .where(
        and(
          isNull(cases.userId),
          sql`${cases.sessionId} in (select ${browserSessions.id} from ${browserSessions} where ${expired})`,
        ),
      )
      .returning({ id: cases.id });

    const deletedSessions = await tx
      .delete(browserSessions)
      .where(expired)
      .returning({ id: browserSessions.id });

    return {
      anonymousCasesDeleted: deletedCases.length,
      sessionsDeleted: deletedSessions.length,
    };
  });
}

/** Exposed unexecuted so tests can prove account-owned cases are excluded. */
export function buildAnonymousCasePurgeQuery(db: Database, now: Date) {
  return db
    .delete(cases)
    .where(
      and(
        isNull(cases.userId),
        sql`${cases.sessionId} in (select ${browserSessions.id} from ${browserSessions} where ${browserSessions.expiresAt} < ${now})`,
      ),
    );
}
