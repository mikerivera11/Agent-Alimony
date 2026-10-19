import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildFilingReadiness } from "@/domain/forms";
import { buildReviewedDraft } from "@/domain/intake";
import { buildPackageViewModel } from "@/domain/package";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import {
  __testing,
  buildOfficialCourtFormsManifest,
  generateOfficialCourtFormsPdf,
} from "../officialCourtForms";

function sampleInputs() {
  const draft = buildReviewedDraft(createSampleDraft());
  const viewModel = buildPackageViewModel(draft);
  const readiness = buildFilingReadiness({
    data: draft.data,
    asOfIso: viewModel.generatedAt.slice(0, 10),
  });
  return { draft, viewModel, readiness };
}

describe("official court forms", () => {
  it("builds a review bundle from revision-locked official PDFs", async () => {
    const inputs = sampleInputs();
    const bytes = await generateOfficialCourtFormsPdf(inputs);

    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Populated Florida Court Forms — Review Draft");
    expect(doc.getPageCount()).toBeGreaterThan(20);
  });

  it("lists the official forms included and the unsafe forms deliberately omitted", () => {
    const manifest = buildOfficialCourtFormsManifest(sampleInputs());

    expect(manifest.included.map((asset) => asset.formNumber)).toEqual([
      "12.928",
      "12.901(b)(1)",
      "12.902(d)",
      "12.902(e)",
      "12.995(a)",
      "12.932",
    ]);
    expect(manifest.omitted.join(" ")).toContain("Financial affidavit");
    expect(manifest.omitted.join(" ")).toContain("Social Security");
    expect(manifest.omitted.join(" ")).toContain("settlement agreement");
  });

  it("writes confirmed caption and child facts into the official petition", async () => {
    const { draft, viewModel } = sampleInputs();
    const bytes = await __testing.populateForm({
      formNumber: "12.901(b)(1)",
      draft,
      viewModel,
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getTextField("NAME OF COUNTY").getText()).toBe("Sample County (fictional)");
    expect(form.getTextField("Petitioner").getText()).toBe("Alex Rivera (fictional)");
    expect(form.getTextField("Respondent").getText()).toBe("Jordan Rivera (fictional)");
    expect(form.getTextField("name and date of birth child 1").getText()).toContain(
      "Taylor Rivera (fictional)",
    );
    expect(form.getCheckBox("there are marital assets or liabilities").isChecked()).toBe(true);
  });

  it.each([
    ["12.901(b)(2)", "Place of marriage: {county, state, country}"],
    ["12.901(b)(3)", "Place of marriage"],
  ] as const)("populates the verified no-child petition template %s", async (formNumber, placeField) => {
    const { draft, viewModel } = sampleInputs();
    const bytes = await __testing.populateForm({ formNumber, draft, viewModel });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getTextField("County Name").getText()).toBe("Sample County (fictional)");
    expect(form.getTextField("Full Legal Name").getText()).toBe("Alex Rivera (fictional)");
    expect(form.getTextField(placeField).getText()).toBe("Orlando, Florida");
  });

  it("writes deterministic support results into the official child-support worksheet", async () => {
    const { draft, viewModel } = sampleInputs();
    if (viewModel.childSupport.kind !== "calculated") throw new Error("Expected sample calculation.");
    const bytes = await __testing.populateForm({
      formNumber: "12.902(e)",
      draft,
      viewModel,
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getTextField("Parties number of children in common").getText()).toBe("2");
    expect(form.getTextField("21. Presumptive Child Support to be Paid").getText()).toBe(
      (viewModel.childSupport.result.monthlyTransferAmountCents / 100).toFixed(2),
    );
    expect(form.getTextField("12. overnight stays with the Petitioner").getText()).toBe("219");
  });

  it("writes structured holiday rotations into the official parenting plan", async () => {
    const { draft, viewModel } = sampleInputs();
    const bytes = await __testing.populateForm({
      formNumber: "12.995(a)",
      draft,
      viewModel,
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getTextField("Thanksgiving").getText()).toBe("Jordan Rivera (fictional)");
    expect(form.getTextField("Odd Years 12").getText()).toBe("Alex Rivera (fictional)");
    expect(form.getTextField("other special day 1").getText()).toBe("Christmas");
    expect(form.getTextField("other special day 2").getText()).toBe("New Year's Day");
  });
});
