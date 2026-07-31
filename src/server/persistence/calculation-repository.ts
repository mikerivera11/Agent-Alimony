import { z } from "zod";

import type { Database } from "@/db/client";
import { calculationRuns } from "@/db/schema";
import { extractionProposalRecordSchema } from "@/server/extraction/schemas";
import { mapConfirmedProposalsToFacts } from "@/server/extraction/facts";

import { getCaseForSession } from "./cases-repository";
import { listConfirmedProposalsForCase } from "./extraction-proposals-repository";

export interface CalculationRunRecord {
  id: string;
  caseId: string;
  caseRevision: number;
  engineVersion: string;
  inputs: unknown;
  result: unknown;
  createdAt: Date;
}

export interface CreateCalculationRunInput {
  engineVersion: string;
  /** The calculation engine's output. Computed entirely outside this module (domain rules ownership) — this repository only persists it alongside the confirmed-facts snapshot that justified it. */
  result: unknown;
}

/**
 * Persists a calculation run. The `inputs` snapshot is built exclusively via
 * `mapConfirmedProposalsToFacts`, and the proposals feeding it are fetched
 * through `listConfirmedProposalsForCase`, which itself filters to
 * `status = "confirmed"` at the SQL level. This is a deliberate two-layer
 * guarantee: even if the query layer's filter were ever loosened, the
 * mapping function independently re-filters by status before producing
 * facts, so a "proposed" or "rejected" row can never reach `inputs`.
 */
export async function createCalculationRun(
  db: Database,
  sessionId: string,
  caseId: string,
  input: CreateCalculationRunInput,
): Promise<CalculationRunRecord | null> {
  const caseRow = await getCaseForSession(db, sessionId, caseId);
  if (!caseRow) {
    return null;
  }

  const confirmedRows = await listConfirmedProposalsForCase(db, sessionId, caseId);
  const validatedProposals = z.array(extractionProposalRecordSchema).parse(confirmedRows);
  const facts = mapConfirmedProposalsToFacts(validatedProposals);

  const [row] = await db
    .insert(calculationRuns)
    .values({
      caseId,
      caseRevision: caseRow.revision,
      engineVersion: input.engineVersion,
      inputs: facts,
      result: input.result,
    })
    .returning();
  return row;
}

export async function listCalculationRunsForCase(
  db: Database,
  sessionId: string,
  caseId: string,
): Promise<CalculationRunRecord[]> {
  const caseRow = await getCaseForSession(db, sessionId, caseId);
  if (!caseRow) {
    return [];
  }
  return db.query.calculationRuns.findMany({
    where: (fields, { eq }) => eq(fields.caseId, caseId),
  });
}
