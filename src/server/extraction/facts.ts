import type { ExtractionProposalRecord } from "./schemas";

/**
 * A fact ready to feed a calculation engine. Every field is traceable back
 * to the confirmed proposal and source document it came from.
 */
export interface CalculationFact {
  fieldKey: string;
  value: ExtractionProposalRecord["value"];
  sourceDocumentId: string;
  sourceProposalId: string;
  confidence: number;
}

/**
 * The ONLY sanctioned path from extraction proposals to calculation facts.
 * Filters strictly on `status === "confirmed"` — proposed and rejected rows
 * are always excluded, regardless of value, confidence, or how they were
 * produced (mock, configured, or otherwise). Uses `confirmedValue` when
 * present (the value as confirmed, which may differ from the originally
 * proposed value if a user edited it before confirming), falling back to the
 * original proposed `value` only for legacy rows without a distinct
 * confirmed value recorded.
 */
export function mapConfirmedProposalsToFacts(
  proposals: readonly ExtractionProposalRecord[],
): CalculationFact[] {
  return proposals
    .filter((proposal) => proposal.status === "confirmed")
    .map((proposal) => ({
      fieldKey: proposal.fieldKey,
      value: proposal.confirmedValue ?? proposal.value,
      sourceDocumentId: proposal.sourceDocumentId,
      sourceProposalId: proposal.id,
      confidence: proposal.confidence,
    }));
}
