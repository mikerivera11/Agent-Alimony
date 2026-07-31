import { createHash } from "node:crypto";
import path from "node:path";

import { fileTypeFromBuffer } from "file-type";

/**
 * Upload validation. Every check operates on bytes/metadata only; nothing
 * here ever logs file contents (only, at most, a caller-supplied filename
 * for the sanitize step and structural metadata like byte size/mime type
 * appear anywhere in this module — never buffer contents).
 */

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export class UploadValidationError extends Error {
  readonly code:
    | "empty"
    | "too_large"
    | "unrecognized_type"
    | "disallowed_type"
    | "mime_mismatch";

  constructor(code: UploadValidationError["code"], message: string) {
    super(message);
    this.name = "UploadValidationError";
    this.code = code;
  }
}

export interface ValidateUploadInput {
  buffer: Buffer;
  /** MIME type declared by the browser/client (e.g. `File.type`). Untrusted. */
  declaredMimeType: string;
  /** Original filename as supplied by the client. Untrusted; used only to derive a sanitized *display* name — never a storage path. */
  originalFilename: string;
  maxBytes: number;
}

export interface ValidatedUpload {
  detectedMimeType: AllowedMimeType;
  byteSize: number;
  sha256: string;
  /** Safe for display only. Never use this to construct a filesystem path or storage object key. */
  sanitizedDisplayFilename: string;
}

function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Strips any directory components and unsafe characters from a
 * user-supplied filename, keeping it strictly cosmetic. The result must
 * never be used to build a filesystem path or storage object key — object
 * keys are always generated independently (see object-key.ts).
 */
export function sanitizeDisplayFilename(originalFilename: string): string {
  const baseName = path.basename(originalFilename.replace(/[\\/]/g, "/"));
  const stripped = baseName
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9 ._-]/g, "_")
    .trim();
  const withoutLeadingDots = stripped.replace(/^\.+/, "");
  const truncated = withoutLeadingDots.slice(0, 200);
  return truncated.length > 0 ? truncated : "upload";
}

/**
 * Validates an uploaded file's size and content, sniffing real magic-byte
 * signatures via `file-type` rather than trusting file extensions or the
 * client-declared MIME type. Rejects empty files, oversized files, anything
 * whose sniffed type is not on the PDF/JPEG/PNG allowlist (this covers
 * archives, executables, and any other disallowed binary format), and any
 * mismatch between the sniffed type and the client's declared type.
 */
export async function validateUpload(input: ValidateUploadInput): Promise<ValidatedUpload> {
  const { buffer, declaredMimeType, originalFilename, maxBytes } = input;

  if (buffer.length === 0) {
    throw new UploadValidationError("empty", "Uploaded file is empty.");
  }
  if (buffer.length > maxBytes) {
    throw new UploadValidationError(
      "too_large",
      `Uploaded file exceeds the maximum allowed size of ${maxBytes} bytes.`,
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    throw new UploadValidationError(
      "unrecognized_type",
      "Could not verify the file's format from its content; only PDF, JPEG, and PNG are accepted.",
    );
  }
  if (!isAllowedMimeType(detected.mime)) {
    throw new UploadValidationError(
      "disallowed_type",
      `File content was identified as '${detected.mime}', which is not an allowed type.`,
    );
  }
  if (declaredMimeType !== detected.mime) {
    throw new UploadValidationError(
      "mime_mismatch",
      `Declared file type '${declaredMimeType}' does not match the detected content type '${detected.mime}'.`,
    );
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    detectedMimeType: detected.mime,
    byteSize: buffer.length,
    sha256,
    sanitizedDisplayFilename: sanitizeDisplayFilename(originalFilename),
  };
}
