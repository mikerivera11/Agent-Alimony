import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { adapterRunResultSchema } from "./schemas";
import { DEMO_DOCUMENT_MARKER, DEMO_DOCUMENT_SHA256, MockExtractionAdapter } from "./mock-adapter";

function sha256Of(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("MockExtractionAdapter — explicit demo labeling and no-op behavior", () => {
  it("is clearly labeled as a mock/demo adapter, never claiming to be real extraction", () => {
    const adapter = new MockExtractionAdapter();
    expect(adapter.name).toBe("mock");
    expect(adapter.label.toLowerCase()).toContain("demo");
    expect(adapter.label.toLowerCase()).toContain("not a real document reader");
  });

  it("returns deterministic demo proposals ONLY for the designated demo document", async () => {
    const adapter = new MockExtractionAdapter();
    const result = await adapter.run({
      documentId: "11111111-1111-4111-8111-111111111111",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: DEMO_DOCUMENT_SHA256,
      detectedMimeType: "application/pdf",
    });

    expect(result.status).toBe("completed");
    expect(result.isDemo).toBe(true);
    expect(result.proposals.length).toBeGreaterThan(0);
    for (const proposal of result.proposals) {
      expect(proposal.sourceDocumentId).toBe("11111111-1111-4111-8111-111111111111");
    }
  });

  it("demo proposals are deterministic across repeated runs", async () => {
    const adapter = new MockExtractionAdapter();
    const run1 = await adapter.run({
      documentId: "11111111-1111-4111-8111-111111111111",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: DEMO_DOCUMENT_SHA256,
      detectedMimeType: "application/pdf",
    });
    const run2 = await adapter.run({
      documentId: "11111111-1111-4111-8111-111111111111",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: DEMO_DOCUMENT_SHA256,
      detectedMimeType: "application/pdf",
    });

    expect(run2.proposals).toEqual(run1.proposals);
  });

  it("returns a 'not_processed' no-op result for any arbitrary (non-demo) upload — never pretends to extract", async () => {
    const adapter = new MockExtractionAdapter();
    const arbitraryHash = sha256Of("this is some arbitrary real user-uploaded document");
    expect(arbitraryHash).not.toBe(DEMO_DOCUMENT_SHA256);

    const result = await adapter.run({
      documentId: "22222222-2222-4222-8222-222222222222",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: arbitraryHash,
      detectedMimeType: "application/pdf",
    });

    expect(result.status).toBe("not_processed");
    expect(result.isDemo).toBe(false);
    expect(result.proposals).toEqual([]);
  });

  it("content-based matching cannot be spoofed via filename/metadata alone — only the exact demo content hash triggers demo output", async () => {
    const adapter = new MockExtractionAdapter();
    // Same marker text but re-hashed independently to double check equality basis.
    expect(sha256Of(DEMO_DOCUMENT_MARKER)).toBe(DEMO_DOCUMENT_SHA256);

    const almostRight = sha256Of(`${DEMO_DOCUMENT_MARKER}x`);
    const result = await adapter.run({
      documentId: "33333333-3333-4333-8333-333333333333",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: almostRight,
      detectedMimeType: "application/pdf",
    });
    expect(result.status).toBe("not_processed");
    expect(result.proposals).toEqual([]);
  });

  it("every emitted result satisfies the adapter output contract (no smuggled status, no proposals on non-completed results)", async () => {
    const adapter = new MockExtractionAdapter();
    const demoResult = await adapter.run({
      documentId: "11111111-1111-4111-8111-111111111111",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: DEMO_DOCUMENT_SHA256,
      detectedMimeType: "application/pdf",
    });
    const notProcessedResult = await adapter.run({
      documentId: "44444444-4444-4444-8444-444444444444",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: sha256Of("unrelated"),
      detectedMimeType: "application/pdf",
    });

    expect(() => adapterRunResultSchema.parse(demoResult)).not.toThrow();
    expect(() => adapterRunResultSchema.parse(notProcessedResult)).not.toThrow();
  });

  it("adapter output proposals never carry a status field (cannot smuggle a confirmed fact)", async () => {
    const adapter = new MockExtractionAdapter();
    const result = await adapter.run({
      documentId: "11111111-1111-4111-8111-111111111111",
      caseId: "case-1",
      sessionId: "session-1",
      sha256: DEMO_DOCUMENT_SHA256,
      detectedMimeType: "application/pdf",
    });
    for (const proposal of result.proposals) {
      expect(Object.prototype.hasOwnProperty.call(proposal, "status")).toBe(false);
    }
  });
});
