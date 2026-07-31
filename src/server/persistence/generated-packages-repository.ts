import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { generatedPackages } from "@/db/schema";

import { getCaseForSession } from "./cases-repository";

export interface GeneratedPackageRecord {
  id: string;
  caseId: string;
  caseRevision: number;
  storageProvider: "local" | "azure";
  objectKey: string;
  kind: string;
  createdAt: Date;
}

export interface NewGeneratedPackageInput {
  storageProvider: "local" | "azure";
  /** Randomized, non-user-controlled key returned by a storage adapter's write operation. */
  objectKey: string;
  kind: string;
}

/** Package objects live in a separate storage container/prefix from source documents and are not subject to the 7-day source retention window (see src/server/storage). */
export async function insertGeneratedPackageForCase(
  db: Database,
  sessionId: string,
  caseId: string,
  input: NewGeneratedPackageInput,
): Promise<GeneratedPackageRecord | null> {
  const caseRow = await getCaseForSession(db, sessionId, caseId);
  if (!caseRow) {
    return null;
  }
  const [row] = await db
    .insert(generatedPackages)
    .values({
      caseId,
      caseRevision: caseRow.revision,
      storageProvider: input.storageProvider,
      objectKey: input.objectKey,
      kind: input.kind,
    })
    .returning();
  return row;
}

export async function listGeneratedPackagesForCase(
  db: Database,
  sessionId: string,
  caseId: string,
): Promise<GeneratedPackageRecord[]> {
  const caseRow = await getCaseForSession(db, sessionId, caseId);
  if (!caseRow) {
    return [];
  }
  return db.query.generatedPackages.findMany({
    where: eq(generatedPackages.caseId, caseId),
  });
}
