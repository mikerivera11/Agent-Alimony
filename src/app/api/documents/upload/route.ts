import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env";
import { MockExtractionAdapter } from "@/server/extraction";
import { UploadValidationError, validateUpload } from "@/server/storage/upload-validation";

import type { ApiErrorResponse, UploadApiResponse } from "@/components/documents/apiContracts";

/**
 * Handles document uploads for the local-first `/documents` preview.
 *
 * Important properties of this route:
 *  - Real file bytes are never written to disk or any persistent store here;
 *    the buffer is used only in-memory to validate + hash the upload, then
 *    discarded when the request completes.
 *  - Validation always goes through `validateUpload`, which sniffs real
 *    magic-byte signatures rather than trusting the extension or the
 *    client-declared MIME type.
 *  - Extraction always goes through the explicit `MockExtractionAdapter`
 *    (never whatever adapter `EXTRACTION_PROVIDER` might otherwise select),
 *    so a real user upload can only ever come back `not_processed` with zero
 *    proposals unless its bytes are byte-for-byte the designated demo
 *    fixture.
 *  - Errors are always generic, safe payloads: no stack traces, no file
 *    content, no filenames beyond what the client already provided.
 */

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Small fixed allowance for multipart boilerplate (field names/boundaries), not file content. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

async function readBodyWithLimit(
  request: NextRequest,
  limitBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > limitBytes) {
      await reader.cancel();
      throw new UploadValidationError("too_large", "Request body exceeds the upload limit.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

const GENERIC_VALIDATION_MESSAGES: Record<UploadValidationError["code"], string> = {
  empty: "The uploaded file is empty.",
  too_large: "The uploaded file is larger than the 10MB limit.",
  unrecognized_type: "The file's format could not be verified. Only PDF, JPEG, and PNG are accepted.",
  disallowed_type: "That file type is not accepted. Only PDF, JPEG, and PNG are accepted.",
  mime_mismatch: "The file's content did not match its reported type.",
};

function errorResponse(status: number, code: string, message: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadApiResponse>> {
  const env = getServerEnv();
  const maxBytes = env.MAX_UPLOAD_BYTES;

  // Reject obviously-oversized requests before buffering anything, using
  // only the declared Content-Length header.
  const declaredContentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredContentLength) && declaredContentLength > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return errorResponse(413, "too_large", GENERIC_VALIDATION_MESSAGES.too_large);
  }

  let formData: FormData;
  try {
    const body = await readBodyWithLimit(request, maxBytes + MULTIPART_OVERHEAD_BYTES);
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: body.buffer,
    });
    formData = await boundedRequest.formData();
  } catch (error) {
    if (error instanceof UploadValidationError && error.code === "too_large") {
      return errorResponse(413, "too_large", GENERIC_VALIDATION_MESSAGES.too_large);
    }
    return errorResponse(400, "invalid_request", "The upload could not be read.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, "missing_file", "No file was included in the upload.");
  }

  // Re-check size against the actual parsed file before touching its bytes.
  if (file.size === 0) {
    return errorResponse(422, "empty", GENERIC_VALIDATION_MESSAGES.empty);
  }
  if (file.size > maxBytes) {
    return errorResponse(413, "too_large", GENERIC_VALIDATION_MESSAGES.too_large);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return errorResponse(400, "invalid_request", "The upload could not be read.");
  }

  try {
    const validated = await validateUpload({
      buffer,
      declaredMimeType: file.type,
      originalFilename: file.name,
      maxBytes,
    });

    const documentId = randomUUID();
    const adapter = new MockExtractionAdapter();
    const extractionResult = await adapter.run({
      documentId,
      caseId: randomUUID(),
      sessionId: randomUUID(),
      sha256: validated.sha256,
      detectedMimeType: validated.detectedMimeType,
    });

    const body: UploadApiResponse = {
      ok: true,
      document: {
        documentId,
        sanitizedDisplayFilename: validated.sanitizedDisplayFilename,
        detectedMimeType: validated.detectedMimeType,
        byteSize: validated.byteSize,
        sha256: validated.sha256,
      },
      extraction: {
        status: extractionResult.status,
        isDemo: extractionResult.isDemo,
        adapterLabel: adapter.label,
        proposals: extractionResult.proposals,
      },
    };

    return NextResponse.json(body, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return errorResponse(422, error.code, GENERIC_VALIDATION_MESSAGES[error.code]);
    }
    // Never surface the original error (message/stack) to the client or logs.
    return errorResponse(500, "upload_failed", "The upload could not be processed.");
  }
}
