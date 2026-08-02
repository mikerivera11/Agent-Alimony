import { describe, expect, it } from "vitest";

import { createUnconnectedTestDb } from "@/server/persistence/test-db";

import { buildAnonymousCasePurgeQuery } from "./purge";

/**
 * The rule this protects: **expiring a session must never delete an account's
 * case.** Someone's browser session lapsing is not them asking to erase the
 * financial answers they spent hours entering, and `cases.session_id` is
 * `ON DELETE SET NULL` specifically so a careless purge cannot do it.
 */
describe("session purge", () => {
  it("only ever deletes cases with no owning account", () => {
    const db = createUnconnectedTestDb();
    const { sql } = buildAnonymousCasePurgeQuery(db, new Date("2026-07-30T00:00:00Z")).toSQL();

    expect(sql).toContain('"user_id" is null');
    // and it is scoped to expired sessions, not all sessions
    expect(sql).toContain("browser_sessions");
    expect(sql).toMatch(/expires_at"?\s*</);
  });

  it("never issues an unconditional delete against cases", () => {
    const db = createUnconnectedTestDb();
    const { sql } = buildAnonymousCasePurgeQuery(db, new Date()).toSQL();
    expect(sql).toMatch(/where/i);
  });
});
