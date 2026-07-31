import { describe, expect, it } from "vitest";

import { adapterProposedFieldSchema, adapterRunResultSchema } from "./schemas";

describe("adapter output schemas — untrusted data boundary", () => {
  it("rejects a proposed field that tries to smuggle a status property", () => {
    const result = adapterProposedFieldSchema.safeParse({
      fieldKey: "participant.petitioner.grossMonthlyIncome",
      value: 4200,
      sourceDocumentId: "11111111-1111-4111-8111-111111111111",
      confidence: 0.9,
      status: "confirmed",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fieldKey that looks like a rule/selector expression rather than a plain identifier", () => {
    const result = adapterProposedFieldSchema.safeParse({
      fieldKey: "rules.select('alternate-guideline')",
      value: 4200,
      sourceDocumentId: "11111111-1111-4111-8111-111111111111",
      confidence: 0.9,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence value outside [0, 1]", () => {
    const result = adapterProposedFieldSchema.safeParse({
      fieldKey: "participant.petitioner.grossMonthlyIncome",
      value: 4200,
      sourceDocumentId: "11111111-1111-4111-8111-111111111111",
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed proposed field", () => {
    const result = adapterProposedFieldSchema.safeParse({
      fieldKey: "participant.petitioner.grossMonthlyIncome",
      value: 4200,
      sourceDocumentId: "11111111-1111-4111-8111-111111111111",
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a run result that carries proposals under a non-completed status", () => {
    const result = adapterRunResultSchema.safeParse({
      status: "not_processed",
      isDemo: false,
      proposals: [
        {
          fieldKey: "participant.petitioner.grossMonthlyIncome",
          value: 4200,
          sourceDocumentId: "11111111-1111-4111-8111-111111111111",
          confidence: 0.9,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a not_processed result with zero proposals", () => {
    const result = adapterRunResultSchema.safeParse({
      status: "not_processed",
      isDemo: false,
      proposals: [],
    });
    expect(result.success).toBe(true);
  });
});
