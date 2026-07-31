import { describe, expect, it } from "vitest";

import { checkFileBeforeUpload } from "../validateClientFileSelection";

describe("checkFileBeforeUpload", () => {
  it("accepts an allowed type within the size limit", () => {
    expect(checkFileBeforeUpload({ size: 1024, type: "application/pdf" })).toEqual({ ok: true });
  });

  it("rejects an empty file", () => {
    const result = checkFileBeforeUpload({ size: 0, type: "application/pdf" });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 10MB", () => {
    const result = checkFileBeforeUpload({ size: 10 * 1024 * 1024 + 1, type: "application/pdf" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/10MB/);
  });

  it("rejects a disallowed type", () => {
    const result = checkFileBeforeUpload({ size: 1024, type: "application/zip" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/PDF, JPEG, and PNG/);
  });
});
