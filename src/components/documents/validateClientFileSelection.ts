import { ACCEPTED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES_CLIENT_HINT } from "./apiContracts";

/**
 * Fast, non-authoritative client-side pre-check so people get immediate
 * feedback before a round trip to the server. This is purely a UX
 * convenience — it never replaces the server's real magic-byte validation
 * in `validateUpload`, since a client-declared MIME type/extension can
 * always be spoofed.
 */
export interface ClientFileCheckResult {
  ok: boolean;
  message?: string;
}

export function checkFileBeforeUpload(file: { size: number; type: string }): ClientFileCheckResult {
  if (file.size === 0) {
    return { ok: false, message: "That file appears to be empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES_CLIENT_HINT) {
    return { ok: false, message: "Files must be 10MB or smaller." };
  }
  if (!ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type as (typeof ACCEPTED_UPLOAD_MIME_TYPES)[number])) {
    return { ok: false, message: "Only PDF, JPEG, and PNG files are accepted." };
  }
  return { ok: true };
}
