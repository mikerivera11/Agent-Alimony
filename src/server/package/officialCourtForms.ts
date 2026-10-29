import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFCheckBox,
  PDFDocument,
  PDFForm,
  type PDFFont,
  PDFTextField,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { POPULATED_OFFICIAL_FORM_NUMBERS, type FilingReadiness } from "@/domain/forms";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import type { PackageViewModel } from "@/domain/package";

type SupportedFormNumber =
  | "12.928"
  | "12.901(b)(1)"
  | "12.901(b)(2)"
  | "12.901(b)(3)"
  | "12.902(d)"
  | "12.902(e)"
  | "12.902(f)(1)"
  | "12.932"
  | "12.995(a)";

interface FormAsset {
  readonly formNumber: SupportedFormNumber;
  readonly title: string;
  readonly revision: string;
  readonly filename: string;
  readonly sha256: string;
}

export const OFFICIAL_COURT_FORM_ASSETS: Readonly<Record<SupportedFormNumber, FormAsset>> = {
  "12.928": {
    formNumber: "12.928",
    title: "Cover Sheet for Family Court Cases",
    revision: "02/24",
    filename: "form-12.928-rev-02-24.pdf",
    sha256: "eee69ad1368a7f9173de41fc71948a4f11f0af9d730e6d8062087f4137fdffe3",
  },
  "12.901(b)(1)": {
    formNumber: "12.901(b)(1)",
    title: "Petition for Dissolution of Marriage with Dependent or Minor Child(ren)",
    revision: "02/18",
    filename: "form-12.901-b1-rev-02-18.pdf",
    sha256: "98361e5644754931655179b4e7c5017293b827c0f2332449b0acb18bcfe2f032",
  },
  "12.901(b)(2)": {
    formNumber: "12.901(b)(2)",
    title: "Petition for Dissolution of Marriage with Property but No Dependent or Minor Child(ren)",
    revision: "02/18",
    filename: "form-12.901-b2-rev-02-18.pdf",
    sha256: "52c3556ec7ec55fe58905a9b3cd6dec5c1586f23002f3e814a12a706549a75a3",
  },
  "12.901(b)(3)": {
    formNumber: "12.901(b)(3)",
    title: "Petition for Dissolution of Marriage with No Dependent or Minor Child(ren) or Property",
    revision: "02/18",
    filename: "form-12.901-b3-rev-02-18.pdf",
    sha256: "feaeb54da6b0a829e7886b4a7121a8b07abf366b8ed75224e5135d18c5453ed6",
  },
  "12.902(d)": {
    formNumber: "12.902(d)",
    title: "Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) Affidavit",
    revision: "02/18",
    filename: "form-12.902-d-rev-02-18.pdf",
    sha256: "1c24cc1fd356fdd1ac6f88d7623f369e2a49b72a0401f92be8412447d75762a1",
  },
  "12.902(e)": {
    formNumber: "12.902(e)",
    title: "Child Support Guidelines Worksheet",
    revision: "06/25",
    filename: "form-12.902-e-rev-06-25.pdf",
    sha256: "033ec3e27e140e4d195ac20627ddba50148b1451230305abc8eea3580d0c4af6",
  },
  "12.902(f)(1)": {
    formNumber: "12.902(f)(1)",
    title: "Marital Settlement Agreement for Dissolution of Marriage with Dependent or Minor Child(ren)",
    revision: "02/18",
    filename: "form-12.902-f1-rev-02-18.pdf",
    sha256: "0b380c4298c2463591ae8d94db3d96e59b147a5068c42107181ae7b08e0602a8",
  },
  "12.932": {
    formNumber: "12.932",
    title: "Certificate of Compliance with Mandatory Disclosure",
    revision: "06/25",
    filename: "form-12.932-rev-06-25.pdf",
    sha256: "fa7a9836e2cc823b5d1a8df076bc4059b7dc5110ec969820891a02a73678a910",
  },
  "12.995(a)": {
    formNumber: "12.995(a)",
    title: "Parenting Plan",
    revision: "02/18",
    filename: "form-12.995-a-rev-02-18.pdf",
    sha256: "7f93a2d9f5cdfb41e04288eb9276e3c290b6c3c2904eafe707f339684f5eef05",
  },
};

export interface OfficialCourtFormsManifest {
  readonly included: readonly FormAsset[];
  readonly omitted: readonly string[];
  readonly warnings: readonly string[];
}

interface Party {
  readonly name: string;
  readonly street: string;
  readonly cityStateZip: string;
  readonly phone: string;
  readonly email: string;
}

interface PartyContext {
  readonly petitioner: Party | null;
  readonly respondent: Party | null;
  readonly self: Party;
  readonly spouse: Party;
  readonly selfIsPetitioner: boolean | null;
}

interface PopulationContext {
  readonly draft: ReviewedIntakeDraft;
  readonly viewModel?: PackageViewModel;
  readonly warnings: string[];
  readonly parties: PartyContext;
}

function assetPath(filename: string): string {
  return path.join(process.cwd(), "src", "server", "package", "florida-forms", filename);
}

async function loadVerifiedAsset(asset: FormAsset): Promise<Uint8Array> {
  const bytes = await readFile(assetPath(asset.filename));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256) {
    throw new Error(`Official form ${asset.formNumber} failed its revision-locked integrity check.`);
  }
  return bytes;
}

function partyFromDraft(
  details: ReviewedIntakeDraft["data"]["filingDetails"] extends infer T
    ? T extends { you: infer P }
      ? P
      : never
    : never,
): Party {
  const address = details?.address;
  return {
    name: details?.fullLegalName?.trim() ?? "",
    street: address?.street?.trim() ?? "",
    cityStateZip: [address?.city, address?.state, address?.postalCode].filter(Boolean).join(", "),
    phone: details?.phoneNumber?.trim() ?? "",
    email: details?.emailAddress?.trim() ?? "",
  };
}

