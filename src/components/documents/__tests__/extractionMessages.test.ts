import { describe, expect, it } from "vitest";

import { describeUploadExtractionOutcome } from "../extractionMessages";

describe("describeUploadExtractionOutcome", () => {
  it("clearly states the mock did not read/extract a real (non-demo, not_processed) upload", () => {
    const outcome = describeUploadExtractionOutcome({ status: "not_processed", isDemo: false, proposals: [] });
    expect(outcome.kind).toBe("not_processed");
    expect(`${outcome.headline} ${outcome.detail}`.toLowerCase()).toMatch(/did not read or extract/);
    expect(`${outcome.headline} ${outcome.detail}`.toLowerCase()).toContain("zero");
  });

  it("labels a demo-hash match distinctly, still noting no real document understanding occurred", () => {
    const outcome = describeUploadExtractionOutcome({
      status: "completed",
      isDemo: true,
      proposals: [
        { fieldKey: "a.b", value: 1, sourceDocumentId: "11111111-1111-4111-8111-111111111111", confidence: 0.9 },
      ],
    });
    expect(outcome.kind).toBe("demo");
    expect(outcome.detail.toLowerCase()).toContain("fictional");
  });

  it("describes a failed run without implying success", () => {
    const outcome = describeUploadExtractionOutcome({ status: "failed", isDemo: false, proposals: [] });
    expect(outcome.kind).toBe("failed");
    expect(outcome.headline.toLowerCase()).not.toContain("success");
  });

  it("describes a pending run distinctly", () => {
    const outcome = describeUploadExtractionOutcome({ status: "pending", isDemo: false, proposals: [] });
    expect(outcome.kind).toBe("pending");
  });
});
