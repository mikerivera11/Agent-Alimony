import { describe, expect, it } from "vitest";

import type { Database } from "@/db/client";

import {
  buildGetCaseForSessionQuery,
  buildSaveCaseDraftQuery,
  saveCaseDraft,
} from "./cases-repository";
import { ConcurrencyConflictError } from "./errors";
import { createUnconnectedTestDb } from "./test-db";

/** Minimal fake conforming only to the chain shape `saveCaseDraft` actually calls, so we can exercise its conflict-handling branch without a live database. */
function fakeUpdateDb(returningRows: unknown[]): Database {
  return {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(returningRows),
        }),
      }),
    }),
  } as unknown as Database;
}


describe("cases-repository ownership scoping", () => {
  it("scopes case lookups by both id and sessionId", () => {
    const db = createUnconnectedTestDb();
    const query = buildGetCaseForSessionQuery(db, "session-A", "case-1");
    const { sql, params } = query.toSQL();

    expect(sql).toContain('"cases"."id" =');
    expect(sql).toContain('"cases"."session_id" =');
    expect(params).toContain("case-1");
    expect(params).toContain("session-A");
  });

  it("never queries for a case by id alone (would leak cross-session existence)", () => {
    const db = createUnconnectedTestDb();
    const queryA = buildGetCaseForSessionQuery(db, "session-A", "case-1");
    const queryB = buildGetCaseForSessionQuery(db, "session-B", "case-1");

    // Same caseId, different sessionId => different compiled parameters.
    expect(queryA.toSQL().params).not.toEqual(queryB.toSQL().params);
    expect(queryA.toSQL().sql).toEqual(queryB.toSQL().sql);
  });
});

describe("cases-repository optimistic concurrency", () => {
  it("the draft save is a compare-and-swap on id, sessionId, AND revision", () => {
    const db = createUnconnectedTestDb();
    const query = buildSaveCaseDraftQuery(db, "session-A", "case-1", 5, { foo: "bar" });
    const { sql, params } = query.toSQL();

    expect(sql).toMatch(/where\s*\([\s\S]*"cases"\."id"\s*=[\s\S]*"cases"\."session_id"\s*=[\s\S]*"cases"\."revision"\s*=/i);
    // revision bumped to expectedRevision + 1 in the SET clause
    expect(params).toContain(6);
    // expected (stale-check) revision is still required in the WHERE clause
    expect(params).toContain(5);
    expect(params).toContain("case-1");
    expect(params).toContain("session-A");
  });

  it("a stale expected revision produces a different (non-matching) predicate than the current one", () => {
    const db = createUnconnectedTestDb();
    const staleQuery = buildSaveCaseDraftQuery(db, "session-A", "case-1", 1, {});
    const currentQuery = buildSaveCaseDraftQuery(db, "session-A", "case-1", 5, {});

    expect(staleQuery.toSQL().params).not.toEqual(currentQuery.toSQL().params);
  });

  it("throws ConcurrencyConflictError when the compare-and-swap affects zero rows", async () => {
    const db = fakeUpdateDb([]);
    await expect(saveCaseDraft(db, "session-A", "case-1", 5, {})).rejects.toThrow(
      ConcurrencyConflictError,
    );
  });

  it("returns the updated row when the compare-and-swap succeeds", async () => {
    const updatedRow = { id: "case-1", sessionId: "session-A", draft: { a: 1 }, revision: 6 };
    const db = fakeUpdateDb([updatedRow]);
    await expect(saveCaseDraft(db, "session-A", "case-1", 5, { a: 1 })).resolves.toEqual(
      updatedRow,
    );
  });
});
