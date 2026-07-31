import { describe, expect, it } from "vitest";

process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
process.env.SESSION_SIGNING_SECRET = "test-session-signing-secret-value-32chars-min";
process.env.APP_BASE_URL = "http://localhost:3000";
delete process.env.AI_PROVIDER_API_KEY;

const { ConfiguredExtractionAdapter } = await import("./configured-adapter");
const { ExtractionProviderUnavailableError } = await import("./adapter");

describe("ConfiguredExtractionAdapter — safe stub boundary", () => {
  it("is clearly labeled as not implemented", () => {
    const adapter = new ConfiguredExtractionAdapter();
    expect(adapter.name).toBe("configured");
    expect(adapter.label.toLowerCase()).toContain("not implemented");
  });

  it("errors clearly instead of silently falling back to mock behavior when unconfigured", async () => {
    const adapter = new ConfiguredExtractionAdapter();
    await expect(
      adapter.run({
        documentId: "doc-1",
        caseId: "case-1",
        sessionId: "session-1",
        sha256: "irrelevant",
        detectedMimeType: "application/pdf",
      }),
    ).rejects.toThrow(ExtractionProviderUnavailableError);
  });
});
