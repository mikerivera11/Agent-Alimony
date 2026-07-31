import { describe, expect, it } from "vitest";

import { buildGetDocumentForSessionQuery } from "./documents-repository";
import { createUnconnectedTestDb } from "./test-db";

describe("documents-repository ownership scoping", () => {
  it("scopes document lookups by sessionId and excludes soft-deleted rows", () => {
    const db = createUnconnectedTestDb();
    const query = buildGetDocumentForSessionQuery(db, "session-A", "doc-1");
    const { sql, params } = query.toSQL();

    expect(sql).toContain('"documents"."id" =');
    expect(sql).toContain('"documents"."session_id" =');
    expect(sql).toContain('"documents"."deleted_at" is null');
    expect(params).toContain("doc-1");
    expect(params).toContain("session-A");
  });

  it("produces different compiled parameters for different owning sessions", () => {
    const db = createUnconnectedTestDb();
    const queryA = buildGetDocumentForSessionQuery(db, "session-A", "doc-1");
    const queryB = buildGetDocumentForSessionQuery(db, "session-B", "doc-1");

    expect(queryA.toSQL().params).not.toEqual(queryB.toSQL().params);
  });
});
