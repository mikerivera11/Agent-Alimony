import type { Database } from "@/db/client";
import { findExpiredSourceDocuments, markDocumentDeleted } from "@/server/persistence/documents-repository";

import type { StorageAdapter } from "./adapter";

export interface ReconciliationOutcome {
  examinedCount: number;
  deletedDocumentIds: string[];
  failures: Array<{ documentId: string; error: string }>;
}

/**
 * Enforces the 7-day source-document retention policy: finds every document
 * row whose `sourceExpiresAt` has passed and has not already been marked
 * deleted, removes the underlying object from the "source-documents"
 * container, and marks the row deleted. Intended to run on a schedule (cron,
 * Azure Function timer trigger, etc). Failures for individual documents are
 * collected rather than aborting the whole run, so one bad object never
 * blocks cleanup of the rest.
 */
export async function reconcileExpiredSourceDocuments(
  db: Database,
  storage: StorageAdapter,
  asOf: Date = new Date(),
): Promise<ReconciliationOutcome> {
  const expiredDocuments = await findExpiredSourceDocuments(db, asOf);
  const outcome: ReconciliationOutcome = {
    examinedCount: expiredDocuments.length,
    deletedDocumentIds: [],
    failures: [],
  };

  for (const document of expiredDocuments) {
    try {
      await storage.delete("source-documents", document.objectKey);
      await markDocumentDeleted(db, document.sessionId, document.id);
      outcome.deletedDocumentIds.push(document.id);
    } catch (error) {
      outcome.failures.push({
        documentId: document.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return outcome;
}
