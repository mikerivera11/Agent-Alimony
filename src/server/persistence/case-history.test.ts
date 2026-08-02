import { describe, expect, it } from "vitest";

import type { Database } from "@/db/client";

import {
  buildOwnedCaseQuery,
  CaseNotFoundError,
  listCaseRevisions,
  restoreCaseRevision,
  saveOwnedCaseDraft,
} from "./case-history";
import { ConcurrencyConflictError } from "./errors";
import { createUnconnectedTestDb } from "./test-db";

/**
 * These tests exist because the ownership predicate is the only thing standing
 * between two strangers' divorce finances. They assert the compiled SQL rather
 * than trusting the code reads correctly, and they assert the *restore*
 * behaviour because a restore that overwrote history would be the single most
 * damaging bug this feature could ship with.
 */

describe("case ownership predicate", () => {
  it("restricts an anonymous caller to unclaimed cases from their own session", () => {
    const db = createUnconnectedTestDb();
    const { sql, params } = buildOwnedCaseQuery(
      db,
      { sessionId: "session-A", userId: null },
      "case-1",
    ).toSQL();

    expect(sql).toContain('"cases"."session_id" =');
    expect(sql).toContain('"cases"."user_id" is null');
    expect(params).toContain("session-A");
    expect(params).toContain("case-1");
    // No user id can appear, so an anonymous caller cannot reach an account's case.
    expect(sql).not.toMatch(/"cases"\."user_id"\s*=/);
  });

  it("lets a signed-in caller reach their account's cases", () => {
    const db = createUnconnectedTestDb();
    const { sql, params } = buildOwnedCaseQuery(
      db,
      { sessionId: "session-A", userId: "user-1" },
      "case-1",
    ).toSQL();

    expect(sql).toMatch(/"cases"\."user_id"\s*=/);
    expect(params).toContain("user-1");
  });

  it("produces different parameters for two different users asking for the same case", () => {
    const db = createUnconnectedTestDb();
    const a = buildOwnedCaseQuery(db, { sessionId: "s", userId: "user-1" }, "case-1").toSQL();
    const b = buildOwnedCaseQuery(db, { sessionId: "s", userId: "user-2" }, "case-1").toSQL();

    expect(a.sql).toEqual(b.sql);
    expect(a.params).not.toEqual(b.params);
  });

  it("never scopes by case id alone", () => {
    const db = createUnconnectedTestDb();
    const { sql } = buildOwnedCaseQuery(db, { sessionId: "s", userId: "u" }, "case-1").toSQL();
    const idComparisons = sql.match(/"cases"\."id"\s*=/g) ?? [];
    expect(idComparisons).toHaveLength(1);
    // and it is always joined to an ownership condition
    expect(sql).toMatch(/and/i);
  });
});

/**
 * Fake shaped only to the chains these functions actually call. A real
 * database is not needed to prove the control flow, and requiring one would
 * mean these guarantees went untested in CI.
 */
function fakeDb(options: {
  updateRows?: unknown[];
  ownedCase?: unknown;
  revision?: unknown;
  onRevisionInsert?: (values: unknown) => void;
}): Database {
  const tx = {
    update: () => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve(options.updateRows ?? []) }),
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        options.onRevisionInsert?.(values);
        return Promise.resolve();
      },
    }),
  };

  return {
    transaction: (fn: (t: unknown) => unknown) => fn(tx),
    query: {
      cases: { findFirst: () => Promise.resolve(options.ownedCase) },
      caseRevisions: {
        findFirst: () => Promise.resolve(options.revision),
        findMany: () => Promise.resolve([]),
      },
    },
  } as unknown as Database;
}

describe("saving a case draft", () => {
  it("writes a history snapshot alongside every save", async () => {
    const inserts: unknown[] = [];
    const db = fakeDb({
      updateRows: [{ revision: 6 }],
      onRevisionInsert: (values) => inserts.push(values),
    });

    await saveOwnedCaseDraft(
      db,
      { sessionId: "s", userId: "u" },
      { caseId: "case-1", expectedRevision: 5, draft: { a: 1 } },
    );

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ caseId: "case-1", revision: 6, draft: { a: 1 } });
  });

  it("refuses a stale save rather than overwriting the newer one", async () => {
    const db = fakeDb({ updateRows: [] });
    await expect(
      saveOwnedCaseDraft(
        db,
        { sessionId: "s", userId: "u" },
        { caseId: "case-1", expectedRevision: 1, draft: {} },
      ),
    ).rejects.toThrow(ConcurrencyConflictError);
  });
});

describe("restoring an earlier version", () => {
  it("saves the old snapshot forward as a new revision instead of deleting anything", async () => {
    const inserts: { caseId: string; revision: number; restoredFromRevision: number | null }[] = [];
    const db = fakeDb({
      ownedCase: { id: "case-1", revision: 9 },
      revision: { id: "rev-2", caseId: "case-1", revision: 2, draft: { answer: "old" } },
      updateRows: [{ revision: 10 }],
      onRevisionInsert: (values) => inserts.push(values as never),
    });

    const result = await restoreCaseRevision(db, { sessionId: "s", userId: "u" }, "case-1", 2);

    expect(result.revision).toBe(10);
    // The new revision is ahead of the current one — history is appended, not rewound.
    expect(inserts[0].revision).toBe(10);
    expect(inserts[0].restoredFromRevision).toBe(2);
  });

  it("treats a case the caller does not own as nonexistent", async () => {
    const db = fakeDb({ ownedCase: undefined });
    await expect(
      restoreCaseRevision(db, { sessionId: "s", userId: "u" }, "case-1", 2),
    ).rejects.toThrow(CaseNotFoundError);
  });

  it("does not list revisions for a case the caller does not own", async () => {
    const db = fakeDb({ ownedCase: undefined });
    await expect(
      listCaseRevisions(db, { sessionId: "s", userId: "u" }, "case-1"),
    ).rejects.toThrow(CaseNotFoundError);
  });
});
