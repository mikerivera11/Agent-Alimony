import { describe, expect, it } from "vitest";

// The app-wide server env schema (owned by src/lib/env.ts) requires a few
// unrelated variables (DATABASE_URL, SESSION_SIGNING_SECRET) that this route
// doesn't otherwise need. Set safe test-only placeholders so `getServerEnv()`
// can resolve `MAX_UPLOAD_BYTES` without requiring a real database.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.SESSION_SIGNING_SECRET ??= "test-session-signing-secret-01234567890123456789";

import { POST } from "../route";

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
  "latin1",
);

const ZIP_ARCHIVE = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0)]);

function buildUploadRequest(options: {
  fileName?: string;
  fileType?: string;
  fileBytes?: Buffer;
  contentLengthOverride?: string;
  omitFile?: boolean;
}): Request {
  const {
    fileName = "paystub.pdf",
    fileType = "application/pdf",
    fileBytes = MINIMAL_PDF,
    contentLengthOverride,
    omitFile = false,
  } = options;

  const formData = new FormData();
  if (!omitFile) {
    const blob = new Blob([new Uint8Array(fileBytes)], { type: fileType });
    formData.set("file", blob, fileName);
  }

  const headers = new Headers();
  if (contentLengthOverride !== undefined) {
    headers.set("content-length", contentLengthOverride);
  }

  return new Request("http://localhost/api/documents/upload", {
    method: "POST",
    body: formData,
    headers,
  });
}

describe("POST /api/documents/upload", () => {
  it("returns safe metadata and a not_processed (zero-proposal) extraction result for a real PDF upload", async () => {
    const request = buildUploadRequest({});
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.document.sanitizedDisplayFilename).toBe("paystub.pdf");
    expect(body.document.detectedMimeType).toBe("application/pdf");
    expect(typeof body.document.sha256).toBe("string");
    expect(body.document.sha256).toHaveLength(64);
    // Never persists real bytes; nothing byte-related beyond safe metadata.
    expect(body.document).not.toHaveProperty("buffer");
    expect(body.document).not.toHaveProperty("bytes");

    expect(body.extraction.status).toBe("not_processed");
    expect(body.extraction.isDemo).toBe(false);
    expect(body.extraction.proposals).toEqual([]);
    expect(body.extraction.adapterLabel.toLowerCase()).toContain("demo");
  });

  it("rejects a disallowed file type with a generic, safe error and no-store headers", async () => {
    const request = buildUploadRequest({ fileName: "archive.zip", fileType: "application/zip", fileBytes: ZIP_ARCHIVE });
    const response = await POST(request as never);
    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("disallowed_type");
    // Generic message only — never a stack trace or raw exception text.
    expect(body.error.message).not.toMatch(/at Object|\.ts:\d+|Error:/);
  });

  it("rejects a request with no file field", async () => {
    const request = buildUploadRequest({ omitFile: true });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("missing_file");
  });

  it("rejects an oversized declared Content-Length before buffering the body", async () => {
    const request = buildUploadRequest({ contentLengthOverride: String(50 * 1024 * 1024) });
    const response = await POST(request as never);
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("too_large");
  });

  it("never returns a success-shaped body alongside an error", async () => {
    const request = buildUploadRequest({ fileName: "archive.zip", fileType: "application/zip", fileBytes: ZIP_ARCHIVE });
    const response = await POST(request as never);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body).not.toHaveProperty("document");
    expect(body).not.toHaveProperty("extraction");
  });
});
