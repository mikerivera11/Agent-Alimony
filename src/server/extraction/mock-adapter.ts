import { createHash } from "node:crypto";

import type { AdapterProposedField } from "./schemas";
import { adapterRunResultSchema } from "./schemas";
import type { ExtractionAdapter, ExtractionAdapterResult, ExtractionRunInput } from "./adapter";

/**
 * Canonical marker whose SHA-256 identifies the single designated demo
 * document. A real demo fixture shipped elsewhere in the app (outside this
 * module's ownership) must contain exactly this marker as its byte content
 * for the mock adapter to recognize it. Any other upload — including
 * anything merely *named* like a demo file — is treated as unrecognized and
 * returns a "not processed" result. Content-based (not filename-based)
 * matching prevents a user from spoofing demo behavior via display name.
 */
export const DEMO_DOCUMENT_MARKER = "florida-support-guide-demo-document-v1";
export const DEMO_DOCUMENT_SHA256 = createHash("sha256")
  .update(DEMO_DOCUMENT_MARKER, "utf8")
  .digest("hex");

function buildDemoProposals(documentId: string): AdapterProposedField[] {
  return [
    {
      fieldKey: "participant.petitioner.grossMonthlyIncome",
      value: 4200,
      sourceDocumentId: documentId,
      sourcePage: 1,
      sourceLocation: { page: 1, note: "Gross pay, current pay stub" },
      confidence: 0.92,
    },
    {
      fieldKey: "participant.respondent.grossMonthlyIncome",
      value: 3100,
      sourceDocumentId: documentId,
      sourcePage: 1,
      sourceLocation: { page: 1, note: "Gross pay, current pay stub" },
      confidence: 0.88,
    },
    {
      fieldKey: "case.children.count",
      value: 2,
      sourceDocumentId: documentId,
      sourcePage: 1,
      confidence: 0.99,
    },
  ];
}

/**
 * Explicitly-labeled demo/mock adapter. It never performs real document
 * understanding: it recognizes exactly one designated demo document by
 * content hash and returns a fixed, deterministic set of demo proposals for
 * it. For every other document — any real user upload — it returns a
 * `not_processed` result with zero proposals. It must never be mistaken for
 * a real extraction provider.
 */
export class MockExtractionAdapter implements ExtractionAdapter {
  readonly name = "mock";
  readonly label = "Mock Extraction Adapter (DEMO DATA ONLY — not a real document reader)";

  async run(input: ExtractionRunInput): Promise<ExtractionAdapterResult> {
    const isDemoDocument = input.sha256 === DEMO_DOCUMENT_SHA256;

    const result: ExtractionAdapterResult = isDemoDocument
      ? {
          status: "completed",
          isDemo: true,
          proposals: buildDemoProposals(input.documentId),
        }
      : {
          status: "not_processed",
          isDemo: false,
          proposals: [],
        };

    // Self-validate against the adapter contract before returning so this
    // adapter can never emit a shape (e.g. a smuggled "confirmed" status or
    // proposals under a non-"completed" status) that violates the contract.
    adapterRunResultSchema.parse(result);
    return result;
  }
}
