import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { describe, expect, it } from "vitest";

import { buildReviewedDraft, type ReviewedIntakeDraft } from "@/domain/intake";
import { unwrapConfirmedFact } from "@/domain/rules";

import { mapReviewedDraftToAlimonyInput } from "../alimonyMapper";

function demoReviewedDraft(): ReviewedIntakeDraft {
  return buildReviewedDraft(createSampleDraft());
}

function clone(reviewed: ReviewedIntakeDraft): ReviewedIntakeDraft {
  return JSON.parse(JSON.stringify(reviewed)) as ReviewedIntakeDraft;
}

describe("mapReviewedDraftToAlimonyInput", () => {
  it("maps an explicitly selected recipient and confirmed monthly need", () => {
    const result = mapReviewedDraftToAlimonyInput(demoReviewedDraft());
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;

    const input = unwrapConfirmedFact(result.value);
    expect(input.confirmedReasonableMonthlyNeedCents).toBe(120_000);
    expect(input.payor.monthlyGrossIncomeCents).toBeGreaterThan(input.obligee.monthlyGrossIncomeCents);
  });

  it("never infers a recipient when the user is not sure", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.alimonyFactors.potentialAlimonyRecipient = "not_sure";

    const result = mapReviewedDraftToAlimonyInput(reviewed);
    expect(result.kind).toBe("unmapped");
    if (result.kind !== "unmapped") return;
    expect(result.issues[0].code).toBe("needs-explicit-recipient");
    expect(result.issues[0].severity).toBe("blocking");
  });

  it("returns a distinct info issue when alimony was not requested", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.alimonyFactors.requestedAlimonyType = "none";
    reviewed.data.alimonyFactors.potentialAlimonyRecipient = "none";

    const result = mapReviewedDraftToAlimonyInput(reviewed);
    expect(result.kind).toBe("unmapped");
    if (result.kind !== "unmapped") return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("alimony-not-requested");
    expect(result.issues[0].severity).toBe("info");
  });

  it("uses a confirmed planning date without pretending a petition was filed", () => {
    const result = mapReviewedDraftToAlimonyInput(demoReviewedDraft());
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    expect(result.issues.some((issue) => issue.code === "planned-petition-date")).toBe(true);
    expect(unwrapConfirmedFact(result.value).petitionFilingDateIso).toBe("2026-07-30");
  });
});
