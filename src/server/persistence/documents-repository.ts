import { and, eq, isNull, lte } from "drizzle-orm";

import type { Database } from "@/db/client";
import { documents } from "@/db/schema";

export interface DocumentRecord {
  id: string;
  caseId: string;
  sessionId: string;
  storageProvider: "local" | "azure";
  objectKey: string;
  displayFilename: string;
  declaredMimeType: string;
  detectedMimeType: string;
  byteSize: number;
  sha256: string;
  sourceExpiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface NewDocumentInput {
  caseId: string;
  sessionId: string;
  storageProvider: "local" | "azure";
  /** Randomized, non-user-controlled key returned by a storage adapter's write operation. */
  objectKey: string;
  displayFilename: string;
  declaredMimeType: string;
  detectedMimeType: string;
  byteSize: number;
  sha256: string;
  /** Defaults to 7 days from now if not provided — see storage source-retention policy. */
  sourceExpiresAt?: Date;
}

const SOURCE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function insertDocumentForCase(
  db: Database,
  input: NewDocumentInput,
): Promise<DocumentRecord> {
  const [row] = await db
    .insert(documents)
    .values({
      caseId: input.caseId,
      sessionId: input.sessionId,
      storageProvider: input.storageProvider,
      objectKey: input.objectKey,
      displayFilename: input.displayFilename,
      declaredMimeType: input.declaredMimeType,
      detectedMimeType: input.detectedMimeType,
      byteSize: input.byteSize,
      sha256: input.sha256,
      sourceExpiresAt: input.sourceExpiresAt ?? new Date(Date.now() + SOURCE_RETENTION_MS),
    })
    .returning();
  return row;
}

/** Scoped strictly by sessionId so a document id from another session is never returned. */
export async function getDocumentForSession(
  db: Database,
  sessionId: string,
  documentId: string,
): Promise<DocumentRecord | undefined> {
  return buildGetDocumentForSessionQuery(db, sessionId, documentId);
}

/**
 * Exposed separately (unexecuted) so tests can assert, via `.toSQL()`, that
 * the compiled query always scopes by `sessionId` — without needing a live
 * database connection to run it.
 */
export function buildGetDocumentForSessionQuery(
  db: Database,
  sessionId: string,
  documentId: string,
) {
  return db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.sessionId, sessionId),
      isNull(documents.deletedAt),
    ),
  });
}

export async function listDocumentsForCase(
  db: Database,
  sessionId: string,
  caseId: string,
): Promise<DocumentRecord[]> {
  return db.query.documents.findMany({
    where: and(
      eq(documents.caseId, caseId),
      eq(documents.sessionId, sessionId),
      isNull(documents.deletedAt),
    ),
  });
}

export async function markDocumentDeleted(
  db: Database,
  sessionId: string,
  documentId: string,
): Promise<boolean> {
  const rows = await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.sessionId, sessionId)))
    .returning({ id: documents.id });
  return rows.length > 0;
}

/**
 * System-level query (not session-scoped by design) used by the storage
 * reconciliation job to find source documents past their 7-day retention
 * window so the underlying blob/object can be deleted and the row marked.
 */
export async function findExpiredSourceDocuments(
  db: Database,
  asOf: Date = new Date(),
): Promise<DocumentRecord[]> {
  return db.query.documents.findMany({
    where: and(lte(documents.sourceExpiresAt, asOf), isNull(documents.deletedAt)),
  });
}
