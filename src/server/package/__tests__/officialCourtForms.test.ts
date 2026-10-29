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
      "12.902(f)(1)",
      "12.995(a)",
    ]);
    expect(manifest.omitted.join(" ")).toContain("Financial affidavit");
    expect(manifest.omitted.join(" ")).toContain("Mandatory Disclosure");
    expect(manifest.omitted.join(" ")).toContain("Social Security");
    expect(manifest.omitted.join(" ")).not.toContain("Marital settlement agreement");
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
    expect(form.getTextField("date of separation1").getText()).toBe("01/10/2025");
    expect(form.getCheckBox("check if petitioner is not").isChecked()).toBe(true);
    expect(form.getCheckBox("check if respondent is not").isChecked()).toBe(true);
    expect(form.getCheckBox("will be timely filed").isChecked()).toBe(true);
    expect(form.getCheckBox("the marriage is irretrievably broken").isChecked()).toBe(true);
    expect(form.getCheckBox("there are marital assets or liabilities").isChecked()).toBe(true);
    expect(form.getCheckBox("all marital assets or liabilities have been divided by written agreement").isChecked()).toBe(
      true,
    );
    expect(form.getCheckBox("minor resides with petitioner").isChecked()).toBe(true);
    expect(form.getCheckBox("parental responsibility shall be shared by both parents").isChecked()).toBe(
      true,
    );
    expect(form.getCheckBox("parenting plan includes time sharing").isChecked()).toBe(true);
    expect(form.getCheckBox("parenting plan does not include time sharing").isChecked()).toBe(false);
    expect(form.getTextField("Petitioner will be referred to as").getText()).toBe(
      "Alex Rivera (fictional)",
    );
    expect(form.getTextField("Respondent will be referred to as").getText()).toBe(
      "Jordan Rivera (fictional)",
    );
    expect(
      form.getCheckBox("Check if attached proposed parenting plan should be adopted by the court").isChecked(),
    ).toBe(true);
    expect(form.getCheckBox("parties agreed to having a parenting plan").isChecked()).toBe(true);
    expect(form.getCheckBox("parties have not agreed to a parenting plan").isChecked()).toBe(false);
    expect(form.getTextField("Explain why this request is in the best interests of the children").getText()).toContain(
      "frequent and continuing contact",
    );
    expect(form.getCheckBox("request to award child support by petitioner").isChecked()).toBe(true);
    expect(form.getCheckBox("guidelines will be filed").isChecked()).toBe(true);
    expect(form.getCheckBox("check for date of separation").isChecked()).toBe(true);
    expect(form.getTextField("date of separation2").getText()).toBe("01/10/2025");
    expect(form.getCheckBox("check if this is a petitioner request on insurance").isChecked()).toBe(true);
    expect(form.getCheckBox("insurance provided by petitioner").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box111").isChecked()).toBe(true);
    expect(form.getCheckBox("Other {explain}").isChecked()).toBe(true);
    expect(form.getTextField("Explaination of other payment arrangements").getText()).toContain(
      "first 12 months",
    );
    expect(form.getCheckBox("check this and any of the following five that apply").isChecked()).toBe(true);
    expect(form.getCheckBox("check if this applies").isChecked()).toBe(true);
    expect(form.getCheckBox("check if this applies 2").isChecked()).toBe(true);
    expect(form.getCheckBox("check if this applies 3").isChecked()).toBe(true);
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

  it("maps alternate petition elections without checking incompatible choices", async () => {
    const source = createSampleDraft();
    Object.assign(source.data.filingDetails, {
      pregnancyStatus: "respondent",
      pregnancyDueDate: "2026-11-15",
      nonCommonMinorChildrenStatus: "yes",
      nonCommonMinorChildrenDetails:
        "Casey Example — 04/01/2018; birth parent: Morgan Example, 1 Example Road",
      adultDependentChildrenStatus: "yes",
      adultDependentChildrenDetails: "Jamie Example — 02/02/2004; qualifying physical disability",
      propertyDistributionRequest: "court_determination",
      childrenCurrentResidence: "other",
      childrenCurrentResidenceExplanation: "The children currently reside with their maternal grandparent.",
      parentalResponsibilityRequest: "sole_respondent",
      soleResponsibilityDetrimentExplanation: "Attorney-reviewed detriment explanation for this fictional test.",
      parentingPlanIncludesTimeSharing: "no",
      childSupportWorksheetStatus: "filed_with_petition",
      retroactiveChildSupportStart: "other",
      retroactiveChildSupportOtherDate: "2025-02-01",
      retroactiveChildSupportOtherExplanation: "The requested date follows the parties' written support arrangement.",
      supportBeyondEighteen: "incapacity",
      supportBeyondEighteenDetails: "Jamie Example; incapacity began before age 18.",
      childSupportDeviationRequested: "yes",
      formerNameRestorationRequested: "yes",
      formerNameToRestore: "Alex Example",
      otherReliefRequested: "Attorney-reviewed additional relief.",
    });
    const draft = buildReviewedDraft(source);
    const viewModel = buildPackageViewModel(draft);
    const bytes = await __testing.populateForm({ formNumber: "12.901(b)(1)", draft, viewModel });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getCheckBox("check if respondent is pregnant").isChecked()).toBe(true);
    expect(form.getCheckBox("check if petitioner is pregnant").isChecked()).toBe(false);
    expect(form.getCheckBox("check if child not common to both parties").isChecked()).toBe(true);
    expect(form.getCheckBox("check if child(ren) common to both parties who are 18 or older but who are dependent").isChecked()).toBe(true);
    expect(form.getCheckBox("The Court should determine how the assets and liabilities of this marriage are to be distributed").isChecked()).toBe(true);
    expect(form.getCheckBox("all marital assets or liabilities have been divided by written agreement").isChecked()).toBe(false);
    expect(form.getCheckBox("minor resides with other circumstance").isChecked()).toBe(true);
    expect(form.getCheckBox("parental responsibility shall be awarded to petitioner or respondent. A choice required").isChecked()).toBe(true);
    expect(form.getCheckBox("responsibility awarded solely to respondent").isChecked()).toBe(true);
    expect(form.getCheckBox("parental responsibility shall be shared by both parents").isChecked()).toBe(false);
    expect(form.getCheckBox("parenting plan does not include time sharing").isChecked()).toBe(true);
    expect(form.getCheckBox("parenting plan includes time sharing").isChecked()).toBe(false);
    expect(form.getCheckBox("guidelines are filed").isChecked()).toBe(true);
    expect(form.getCheckBox("guidelines will be filed").isChecked()).toBe(false);
    expect(form.getCheckBox("check for date of other").isChecked()).toBe(true);
    expect(form.getCheckBox("petitioner requests that the Court award child support to be paid beyond the age of 18").isChecked()).toBe(true);
    expect(form.getCheckBox("check because dependent has mental or physical incapacity").isChecked()).toBe(true);
    expect(form.getCheckBox("check if this is a petitioner request").isChecked()).toBe(true);
    expect(form.getTextField("former legal name").getText()).toBe("Alex Example");
    expect(form.getCheckBox("check if this applies 4").isChecked()).toBe(true);
    expect(form.getCheckBox("check if this applies 5").isChecked()).toBe(true);
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

  it("writes the collected parenting-plan choices into the official form", async () => {
    const { draft, viewModel } = sampleInputs();
    const bytes = await __testing.populateForm({
      formNumber: "12.995(a)",
      draft,
      viewModel,
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getCheckBox("Check Box1").isChecked()).toBe(true);
    expect(form.getTextField("Other 5").getText()).toContain("Monday through Thursday");
    expect(form.getTextField("Other 7").getText()).toContain("Alternating weekends");
    expect(form.getCheckBox("Check Box43").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box44").isChecked()).toBe(true);
    expect(
      form.getTextField("indicate percentage of cost for activities by parent 1").getText(),
    ).toContain("50%");
    expect(
      form.getTextField("The costs of the extra-curricular activities shall be paid by parent 1").getText(),
    ).toContain("Alex Rivera");
    expect(form.getTextField("Thanksgiving").getText()).toBe("Jordan Rivera (fictional)");
    expect(form.getTextField("Odd Years 12").getText()).toBe("Alex Rivera (fictional)");
    expect(form.getTextField("other special day 1").getText()).toBe("Christmas");
    expect(form.getTextField("other special day 2").getText()).toBe("New Year's Day");
    expect(form.getCheckBox("Check Box46").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box52").isChecked()).toBe(false);
    expect(form.getCheckBox("Check Box54").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box55").isChecked()).toBe(false);
    expect(form.getCheckBox("Check Box102").isChecked()).toBe(false);
    expect(
      form.getTextField("Parent having child(ren) for odd-numbered years for Spring Break").getText(),
    ).toBeUndefined();
    expect(
      form.getTextField("Parent having child(ren) for even-numbered years for Spring Break").getText(),
    ).toBeUndefined();
    expect(
      form.getTextField("Parent shall have the child(ren) for the entire Spring Break every year").getText(),
    ).toBeUndefined();
    expect(form.getCheckBox("Check Box117").isChecked()).toBe(true);
    expect(form.getTextField("date for summer break 4").getText()).toContain("four consecutive weeks");
    expect(
      form.getTextField("Parent that shall have the entire Summer Break from school").getText(),
    ).toBeUndefined();
    expect(form.getCheckBox("Check Box120").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box122").isChecked()).toBe(false);
    expect(form.getCheckBox("Check Box126").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box127").isChecked()).toBe(false);
    expect(form.getTextField("Explain where exchanges shall occur").getText()).toContain("children's school");
    expect(form.getCheckBox("Check Box152").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box154").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box156").isChecked()).toBe(false);
    expect(form.getTextField("communicate only on day - other, explain").getText()).toContain("video call");
  });

  it("writes the confirmed marital settlement terms into Form 12.902(f)(1)", async () => {
    const { draft, viewModel } = sampleInputs();
    const bytes = await __testing.populateForm({
      formNumber: "12.902(f)(1)",
      draft,
      viewModel,
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getTextField("Petitioner’s full legal name").getText()).toBe("Alex Rivera (fictional)");
    expect(form.getTextField("Respondent’s full legal name").getText()).toBe("Jordan Rivera (fictional)");
    expect(form.getTextField("We were married to each other on date").getText()).toBe("06/14/2011");
    expect(form.getTextField("Other assets Petitioner shall receive").getText()).toContain("401(k)");
    expect(form.getTextField("Current fair market value other assets Petitioner shall receive").getText()).toBe(
      "60000.00",
    );
    expect(form.getTextField("Other assets Respondent shall receive").getText()).toContain("Marital home");
    expect(form.getTextField("Other to be paid by Petitioner").getText()).toContain("Car loan");
    expect(form.getTextField("Other monthly payment to be paid by Petitioner").getText()).toBe("420.00");
    expect(form.getTextField("Total debts monthly payment to be paid by Petitioner").getText()).toBe("420.00");
    expect(form.getCheckBox("Check Box9").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box13").isChecked()).toBe(true);
    expect(form.getTextField("Dollar amount").getText()).toBe("1000.00");
    expect(form.getTextField("Name and birth date of minor child or children").getText()).toContain(
      "Taylor Rivera (fictional)",
    );
    expect(form.getTextField("Indicate exhibit").getText()).toBe("A");
    expect(form.getCheckBox("Check Box18").isChecked()).toBe(true);
    expect(form.getTextField("Indicate amount per month").getText()).toBe("775.00");
    expect(form.getTextField("Commencing month, day, year").getText()).toBe("09/01/2026");
    expect(form.getCheckBox("Check Box22").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box26").isChecked()).toBe(true);
    expect(form.getTextField("Explain if other").getText()).toContain("first 12 months");
    expect(form.getCheckBox("Check Box28").isChecked()).toBe(true);
    expect(form.getCheckBox("Check Box33").isChecked()).toBe(true);
    expect(form.getTextField("Other 2").getText()).toContain("Dental and orthodontic");
    expect(form.getCheckBox("Check Box36").isChecked()).toBe(true);
    expect(form.getTextField("Amount of life insurance").getText()).toBe("100000.00");
    expect(form.getTextField("Explain tax exemptions for child or children").getText()).toContain(
      "file jointly for tax year 2026",
    );
    expect(form.getTextField("Other continued").getText()).toContain("vehicle lease");
    expect(form.getTextField("Issues not agreed on").getText()).toContain("Christmas-break start");
  });

  it("maps shared and allocated parental decision-making without inferring sole responsibility", async () => {
    const sharedDraftData = createSampleDraft();
    sharedDraftData.data.parentingPlan.decisionMakingReligion = "shared";
    const sharedDraft = buildReviewedDraft(sharedDraftData);
    const sharedBytes = await __testing.populateForm({
      formNumber: "12.995(a)",
      draft: sharedDraft,
      viewModel: buildPackageViewModel(sharedDraft),
    });
    const sharedForm = (await PDFDocument.load(sharedBytes)).getForm();
    expect(sharedForm.getCheckBox("Check Box15").isChecked()).toBe(true);
    expect(sharedForm.getCheckBox("Check Box20").isChecked()).toBe(false);

    const allocatedDraftData = createSampleDraft();
    allocatedDraftData.data.parentingPlan.decisionMakingEducation = "you";
    allocatedDraftData.data.parentingPlan.decisionMakingHealthcare = "other_parent";
    allocatedDraftData.data.parentingPlan.decisionMakingReligion = "you";
    const allocatedDraft = buildReviewedDraft(allocatedDraftData);
    const allocatedBytes = await __testing.populateForm({
      formNumber: "12.995(a)",
      draft: allocatedDraft,
      viewModel: buildPackageViewModel(allocatedDraft),
    });
    const allocatedForm = (await PDFDocument.load(allocatedBytes)).getForm();
    expect(allocatedForm.getCheckBox("Check Box16").isChecked()).toBe(true);
    expect(allocatedForm.getCheckBox("Check Box20").isChecked()).toBe(false);
    expect(allocatedForm.getTextField("Parent 1").getText()).toBe("Alex Rivera (fictional)");
    expect(allocatedForm.getTextField("Parent 2").getText()).toBe("Jordan Rivera (fictional)");
    expect(allocatedForm.getTextField("other activity").getText()).toBe("Religious upbringing");
    expect(allocatedForm.getTextField("Parent 3").getText()).toBe("Alex Rivera (fictional)");
  });

  it("does not expose an address marked confidential in the parenting plan", async () => {
    const source = createSampleDraft();
    source.data.parentingPlanDetails.petitionerAddressStatus = "confidential";
    const draft = buildReviewedDraft(source);
    const bytes = await __testing.populateForm({
      formNumber: "12.995(a)",
      draft,
      viewModel: buildPackageViewModel(draft),
    });
    const form = (await PDFDocument.load(bytes)).getForm();

    expect(form.getCheckBox("Check Box8").isChecked()).toBe(true);
    expect(form.getTextField("address of Petitioner").getText()).toBeUndefined();
    expect(form.getTextField("Address of Petitioner/Parent").getText()).toBeUndefined();
    expect(form.getTextField("City State Zip of Petitioner/Parent").getText()).toBeUndefined();
  });
});
