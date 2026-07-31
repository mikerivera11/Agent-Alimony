import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { extractionProposals, extractionRuns } from "@/db/schema";
import type { AdapterProposedField } from "@/server/extraction/schemas";
import { adapterRunResultSchema } from "@/server/extraction/schemas";

import { getCaseForSession } from "./cases-repository";
import { InvalidProposalTransitionError } from "./errors";

export interface ExtractionRunRecord {
  id: string;
  caseId: string;
  documentId: string;
  adapter: string;
  isDemo: boolean;
  status: "pending" | "completed" | "failed" | "not_processed";
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface ExtractionProposalRow {
  id: string;
  extractionRunId: string;
  caseId: string;
  fieldKey: string;
  value: unknown;
  confirmedValue: unknown;
  sourceDocumentId: string;
  sourcePage: number | null;
  sourceLocation: unknown;
  confidence: string;
  status: "proposed" | "confirmed" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
}

export interface RecordExtractionRunInput {
  caseId: string;
  sessionId: string;
  documentId: string;
  adapterName: string;
  result: {
    status: "pending" | "completed" | "failed" | "not_processed";
    isDemo: boolean;
    proposals: AdapterProposedField[];
    errorMessage?: string;
  };
}

/**
 * Persists one extraction attempt and, only when the (schema-validated)
 * adapter result is `completed`, its proposals — always inserted with
 * `status: "proposed"` regardless of anything the adapter emitted, since the
 * adapter output contract has no `status` field at all. Every proposal's
 * `sourceDocumentId` must match the document the run was performed against;
 * this rejects a misbehaving adapter that tries to attribute a proposal to
 * an unrelated document.
 */
export async function recordExtractionRun(
  db: Database,
  input: RecordExtractionRunInput,
): Promise<{ run: ExtractionRunRecord; proposals: ExtractionProposalRow[] } | null> {
  const caseRow = await getCaseForSession(db, input.sessionId, input.caseId);
  if (!caseRow) {
    return null;
  }

  // Defense in depth: re-validate the adapter's own self-checked output.
  const validated = adapterRunResultSchema.parse(input.result);

  for (const proposal of validated.proposals) {
    if (proposal.sourceDocumentId !== input.documentId) {
      throw new Error(
        "Extraction adapter proposal referenced a document outside the current run.",
      );
    }
  }

  const [run] = await db
    .insert(extractionRuns)
    .values({
      caseId: input.caseId,
      documentId: input.documentId,
      adapter: input.adapterName,
      isDemo: validated.isDemo,
      status: validated.status,
      errorMessage: validated.errorMessage ?? null,
      completedAt: new Date(),
    })
    .returning();

  if (validated.status !== "completed" || validated.proposals.length === 0) {
    return { run, proposals: [] };
  }

  const proposals = await db
    .insert(extractionProposals)
    .values(
      validated.proposals.map((proposal) => ({
        extractionRunId: run.id,
        caseId: input.caseId,
        fieldKey: proposal.fieldKey,
        value: proposal.value,
        sourceDocumentId: proposal.sourceDocumentId,
        sourcePage: proposal.sourcePage ?? null,
        sourceLocation: proposal.sourceLocation ?? null,
        confidence: proposal.confidence.toString(),
        status: "proposed" as const,
      })),
    )
    .returning();

  return { run, proposals };
}

export async function listProposalsForCase(
  db: Database,
  sessionId: string,
  caseId: string,
): Promise<ExtractionProposalRow[]> {
  const caseRow = await getCaseForSession(db, sessionId, caseId);
  if (!caseRow) {
    return [];
  }
  return db.query.extractionProposals.findMany({
    where: eq(extractionProposals.caseId, caseId),
  });
}

export async function listConfirmedProposalsForCase(
  db: Database,
  sessionId: string,
  caseId: string,
): Promise<ExtractionProposalRow[]> {
  const caseRow = await getCaseForSession(db, sessionId, caseId);
  if (!caseRow) {
    return [];
  }
  return db.query.extractionProposals.findMany({
    where: and(eq(extractionProposals.caseId, caseId), eq(extractionProposals.status, "confirmed")),
  });
}

async function transitionProposal(
  db: Database,
  sessionId: string,
  proposalId: string,
  nextStatus: "confirmed" | "rejected",
  confirmedValue?: unknown,
): Promise<ExtractionProposalRow> {
  const existing = await db.query.extractionProposals.findFirst({
    where: eq(extractionProposals.id, proposalId),
  });
  // Ownership is enforced via the parent case; a foreign-session proposal
  // (or one that does not exist) is treated identically as "not found".
  if (!existing) {
    throw new InvalidProposalTransitionError("Proposal not found.");
  }
  const caseRow = await getCaseForSession(db, sessionId, existing.caseId);
  if (!caseRow) {
    throw new InvalidProposalTransitionError("Proposal not found.");
  }
  if (!isValidProposalTransition(existing.status)) {
    throw new InvalidProposalTransitionError(
      `Cannot transition a proposal from '${existing.status}' to '${nextStatus}'; only 'proposed' proposals may be confirmed or rejected.`,
    );
  }

  const [row] = await buildProposalTransitionQuery(
    db,
    proposalId,
    nextStatus,
    nextStatus === "confirmed" ? confirmedValue ?? existing.value : undefined,
  );

  if (!row) {
    // Lost a race with a concurrent transition on the same proposal.
    throw new InvalidProposalTransitionError(
      "The proposal was already confirmed or rejected by another request.",
    );
  }
  return row;
}

/**
 * Pure predicate: only a proposal currently in `"proposed"` status may be
 * confirmed or rejected. `"confirmed"` and `"rejected"` are terminal states.
 */
export function isValidProposalTransition(
  currentStatus: "proposed" | "confirmed" | "rejected",
): boolean {
  return currentStatus === "proposed";
}

/**
 * Exposed separately (unexecuted) so tests can assert, via `.toSQL()`, that
 * the compare-and-swap predicate always requires `status = 'proposed'` in
 * its WHERE clause — the mechanism that makes "confirmed"/"rejected" a
 * one-way, race-safe transition — without needing a live database
 * connection.
 */
export function buildProposalTransitionQuery(
  db: Database,
  proposalId: string,
  nextStatus: "confirmed" | "rejected",
  confirmedValue: unknown,
) {
  return db
    .update(extractionProposals)
    .set({
      status: nextStatus,
      confirmedAt: nextStatus === "confirmed" ? new Date() : null,
      confirmedValue: nextStatus === "confirmed" ? confirmedValue ?? null : null,
      updatedAt: new Date(),
    })
    .where(and(eq(extractionProposals.id, proposalId), eq(extractionProposals.status, "proposed")))
    .returning();
}

/** Confirms a proposed field, optionally overriding the value the user actually confirmed (e.g. after editing). */
export async function confirmProposal(
  db: Database,
  sessionId: string,
  proposalId: string,
  confirmedValue?: unknown,
): Promise<ExtractionProposalRow> {
  return transitionProposal(db, sessionId, proposalId, "confirmed", confirmedValue);
}

/** Rejects a proposed field. Rejected proposals can never later be mapped to calculation facts. */
export async function rejectProposal(
  db: Database,
  sessionId: string,
  proposalId: string,
): Promise<ExtractionProposalRow> {
  return transitionProposal(db, sessionId, proposalId, "rejected");
}
