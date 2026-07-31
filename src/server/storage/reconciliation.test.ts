import { describe, expect, it } from "vitest";

import type { Database } from "@/db/client";
import type { StorageAdapter, StorageContainer } from "./adapter";
import { reconcileExpiredSourceDocuments } from "./reconciliation";

interface FakeDocumentRow {
  id: string;
  sessionId: string;
  objectKey: string;
  sourceExpiresAt: Date;
  deletedAt: Date | null;
}

/** Minimal in-memory fake conforming only to the calls reconciliation makes: `db.query.documents.findMany` and `db.update(documents).set(...).where(...).returning(...)`. */
function fakeDb(rows: FakeDocumentRow[]): Database {
  return {
    query: {
      documents: {
        findMany: async () => rows.filter((r) => !r.deletedAt && r.sourceExpiresAt <= new Date()),
      },
    },
    update: () => ({
      set: (patch: { deletedAt: Date }) => ({
        where: () => ({
          returning: async () => {
            const target = rows[0];
            target.deletedAt = patch.deletedAt;
            return [{ id: target.id }];
          },
        }),
      }),
    }),
  } as unknown as Database;
}

class FakeStorageAdapter implements StorageAdapter {
  readonly provider = "local" as const;
  deletedKeys: string[] = [];
  failOn: Set<string> = new Set();

  async write(): Promise<{ objectKey: string }> {
    throw new Error("not used in this test");
  }
  async read(): Promise<Buffer> {
    throw new Error("not used in this test");
  }
  async delete(_container: StorageContainer, objectKey: string): Promise<void> {
    if (this.failOn.has(objectKey)) {
      throw new Error(`simulated storage failure for ${objectKey}`);
    }
    this.deletedKeys.push(objectKey);
  }
  async exists(): Promise<boolean> {
    return false;
  }
}

describe("reconcileExpiredSourceDocuments", () => {
  it("deletes the underlying object and marks the row deleted for each expired document", async () => {
    const expiredRow: FakeDocumentRow = {
      id: "doc-1",
      sessionId: "session-1",
      objectKey: "aa/bb/expired-object",
      sourceExpiresAt: new Date(Date.now() - 1000),
      deletedAt: null,
    };
    const db = fakeDb([expiredRow]);
    const storage = new FakeStorageAdapter();

    const outcome = await reconcileExpiredSourceDocuments(db, storage);

    expect(outcome.examinedCount).toBe(1);
    expect(outcome.deletedDocumentIds).toEqual(["doc-1"]);
    expect(storage.deletedKeys).toEqual(["aa/bb/expired-object"]);
    expect(outcome.failures).toEqual([]);
  });

  it("collects a per-document failure without aborting the whole reconciliation run", async () => {
    const expiredRow: FakeDocumentRow = {
      id: "doc-1",
      sessionId: "session-1",
      objectKey: "aa/bb/will-fail",
      sourceExpiresAt: new Date(Date.now() - 1000),
      deletedAt: null,
    };
    const db = fakeDb([expiredRow]);
    const storage = new FakeStorageAdapter();
    storage.failOn.add("aa/bb/will-fail");

    const outcome = await reconcileExpiredSourceDocuments(db, storage);

    expect(outcome.deletedDocumentIds).toEqual([]);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0].documentId).toBe("doc-1");
  });

  it("examines zero documents when none are expired", async () => {
    const db = fakeDb([]);
    const storage = new FakeStorageAdapter();
    const outcome = await reconcileExpiredSourceDocuments(db, storage);
    expect(outcome.examinedCount).toBe(0);
    expect(outcome.deletedDocumentIds).toEqual([]);
  });
});
