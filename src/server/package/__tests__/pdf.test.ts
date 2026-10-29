import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildPackageViewModel } from "@/domain/package";
import { buildReviewedDraft } from "@/domain/intake";

import { generateAlimonyAdvanceAgreementPdf, generatePackagePdf } from "../pdf";

describe("generatePackagePdf", () => {
  it("produces bytes with a valid PDF header that pdf-lib can reload", async () => {
    const viewModel = buildPackageViewModel(buildReviewedDraft(createSampleDraft()));
    const bytes = await generatePackagePdf(viewModel);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
    expect(header).toBe("%PDF-");

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("wraps content across multiple pages for a full demo packet", async () => {
    const viewModel = buildPackageViewModel(buildReviewedDraft(createSampleDraft()));
    const bytes = await generatePackagePdf(viewModel);
    const reloaded = await PDFDocument.load(bytes);

    // The demo draft has enough confirmed facts, a full formula trace, assumptions,
    // citations, and scenarios that it must not fit on a single page.
    expect(reloaded.getPageCount()).toBeGreaterThan(1);
  });

  it("still renders successfully when child support and alimony both need input (minimal draft)", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());
    reviewed.data.children.hasChildren = "no";
    reviewed.data.children.children = [];
    reviewed.data.parentingTime = undefined;
    reviewed.data.childCosts = undefined;

    const viewModel = buildPackageViewModel(reviewed);
    expect(viewModel.childSupport.kind).toBe("needsInput");

    const bytes = await generatePackagePdf(viewModel);
    const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
    expect(header).toBe("%PDF-");
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("generates the separate alimony advance and credit acknowledgment", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());

    const bytes = await generateAlimonyAdvanceAgreementPdf(reviewed);
    const reloaded = await PDFDocument.load(bytes);

    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(reloaded.getTitle()).toBe(
      "Pre-Judgment Housing Advance and Lump-Sum Credit Agreement — Attorney-Review Draft",
    );
    expect(reloaded.getSubject()).toBe(
      "Pre-judgment housing advance, payment schedule, and proposed lump-sum alimony credit",
    );
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("refuses to generate an advance agreement unless the reviewed answers request one", async () => {
    const draft = createSampleDraft();
    draft.data.alimonyAdvance = {
      wantsAdvanceAgreement: "no",
      payerFullLegalName: "",
      recipientFullLegalName: "",
      advanceAmount: 0,
      finalSettlementAmount: 0,
      creditMethod: "dollar_for_dollar",
      ifFinalAgreementNotEntered: "attorney_to_confirm",
      clearedFundsRequired: "yes",
    };
    const reviewed = buildReviewedDraft(draft);

    await expect(generateAlimonyAdvanceAgreementPdf(reviewed)).rejects.toThrow(
      "does not request an alimony advance agreement",
    );
  });
});
