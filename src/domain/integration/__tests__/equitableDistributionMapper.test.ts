import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { describe, expect, it } from "vitest";

import { buildReviewedDraft, type ReviewedIntakeDraft } from "@/domain/intake";
import { unwrapConfirmedFact } from "@/domain/rules";

import { mapReviewedDraftToEquitableDistributionInput } from "../equitableDistributionMapper";

function demoReviewedDraft(): ReviewedIntakeDraft {
  return buildReviewedDraft(createSampleDraft());
}

function clone(reviewed: ReviewedIntakeDraft): ReviewedIntakeDraft {
  return JSON.parse(JSON.stringify(reviewed)) as ReviewedIntakeDraft;
}

describe("mapReviewedDraftToEquitableDistributionInput", () => {
  it("maps every itemized asset/debt into integer cents with party labels", () => {
    const result = mapReviewedDraftToEquitableDistributionInput(demoReviewedDraft());
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;

    const input = unwrapConfirmedFact(result.value);
    expect(input.items).toHaveLength(4);
    const home = input.items.find((item) => item.id === "demo-asset-home");
    expect(home?.valueCents).toBe(210000 * 100);
    expect(input.partyALabel).toBe("J.R. (fictional demo person)");
    expect(input.partyBLabel).toBe("A.R. (fictional demo person)");
    expect(input.writtenAgreementConfirmed).toBe(true);
  });

  it("records the confirmed petition date as the §61.075(7) cut-off", () => {
    const result = mapReviewedDraftToEquitableDistributionInput(demoReviewedDraft());
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    expect(unwrapConfirmedFact(result.value).classificationCutoffDateIso).toBe("2026-07-30");
  });

  it("forwards a nonmarital basis only for nonmarital items", () => {
    const result = mapReviewedDraftToEquitableDistributionInput(demoReviewedDraft());
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    const input = unwrapConfirmedFact(result.value);
    const inheritance = input.items.find((item) => item.id === "demo-asset-inheritance");
    expect(inheritance?.nonmaritalBasis).toBe("separateGiftOrInheritance");
    const home = input.items.find((item) => item.id === "demo-asset-home");
    expect(home?.nonmaritalBasis).toBeUndefined();
  });

  it("never forwards a written-agreement exclusion on a nonmarital item", () => {
    const reviewed = clone(demoReviewedDraft());
    // Force the (illegal) combination the UI prevents to prove the mapper strips it.
    reviewed.data.assetsDebts.items = reviewed.data.assetsDebts.items.map((item) =>
      item.id === "demo-asset-inheritance" ? { ...item, excludedByWrittenAgreement: true } : item,
    );
    const result = mapReviewedDraftToEquitableDistributionInput(reviewed);
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    const inheritance = unwrapConfirmedFact(result.value).items.find(
      (item) => item.id === "demo-asset-inheritance",
    );
    expect(inheritance?.excludedByWrittenAgreement).toBe(false);
  });

  it("blocks when a nonmarital item is missing its statutory basis", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.assetsDebts.items = reviewed.data.assetsDebts.items.map((item) =>
      item.id === "demo-asset-inheritance" ? { ...item, nonmaritalBasis: undefined } : item,
    );
    const result = mapReviewedDraftToEquitableDistributionInput(reviewed);
    expect(result.kind).toBe("unmapped");
    if (result.kind !== "unmapped") return;
    expect(result.issues[0].code).toContain("nonmarital-basis-missing");
    expect(result.issues[0].severity).toBe("blocking");
  });

  it("warns when exclusions are flagged without a confirmed written agreement", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.assetsDebts.writtenAgreementConfirmed = false;
    const result = mapReviewedDraftToEquitableDistributionInput(reviewed);
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    expect(result.issues.some((issue) => issue.code === "exclusions-without-written-agreement")).toBe(true);
  });

  it("returns an info issue when no items were itemized", () => {
    const reviewed = clone(demoReviewedDraft());
    reviewed.data.assetsDebts.items = [];
    const result = mapReviewedDraftToEquitableDistributionInput(reviewed);
    expect(result.kind).toBe("mapped");
    if (result.kind !== "mapped") return;
    expect(result.issues.some((issue) => issue.code === "no-itemized-assets-or-debts")).toBe(true);
  });
});
