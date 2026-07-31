import type { AdapterProposedField, ExtractionRunStatus } from "@/server/extraction";
import type { AllowedMimeType } from "@/server/storage/upload-validation";

/**
 * Wire contract shared between the `/api/documents/*` route handlers and the
 * `documents` UI. Kept in `components/documents` (rather than duplicated in
 * both places) so the client and server can never silently drift apart.
 *
 * Every response is `no-store` and carries only safe, structural metadata —
 * never raw file bytes, never a stack trace, never document content.
 */

export type SafeDetectedMimeType = AllowedMimeType;

/** Safe-to-display metadata about a validated upload. No file bytes are ever included or retained. */
export interface SafeUploadedDocumentMetadata {
  documentId: string;
  sanitizedDisplayFilename: string;
  detectedMimeType: SafeDetectedMimeType;
  byteSize: number;
  sha256: string;
}

/** A single adapter-proposed field, always inert data — never an instruction or a confirmed fact. */
export type ExtractionProposalDTO = AdapterProposedField;

export interface ExtractionResultDTO {
  status: ExtractionRunStatus;
  isDemo: boolean;
  /** Human-readable adapter label (always names the mock/demo adapter explicitly). */
  adapterLabel: string;
  proposals: ExtractionProposalDTO[];
}

export interface ApiErrorPayload {
  /** A stable, generic machine-readable code. Never derived from file content or a raw exception message. */
  code: string;
  /** A generic, user-safe message. Never a stack trace or internal detail. */
  message: string;
}

export interface UploadSuccessResponse {
  ok: true;
  document: SafeUploadedDocumentMetadata;
  extraction: ExtractionResultDTO;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiErrorPayload;
}

export type UploadApiResponse = UploadSuccessResponse | ApiErrorResponse;

export interface DemoExtractionSuccessResponse {
  ok: true;
  /** The fictional demo "document" is never a real uploaded file — just a generated identifier. */
  document: {
    documentId: string;
  };
  extraction: ExtractionResultDTO;
}

export type DemoExtractionApiResponse = DemoExtractionSuccessResponse | ApiErrorResponse;

export const MAX_UPLOAD_BYTES_CLIENT_HINT = 10 * 1024 * 1024;

export const ACCEPTED_UPLOAD_MIME_TYPES: readonly SafeDetectedMimeType[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
