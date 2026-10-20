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
    ]);
    expect(manifest.omitted.join(" ")).toContain("Financial affidavit");
    expect(manifest.omitted.join(" ")).toContain("Mandatory Disclosure");
    expect(manifest.omitted.join(" ")).toContain("Social Security");
    expect(manifest.omitted.join(" ")).toContain("settlement agreement");
  });

  it("lists unresolved answers as blanks to complete before filing", () => {
    const draftData = createSampleDraft();
    draftData.data.filingDetails.judicialCircuit = "";
    const draft = buildReviewedDraft(draftData);
    const viewModel = buildPackageViewModel(draft);
    const readiness = buildFilingReadiness({
      data: draft.data,
      asOfIso: viewModel.generatedAt.slice(0, 10),
    });

    const manifest = buildOfficialCourtFormsManifest({ draft, viewModel, readiness });

    expect(manifest.warnings.join(" ")).toMatch(/partially populated draft/i);
    expect(manifest.warnings.join(" ")).toContain("Form 12.928: The judicial circuit");
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
    expect(form.getCheckBox("check if minor child common to both").isChecked()).toBe(true);
    expect(form.getCheckBox("there are marital assets or liabilities").isChecked()).toBe(true);
    expect(form.getTextField("Telephone Number").getText()).toBe("407-555-0100");
    expect(form.getTextField("designated email address").getText()).toBe("alex@example.invalid");
    expect(form.getTextField("indicate amount of payment").getText()).toBe("1000.00");
    expect(form.getTextField("check for every month").getText()).toBe("X");
    expect(
      form.getCheckBox("Respondent requests that the Court order the other spouse to pay the following").isChecked(),
    ).toBe(true);
    expect(form.getCheckBox("check for payment by petitioner").isChecked()).toBe(true);
  });

  it("writes structured child residence and UCCJEA history answers into the affidavit", async () => {
    const { draft, viewModel } = sampleInputs();
    const bytes = await __testing.populateForm({
      formNumber: "12.902(d)",
      draft,
      viewModel,
    });

    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getTextField("Place of Birth for child 1").getText()).toBe("Orlando, Florida");
    expect(form.getTextField("Sex of child 1").getText()).toBe("Female");
    expect(form.getTextField("where child lived for past five years. Give address").getText()).toBe(
      "100 Demo Street, Orlando, FL 32801",
    );
    expect(
      form.getCheckBox("check if you have not participated in custody or time sharing proceedings").isChecked(),
    ).toBe(true);
    expect(
      form
        .getCheckBox(
          "I DO NOT KNOW OF ANY PERSON not a party to this proceeding who has physical custody or claims to have custody, visitation or time-sharing with respect to any child subject to this proceeding",
        )
        .isChecked(),
    ).toBe(true);
  });

  it("fits worksheet amounts inside their official form cells", async () => {
    const { draft, viewModel } = sampleInputs();
    const bytes = await __testing.populateForm({
      formNumber: "12.902(e)",
      draft,
      viewModel,
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    for (const fieldName of [
      "Petitioner Present Gross Monthly Income",
      "Respondent Present Gross Monthly Income",
      "Petitioner Present Net Monthly Income",
      "Respondent Present Net Monthly Income",
      "Total Present Net Monthly Income",
    ]) {
      const appearance = form.getTextField(fieldName).acroField.getDefaultAppearance() ?? "";
      const fontSize = Number(appearance.match(/\/Helvetica ([\d.]+) Tf/)?.[1]);
      expect(fontSize).toBeGreaterThanOrEqual(5);
      expect(fontSize).toBeLessThanOrEqual(10);
    }
  });

  it("maps affirmative UCCJEA proceeding answers into their separate verified fields", async () => {
    const source = createSampleDraft();
    source.data.filingDetails.priorCustodyProceedingStatus = "exists";
    source.data.filingDetails.priorCustodyProceedingDetails = {
      childNames: "Taylor Rivera",
      proceedingType: "Prior time-sharing case",
      courtAndState: "Sample County Court, Florida",
      orderDate: "2024-05-01",
    };
    source.data.filingDetails.pendingCustodyProceedingStatus = "exists";
    source.data.filingDetails.pendingCustodyProceedingDetails = {
      childNames: "Morgan Rivera",
      proceedingType: "Pending custody case",
      courtAndState: "Example County Court, Georgia",
      caseNumber: "TEST-123",
    };
    source.data.filingDetails.thirdPartyCustodyClaimStatus = "exists";
    source.data.filingDetails.thirdPartyCustodyClaimDetails = {
      nameAndAddress: "Casey Example, 1 Example Road",
      childNames: "Taylor Rivera",
      relationshipToChildren: "Grandparent",
      claimType: "visitation_or_time_sharing",
    };
    source.data.filingDetails.existingChildSupportOrderStatus = "exists";
    source.data.filingDetails.existingChildSupportOrderDetails = {
      childNames: "Taylor Rivera",
      proceedingType: "Child support",
      courtAndAddress: "Sample County Court, Florida",
      orderDate: "2024-05-01",
      amountAndPayer: "$500 monthly paid by Parent A",
    };
    const draft = buildReviewedDraft(source);
    const viewModel = buildPackageViewModel(draft);
    const bytes = await __testing.populateForm({
      formNumber: "12.902(d)",
      draft,
      viewModel,
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getTextField("Type of proceeding").getText()).toBe("Prior time-sharing case");
    expect(form.getTextField("case number").getText()).toBe("TEST-123");
    expect(form.getTextField("Relationship to child").getText()).toBe("Grandparent");
    expect(form.getCheckBox("claims visitation or time sharing").isChecked()).toBe(true);
    expect(form.getTextField("Amount of child support paid and by whom").getText()).toBe(
      "$500 monthly paid by Parent A",
    );
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
    if (formNumber === "12.901(b)(2)") {
      expect(form.getTextField("Spousal support (alimony) Amount").getText()).toBe("1000.00");
      expect(
        form
          .getTextField("type of alimony (temporary, permanent, bridge-the-gap, durational, rehabilitative, and/or lump sum)")
          .getText(),
      ).toBe("Durational");
    }
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
