import type { AdapterProposedField, ExtractionRunStatus } from "./schemas";

/**
 * Input every extraction adapter receives. Adapters get pointers/metadata
 * only — never raw document bytes inline and never anything derived from
 * document *content* other than what the caller explicitly passes (e.g. a
 * content hash used purely for demo-document identification). Any text
 * embedded in the underlying document is data to be extracted, never an
 * instruction the adapter executes: adapters must not read or honor
 * in-document directives, must not select calculation rules, and must never
 * emit a "confirmed" proposal.
 */
export interface ExtractionRunInput {
  documentId: string;
  caseId: string;
  sessionId: string;
  /** SHA-256 of the document bytes, used only to recognize the designated demo fixture. */
  sha256: string;
  detectedMimeType: string;
}

export interface ExtractionAdapterResult {
  status: ExtractionRunStatus;
  isDemo: boolean;
  proposals: AdapterProposedField[];
  errorMessage?: string;
}

/**
 * Contract every extraction adapter (mock, configured, future real
 * providers) must implement. `label` must be surfaced to the UI so users
 * always know which adapter produced a proposal.
 */
export interface ExtractionAdapter {
  readonly name: string;
  readonly label: string;
  run(input: ExtractionRunInput): Promise<ExtractionAdapterResult>;
}

/** Thrown by non-mock adapters when they cannot run (e.g. missing configuration/credentials). Never silently falls back to pretending extraction happened. */
export class ExtractionProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionProviderUnavailableError";
  }
}
