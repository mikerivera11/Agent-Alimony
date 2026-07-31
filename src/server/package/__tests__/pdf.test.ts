import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildPackageViewModel } from "@/domain/package";
import { buildReviewedDraft, createDemoDraft } from "@/domain/intake";

import { generatePackagePdf } from "../pdf";

describe("generatePackagePdf", () => {
  it("produces bytes with a valid PDF header that pdf-lib can reload", async () => {
    const viewModel = buildPackageViewModel(buildReviewedDraft(createDemoDraft()));
    const bytes = await generatePackagePdf(viewModel);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
    expect(header).toBe("%PDF-");

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("wraps content across multiple pages for a full demo packet", async () => {
    const viewModel = buildPackageViewModel(buildReviewedDraft(createDemoDraft()));
    const bytes = await generatePackagePdf(viewModel);
    const reloaded = await PDFDocument.load(bytes);

    // The demo draft has enough confirmed facts, a full formula trace, assumptions,
    // citations, and scenarios that it must not fit on a single page.
    expect(reloaded.getPageCount()).toBeGreaterThan(1);
  });

  it("still renders successfully when child support and alimony both need input (minimal draft)", async () => {
    const reviewed = buildReviewedDraft(createDemoDraft());
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
});