function getParties(draft: ReviewedIntakeDraft): PartyContext {
  const filing = draft.data.filingDetails;
  const self = partyFromDraft(filing?.you);
  const spouse = partyFromDraft(filing?.spouse);
  const role = draft.data.spouses.yourRole;

  if (role === "petitioner") {
    return { petitioner: self, respondent: spouse, self, spouse, selfIsPetitioner: true };
  }
  if (role === "respondent") {
    return { petitioner: spouse, respondent: self, self, spouse, selfIsPetitioner: false };
  }
  return { petitioner: null, respondent: null, self, spouse, selfIsPetitioner: null };
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

function optionalDollars(value: number | undefined): string | undefined {
  return typeof value === "number" ? value.toFixed(2) : undefined;
}

function percent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${month}/${day}/${year}` : iso;
}

const ALIMONY_TYPE_LABELS = {
  bridge_the_gap: "Bridge-the-gap",
  rehabilitative: "Rehabilitative",
  durational: "Durational",
  lump_sum: "Lump sum",
  other: "Other",
} as const;

const ALIMONY_FREQUENCY_LABELS = {
  weekly: "weekly",
  every_two_weeks: "every two weeks",
  twice_monthly: "twice monthly",
  monthly: "monthly",
  one_time: "one-time",
  other: "other frequency",
} as const;

function agreedAlimonySummary(context: PopulationContext): string {
  const factors = context.draft.data.alimonyFactors;
  if (factors.alimonyAgreementStatus !== "agreed_payment") return "";
  const amount =
    typeof factors.agreedAlimonyAmount === "number"
      ? `$${factors.agreedAlimonyAmount.toFixed(2)}`
      : "amount not entered";
  const frequency = factors.agreedAlimonyFrequency
    ? ALIMONY_FREQUENCY_LABELS[factors.agreedAlimonyFrequency]
    : "frequency not entered";
  return [
    `${amount} ${frequency}`,
    factors.agreedAlimonyType ? ALIMONY_TYPE_LABELS[factors.agreedAlimonyType] : "",
    factors.agreedAlimonyEndCondition,
    factors.agreedAlimonyModifiability === "nonmodifiable"
      ? "nonmodifiable"
      : factors.agreedAlimonyModifiability === "modifiable"
        ? "modifiable"
        : "modifiability for attorney to confirm",
    factors.agreedAlimonyNotes,
  ]
    .filter(Boolean)
    .join("; ");
}

function selfIsAgreedAlimonyRecipient(context: PopulationContext): boolean | null {
  const recipient = context.draft.data.alimonyFactors.potentialAlimonyRecipient;
  if (recipient === "self") return true;
  if (recipient === "spouse") return false;
  return null;
}

function setText(
  form: PDFForm,
  name: string,
  value: string | number | null | undefined,
  warnings: string[],
): void {
  if (value === null || value === undefined || String(value).trim() === "") return;
  const field = form.getFieldMaybe(name);
  if (!(field instanceof PDFTextField)) {
    throw new Error(`Verified text field "${name}" is missing from the official PDF.`);
  }

  let text = String(value).replace(/\s+/g, " ").trim();
  const maxLength = field.getMaxLength();
  if (maxLength !== undefined && text.length > maxLength) {
    warnings.push(`${name} was shortened to fit the official form; review the full answer in the filing packet.`);
    text = `${text.slice(0, Math.max(0, maxLength - 1))}\u2026`;
  }
  field.setText(text);
}

function check(form: PDFForm, name: string): void {
  const field = form.getFieldMaybe(name);
  if (!(field instanceof PDFCheckBox)) {
    throw new Error(`Verified checkbox "${name}" is missing from the official PDF.`);
  }
  field.check();
}

function fitPopulatedTextFieldFonts(form: PDFForm, font: PDFFont): void {
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField) || !field.getText()?.trim()) continue;

    if (field.isMultiline()) {
      field.acroField.setDefaultAppearance("/Helvetica 8 Tf 0 g");
      continue;
    }

    const availableWidth = Math.min(
      ...field.acroField.getWidgets().map((widget) => Math.max(1, widget.getRectangle().width - 6)),
    );
    let fontSize = 10;
    while (fontSize > 5 && font.widthOfTextAtSize(field.getText() ?? "", fontSize) > availableWidth) {
      fontSize -= 0.25;
    }
    field.acroField.setDefaultAppearance(`/Helvetica ${fontSize} Tf 0 g`);
  }
}

function fillCaption(form: PDFForm, context: PopulationContext, fields: {
  county: string;
  petitioner: string;
  respondent: string;
}): void {
  const { county } = context.draft.data.caseBasics;
  setText(form, fields.county, county, context.warnings);
  setText(form, fields.petitioner, context.parties.petitioner?.name, context.warnings);
  setText(form, fields.respondent, context.parties.respondent?.name, context.warnings);
}

function fillCaseMetadata(
  form: PDFForm,
  context: PopulationContext,
  fields: {
    circuit?: string;
    caseNumber?: string;
    division?: string;
  },
): void {
  const filing = context.draft.data.filingDetails;
  if (fields.circuit) setText(form, fields.circuit, filing?.judicialCircuit, context.warnings);
  if (fields.caseNumber) setText(form, fields.caseNumber, filing?.caseNumber, context.warnings);
  if (fields.division) setText(form, fields.division, filing?.division, context.warnings);
}

function fillCoverSheet(form: PDFForm, context: PopulationContext): void {
  fillCaption(form, context, { county: "County", petitioner: "Petitioner", respondent: "Respondent" });
  fillCaseMetadata(form, context, { circuit: "Circuit", caseNumber: "Case Number" });
  setText(form, "Initial ActionPetition", "X", context.warnings);
  setText(form, "Dissolution of Marriage", "X", context.warnings);
  if (context.draft.data.filingDetails?.relatedCasesStatus === "none") {
    setText(form, "No to the best of my knowledge no related cases exist", "X", context.warnings);
  }
  if (context.draft.data.filingDetails?.relatedCasesStatus === "listed_separately") {
    setText(form, "Yes all related cases are listed on Family Law Form 12900h", "X", context.warnings);
  }
  setText(form, "Type or print name", context.parties.self.name, context.warnings);
  setText(form, "E-mail Address", context.parties.self.email, context.warnings);
}

function fillPetition(form: PDFForm, context: PopulationContext, formNumber: SupportedFormNumber): void {
  const data = context.draft.data;
  const filing = data.filingDetails;
  const petitioner = context.parties.petitioner;

  if (formNumber === "12.901(b)(1)") {
    fillCaption(form, context, {
      county: "NAME OF COUNTY",
      petitioner: "Petitioner",
      respondent: "Respondent",
    });
    fillCaseMetadata(form, context, {
      circuit: "NAME OF CIRCUIT COURT",
      caseNumber: "Case No",
      division: "Division",
    });
    setText(form, "full legal name", petitioner?.name, context.warnings);
    setText(form, "Date of marriage month day year", formatDate(data.marriage.marriageDate), context.warnings);
    setText(form, "date of separation1", formatDate(data.marriage.separationDate), context.warnings);
    setText(
      form,
      "Place of marriage county state country",
      [filing?.marriagePlaceCity, filing?.marriagePlaceStateOrCountry].filter(Boolean).join(", "),
      context.warnings,
    );

    const resident = filing?.whichPartyIsFloridaResident;
    const selfIsPetitioner = context.parties.selfIsPetitioner;
    const petitionerResident =
      resident === "both" ||
      (resident === "you" && selfIsPetitioner === true) ||
      (resident === "spouse" && selfIsPetitioner === false);
    const respondentResident =
      resident === "both" ||
      (resident === "you" && selfIsPetitioner === false) ||
      (resident === "spouse" && selfIsPetitioner === true);
    if (petitionerResident && respondentResident) check(form, "check jurisdiction if petitioner and respondent");
    else if (petitionerResident) check(form, "check jurisdiction if petitioner");
    else if (respondentResident) check(form, "check if repondent is");

    const petitionerMilitary = selfIsPetitioner ? filing?.you?.militaryService : filing?.spouse?.militaryService;
    const respondentMilitary = selfIsPetitioner ? filing?.spouse?.militaryService : filing?.you?.militaryService;
    if (petitionerMilitary === "none") check(form, "check if petitioner is not");
    else if (petitionerMilitary && petitionerMilitary !== "not_sure") check(form, "check if petitioner is");
    if (respondentMilitary === "none") check(form, "check if respondent is not");
    else if (respondentMilitary && respondentMilitary !== "not_sure") check(form, "check if repondent is");

    if (filing?.pregnancyStatus === "petitioner") {
      check(form, "check if petitioner is pregnant");
      setText(form, "Baby is due on date", formatDate(filing.pregnancyDueDate), context.warnings);
    } else if (filing?.pregnancyStatus === "respondent") {
      check(form, "check if respondent is pregnant");
      setText(form, "Baby is due on date-2", formatDate(filing.pregnancyDueDate), context.warnings);
    }

    const childDetails = new Map((filing?.children ?? []).map((child) => [child.childId, child]));
    if (data.children.children.length > 0) {
      check(form, "check if minor child common to both");
    }
    data.children.children.slice(0, 6).forEach((child, index) => {
      const name = childDetails.get(child.id)?.fullLegalName || child.nameOrInitials;
      setText(
        form,
        `name and date of birth child ${index + 1}`,
        `${name} \u2014 ${formatDate(child.dateOfBirth)}`,
        context.warnings,
      );
    });
    if (filing?.nonCommonMinorChildrenStatus === "yes") {
      check(form, "check if child not common to both parties");
      setText(form, "child not common to both 1", filing.nonCommonMinorChildrenDetails, context.warnings);
      setText(
        form,
        "The birth parent (s) of the above minor children is are name and address 1",
        filing.nonCommonMinorChildrenDetails,
        context.warnings,
      );
    }
    if (filing?.adultDependentChildrenStatus === "yes") {
      check(form, "check if child(ren) common to both parties who are 18 or older but who are dependent");
      setText(form, "child name and birth date with disability 1", filing.adultDependentChildrenDetails, context.warnings);
    }
    if (filing?.financialAffidavitStatus === "filed_with_petition") check(form, "filed with this petition");
    if (filing?.financialAffidavitStatus === "will_be_timely_filed") check(form, "will be timely filed");
    if (filing?.marriageGround === "irretrievably_broken") check(form, "the marriage is irretrievably broken");
    if (filing?.marriageGround === "mental_incapacity") {
      check(form, "check if one of the parties has been adjudged mentally incapacitated for a period of 3 years");
    }

    if ((data.assetsDebts?.items ?? []).length > 0) check(form, "there are marital assets or liabilities");
    else check(form, "no marital assests or liabilities");
    if (filing?.propertyDistributionRequest === "written_agreement") {
      check(form, "all marital assets or liabilities have been divided by written agreement");
    } else if (filing?.propertyDistributionRequest === "court_determination") {
      check(form, "The Court should determine how the assets and liabilities of this marriage are to be distributed");
    } else if (filing?.propertyDistributionRequest === "other_property_interest") {
      if (filing.propertyInterestRecipient === "petitioner") {
        check(form, "check if petitioner should be awarded an interest in the other spouse’s property");
      } else if (filing.propertyInterestRecipient === "respondent") {
        check(form, "check if respondent should be awarded an interest in the other spouse’s property");
      }
      setText(
        form,
        "an interest in the other spouse’s property should be awarded because",
        filing.propertyInterestExplanation,
        context.warnings,
      );
    }

    const parentingPlan = data.parentingPlan;
    if (filing?.childrenCurrentResidence === "petitioner") check(form, "minor resides with petitioner");
    if (filing?.childrenCurrentResidence === "respondent") check(form, "minor resides with respondent");
    if (filing?.childrenCurrentResidence === "other") {
      check(form, "minor resides with other circumstance");
      setText(
        form,
        "explain minor residence here if needed",
        filing.childrenCurrentResidenceExplanation,
        context.warnings,
      );
    }
    if (filing?.parentalResponsibilityRequest === "shared") {
      check(form, "parental responsibility shall be shared by both parents");
    } else if (
      filing?.parentalResponsibilityRequest === "sole_petitioner" ||
      filing?.parentalResponsibilityRequest === "sole_respondent"
    ) {
      check(form, "parental responsibility shall be awarded to petitioner or respondent. A choice required");
      check(
        form,
        filing.parentalResponsibilityRequest === "sole_petitioner"
          ? "responsibility awarded solely to petitioner"
          : "responsibility awarded solely to respondent",
      );
      setText(
        form,
        "shared parental responsibility would be detrimental to the children because",
        filing.soleResponsibilityDetrimentExplanation,
        context.warnings,
      );
    }
    if (filing?.parentingPlanIncludesTimeSharing === "yes") {
      check(form, "parenting plan includes time sharing");
      setText(
        form,
        "Petitioner will be referred to as",
        context.parties.petitioner?.name,
        context.warnings,
      );
      setText(
        form,
        "Respondent will be referred to as",
        context.parties.respondent?.name,
        context.warnings,
      );
    } else if (filing?.parentingPlanIncludesTimeSharing === "no") {
      check(form, "parenting plan does not include time sharing");
    }

    if (parentingPlan?.planStatus === "agreed") {
      check(form, "Check if attached proposed parenting plan should be adopted by the court");
      check(form, "parties agreed to having a parenting plan");
    }
    if (parentingPlan?.planStatus === "proposed") {
      check(form, "parties have not agreed to a parenting plan");
      check(form, "Check if attached proposed parenting plan should be adopted by the court");
    }
    if (parentingPlan?.planStatus === "in_dispute") {
      check(form, "parties have not agreed to a parenting plan");
    }
    setText(
      form,
      "Explain why this request is in the best interests of the children",
      filing?.parentingBestInterestsExplanation,
      context.warnings,
    );
    if (data.alimonyFactors.alimonyAgreementStatus === "agreed_payment") {
      const selfIsRecipient = selfIsAgreedAlimonyRecipient(context);
      const recipientIsPetitioner =
        selfIsRecipient === null || context.parties.selfIsPetitioner === null
          ? null
          : selfIsRecipient === context.parties.selfIsPetitioner;
      if (recipientIsPetitioner === true) {
        check(form, "Petitioner requests that the Court order the other spouse to pay the following");
        check(form, "check for payment by respondent");
      } else if (recipientIsPetitioner === false) {
        check(form, "Respondent requests that the Court order the other spouse to pay the following");
        check(form, "check for payment by petitioner");
      }
      setText(
        form,
        "indicate amount of payment",
        optionalDollars(data.alimonyFactors.agreedAlimonyAmount),
        context.warnings,
      );
      if (data.alimonyFactors.agreedAlimonyFrequency === "weekly") check(form, "check for every week");
      else if (data.alimonyFactors.agreedAlimonyFrequency === "every_two_weeks") {
        check(form, "check for every other week");
      } else if (data.alimonyFactors.agreedAlimonyFrequency === "monthly") {
        setText(form, "check for every month", "X", context.warnings);
      } else {
        setText(
          form,
          "enter other payment period",
          data.alimonyFactors.agreedAlimonyFrequency
            ? ALIMONY_FREQUENCY_LABELS[data.alimonyFactors.agreedAlimonyFrequency]
            : "",
          context.warnings,
        );
      }
      setText(form, "beginning date of support", formatDate(data.alimonyFactors.agreedAlimonyStartDate), context.warnings);
      setText(form, "payment made until this date", data.alimonyFactors.agreedAlimonyEndCondition, context.warnings);
      setText(
        form,
        "Explain why the Court should order Petitioner or Respondent to pay, and any specific request(s) for type of alimony",
        agreedAlimonySummary(context),
        context.warnings,
      );
    } else if (data.alimonyFactors.alimonyAgreementStatus === "agreed_waiver") {
      check(form, "Petitioner forever gives up any right to spousal support (alimony) from the other spouse");
      check(form, "Respondent forever gives up any right to spousal support (alimony) from the other spouse");
    }

    check(form, "request to award child support by petitioner");
    if (filing?.childSupportWorksheetStatus === "filed_with_petition") check(form, "guidelines are filed");
    if (filing?.childSupportWorksheetStatus === "will_be_timely_filed") check(form, "guidelines will be filed");
    if (filing?.retroactiveChildSupportStart === "separation") {
      check(form, "check for date of separation");
      setText(form, "date of separation2", formatDate(data.marriage.separationDate), context.warnings);
    } else if (filing?.retroactiveChildSupportStart === "filing") {
      check(form, "check for date of filing");
    } else if (filing?.retroactiveChildSupportStart === "other") {
      check(form, "check for date of other");
      setText(
        form,
        "indicate other date here",
        formatDate(filing.retroactiveChildSupportOtherDate),
        context.warnings,
      );
      setText(
        form,
        "explain other date of filing",
        filing.retroactiveChildSupportOtherExplanation,
        context.warnings,
      );
    }
    if (filing?.supportBeyondEighteen === "incapacity") {
      check(form, "petitioner requests that the Court award child support to be paid beyond the age of 18");
      check(form, "check because dependent has mental or physical incapacity");
      setText(
        form,
        "name(s) of dependent who has mental or physical incapacity",
        filing.supportBeyondEighteenDetails,
        context.warnings,
      );
      setText(form, "explain incapacity", filing.supportBeyondEighteenDetails, context.warnings);
    } else if (filing?.supportBeyondEighteen === "high_school") {
      check(form, "petitioner requests that the Court award child support to be paid beyond the age of 18");
      check(form, "check if children are dependent due to age as follows");
      setText(form, "names of children dependent due to age", filing.supportBeyondEighteenDetails, context.warnings);
    }
    if (filing?.childSupportDeviationRequested === "yes") check(form, "check if this is a petitioner request");

    const terms = data.settlementTerms;
    if (terms) {
      const healthIsPetitioner =
        terms.healthInsuranceProvider === "not_available"
          ? null
          : partyChoiceIsPetitioner(terms.healthInsuranceProvider, context);
      if (healthIsPetitioner !== null) {
        check(form, "check if this is a petitioner request on insurance");
        check(
          form,
          healthIsPetitioner ? "insurance provided by petitioner" : "insurance provided by respondent",
        );
      }
      check(form, "Check Box111");
      if (terms.uninsuredMedicalSplit === "equal") {
        check(form, "To be paid by both spouses equally");
      } else if (terms.uninsuredMedicalSplit === "guideline_percentages") {
        check(form, "To be paid according to the percentages in the Child Support Guidelines Worksheet, Florida Family");
      } else {
        check(form, "Other {explain}");
        setText(form, "Explaination of other payment arrangements", terms.uninsuredMedicalDetails, context.warnings);
      }
      if (terms.childSupportLifeInsuranceProvider !== "none") check(form, "Check Box118");
    }

    if (filing?.formerNameRestorationRequested === "yes") {
      setText(form, "former legal name", filing.formerNameToRestore, context.warnings);
    }
    setText(form, "Other relief specify 1", filing?.otherReliefRequested, context.warnings);
    if ((data.assetsDebts?.items ?? []).length > 0) {
      check(form, "check this and any of the following five that apply");
    }
    if (
      data.alimonyFactors.alimonyAgreementStatus === "agreed_payment" ||
      data.alimonyFactors.alimonyAgreementStatus === "agreed_waiver"
    ) {
      check(form, "check if this applies");
    }
    check(form, "check if this applies 2");
    check(form, "check if this applies 3");
    if (filing?.formerNameRestorationRequested === "yes") check(form, "check if this applies 4");
    if (filing?.otherReliefRequested?.trim()) check(form, "check if this applies 5");

    setText(form, "Printed Name", petitioner?.name, context.warnings);
    setText(form, "Address", petitioner?.street, context.warnings);
    setText(form, "City State Zip", petitioner?.cityStateZip, context.warnings);
    setText(form, "Telephone Number", petitioner?.phone, context.warnings);
    setText(form, "designated email address", petitioner?.email, context.warnings);
    return;
  }

  fillCaption(form, context, { county: "County Name", petitioner: "Petitioner", respondent: "Respondent" });
  fillCaseMetadata(form, context, {
    circuit: "Judicial Circuit",
    caseNumber: "Case Number",
    division: "Division",
  });
  setText(form, "Full Legal Name", petitioner?.name, context.warnings);
  setText(form, "Date of marriage: {month, day, year}", formatDate(data.marriage.marriageDate), context.warnings);
  setText(
    form,
    formNumber === "12.901(b)(2)" ? "Place of marriage: {county, state, country}" : "Place of marriage",
    [filing?.marriagePlaceCity, filing?.marriagePlaceStateOrCountry].filter(Boolean).join(", "),
    context.warnings,
  );
  if (formNumber === "12.901(b)(2)") {
    setText(form, "Date of separation: {month, day, year}", formatDate(data.marriage.separationDate), context.warnings);
    if (data.alimonyFactors.alimonyAgreementStatus === "agreed_payment") {
      setText(
        form,
        "Spousal support (alimony) Amount",
        optionalDollars(data.alimonyFactors.agreedAlimonyAmount),
        context.warnings,
      );
      setText(
        form,
        "Spousal support (alimony) amount beginning date month",
        formatDate(data.alimonyFactors.agreedAlimonyStartDate),
        context.warnings,
      );
      setText(
        form,
        "Spousal support (alimony) amount continuing until {date or event}",
        data.alimonyFactors.agreedAlimonyEndCondition,
        context.warnings,
      );
      setText(
        form,
        "type of alimony (temporary, permanent, bridge-the-gap, durational, rehabilitative, and/or lump sum)",
        data.alimonyFactors.agreedAlimonyType
          ? ALIMONY_TYPE_LABELS[data.alimonyFactors.agreedAlimonyType]
          : "",
        context.warnings,
      );
      setText(
        form,
        "Other provisions relating to alimony including any tax treatment and consequences1",
        agreedAlimonySummary(context),
        context.warnings,
      );
    }
  }
  setText(form, "Printed Name of Petitioner", petitioner?.name, context.warnings);
  setText(form, "Address of Petitioner", petitioner?.street, context.warnings);
  setText(form, "City State Zip of Petitioner", petitioner?.cityStateZip, context.warnings);
  setText(form, "Telephone Number of Petitioner", petitioner?.phone, context.warnings);
  setText(form, "Email Addresses of Petitioner", petitioner?.email, context.warnings);
}

function fillUccjea(form: PDFForm, context: PopulationContext): void {
  const data = context.draft.data;
  fillCaption(form, context, {
    county: "COUNTY NAME",
    petitioner: "PETITIONER NAME",
    respondent: "RESPONDENT NAME",
  });
  fillCaseMetadata(form, context, {
    circuit: "CIRCUIT COURT NAME",
    caseNumber: "CASE NUMBER",
    division: "COURT DIVISION",
  });
  setText(form, "full legal name", context.parties.self.name, context.warnings);
  setText(form, "number of minor children subject to this proceeding is", data.children.children.length, context.warnings);
  if (context.parties.selfIsPetitioner === true) check(form, "choose this box for Petitioner");
  if (context.parties.selfIsPetitioner === false) check(form, "choose this box for respondent");

  const filingChildren = new Map(
    (data.filingDetails?.children ?? []).map((child) => [child.childId, child.fullLegalName ?? ""]),
  );
  const childFields = [
    {
      name: "child number one name",
      birthDate: "Date of Birth of child 1",
      birthPlace: "Place of Birth for child 1",
      sex: "Sex of child 1",
      residences: [
        {
          address: "where child lived for past five years. Give address",
          combinedDates: "where child lived for past five years. Give date from when to present",
          livedWith: "name and address of person child lived with for past five years",
        },
        ...[2, 3, 4, 5, 6].map((number) => ({
          address: number === 2 ? "previous address" : `previous address ${number}`,
          from: `date ${number} from`,
          until: `date ${number} until`,
          livedWith: number === 2 ? "previous name" : `previous name ${number}`,
          relationship: number === 2 ? "previous relationship" : `previous relationship ${number}`,
        })),
      ],
    },
    {
      name: "child number two legal name",
      birthDate: "Date of Birth 2",
      birthPlace: "Place of Birth 2",
      sex: "Sex 2",
      residences: [
        { address: "address 2", from: "date 7 from", livedWith: "name 2", relationship: "relationship 2" },
        ...[7, 8, 9, 10, 11].map((number) => ({
          address: `previous address ${number}`,
          from: `date ${number + 1} from`,
          until: `date ${number + 1} until`,
          livedWith: `previous name ${number}`,
          relationship: `previous relationship ${number}`,
        })),
      ],
    },
    {
      name: "Childs Full Legal Name_3",
      birthDate: "Date of Birth_3",
      birthPlace: "Place of Birth_3",
      sex: "Sex_3",
      residences: [
        {
          address: "previous address 12",
          from: "date 13 from",
          livedWith: "previous name 12",
          relationship: "previous relationship 12",
        },
        ...[13, 14, 15, 16, 17].map((number) => ({
          address: `previous address ${number}`,
          from: `date ${number + 1} from`,
          until: `date ${number + 1} until`,
          livedWith: `previous name ${number}`,
          relationship: `previous relationship ${number}`,
        })),
      ],
    },
  ] as const;
  data.children.children.slice(0, childFields.length).forEach((child, index) => {
    const fields = childFields[index]!;
    const filingChild = data.filingDetails?.children.find((entry) => entry.childId === child.id);
    setText(form, fields.name, filingChildren.get(child.id) || child.nameOrInitials, context.warnings);
    setText(form, fields.birthDate, formatDate(child.dateOfBirth), context.warnings);
    setText(form, fields.birthPlace, filingChild?.placeOfBirth, context.warnings);
    setText(
      form,
      fields.sex,
      filingChild?.sex === "female" ? "Female" : filingChild?.sex === "male" ? "Male" : "",
      context.warnings,
    );
    filingChild?.residences.slice(0, fields.residences.length).forEach((residence, residenceIndex) => {
      const residenceFields = fields.residences[residenceIndex]!;
      setText(form, residenceFields.address, residence.address, context.warnings);
      if ("combinedDates" in residenceFields) {
        setText(
          form,
          residenceFields.combinedDates,
          `${formatDate(residence.fromDate)} to ${residence.untilDate ? formatDate(residence.untilDate) : "present"}`,
          context.warnings,
        );
      }
      if ("from" in residenceFields) {
        setText(form, residenceFields.from, formatDate(residence.fromDate), context.warnings);
      }
      if ("until" in residenceFields) {
        setText(form, residenceFields.until, formatDate(residence.untilDate), context.warnings);
      }
      setText(form, residenceFields.livedWith, residence.livedWithNameAndAddress, context.warnings);
      if ("relationship" in residenceFields) {
        setText(form, residenceFields.relationship, residence.relationship, context.warnings);
      }
    });
  });

  const filing = data.filingDetails;
  if (filing?.priorCustodyProceedingStatus === "none") {
    check(form, "check if you have not participated in custody or time sharing proceedings");
  } else if (filing?.priorCustodyProceedingStatus === "exists") {
    check(form, "check if you have participated in custody or time sharing proceedings");
    setText(
      form,
      "if you have participated in custody or time sharing proceedings indicate name of child",
      filing.priorCustodyProceedingDetails.childNames,
      context.warnings,
    );
    setText(form, "Type of proceeding", filing.priorCustodyProceedingDetails.proceedingType, context.warnings);
    setText(form, "Court and state", filing.priorCustodyProceedingDetails.courtAndState, context.warnings);
    setText(
      form,
      "Date of court order or judgment if any",
      formatDate(filing.priorCustodyProceedingDetails.orderDate),
      context.warnings,
    );
  }
  if (filing?.pendingCustodyProceedingStatus === "none") {
    check(form, "I HAVE NO INFORMATION of any custody or time-sharing proceeding pending in a court of this");
  } else if (filing?.pendingCustodyProceedingStatus === "exists") {
    check(form, "I have the following information of custody or time sharing proceedings pending in a court");
    setText(form, "Name of each child", filing.pendingCustodyProceedingDetails.childNames, context.warnings);
    setText(form, "Type of proceeding 2", filing.pendingCustodyProceedingDetails.proceedingType, context.warnings);
    setText(form, "Court and state 2", filing.pendingCustodyProceedingDetails.courtAndState, context.warnings);
    setText(
      form,
      "Date of court order or judgment if any 2",
      formatDate(filing.pendingCustodyProceedingDetails.orderDate),
      context.warnings,
    );
    setText(form, "case number", filing.pendingCustodyProceedingDetails.caseNumber, context.warnings);
  }
  if (filing?.thirdPartyCustodyClaimStatus === "none") {
    check(
      form,
      "I DO NOT KNOW OF ANY PERSON not a party to this proceeding who has physical custody or claims to have custody, visitation or time-sharing with respect to any child subject to this proceeding",
    );
  } else if (filing?.thirdPartyCustodyClaimStatus === "exists") {
    check(
      form,
      "I  KNOW THAT THE FOLLOWING NAMED PERSON(S) not a party to this proceeding who has physical custody or claims to have custody, visitation or time-sharing with respect to any child subject to this proceeding",
    );
    setText(form, "Name and address of person", filing.thirdPartyCustodyClaimDetails.nameAndAddress, context.warnings);
    setText(form, "Name of each child 4", filing.thirdPartyCustodyClaimDetails.childNames, context.warnings);
    setText(form, "Relationship to child", filing.thirdPartyCustodyClaimDetails.relationshipToChildren, context.warnings);
    if (filing.thirdPartyCustodyClaimDetails.claimType === "physical_custody") {
      check(form, "has physical custody");
    } else if (filing.thirdPartyCustodyClaimDetails.claimType === "custody_rights") {
      check(form, "claims custody rights");
    } else if (filing.thirdPartyCustodyClaimDetails.claimType === "visitation_or_time_sharing") {
      check(form, "claims visitation or time sharing");
    }
  }
  if (filing?.existingChildSupportOrderStatus === "none") {
    check(form, "children not subject to existing child support");
  } else if (filing?.existingChildSupportOrderStatus === "exists") {
    check(form, "children are subject to existing child support");
    setText(form, "Name of each child 6", filing.existingChildSupportOrderDetails.childNames, context.warnings);
    setText(form, "Type of proceeding 3", filing.existingChildSupportOrderDetails.proceedingType, context.warnings);
    setText(form, "Court and address", filing.existingChildSupportOrderDetails.courtAndAddress, context.warnings);
    setText(
      form,
      "Date of court order/judgment if any",
      formatDate(filing.existingChildSupportOrderDetails.orderDate),
      context.warnings,
    );
    setText(
      form,
      "Amount of child support paid and by whom",
      filing.existingChildSupportOrderDetails.amountAndPayer,
      context.warnings,
    );
  }
  setText(form, "Printed Name", context.parties.self.name, context.warnings);
  setText(form, "Address 2", context.parties.self.street, context.warnings);
  setText(form, "City State Zip 2", context.parties.self.cityStateZip, context.warnings);
  setText(form, "Telephone Number", context.parties.self.phone, context.warnings);
  setText(form, "Designated Email Addresses 2", context.parties.self.email, context.warnings);
}

function parentOrder<T>(context: PopulationContext, selfValue: T, spouseValue: T): {
  petitioner: T;
  respondent: T;
} | null {
  if (context.parties.selfIsPetitioner === true) return { petitioner: selfValue, respondent: spouseValue };
  if (context.parties.selfIsPetitioner === false) return { petitioner: spouseValue, respondent: selfValue };
  return null;
}

function fillChildSupport(form: PDFForm, context: PopulationContext): void {
  const outcome = context.viewModel?.childSupport;
  if (!outcome) return;
  if (outcome.kind !== "calculated") return;
  const result = outcome.result;
  fillCaption(form, context, {
    county: "County Name",
    petitioner: "petitioner",
    respondent: "respondent",
  });
  fillCaseMetadata(form, context, { caseNumber: "Case No", division: "Division" });
  setText(form, "County Name_2", context.draft.data.caseBasics.county, context.warnings);
  setText(form, "petitioner_2", context.parties.petitioner?.name, context.warnings);
  setText(form, "respondent_2", context.parties.respondent?.name, context.warnings);

  const ordered = parentOrder(context, result.parents[0], result.parents[1]);
  if (!ordered) return;
  const petitioner = ordered.petitioner;
  const respondent = ordered.respondent;
  setText(form, "Parties number of children in common", result.numberOfChildren, context.warnings);
  setText(form, "Petitioner Present Gross Monthly Income", money(petitioner.monthlyGrossIncomeCents), context.warnings);
  setText(form, "Respondent Present Gross Monthly Income", money(respondent.monthlyGrossIncomeCents), context.warnings);
  setText(form, "Petitioner Present Net Monthly Income", money(petitioner.monthlyNetIncomeCents), context.warnings);
  setText(form, "Respondent Present Net Monthly Income", money(respondent.monthlyNetIncomeCents), context.warnings);
  setText(form, "Total Present Net Monthly Income", money(result.combinedNetMonthlyIncomeCents), context.warnings);
  setText(form, "Petitioner answer on line 3A Divide the amount on line", percent(petitioner.incomeSharePercentBasisPoints), context.warnings);
  setText(form, "Respondent answer on line 3A Divide the amount on line", percent(respondent.incomeSharePercentBasisPoints), context.warnings);
  setText(form, "Total Basic Monthly Obligation", money(result.basicMonthlyNeedCents), context.warnings);
  setText(form, "Petitioner line 4A Multiply the number on line 2 by the", money(petitioner.dollarShareOfTotalNeedCents), context.warnings);
  setText(form, "Respondent line 4A Multiply the number on line 2 by the", money(respondent.dollarShareOfTotalNeedCents), context.warnings);
  setText(form, "Total Child Care Cost", money(result.childCareAddOnCents), context.warnings);
  setText(form, "Total Child(ren) Health Insurance Cost", money(result.childHealthInsuranceAddOnCents), context.warnings);
  setText(form, "Total Monthly Child Care and Health Costs", money(result.childCareAddOnCents + result.childHealthInsuranceAddOnCents), context.warnings);
  setText(form, "10. Total Monthly Obligation", money(result.totalMinimumChildSupportNeedCents), context.warnings);
  setText(form, "12. overnight stays with the Petitioner", petitioner.overnightsWithChild, context.warnings);
  setText(form, "12. overnight stays with Respondent", respondent.overnightsWithChild, context.warnings);
  setText(form, "12. Petitioner Percentage of Overnight Stays", percent(petitioner.overnightSharePercentBasisPoints), context.warnings);
  setText(form, "12. Respondent Percentage of Overnight Stays", percent(respondent.overnightSharePercentBasisPoints), context.warnings);
  setText(form, "21. Presumptive Child Support to be Paid", money(result.monthlyTransferAmountCents), context.warnings);
  setText(form, "Printed Name", context.parties.self.name, context.warnings);
  setText(form, "Address_2", context.parties.self.street, context.warnings);
  setText(form, "City State Zip_2", context.parties.self.cityStateZip, context.warnings);
  setText(form, "Telephone Number_2", context.parties.self.phone, context.warnings);
  setText(form, "Email Addresses_2", context.parties.self.email, context.warnings);
}

function partyChoiceIsPetitioner(
  choice: "you" | "other_parent",
  context: PopulationContext,
): boolean | null {
  if (context.parties.selfIsPetitioner === null) return null;
  return choice === "you" ? context.parties.selfIsPetitioner : !context.parties.selfIsPetitioner;
}

function fillAssignedItems(
  form: PDFForm,
  context: PopulationContext,
  recipient: "petitioner" | "respondent",
): void {
  const selfRecipient =
    context.parties.selfIsPetitioner === null
      ? null
      : recipient === "petitioner"
        ? context.parties.selfIsPetitioner
        : !context.parties.selfIsPetitioner;
  if (selfRecipient === null) return;

  const recipientValue = selfRecipient ? "you" : "spouse";
  const items = context.draft.data.assetsDebts.items ?? [];
  const assets = items.filter(
    (item) => item.type === "asset" && item.agreedRecipient === recipientValue,
  );
  const liabilities = items.filter(
    (item) => item.type === "liability" && item.agreedRecipient === recipientValue,
  );

  const assetDescriptionFields =
    recipient === "petitioner"
      ? [
          "Other assets Petitioner shall receive",
          "Other assets Petitioner shall receive 2",
          "Other assets Petitioner shall receive 3",
          "Other assets Petitioner shall receive 4",
          "Other assets Petitioner shall receive 5",
          "Other assets Petitioner shall receive 6",
          "Other assets Petitioner shall receive 7",
        ]
      : [
          "Other assets Respondent shall receive",
          "Other assets Respondent shall receive 2",
          "Other assets Respondent shall receive 3",
          "Other assets Respondent shall receive 4",
          "Other assets Respondent shall receive 5",
          "Other assets Respondent shall receive 6",
        ];
  const assetValueFields =
    recipient === "petitioner"
      ? [
          "Current fair market value other assets Petitioner shall receive",
          "Current fair market value other assets Petitioner shall receive 2",
          "Current fair market value other assets Petitioner shall receive 3",
          "Current fair market value other assets Petitioner shall receive 4",
          "Current fair market value other assets Petitioner shall receive 5",
          "Current fair market value other assets Petitioner shall receive 6",
          "Current fair market value other assets Petitioner shall receive 7",
        ]
      : [
          "Current fair market value other assets Respondent shall receive",
          "Current fair market value other assets Respondent shall receive 2",
          "Current fair market value other assets Respondent shall receive 3",
          "Current fair market value other assets Respondent shall receive 4",
          "Current fair market value other assets Respondent shall receive 5",
          "Current fair market value other assets Respondent shall receive 6",
        ];
  assets.slice(0, assetDescriptionFields.length).forEach((item, index) => {
    setText(form, assetDescriptionFields[index]!, item.label, context.warnings);
    setText(form, assetValueFields[index]!, item.value.toFixed(2), context.warnings);
  });
  if (assets.length > assetDescriptionFields.length) {
    context.warnings.push(
      `Form 12.902(f)(1) has room for only ${assetDescriptionFields.length} ${recipient} asset assignments; ${
        assets.length - assetDescriptionFields.length
      } additional item(s) remain in the attorney filing packet.`,
    );
  }
  setText(
    form,
    recipient === "petitioner" ? "Total Assets to Petitioner" : "Total Assets to Respondent",
    assets.reduce((sum, item) => sum + item.value, 0).toFixed(2),
    context.warnings,
  );

  const liabilityDescriptionFields =
    recipient === "petitioner"
      ? [
          "Other to be paid by Petitioner",
          "Other to be paid by Petitioner 2",
          "Other to be paid by Petitioner 3",
          "Other to be paid by Petitioner 4",
        ]
      : [
          "Other to be paid by Respondent",
          "Other to be paid by Respondent 2",
          "Other to be paid by Respondent 3",
          "Other to be paid by Respondent 4",
          "Other to be paid by Respondent 5",
        ];
  const liabilityBalanceFields =
    recipient === "petitioner"
      ? [
          "Other current amount owed to be paid by Petitioner",
          "Other current amount owed to be paid by Petitioner 2",
          "Other current amount owed to be paid by Petitioner3",
          "Other current amount owed to be paid by Petitioner4",
        ]
      : [
          "Other current amount owed to be paid by Respondent",
          "Other current amount owed to be paid by Respondent 2",
          "Other current amount owed to be paid by Respondent 3",
          "Other current amount owed to be paid by Respondent 4",
          "Other current amount owed to be paid by Respondent 5",
        ];
  const liabilityMonthlyPaymentFields =
    recipient === "petitioner"
      ? [
          "Other monthly payment to be paid by Petitioner",
          "Other monthly payment to be paid by Petitioner2",
          "Other monthly payment to be paid by Petitioner3",
          "Other monthly payment to be paid by Petitioner4",
        ]
      : [
          "Other monthly payment to be paid by Respondent",
          "Other monthly payment to be paid by Respondent 2",
          "Other monthly payment to be paid by Respondent 3",
          "Other monthly payment to be paid by Respondent 4",
          "Other monthly payment to be paid by Respondent 5",
        ];
  liabilities.slice(0, liabilityDescriptionFields.length).forEach((item, index) => {
    setText(form, liabilityDescriptionFields[index]!, item.label, context.warnings);
    setText(form, liabilityBalanceFields[index]!, item.value.toFixed(2), context.warnings);
    setText(
      form,
      liabilityMonthlyPaymentFields[index]!,
      item.monthlyPayment.toFixed(2),
      context.warnings,
    );
  });
  if (liabilities.length > liabilityDescriptionFields.length) {
    context.warnings.push(
      `Form 12.902(f)(1) has room for only ${liabilityDescriptionFields.length} ${recipient} debt assignments; ${
        liabilities.length - liabilityDescriptionFields.length
      } additional item(s) remain in the attorney filing packet.`,
    );
  }
  setText(
    form,
    recipient === "petitioner"
      ? "Total debts current amount owed to be paid by Petitioner"
      : "Total Current Amount Owed by Respondent",
    liabilities.reduce((sum, item) => sum + item.value, 0).toFixed(2),
    context.warnings,
  );
  setText(
    form,
    recipient === "petitioner"
      ? "Total debts monthly payment to be paid by Petitioner"
      : "Total Monthly payment to be paid by Respondent",
    liabilities.reduce((sum, item) => sum + item.monthlyPayment, 0).toFixed(2),
    context.warnings,
  );
}

function fillMaritalSettlementAgreement(form: PDFForm, context: PopulationContext): void {
  const data = context.draft.data;
  const terms = data.settlementTerms;
  const alimony = data.alimonyFactors;
  const filing = data.filingDetails;

  fillCaption(form, context, {
    county: "County Name",
    petitioner: "Petitioner",
    respondent: "Respondent",
  });
  fillCaseMetadata(form, context, {
    circuit: "Judicial Circuit",
    caseNumber: "Case Number",
    division: "Division",
  });
  setText(form, "Petitioner’s full legal name", context.parties.petitioner?.name, context.warnings);
  setText(form, "Respondent’s full legal name", context.parties.respondent?.name, context.warnings);
  setText(form, "We were married to each other on date", formatDate(data.marriage.marriageDate), context.warnings);

  fillAssignedItems(form, context, "petitioner");
  fillAssignedItems(form, context, "respondent");
  setText(
    form,
    "Contingent Assets and Liabilities (listed in Section III of our Family Law Financial Affidavits) will be",
    terms?.contingentAssetsLiabilities,
    context.warnings,
  );

  if (terms?.beneficiaryDesignationMode && terms.beneficiaryDesignationMode !== "none") {
    check(form, "Check Box1");
    check(form, "Check Box2");
    const ownerChoice = alimony.potentialAlimonyRecipient === "self" ? "other_parent" : "you";
    const ownerIsPetitioner = partyChoiceIsPetitioner(ownerChoice, context);
    if (ownerIsPetitioner === true) check(form, "Check Box3");
    if (ownerIsPetitioner === false) check(form, "Check Box4");
    setText(form, "Describe the assets with specificity", terms?.beneficiaryDesignationDetails, context.warnings);
  }

  if (alimony.alimonyAgreementStatus === "agreed_waiver") {
    check(form, "Check Box8");
  } else if (alimony.alimonyAgreementStatus === "agreed_payment") {
    const payerChoice = alimony.potentialAlimonyRecipient === "self" ? "other_parent" : "you";
    const payerIsPetitioner = partyChoiceIsPetitioner(payerChoice, context);
    if (payerIsPetitioner === true) check(form, "Check Box9");
    if (payerIsPetitioner === false) check(form, "Check Box10");
    setText(form, "Dollar amount", optionalDollars(alimony.agreedAlimonyAmount), context.warnings);
    if (alimony.agreedAlimonyFrequency === "weekly") check(form, "Check Box11");
    else if (alimony.agreedAlimonyFrequency === "every_two_weeks") check(form, "Check Box12");
    else if (alimony.agreedAlimonyFrequency === "monthly") check(form, "Check Box13");
    else {
      check(form, "Check Box14");
      setText(
        form,
        "Explain other",
        alimony.agreedAlimonyFrequency
          ? ALIMONY_FREQUENCY_LABELS[alimony.agreedAlimonyFrequency]
          : "See additional terms",
        context.warnings,
      );
    }
    setText(form, "Enter beginning date of alimony", formatDate(alimony.agreedAlimonyStartDate), context.warnings);
    setText(form, "Enter date or event alimony continues until", alimony.agreedAlimonyEndCondition, context.warnings);
    setText(
      form,
      "Type of alimony",
      [
        alimony.agreedAlimonyType ? ALIMONY_TYPE_LABELS[alimony.agreedAlimonyType] : "",
        alimony.agreedAlimonyNotes,
      ]
        .filter(Boolean)
        .join("; "),
      context.warnings,
    );
    if (alimony.agreedAlimonyNotes?.trim()) {
      check(form, "Check Box16");
      setText(
        form,
        "Other provisions relating to alimony, including any tax treatment and consequences",
        alimony.agreedAlimonyNotes,
        context.warnings,
      );
    }
  }

  if (alimony.agreedAlimonySecurity === "life_insurance") {
    setText(
      form,
      "Life insurance amount to secure the above support, will be provided by the Obligor",
      optionalDollars(alimony.agreedAlimonyAmount),
      context.warnings,
    );
  }

  const filingChildren = new Map((filing.children ?? []).map((child) => [child.childId, child.fullLegalName]));
  const childFields = [
    "Name and birth date of minor child or children",
    "Name and birth date of minor child or children 2",
    "Name and birth date of minor child or children 3",
    "Name and birth date of minor child or children 4",
    "Name and birth date of minor child or children 5",
    "Name and birth date of minor child or children 6",
  ];
  data.children.children.slice(0, childFields.length).forEach((child, index) => {
    setText(
      form,
      childFields[index]!,
      `${filingChildren.get(child.id) || child.nameOrInitials} — ${formatDate(child.dateOfBirth)}`,
      context.warnings,
    );
  });
  setText(form, "Indicate exhibit", terms?.parentingPlanExhibitLabel, context.warnings);

  if (terms) {
    const obligorIsPetitioner = partyChoiceIsPetitioner(terms.childSupportObligor, context);
    if (obligorIsPetitioner === true) check(form, "Check Box17");
    if (obligorIsPetitioner === false) check(form, "Check Box18");
    setText(form, "Indicate amount per month", optionalDollars(terms.agreedChildSupportMonthly), context.warnings);
    setText(
      form,
      "Indicate total number of parties’ minor or dependent children",
      data.children.children.length,
      context.warnings,
    );
    setText(form, "Commencing month, day, year", formatDate(terms.childSupportStartDate), context.warnings);
    setText(form, "Terminating month, day, year", formatDate(terms.childSupportEndDate), context.warnings);
    setText(form, "Indicate amount", optionalDollars(terms.childSupportPaymentAmount), context.warnings);
    setText(
      form,
      "Per week, month, other",
      terms.childSupportPaymentFrequency?.replaceAll("_", " "),
      context.warnings,
    );
    check(form, "Indicate if schedule appears below");
    setText(form, "Schedule for child support obligation", terms.childSupportStepDownSchedule, context.warnings);
    setText(
      form,
      "If the child support amount above deviates from the guidelines by 5% or more, explain the reason(s) here",
      terms.childSupportDeviationReason,
      context.warnings,
    );
    setText(form, "Indicate amount 3", optionalDollars(terms.retroactiveChildSupport), context.warnings);
    setText(form, "Indicate amount 4", optionalDollars(terms.childSupportArrearage), context.warnings);
    const hasArrearsAmounts =
      typeof terms.retroactiveChildSupport === "number" ||
      typeof terms.childSupportArrearage === "number";
    const totalArrears = (terms.retroactiveChildSupport ?? 0) + (terms.childSupportArrearage ?? 0);
    if (hasArrearsAmounts) {
      setText(form, "Indicate total amount", totalArrears.toFixed(2), context.warnings);
    }
    if (totalArrears > 0) {
      setText(form, "Indicate rate", optionalDollars(terms.arrearsPaymentAmount), context.warnings);
      setText(form, "Beginning date 2", formatDate(terms.arrearsPaymentStartDate), context.warnings);
      if (terms.arrearsPaymentFrequency === "weekly") check(form, "Check Box19");
      if (terms.arrearsPaymentFrequency === "every_two_weeks") check(form, "Check Box20");
      if (terms.arrearsPaymentFrequency === "monthly") check(form, "Check Box21");
    }

    const healthIsPetitioner =
      terms.healthInsuranceProvider === "not_available"
        ? null
        : partyChoiceIsPetitioner(terms.healthInsuranceProvider, context);
    if (healthIsPetitioner === true) check(form, "Check Box22");
    if (healthIsPetitioner === false) check(form, "Check Box23");
    if (terms.healthInsuranceProvider === "not_available") {
      check(form, "Indicate if health insurance is either not reasonable in cost or accessible to the child(ren) at this time");
    }
    if (terms.uninsuredMedicalSplit === "equal") check(form, "Check Box24");
    if (terms.uninsuredMedicalSplit === "guideline_percentages") check(form, "Check Box25");
    if (terms.uninsuredMedicalSplit === "other") {
      check(form, "Check Box26");
      setText(form, "Explain if other", terms.uninsuredMedicalDetails, context.warnings);
    }

    const dentalIsPetitioner =
      terms.dentalInsuranceProvider === "not_available"
        ? null
        : partyChoiceIsPetitioner(terms.dentalInsuranceProvider, context);
    if (dentalIsPetitioner === true) check(form, "Check Box27");
    if (dentalIsPetitioner === false) check(form, "Check Box28");
    if (terms.dentalInsuranceProvider === "not_available") check(form, "Check Box37");
    if (terms.uninsuredDentalSplit === "equal") check(form, "Check Box31");
    if (terms.uninsuredDentalSplit === "guideline_percentages") check(form, "Check Box32");
    if (terms.uninsuredDentalSplit === "other") {
      check(form, "Check Box33");
      setText(form, "Other 2", terms.uninsuredDentalDetails, context.warnings);
    }

    const lifeInsuranceIsPetitioner =
      terms.childSupportLifeInsuranceProvider === "none"
        ? null
        : partyChoiceIsPetitioner(terms.childSupportLifeInsuranceProvider, context);
    if (lifeInsuranceIsPetitioner === true) check(form, "Check Box35");
    if (lifeInsuranceIsPetitioner === false) check(form, "Check Box36");
    setText(
      form,
      "Amount of life insurance",
      optionalDollars(terms.childSupportLifeInsuranceAmount),
      context.warnings,
    );
    setText(form, "Explain tax exemptions for child or children", terms.taxExemptionTerms, context.warnings);
    setText(
      form,
      "Other provisions relating to child support (e.g., uninsured medical/dental expenses, health or dental insurance, life insurance to secure child support, orthodontic payments, college fund, etc.):",
      terms.otherChildSupportTerms,
      context.warnings,
    );
    const sharedDispositionTerms = (data.assetsDebts.items ?? [])
      .filter(
        (item) =>
          item.agreedRecipient === "joint" || item.agreedRecipient === "sell_and_divide",
      )
      .map((item) =>
        item.agreedRecipient === "joint"
          ? `${item.label} ($${item.value.toFixed(2)}) will be retained jointly.`
          : `${item.label} ($${item.value.toFixed(2)}) will be sold and the proceeds divided as stated by the parties.`,
      );
    setText(
      form,
      "Other continued",
      [terms.otherSettlementTerms, ...sharedDispositionTerms].filter(Boolean).join(" "),
      context.warnings,
    );
    setText(form, "Issues not agreed on", terms.unresolvedIssues, context.warnings);
  }

  setText(form, "Printed Name of Petitioner", context.parties.petitioner?.name, context.warnings);
  setText(form, "Address of Petitioner", context.parties.petitioner?.street, context.warnings);
  setText(form, "City State Zip of Petitioner", context.parties.petitioner?.cityStateZip, context.warnings);
  setText(form, "Telephone Number of Petitioner", context.parties.petitioner?.phone, context.warnings);
  setText(form, "Designated E-mail Address(es) of Petitioner", context.parties.petitioner?.email, context.warnings);
  setText(form, "Printed Name of Respondent", context.parties.respondent?.name, context.warnings);
  setText(form, "Address of Respondent", context.parties.respondent?.street, context.warnings);
  setText(form, "City State Zip of Respondent", context.parties.respondent?.cityStateZip, context.warnings);
  setText(form, "Telephone Number of Respondent", context.parties.respondent?.phone, context.warnings);
  setText(form, "Designated E-mail Address(es) of Respondent", context.parties.respondent?.email, context.warnings);
}

function holidayParent(
  choice: "you" | "other_parent",
  context: PopulationContext,
): string {
  return choice === "you" ? context.parties.self.name : context.parties.spouse.name;
}

function fillHolidayRow(
  form: PDFForm,
  context: PopulationContext,
  holiday: NonNullable<ReviewedIntakeDraft["data"]["parentingPlan"]>["holidaySchedules"][number],
  fields: { even: string; odd: string; every: string; time: string },
): void {
  if (holiday.rotation === "alternating" && holiday.oddYearParent) {
    const oddChoice = holiday.oddYearParent;
    const evenChoice = oddChoice === "you" ? "other_parent" : "you";
    setText(form, fields.odd, holidayParent(oddChoice, context), context.warnings);
    setText(form, fields.even, holidayParent(evenChoice, context), context.warnings);
  } else if (holiday.rotation === "you_every_year") {
    setText(form, fields.every, context.parties.self.name, context.warnings);
  } else if (holiday.rotation === "other_parent_every_year") {
    setText(form, fields.every, context.parties.spouse.name, context.warnings);
  }
  setText(form, fields.time, holiday.beginEndTime, context.warnings);
}

function holidayOverflowText(
  holiday: NonNullable<ReviewedIntakeDraft["data"]["parentingPlan"]>["holidaySchedules"][number],
  context: PopulationContext,
): string {
  let assignment = "assignment not decided";
  if (holiday.rotation === "alternating" && holiday.oddYearParent) {
    const oddParent = holidayParent(holiday.oddYearParent, context);
    const evenParent = holidayParent(
      holiday.oddYearParent === "you" ? "other_parent" : "you",
      context,
    );
    assignment = `${evenParent} in even-numbered years and ${oddParent} in odd-numbered years`;
  } else if (holiday.rotation === "you_every_year") {
    assignment = `${context.parties.self.name} every year`;
  } else if (holiday.rotation === "other_parent_every_year") {
    assignment = `${context.parties.spouse.name} every year`;
  } else if (holiday.rotation === "regular_schedule") {
    assignment = "regular time-sharing schedule";
  }
  return `${holiday.name}: ${assignment}; ${holiday.beginEndTime?.trim() || "times not decided"}${
    holiday.notes?.trim() ? `; ${holiday.notes.trim()}` : ""
  }.`;
}

const STANDARD_HOLIDAYS = [
  { aliases: ["mother's day", "mothers day"], row: 1, even: "Mothers Day" },
  { aliases: ["father's day", "fathers day"], row: 2, even: "Fathers Day" },
  { aliases: ["president's day", "presidents day"], row: 3, even: "Presidents Day" },
  { aliases: ["martin luther king jr. day", "martin luther king day", "mlk day"], row: 4, even: "M L King Day" },
  { aliases: ["easter"], row: 5, even: "Easter" },
  { aliases: ["passover"], row: 6, even: "Passover" },
  { aliases: ["memorial day", "memorial day weekend"], row: 7, even: "Memorial Day Wkd" },
  { aliases: ["4th of july", "fourth of july", "independence day"], row: 8, even: "4th of July" },
  { aliases: ["labor day", "labor day weekend"], row: 9, even: "Labor Day Wkd" },
  { aliases: ["columbus day", "columbus day weekend"], row: 10, even: "Columbus Day Wkd" },
  { aliases: ["halloween"], row: 11, even: "Halloween" },
  { aliases: ["thanksgiving"], row: 12, even: "Thanksgiving" },
  { aliases: ["veterans day", "veteran's day"], row: 13, even: "Veterans Day" },
  { aliases: ["hanukkah"], row: 14, even: "Hanukkah" },
  { aliases: ["yom kippur"], row: 15, even: "Yom Kippur" },
  { aliases: ["rosh hashanah"], row: 16, even: "Rosh Hashanah" },
] as const;

function standardHolidayFields(name: string): { even: string; odd: string; every: string; time: string } | null {
  const normalized = name.trim().toLowerCase();
  if (["birthday", "birthdays", "children's birthdays"].includes(normalized)) {
    return { even: "Birthdays", odd: "Odd years 17", every: "Every Year 17", time: "BeginEnd Time 17" };
  }
  const holiday = STANDARD_HOLIDAYS.find((candidate) =>
    (candidate.aliases as readonly string[]).includes(normalized),
  );
  if (!holiday) return null;
  return {
    even: holiday.even,
    odd: `Odd Years ${holiday.row}`,
    every: `Every Year ${holiday.row}`,
    time: `BeginEnd Time ${holiday.row}`,
  };
}

function decisionMaker(
  choice: "shared" | "you" | "other_parent" | "undecided",
  context: PopulationContext,
): string {
  if (choice === "you") return context.parties.self.name;
  if (choice === "other_parent") return context.parties.spouse.name;
  return "";
}

function fillParentingPlan(form: PDFForm, context: PopulationContext): void {
  const data = context.draft.data;
  const plan = data.parentingPlan;
  const details = data.parentingPlanDetails;
  const overflowHolidayTerms = (plan?.holidaySchedules ?? [])
    .filter((holiday) => !standardHolidayFields(holiday.name))
    .slice(2)
    .map((holiday) => holidayOverflowText(holiday, context));
  fillCaption(form, context, {
    county: "County Name",
    petitioner: "Petitioner",
    respondent: "Respondent",
  });
  fillCaseMetadata(form, context, {
    circuit: "Judicial Circuit",
    caseNumber: "Case Number",
    division: "Division",
  });
  setText(form, "Name of Petitioner", context.parties.petitioner?.name, context.warnings);
  setText(form, "Name of Respondent", context.parties.respondent?.name, context.warnings);
  setText(form, "Petitioner, hereinafter referred to in this Parenting Plan as Parent", "Petitioner", context.warnings);
  setText(form, "Respondent, hereinafter referred to in this Parenting Plan as Parent", "Respondent", context.warnings);
  const petitionerAddressIsKnown = details?.petitionerAddressStatus === "known";
  const respondentAddressIsKnown = details?.respondentAddressStatus === "known";
  setText(
    form,
    "address of Petitioner",
    petitionerAddressIsKnown ? context.parties.petitioner?.street : "",
    context.warnings,
  );
  setText(form, "telephone of Petitioner", context.parties.petitioner?.phone, context.warnings);
  setText(form, "email of Petitioner", context.parties.petitioner?.email, context.warnings);
  setText(
    form,
    "address of Respondent",
    respondentAddressIsKnown ? context.parties.respondent?.street : "",
    context.warnings,
  );
  setText(form, "telephone of Respondent", context.parties.respondent?.phone, context.warnings);
  setText(form, "email of Respondent", context.parties.respondent?.email, context.warnings);
  setText(form, "Printed Name of Petitioner/Parent", context.parties.petitioner?.name, context.warnings);
  setText(
    form,
    "Address of Petitioner/Parent",
    petitionerAddressIsKnown ? context.parties.petitioner?.street : "",
    context.warnings,
  );
  setText(
    form,
    "City State Zip of Petitioner/Parent",
    petitionerAddressIsKnown ? context.parties.petitioner?.cityStateZip : "",
    context.warnings,
  );
  setText(form, "Telephone Number of Petitioner/Parent", context.parties.petitioner?.phone, context.warnings);
  setText(form, "Designated Email Addresses of Petitioner", context.parties.petitioner?.email, context.warnings);
  setText(form, "Printed Name of Respondent/Parent", context.parties.respondent?.name, context.warnings);
  setText(
    form,
    "Address of Respondent/Parent",
    respondentAddressIsKnown ? context.parties.respondent?.street : "",
    context.warnings,
  );
  setText(
    form,
    "City State Zip of Respondent/Parent",
    respondentAddressIsKnown ? context.parties.respondent?.cityStateZip : "",
    context.warnings,
  );
  setText(form, "Telephone Number of Respondent/Parent", context.parties.respondent?.phone, context.warnings);
  setText(form, "Designated Email Addresses of Respondent/Parent", context.parties.respondent?.email, context.warnings);

  if (plan?.planStatus === "agreed") {
    check(form, "Check Box1");
  } else if (plan?.planStatus === "proposed" || plan?.planStatus === "in_dispute") {
    check(form, "Check Box2");
    setText(form, "parent's name", context.parties.self.name, context.warnings);
  }
  if (details?.planOrderType === "final") check(form, "Check Box4");
  if (details?.planOrderType === "temporary") check(form, "Check Box5");
  if (details?.planOrderType === "modification") check(form, "Check Box6");
  if (details?.petitionerAddressStatus === "unknown") check(form, "Check Box7");
  if (details?.petitionerAddressStatus === "confidential") check(form, "Check Box8");
  if (details?.respondentAddressStatus === "unknown") check(form, "Check Box11");
  if (details?.respondentAddressStatus === "confidential") check(form, "Check Box12");

  const filingChildren = new Map(
    (data.filingDetails?.children ?? []).map((child) => [child.childId, child.fullLegalName ?? ""]),
  );
  const childFields = [
    "name of child one and date of birth",
    "name of child two and date of birth",
    "name of child three and date of birth",
    "name of child four and date of birth",
    "name of child five and date of birth",
  ];
  data.children.children.slice(0, childFields.length).forEach((child, index) => {
    setText(
      form,
      childFields[index]!,
      `${filingChildren.get(child.id) || child.nameOrInitials} \u2014 ${formatDate(child.dateOfBirth)}`,
      context.warnings,
    );
  });

  if (plan) {
    const decisions = [
      plan.decisionMakingEducation,
      plan.decisionMakingHealthcare,
      plan.decisionMakingReligion,
    ];
    const decidedParents = decisions.filter(
      (choice): choice is "you" | "other_parent" => choice === "you" || choice === "other_parent",
    );
    if (decisions.every((choice) => choice === "shared")) {
      check(form, "Check Box15");
    } else if (decidedParents.length === 3 && decidedParents.every((choice) => choice === decidedParents[0])) {
      check(form, "Check Box20");
      setText(form, "Name or designation of that parent", decisionMaker(decidedParents[0]!, context), context.warnings);
    } else if (decisions.some((choice) => choice === "you" || choice === "other_parent")) {
      check(form, "Check Box16");
      setText(form, "Parent 1", decisionMaker(plan.decisionMakingEducation, context), context.warnings);
      setText(form, "Parent 2", decisionMaker(plan.decisionMakingHealthcare, context), context.warnings);
      if (plan.decisionMakingReligion === "you" || plan.decisionMakingReligion === "other_parent") {
        setText(form, "other activity", "Religious upbringing", context.warnings);
        setText(form, "Parent 3", decisionMaker(plan.decisionMakingReligion, context), context.warnings);
      }
    }
  }

  if (details?.extracurricularApproval === "either_parent") check(form, "Check Box21");
  if (details?.extracurricularApproval === "mutual_agreement") check(form, "Check Box22");
  if (details?.extracurricularTransportation === "parent_with_child") check(form, "Check Box23");
  if (details) {
    const otherActivityPercent = 100 - details.extracurricularActivityCostPercentSelf;
    const otherEquipmentPercent = 100 - details.extracurricularEquipmentCostPercentSelf;
    check(form, "Check Box24");
    setText(
      form,
      "indicate percentage of cost for activities by parent 1",
      `${context.parties.self.name} — ${details.extracurricularActivityCostPercentSelf}%`,
      context.warnings,
    );
    setText(
      form,
      "indicate percentage of cost for activities by parent 2",
      `${context.parties.spouse.name} — ${otherActivityPercent}%`,
      context.warnings,
    );
    check(form, "Check Box25");
    setText(
      form,
      "The costs of the extra-curricular activities shall be paid by parent 1",
      `${context.parties.self.name} — ${details.extracurricularEquipmentCostPercentSelf}%`,
      context.warnings,
    );
    setText(
      form,
      "The costs of the extra-curricular activities shall be paid by parent 2",
      `${context.parties.spouse.name} — ${otherEquipmentPercent}%`,
      context.warnings,
    );
  }
  if (details?.extracurricularApproval === "other" || details?.extracurricularTransportation === "other") {
    check(form, "Check Box26");
    setText(form, "other", details.extracurricularCosts, context.warnings);
  }
  setText(
    form,
    "Indicate other information that may be important related to information sharing",
    details?.informationSharingOther,
    context.warnings,
  );

  if (details?.schoolCalendarBasis === "oldest_child") check(form, "Check Box27");
  if (details?.schoolCalendarBasis === "youngest_child") check(form, "Check Box28");
  if (details?.schoolCalendarBasis === "county") {
    setText(form, "the county of school", details.schoolCalendarDetails, context.warnings);
  }
  if (details?.schoolCalendarBasis === "school") {
    setText(form, "school", details.schoolCalendarDetails, context.warnings);
  }
  if (details?.scheduleChangeNotice?.trim()) {
    check(form, "Check Box31");
    setText(form, "indicate date for change notice", details.scheduleChangeNotice, context.warnings);
  }
  if (details?.scheduleChangeRequesterPaysCosts === "yes") check(form, "Check Box32");
  if (details?.scheduleChangeOther?.trim()) {
    check(form, "Check Box33");
    setText(form, "Other2", details.scheduleChangeOther, context.warnings);
  }

  setText(
    form,
    "For purposes of school boundary determination and registration, the address of Parent {name or designation} shall be used",
    plan?.schoolDesignationParent === "you"
      ? context.parties.self.name
      : plan?.schoolDesignationParent === "other_parent"
        ? context.parties.spouse.name
        : "",
    context.warnings,
  );
  const regularSchedule = [
    plan?.weekdaySchedule?.trim() ? `Weekdays: ${plan.weekdaySchedule.trim()}` : "",
    plan?.weekendSchedule?.trim() ? `Weekends: ${plan.weekendSchedule.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  setText(form, "The children shall spend time with Parent", context.parties.petitioner?.name, context.warnings);
  setText(form, "dates and times children shall spend time with the Parent", context.parties.respondent?.name, context.warnings);
  setText(form, "indicate schedule date", formatDate(details?.scheduleStartDate), context.warnings);
  setText(form, "Other 5", regularSchedule, context.warnings);
  setText(form, "Other 7", regularSchedule, context.warnings);
  if (details?.differentChildSchedule === "yes") {
    check(form, "Check Box40");
    setText(form, "Other 8", details.differentChildScheduleDetails, context.warnings);
  }

  if (details?.winterBreakMode === "split") check(form, "Check Box46");
  if (details?.winterBreakMode === "alternating_entire_break") check(form, "Check Box50");
  if (details?.winterBreakMode === "other") check(form, "Check Box52");
  setText(form, "Indicate other winter break date variations", details?.winterBreakDetails, context.warnings);
  setText(form, "specific Winter Holidays", plan?.holidaySchedule, context.warnings);

  if (details?.springBreakMode === "regular_schedule") check(form, "Check Box54");
  if (details?.springBreakMode === "alternating") check(form, "Check Box55");
  if (details?.springBreakMode === "one_parent") check(form, "Check Box96");
  if (details?.springBreakMode === "even_split") check(form, "Check Box101");
  if (details?.springBreakMode === "other") check(form, "Check Box102");
  if (
    details?.springBreakMode === "alternating" &&
    details.springBreakParent &&
    details.springBreakParent !== "undecided"
  ) {
    const oddChoice = details.springBreakParent;
    const evenChoice = oddChoice === "you" ? "other_parent" : "you";
    setText(
      form,
      "Parent having child(ren) for odd-numbered years for Spring Break",
      holidayParent(oddChoice, context),
      context.warnings,
    );
    setText(
      form,
      "Parent having child(ren) for even-numbered years for Spring Break",
      holidayParent(evenChoice, context),
      context.warnings,
    );
  }
  if (
    details?.springBreakMode === "one_parent" &&
    details.springBreakParent &&
    details.springBreakParent !== "undecided"
  ) {
    setText(
      form,
      "Parent shall have the child(ren) for the entire Spring Break every year",
      holidayParent(details.springBreakParent, context),
      context.warnings,
    );
  }
  if (details?.springBreakMode === "other") {
    setText(form, "spring break other share time", details.springBreakDetails, context.warnings);
  }

  if (details?.summerBreakMode === "regular_schedule") check(form, "Check Box104");
  if (details?.summerBreakMode === "one_parent") check(form, "Check Box105");
  if (details?.summerBreakMode === "equal_split") check(form, "Check Box106");
  if (details?.summerBreakMode === "other") check(form, "Check Box117");
  if (details?.summerBreakMode === "other" && details.summerBreakDetails?.trim()) {
    setText(form, "date for summer break 4", details.summerBreakDetails, context.warnings);
  }
  if (
    details?.summerBreakMode === "one_parent" &&
    details.summerBreakParent &&
    details.summerBreakParent !== "undecided"
  ) {
    setText(
      form,
      "Parent that shall have the entire Summer Break from school",
      holidayParent(details.summerBreakParent, context),
      context.warnings,
    );
  }

  if (details?.transportationMode === "you" || details?.transportationMode === "other_parent") {
    check(form, "Check Box119");
    setText(
      form,
      "Parent shall provide all transportation",
      holidayParent(details.transportationMode, context),
      context.warnings,
    );
  }
  if (details?.transportationMode === "beginning_parent") check(form, "Check Box120");
  if (details?.transportationMode === "ending_parent") check(form, "Check Box121");
  if (details?.transportationMode === "other") {
    check(form, "Check Box122");
    setText(form, "explain other time sharing transportation options", details.transportationDetails, context.warnings);
  }
  setText(form, "Number of minutes late", details?.lateExchangeMinutes, context.warnings);
  if (details?.exchangeLocationMode === "parents_homes") check(form, "Check Box125");
  if (details?.exchangeLocationMode === "specific_location") {
    check(form, "Check Box126");
    setText(form, "Explain where exchanges shall occur", details.exchangeLocationDetails, context.warnings);
  }
  if (details?.exchangeLocationMode === "other") {
    check(form, "Check Box127");
    setText(form, "Exchanges shall occur at other place", details.exchangeLocationDetails, context.warnings);
  }
  if (details?.transportationCostsMode === "child_support_order") check(form, "Check Box130");
  if (details?.transportationCostsMode === "split") {
    check(form, "Check Box131");
    setText(form, "% of the transportation costs", "50", context.warnings);
    setText(form, "% of the transportation costs 1", "50", context.warnings);
  }
  if (details?.transportationCostsMode === "other") {
    check(form, "Check Box132");
    setText(form, "% of the transportation costs other", details.transportationCostsDetails, context.warnings);
  }
  if (details) {
    check(form, "Check Box135");
    setText(form, "indicate number of days 1", details.domesticTravelNoticeDays, context.warnings);
    setText(form, "indicate number of days 2", details.domesticTravelNoticeDays, context.warnings);
    check(form, "Check Box139");
    setText(form, "indicate number of days 3", details.internationalTravelNoticeDays, context.warnings);
    if (details.internationalTravelSecurity?.trim()) {
      check(form, "Check Box140");
      setText(form, "indicate security information for return of child", details.internationalTravelSecurity, context.warnings);
    }
    if (details.travelOther?.trim()) {
      check(form, "Check Box141");
      setText(form, "indicate other information related to travel", details.travelOther, context.warnings);
    }
    if (details.majorityDesignationParent !== "undecided") {
      setText(
        form,
        "Insert the name or designation of the appropriate parent in the space provided",
        holidayParent(details.majorityDesignationParent, context),
        context.warnings,
      );
    }
    const parentCommunicationCheckboxes = {
      in_person: "Check Box145",
      telephone: "Check Box146",
      letter: "Check Box147",
      email: "Check Box148",
      other: "Check Box149",
    } as const;
    (details.parentCommunicationMethods ?? []).forEach((method) =>
      check(form, parentCommunicationCheckboxes[method]),
    );
    setText(form, "parents communicate by other - explain", details.parentCommunicationOther, context.warnings);

    const childCommunicationCheckboxes = {
      telephone: "Check Box150",
      email: "Check Box151",
      video: "Check Box152",
      other: "Check Box152",
    } as const;
    (details.childCommunicationMethods ?? []).forEach((method) =>
      check(form, childCommunicationCheckboxes[method]),
    );
    setText(
      form,
      "child has communication with other parent explain",
      (details.childCommunicationMethods ?? []).join(", "),
      context.warnings,
    );
    if (details.childCommunicationMode === "anytime") check(form, "Check Box153");
    if (details.childCommunicationMode === "daily") check(form, "Check Box154");
    if (details.childCommunicationMode === "specific_days") check(form, "Check Box155");
    if (details.childCommunicationMode === "other") check(form, "Check Box156");
    setText(form, "communicate only on day - other, explain", details.childCommunicationDetails, context.warnings);
    setText(
      form,
      "Costs of Electronic Communication shall be addressed as follows",
      details.electronicCommunicationCosts,
      context.warnings,
    );
    if (details.childcareMode === "each_parent_selects") check(form, "Check Box157");
    if (details.childcareMode === "mutual_agreement") check(form, "Check Box158");
    if (details.childcareMode === "right_of_first_refusal") {
      check(form, "Check Box159");
      setText(form, "period of time exceeding this number of hours", details.rightOfFirstRefusalHours, context.warnings);
    }
    if (details.childcareMode === "other") {
      check(form, "Check Box160");
      setText(form, "specify other child care time", details.childcareDetails, context.warnings);
    }
    setText(
      form,
      "make note of other provisions",
      [
        details.disputeResolution,
        details.springBreakMode !== "other" && details.springBreakDetails?.trim()
          ? `Spring break details: ${details.springBreakDetails.trim()}`
          : "",
        details.summerBreakMode !== "other" && details.summerBreakDetails?.trim()
          ? `Summer break details: ${details.summerBreakDetails.trim()}`
          : "",
        details.otherProvisions,
        ...overflowHolidayTerms,
      ]
        .filter(Boolean)
        .join(" "),
      context.warnings,
    );
  }

  const overnights = parentOrder(
    context,
    data.parentingTime?.overnightsWithYouPerYear ?? 0,
    data.parentingTime?.overnightsWithOtherParentPerYear ?? 0,
  );
  if (overnights) {
    setText(form, "Based upon the time-sharing schedule Parent has total 1", context.parties.petitioner?.name, context.warnings);
    setText(form, "Based upon the time-sharing schedule Parent has overnights per year 1", overnights.petitioner, context.warnings);
    setText(form, "Based upon the time-sharing schedule Parent", context.parties.respondent?.name, context.warnings);
    setText(form, "Based upon the time-sharing schedule Parent has overnights per year", overnights.respondent, context.warnings);
  }

  if (plan?.holidayScheduleMode === "regular_schedule") {
    check(form, "Check Box41");
  } else if (plan?.holidayScheduleMode === "as_agreed") {
    check(form, "Check Box42");
  } else if (plan?.holidayScheduleMode === "specific" && plan.holidayScheduleOverridesRegular) {
    check(form, "Check Box43");
  }
  if (plan?.threeWeekendAdjustment) check(form, "Check Box44");
  if (plan?.unspecifiedHolidayFollowsAdjacentWeekend) check(form, "Check Box45");

  const otherHolidays: NonNullable<ReviewedIntakeDraft["data"]["parentingPlan"]>["holidaySchedules"] = [];
  for (const holiday of plan?.holidaySchedules ?? []) {
    const fields = standardHolidayFields(holiday.name);
    if (fields) fillHolidayRow(form, context, holiday, fields);
    else otherHolidays.push(holiday);
  }

  otherHolidays.slice(0, 2).forEach((holiday, index) => {
    const number = index + 1;
    setText(form, `other special day ${number}`, holiday.name, context.warnings);
    fillHolidayRow(form, context, holiday, {
      even: `other special day ${number} even years`,
      odd: `other special day ${number} odd years`,
      every: `other special day ${number} every year`,
      time: number === 1 ? "other special day 1 begin and end time" : "other special day 2 begin end time",
    });
  });
}

function fillDisclosureCertificate(form: PDFForm, context: PopulationContext): void {
  fillCaption(form, context, {
    county: "COUNTY FLORIDA",
    petitioner: "petitioner",
    respondent: "respondent",
  });
  fillCaseMetadata(form, context, {
    circuit: "JUDICIAL CIRCUIT",
    caseNumber: "Case No",
    division: "Division",
  });
  setText(form, "Printed Name", context.parties.self.name, context.warnings);
  setText(form, "Address_2", context.parties.self.street, context.warnings);
  setText(form, "City State Zip_2", context.parties.self.cityStateZip, context.warnings);
  setText(form, "Telephone Number_2", context.parties.self.phone, context.warnings);
  setText(form, "Email Addresses_2", context.parties.self.email, context.warnings);
}

function fillForm(formNumber: SupportedFormNumber, form: PDFForm, context: PopulationContext): void {
  switch (formNumber) {
    case "12.928":
      fillCoverSheet(form, context);
      return;
    case "12.901(b)(1)":
    case "12.901(b)(2)":
    case "12.901(b)(3)":
      fillPetition(form, context, formNumber);
      return;
    case "12.902(d)":
      fillUccjea(form, context);
      return;
    case "12.902(e)":
      fillChildSupport(form, context);
      return;
    case "12.902(f)(1)":
      fillMaritalSettlementAgreement(form, context);
      return;
    case "12.932":
      fillDisclosureCertificate(form, context);
      return;
    case "12.995(a)":
      fillParentingPlan(form, context);
  }
}

function supportedFormNumbers(
  readiness: FilingReadiness,
  viewModel?: PackageViewModel,
): SupportedFormNumber[] {
  const petition = readiness.forms.find((form) => form.entry.form.formNumber.startsWith("12.901(b)"))
    ?.entry.form.formNumber as SupportedFormNumber | undefined;
  const numbers: SupportedFormNumber[] = ["12.928"];
  if (petition && petition in OFFICIAL_COURT_FORM_ASSETS) numbers.push(petition);
  if (readiness.forms.some((form) => form.entry.form.formNumber === "12.902(d)")) numbers.push("12.902(d)");
  if (
    readiness.forms.some((form) => form.entry.form.formNumber === "12.902(e)") &&
    viewModel?.childSupport.kind === "calculated"
  ) {
    numbers.push("12.902(e)");
  }
  if (readiness.forms.some((form) => form.entry.form.formNumber === "12.902(f)(1)")) {
    numbers.push("12.902(f)(1)");
  }
  if (readiness.forms.some((form) => form.entry.form.formNumber === "12.995(a)")) numbers.push("12.995(a)");
  return numbers;
}

export function buildOfficialCourtFormsManifest(options: {
  readonly draft: ReviewedIntakeDraft;
  readonly readiness: FilingReadiness;
  readonly viewModel?: PackageViewModel;
}): OfficialCourtFormsManifest {
  const included = supportedFormNumbers(options.readiness, options.viewModel).map(
    (number) => OFFICIAL_COURT_FORM_ASSETS[number],
  );
  const warnings = [
    "Review every populated answer against the current Florida Courts form before signing or filing.",
    "No form is signed, notarized, witnessed, or electronically filed by this application.",
    "Case number, division, judicial circuit, service details, and facts not collected in the intake remain blank.",
  ];
  const missingAnswers = getOfficialCourtFormsMissingAnswers(options.readiness);
  if (missingAnswers.length > 0) {
    warnings.push(
      "This is a partially populated draft. The unanswered items listed below remain blank and must be completed before signing or filing.",
      ...missingAnswers.map((missing) => `Complete before filing: ${missing}.`),
    );
  }
  if (options.draft.data.spouses.yourRole === "not_sure") {
    warnings.push(
      "Petitioner and respondent were not assigned because you selected 'not sure' for your role. Confirm the roles before using these forms.",
    );
  }
  if (options.draft.data.children.children.length > 3) {
    warnings.push(
      "The official UCCJEA PDF has structured tables for three children. Additional children remain listed in the filing packet for attorney completion.",
    );
  }

  return {
    included,
    warnings,
    omitted: [
      "Financial affidavit 12.902(b) or 12.902(c): the correct version depends on a rule threshold this app has not verified from a primary source.",
      "Certificate of Compliance with Mandatory Disclosure 12.932: generate it only after the required documents have actually been exchanged and service details can be sworn.",
      "Notice of Social Security Number 12.902(j): SSNs are deliberately never collected; complete this form securely by hand.",
      "Final judgment: reserved for the court and the attorney preparing the proposed order.",
      "Signatures, notarization, service certificates, sworn declarations, and legal elections that were not explicitly answered.",
    ],
  };
}

async function populateFormBytes(options: {
  readonly formNumber: SupportedFormNumber;
  readonly context: PopulationContext;
  readonly flatten: boolean;
}): Promise<Uint8Array> {
  const asset = OFFICIAL_COURT_FORM_ASSETS[options.formNumber];
  const doc = await PDFDocument.load(await loadVerifiedAsset(asset), { ignoreEncryption: true });
  const form = doc.getForm();
  form.deleteXFA();
  fillForm(options.formNumber, form, options.context);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  fitPopulatedTextFieldFonts(form, font);
  form.updateFieldAppearances(font);
  if (options.flatten) form.flatten({ updateFieldAppearances: false });
  doc.setTitle(`Florida Form ${asset.formNumber} — populated draft`);
  doc.setSubject("Review-required draft; not filed, signed, notarized, or legal advice");
  doc.setProducer("Florida Support Guide");
  return doc.save();
}

function wrap(text: string, max = 92): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function addManifestPages(
  doc: PDFDocument,
  manifest: OfficialCourtFormsManifest,
): Promise<void> {
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 738;
  const addLine = (text: string, options: { bold?: boolean; indent?: number; gap?: number } = {}) => {
    for (const line of wrap(text, options.indent ? 84 : 92)) {
      if (y < 60) {
        page = doc.addPage([612, 792]);
        y = 738;
      }
      page.drawText(line, {
        x: 54 + (options.indent ?? 0),
        y,
        size: options.bold ? 11 : 9,
        font: options.bold ? bold : regular,
        color: rgb(0.06, 0.09, 0.16),
      });
      y -= options.bold ? 16 : 13;
    }
    y -= options.gap ?? 2;
  };

  page.drawText("Populated Florida court forms — review draft", {
    x: 54,
    y,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.2, 0.55),
  });
  y -= 32;
  addLine(
    "These are official Florida Supreme Court Approved Family Law Forms with verified intake answers inserted. They are not filing-ready until every blank, election, signature, service requirement, and revision date is reviewed by a Florida attorney or the clerk.",
  );
  y -= 8;
  addLine("Included official forms", { bold: true });
  for (const asset of manifest.included) {
    addLine(`• Form ${asset.formNumber}, ${asset.title} (revision ${asset.revision})`, { indent: 8 });
  }
  y -= 6;
  addLine("Important review warnings", { bold: true });
  for (const warning of manifest.warnings) addLine(`• ${warning}`, { indent: 8 });
  y -= 6;
  addLine("Not generated automatically", { bold: true });
  for (const omission of manifest.omitted) addLine(`• ${omission}`, { indent: 8 });
}

