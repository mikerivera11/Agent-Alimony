import { describe, expect, it } from "vitest";

import { buildReviewedDraft, createDemoDraft } from "@/domain/intake";

import { packageRequestSchema } from "../payloadSchema";

describe("packageRequestSchema", () => {
  it("accepts a valid reviewed-draft payload built from the demo draft", () => {
    const reviewed = buildReviewedDraft(createDemoDraft());
    const result = packageRequestSchema.safeParse({ reviewedDraft: reviewed });
    expect(result.success).toBe(true);
  });

  it("rejects a payload with an unexpected top-level field (e.g. a precomputed result or raw HTML)", () => {
    const reviewed = buildReviewedDraft(createDemoDraft());
    const result = packageRequestSchema.safeParse({
      reviewedDraft: reviewed,
      precomputedOutcome: { monthlyTransferAmountCents: 999_999 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with an unexpected key inside the reviewed data envelope", () => {
    const reviewed = buildReviewedDraft(createDemoDraft());
    const withExtra = {
      reviewedDraft: {
        ...reviewed,
        data: { ...reviewed.data, htmlOverride: "<script>alert(1)</script>" },
      },
    };
    const result = packageRequestSchema.safeParse(withExtra);
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing required topics", () => {
    const result = packageRequestSchema.safeParse({ reviewedDraft: { draftId: "x", reviewedAt: "x", isDemo: false, data: {} } });
    expect(result.success).toBe(false);
  });
});
