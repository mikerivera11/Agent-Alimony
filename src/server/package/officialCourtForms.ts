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
  readonly viewModel: PackageViewModel;
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
  const amount = `$${factors.agreedAlimonyAmount.toFixed(2)}`;
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

  let text = String(value);
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

    if ((data.assetsDebts?.items ?? []).length > 0) check(form, "there are marital assets or liabilities");
    else check(form, "no marital assests or liabilities");

    if (data.parentingPlan?.planStatus === "agreed") check(form, "parties agreed to having a parenting plan");
    if (data.parentingPlan?.planStatus === "proposed") {
      check(form, "parties have not agreed to a parenting plan");
      check(form, "Check if attached proposed parenting plan should be adopted by the court");
    }
    if (data.parentingPlan?.planStatus === "in_dispute") {
      check(form, "parties have not agreed to a parenting plan");
    }
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
      setText(form, "indicate amount of payment", data.alimonyFactors.agreedAlimonyAmount.toFixed(2), context.warnings);
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
    }
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
        data.alimonyFactors.agreedAlimonyAmount.toFixed(2),
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
  const outcome = context.viewModel.childSupport;
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

function fillParentingPlan(form: PDFForm, context: PopulationContext): void {
  const data = context.draft.data;
  const plan = data.parentingPlan;
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
  setText(form, "address of Petitioner", context.parties.petitioner?.street, context.warnings);
  setText(form, "telephone of Petitioner", context.parties.petitioner?.phone, context.warnings);
  setText(form, "email of Petitioner", context.parties.petitioner?.email, context.warnings);
  setText(form, "address of Respondent", context.parties.respondent?.street, context.warnings);
  setText(form, "telephone of Respondent", context.parties.respondent?.phone, context.warnings);
  setText(form, "email of Respondent", context.parties.respondent?.email, context.warnings);
  setText(form, "Printed Name of Petitioner/Parent", context.parties.petitioner?.name, context.warnings);
  setText(form, "Address of Petitioner/Parent", context.parties.petitioner?.street, context.warnings);
  setText(form, "City State Zip of Petitioner/Parent", context.parties.petitioner?.cityStateZip, context.warnings);
  setText(form, "Telephone Number of Petitioner/Parent", context.parties.petitioner?.phone, context.warnings);
  setText(form, "Designated Email Addresses of Petitioner", context.parties.petitioner?.email, context.warnings);
  setText(form, "Printed Name of Respondent/Parent", context.parties.respondent?.name, context.warnings);
  setText(form, "Address of Respondent/Parent", context.parties.respondent?.street, context.warnings);
  setText(form, "City State Zip of Respondent/Parent", context.parties.respondent?.cityStateZip, context.warnings);
  setText(form, "Telephone Number of Respondent/Parent", context.parties.respondent?.phone, context.warnings);
  setText(form, "Designated Email Addresses of Respondent/Parent", context.parties.respondent?.email, context.warnings);

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
  setText(form, "make note of other provisions", [plan?.weekdaySchedule, plan?.weekendSchedule].filter(Boolean).join("\n"), context.warnings);
  setText(form, "Indicate other winter break date variations", plan?.holidaySchedule, context.warnings);
  setText(form, "Parent that shall have the entire Summer Break from school", plan?.summerSchedule, context.warnings);
  setText(form, "Explain where exchanges shall occur", plan?.exchangeArrangements, context.warnings);
  setText(form, "child has communication with other parent explain", plan?.communicationBetweenChildAndParent, context.warnings);

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

  const holidays = plan?.holidaySchedules ?? [];
  const thanksgiving = holidays.find((holiday) => holiday.name.trim().toLowerCase() === "thanksgiving");
  if (thanksgiving) {
    fillHolidayRow(form, context, thanksgiving, {
      even: "Thanksgiving",
      odd: "Odd Years 12",
      every: "Every Year 12",
      time: "BeginEnd Time 12",
    });
  }

  const otherHolidays = holidays
    .filter((holiday) => holiday !== thanksgiving)
    .slice(0, 2);
  otherHolidays.forEach((holiday, index) => {
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
    case "12.932":
      fillDisclosureCertificate(form, context);
      return;
    case "12.995(a)":
      fillParentingPlan(form, context);
  }
}

function supportedFormNumbers(
  readiness: FilingReadiness,
  viewModel: PackageViewModel,
): SupportedFormNumber[] {
  const petition = readiness.forms.find((form) => form.entry.form.formNumber.startsWith("12.901(b)"))
    ?.entry.form.formNumber as SupportedFormNumber | undefined;
  const numbers: SupportedFormNumber[] = ["12.928"];
  if (petition && petition in OFFICIAL_COURT_FORM_ASSETS) numbers.push(petition);
  if (readiness.forms.some((form) => form.entry.form.formNumber === "12.902(d)")) numbers.push("12.902(d)");
  if (
    readiness.forms.some((form) => form.entry.form.formNumber === "12.902(e)") &&
    viewModel.childSupport.kind === "calculated"
  ) {
    numbers.push("12.902(e)");
  }
  if (readiness.forms.some((form) => form.entry.form.formNumber === "12.995(a)")) numbers.push("12.995(a)");
  return numbers;
}

export function buildOfficialCourtFormsManifest(options: {
  readonly draft: ReviewedIntakeDraft;
  readonly readiness: FilingReadiness;
  readonly viewModel: PackageViewModel;
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
      "Marital settlement agreement 12.902(f): this app produces a term sheet, not a binding agreement.",
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
  readonly viewModel: PackageViewModel;
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