export async function generateOfficialCourtFormsPdf(options: {
  readonly draft: ReviewedIntakeDraft;
  readonly readiness: FilingReadiness;
  readonly viewModel?: PackageViewModel;
}): Promise<Uint8Array> {
  const manifest = buildOfficialCourtFormsManifest(options);
  const warnings = [...manifest.warnings];
  const context: PopulationContext = {
    draft: options.draft,
    viewModel: options.viewModel,
    warnings,
    parties: getParties(options.draft),
  };
  const doc = await PDFDocument.create();
  doc.setTitle("Populated Florida Court Forms — Review Draft");
  doc.setSubject("Official forms populated from confirmed intake; attorney review required");
  doc.setProducer("Florida Support Guide");

  const populated: Uint8Array[] = [];
  for (const asset of manifest.included) {
    populated.push(await populateFormBytes({ formNumber: asset.formNumber, context, flatten: true }));
  }
  await addManifestPages(doc, { ...manifest, warnings });
  for (const bytes of populated) {
    const source = await PDFDocument.load(bytes);
    const pages = await doc.copyPages(source, source.getPageIndices());
    pages.forEach((page) => doc.addPage(page));
  }
  return doc.save();
}

export function getOfficialCourtFormsMissingAnswers(readiness: FilingReadiness): string[] {
  const populated = new Set<string>(POPULATED_OFFICIAL_FORM_NUMBERS);
  return readiness.forms
    .filter((form) => populated.has(form.entry.form.formNumber) && form.status === "needsInformation")
    .flatMap((form) =>
      form.missing.map((missing) => `Form ${form.entry.form.formNumber}: ${missing}`),
    );
}

export const __testing = {
  async populateForm(options: {
    readonly formNumber: SupportedFormNumber;
    readonly draft: ReviewedIntakeDraft;
    readonly viewModel: PackageViewModel;
  }): Promise<Uint8Array> {
    const context: PopulationContext = {
      draft: options.draft,
      viewModel: options.viewModel,
      warnings: [],
      parties: getParties(options.draft),
    };
    return populateFormBytes({ formNumber: options.formNumber, context, flatten: false });
  },
};
