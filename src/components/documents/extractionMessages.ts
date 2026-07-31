import type { ExtractionResultDTO } from "./apiContracts";

/**
 * Pure, presentation-only helpers for describing an extraction outcome in
 * plain language. Kept free of React/DOM so they're easy to unit test and
 * so the "what actually happened" wording lives in exactly one place.
 */

export type ExtractionOutcomeKind = "demo" | "not_processed" | "failed" | "pending" | "completed_non_demo";

export interface ExtractionOutcomeDescription {
  kind: ExtractionOutcomeKind;
  headline: string;
  detail: string;
}

/**
 * Describes the outcome of running the mock extraction adapter against a
 * user-uploaded (non-demo-fixture) file. Always makes explicit that the
 * mock adapter never actually read or extracted anything from a real
 * upload — there is no wording path here that could be mistaken for a
 * real-extraction success message.
 */
export function describeUploadExtractionOutcome(
  extraction: Pick<ExtractionResultDTO, "status" | "isDemo" | "proposals">,
): ExtractionOutcomeDescription {
  if (extraction.isDemo) {
    return {
      kind: "demo",
      headline: "This file's content matched the designated demo fixture.",
      detail:
        "The mock adapter recognized this exact fixture and returned fictional demo proposals below — it still did not perform real document understanding.",
    };
  }

  switch (extraction.status) {
    case "not_processed":
      return {
        kind: "not_processed",
        headline: "The mock adapter did not read or extract anything from this file.",
        detail:
          "This preview only recognizes one designated demo fixture by exact content hash. Every other upload — including yours — is left completely unprocessed: zero fields were read, inferred, or proposed.",
      };
    case "failed":
      return {
        kind: "failed",
        headline: "Extraction did not complete.",
        detail: "No proposals were produced for this file.",
      };
    case "pending":
      return {
        kind: "pending",
        headline: "Extraction has not run yet.",
        detail: "No proposals are available yet for this file.",
      };
    case "completed":
    default:
      return {
        kind: "completed_non_demo",
        headline: "Extraction completed.",
        detail:
          extraction.proposals.length > 0
            ? "Proposals were produced — review each one below before deciding."
            : "No fields were proposed for this file.",
      };
  }
}
