import { describe, expect, it } from "vitest";

import { sanitizeDisplayFilename, UploadValidationError, validateUpload } from "./upload-validation";

const MAX_BYTES = 10 * 1024 * 1024;

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF",
  "latin1",
);

// A real, valid 1x1 transparent PNG (magic bytes + minimal IHDR/IDAT/IEND chunks).
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const MINIMAL_JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(64, 0),
]);

const ZIP_ARCHIVE = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 0)]);
const WINDOWS_EXECUTABLE = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(128, 0)]);

describe("validateUpload", () => {
  it("accepts a real PDF with a truthfully declared MIME type", async () => {
    const result = await validateUpload({
      buffer: MINIMAL_PDF,
      declaredMimeType: "application/pdf",
      originalFilename: "paystub.pdf",
      maxBytes: MAX_BYTES,
    });
    expect(result.detectedMimeType).toBe("application/pdf");
    expect(result.sha256).toHaveLength(64);
  });

  it("accepts a real PNG", async () => {
    const result = await validateUpload({
      buffer: MINIMAL_PNG,
      declaredMimeType: "image/png",
      originalFilename: "id.png",
      maxBytes: MAX_BYTES,
    });
    expect(result.detectedMimeType).toBe("image/png");
  });

  it("accepts a real JPEG", async () => {
    const result = await validateUpload({
      buffer: MINIMAL_JPEG,
      declaredMimeType: "image/jpeg",
      originalFilename: "id.jpg",
      maxBytes: MAX_BYTES,
    });
    expect(result.detectedMimeType).toBe("image/jpeg");
  });

  it("rejects an empty file", async () => {
    await expect(
      validateUpload({
        buffer: Buffer.alloc(0),
        declaredMimeType: "application/pdf",
        originalFilename: "empty.pdf",
        maxBytes: MAX_BYTES,
      }),
    ).rejects.toMatchObject({ code: "empty" });
  });

  it("rejects a file exceeding the maximum byte size", async () => {
    await expect(
      validateUpload({
        buffer: MINIMAL_PDF,
        declaredMimeType: "application/pdf",
        originalFilename: "paystub.pdf",
        maxBytes: 4,
      }),
    ).rejects.toMatchObject({ code: "too_large" });
  });

  it("rejects a ZIP archive renamed with a .pdf extension and a lying declared MIME type", async () => {
    await expect(
      validateUpload({
        buffer: ZIP_ARCHIVE,
        declaredMimeType: "application/pdf",
        originalFilename: "totally-a-pdf.pdf",
        maxBytes: MAX_BYTES,
      }),
    ).rejects.toMatchObject({ code: "disallowed_type" });
  });

  it("rejects a Windows executable outright", async () => {
    await expect(
      validateUpload({
        buffer: WINDOWS_EXECUTABLE,
        declaredMimeType: "application/pdf",
        originalFilename: "invoice.pdf",
        maxBytes: MAX_BYTES,
      }),
    ).rejects.toMatchObject({ code: "disallowed_type" });
  });

  it("rejects when the declared MIME type does not match the sniffed magic-byte type (MIME mismatch)", async () => {
    await expect(
      validateUpload({
        // Real PNG bytes, but declared as a PDF.
        buffer: MINIMAL_PNG,
        declaredMimeType: "application/pdf",
        originalFilename: "id.png",
        maxBytes: MAX_BYTES,
      }),
    ).rejects.toMatchObject({ code: "mime_mismatch" });
  });

  it("rejects content that has no recognizable magic-byte signature at all", async () => {
    await expect(
      validateUpload({
        buffer: Buffer.from("just some plain text, not a real file format"),
        declaredMimeType: "application/pdf",
        originalFilename: "not-a-pdf.pdf",
        maxBytes: MAX_BYTES,
      }),
    ).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("computes a stable sha256 for identical bytes", async () => {
    const first = await validateUpload({
      buffer: MINIMAL_PDF,
      declaredMimeType: "application/pdf",
      originalFilename: "a.pdf",
      maxBytes: MAX_BYTES,
    });
    const second = await validateUpload({
      buffer: Buffer.from(MINIMAL_PDF),
      declaredMimeType: "application/pdf",
      originalFilename: "b.pdf",
      maxBytes: MAX_BYTES,
    });
    expect(first.sha256).toBe(second.sha256);
  });
});

describe("sanitizeDisplayFilename", () => {
  it("strips directory components from a path-traversal-style filename", () => {
    expect(sanitizeDisplayFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeDisplayFilename("..\\..\\windows\\system32\\config")).toBe("config");
  });

  it("removes control characters and disallowed symbols", () => {
    expect(sanitizeDisplayFilename("evil\u0000name<script>.pdf")).toBe("evilname_script_.pdf");
  });

  it("preserves a normal, already-safe filename", () => {
    expect(sanitizeDisplayFilename("Pay Stub - March 2024.pdf")).toBe("Pay Stub - March 2024.pdf");
  });

  it("never returns an empty string", () => {
    expect(sanitizeDisplayFilename("...")).toBe("upload");
    expect(sanitizeDisplayFilename("")).toBe("upload");
  });

  it("truncates excessively long filenames", () => {
    const long = `${"a".repeat(500)}.pdf`;
    expect(sanitizeDisplayFilename(long).length).toBeLessThanOrEqual(200);
  });
});
