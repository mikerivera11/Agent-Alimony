/**
 * The attorney filing packet: what an uncontested Florida dissolution needs,
 * matched against what this person has actually answered.
 *
 * Two deliberate limits define this module.
 *
 * First, this module itself does not fill official PDFs; it reports readiness.
 * The separate official-form exporter uses revision-locked court PDFs and
 * verified field mappings, and still leaves unsupported legal elections,
 * signatures, SSNs, and ambiguous positional fields blank.
 *
 * Second, it does not draft a marital settlement agreement. It produces a
 * *term sheet* — the agreed economics, stated plainly, with every figure
 * traceable to a calculation the user has already reviewed. Drafting the
 * binding instrument means choosing whether alimony is modifiable, who claims
 * the children on a tax return, whether a QDRO is needed to divide retirement,
 * whether life insurance secures support, and how a house is deeded or
 * refinanced. Those are legal judgements with consequences that outlast the
 * divorce, and none of them is arithmetic. An attorney makes them; this gives
 * them the inputs.
 *
 * Everything here is pure and deterministic. No model is involved.
 */

import type { IntakeDraftData } from "@/domain/intake";
import { formatCentsAsDollars } from "@/domain/package/formatting";
import type { PackageViewModel } from "@/domain/package/types";

import { OFFICIAL_FILING_FORMS, type FilingFormEntry } from "./officialForms";

/**
 * Accepts either a live draft (every topic partial) or a reviewed snapshot
 * (topics complete, but inapplicable ones absent). Both are read the same way
 * here, and widening the input rather than converting between them means the
 * packet cannot be built from a shape that skipped validation.
 */
export type FilingPacketDraftData = {
  readonly [K in keyof IntakeDraftData]?: Partial<IntakeDraftData[K]> | undefined;
};

/** Florida requires six months' residence before a dissolution is filed. §61.021. */
export const FLORIDA_RESIDENCY_MONTHS_REQUIRED = 6;

export const FLORIDA_RESIDENCY_CITATION = {
  citation: "Fla. Stat. §61.021",
  title: "Residence requirement before filing for dissolution",
  url: "https://www.flsenate.gov/Laws/Statutes/2025/61.021",
} as const;

export type FilingFormStatus = "ready" | "needsInformation" | "completeByHand";

export interface FilingFormReadiness {
  readonly entry: FilingFormEntry;
  readonly status: FilingFormStatus;
  /**
   * Exactly which answers are still missing, worded as the question the person
   * would be answering — not as a field name.
   */
  readonly missing: readonly string[];
  /** Why this form is in the packet for this particular case. */
  readonly reason: string;
}

export type ResidencyCheck =
  | { readonly kind: "notProvided"; readonly message: string }
  | { readonly kind: "noResidentParty"; readonly message: string }
  | {
      readonly kind: "checked";
      readonly monthsResident: number;
      readonly satisfied: boolean;
      readonly message: string;
    };

export interface FilingReadiness {
  readonly requested: boolean;
  readonly residency: ResidencyCheck;
  readonly forms: readonly FilingFormReadiness[];
  /** Case-level gaps that are not tied to one form. */
  readonly generalGaps: readonly string[];
}

/**
 * Which child support parent id represents the person using the app. The
 * mapper assigns them `parent1`; this names that fact rather than repeating
 * the literal, so the two cannot drift apart silently.
 */
const SELF_PARENT_ID = "parent1";

/** The affidavit needs expenses; any one category being present is enough to say they were answered. */
function hasAnyHouseholdExpense(data: FilingPacketDraftData): boolean {
  return Object.values(data.householdExpenses ?? {}).some(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
}

function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Whole months between two ISO dates, counting only complete months. Written
 * out rather than pulled from a date library so the arithmetic behind a
 * jurisdictional statement is visible and testable.
 */
export function wholeMonthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return Number.NaN;

  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

function checkResidency(data: FilingPacketDraftData, asOfIso: string): ResidencyCheck {
  const filing = data.filingDetails ?? {};
  if (filing.whichPartyIsFloridaResident === "neither") {
    return {
      kind: "noResidentParty",
      message:
        "You indicated that neither spouse has lived in Florida. Florida requires one spouse to have lived here for " +
        "six months before a dissolution is filed, so a Florida court may not be able to hear this case. Ask an attorney " +
        "which state can.",
    };
  }
  if (isBlank(filing.floridaResidentSince) || !filing.whichPartyIsFloridaResident) {
    return {
      kind: "notProvided",
      message: "Add who has lived in Florida and since when, so this six-month requirement can be checked.",
    };
  }

  const residentSince = filing.floridaResidentSince;
  if (residentSince === undefined) {
    return { kind: "notProvided", message: "Add the date Florida residence began." };
  }
  const months = wholeMonthsBetween(residentSince, asOfIso);
  if (Number.isNaN(months)) {
    return { kind: "notProvided", message: "The Florida residence date could not be read as a date." };
  }
  const satisfied = months >= FLORIDA_RESIDENCY_MONTHS_REQUIRED;
  return {
    kind: "checked",
    monthsResident: months,
    satisfied,
    message: satisfied
      ? `Florida residence began ${residentSince}, which is ${months} complete months as of ${asOfIso} — ` +
        `at or above the six months §61.021 requires. The court will still want proof, such as a Florida driver licence or a witness.`
      : `Florida residence began ${residentSince}, which is only ${months} complete months as of ${asOfIso}. ` +
        `§61.021 requires six. Filing before then risks dismissal — check the timing with an attorney.`,
  };
}

/** Which petition, settlement agreement, and child forms this case calls for. */
function selectedFormNumbers(data: FilingPacketDraftData): Set<string> {
  const hasChildren = data.children?.hasChildren === "yes";
  const items = data.assetsDebts?.items ?? [];
  const hasPropertyOrDebt = Array.isArray(items) && items.length > 0;
  const hasAlimonyTerms =
    data.alimonyFactors?.alimonyAgreementStatus === "agreed_payment" ||
    (data.alimonyFactors?.potentialAlimonyRecipient !== undefined &&
      data.alimonyFactors.potentialAlimonyRecipient !== "none");

  const selected = new Set<string>(["12.928", "12.902(j)", "12.932"]);

  if (hasChildren) {
    selected.add("12.901(b)(1)");
    selected.add("12.902(f)(1)");
    selected.add("12.902(e)");
    selected.add("12.995(a)");
    selected.add("12.902(d)");
    selected.add("12.990(c)(1)");
  } else if (hasPropertyOrDebt || hasAlimonyTerms) {
    selected.add("12.901(b)(2)");
    selected.add("12.902(f)(2)");
  } else {
    selected.add("12.901(b)(3)");
  }

  // The affidavit is required either way; which of the two versions applies
  // depends on a threshold this app does not assert, so both are listed.
  selected.add("12.902(c)");
  selected.add("12.902(b)");

  return selected;
}

function missingForForm(formNumber: string, data: FilingPacketDraftData): string[] {
  const filing = data.filingDetails ?? {};
  const missing: string[] = [];

  const needsBothNames = () => {
    if (isBlank(filing.you?.fullLegalName)) missing.push("Your full legal name");
    if (isBlank(filing.spouse?.fullLegalName)) missing.push("Your spouse's full legal name");
  };

  if (formNumber.startsWith("12.901")) {
    needsBothNames();
    if (data.spouses?.yourRole === "not_sure" || !data.spouses?.yourRole) {
      missing.push("Whether you are the petitioner or respondent");
    }
    if (isBlank(filing.you?.address?.street) || isBlank(filing.you?.address?.city)) {
      missing.push("Your address");
    }
    if (isBlank(filing.you?.phoneNumber)) missing.push("Your telephone number");
    if (isBlank(filing.you?.emailAddress)) missing.push("Your designated email address");
    if (!filing.you?.militaryService || filing.you.militaryService === "not_sure") {
      missing.push("Your military-service status");
    }
    if (!filing.spouse?.militaryService || filing.spouse.militaryService === "not_sure") {
      missing.push("Your spouse's military-service status");
    }
    if (isBlank(data.marriage?.marriageDate)) missing.push("The date you married");
    if (isBlank(filing.floridaResidentSince)) missing.push("When Florida residence began");
    if (isBlank(filing.judicialCircuit)) missing.push("The judicial circuit");
    if (data.caseBasics?.petitionStatus === "filed") {
      if (isBlank(filing.caseNumber)) missing.push("The assigned case number");
      if (isBlank(filing.division)) missing.push("The assigned division");
    }
    if (formNumber === "12.901(b)(1)") {
      for (const [field, label] of [
        ["marriageGround", "The requested ground for dissolution"],
        ["financialAffidavitStatus", "When the financial affidavit will be filed"],
        ["pregnancyStatus", "Whether either party is pregnant"],
        ["nonCommonMinorChildrenStatus", "Whether there are minor children not common to both parties"],
        ["adultDependentChildrenStatus", "Whether there are adult dependent children"],
        ["propertyDistributionRequest", "How the petition should request property distribution"],
        ["childrenCurrentResidence", "Where the minor children currently reside"],
        ["parentalResponsibilityRequest", "The requested parental-responsibility arrangement"],
        ["parentingPlanIncludesTimeSharing", "Whether the parenting plan includes time-sharing"],
        ["childSupportWorksheetStatus", "When the child-support worksheet will be filed"],
        ["retroactiveChildSupportStart", "Whether retroactive child support is requested"],
        ["supportBeyondEighteen", "Whether support beyond age 18 is requested"],
        ["childSupportDeviationRequested", "Whether a child-support deviation is requested"],
      ] as const) {
        if (!filing[field]) missing.push(label);
      }
      if (isBlank(filing.parentingBestInterestsExplanation)) {
        missing.push("Why the requested parenting plan is in the children's best interests");
      }
    }
  }

  if (formNumber === "12.928") {
    needsBothNames();
    if (isBlank(filing.judicialCircuit)) missing.push("The judicial circuit");
    if (!filing.relatedCasesStatus || filing.relatedCasesStatus === "not_sure") {
      missing.push("Whether related family cases exist");
    }
  }

  if (formNumber === "12.902(c)" || formNumber === "12.902(b)") {
    needsBothNames();
    if (!data.income?.self) {
      missing.push("Your income by category");
    }
    if (!hasAnyHouseholdExpense(data)) {
      missing.push("Your monthly household expenses");
    }
    if ((data.assetsDebts?.items ?? []).length === 0) {
      missing.push("Your assets and debts");
    }
  }

  if (formNumber === "12.902(d)") {
    const rows = filing.children ?? [];
    const declared = data.children?.children ?? [];
    if (rows.length < declared.length) {
      missing.push("Filing details for every child");
    }
    for (const child of rows) {
      if (isBlank(child.fullLegalName)) missing.push("Each child's full legal name");
      if (isBlank(child.placeOfBirth)) missing.push("Each child's place of birth");
      if (!child.sex || child.sex === "another_or_not_listed") {
        missing.push("The entry for each child's sex field");
      }
      if ((child.residences ?? []).length === 0) {
        missing.push("Each child's structured five-year residence history");
      }
    }
    for (const [field, label] of [
      ["priorCustodyProceedingStatus", "Prior custody or time-sharing proceedings"],
      ["pendingCustodyProceedingStatus", "Pending custody or time-sharing proceedings"],
      ["thirdPartyCustodyClaimStatus", "Third-party custody or time-sharing claims"],
      ["existingChildSupportOrderStatus", "Existing child-support orders"],
    ] as const) {
      if (!filing[field] || filing[field] === "not_sure") missing.push(label);
    }
  }

  if (formNumber === "12.995(a)") {
    needsBothNames();
    if (isBlank(filing.you?.phoneNumber) || isBlank(filing.you?.emailAddress)) {
      missing.push("Your court-form contact information");
    }
    const details = data.parentingPlanDetails;
    const selfIsPetitioner = data.spouses?.yourRole === "petitioner";
    const spouseAddressStatus = selfIsPetitioner
      ? details?.respondentAddressStatus
      : details?.petitionerAddressStatus;
    if (
      (spouseAddressStatus === "known" && isBlank(filing.spouse?.address?.street)) ||
      isBlank(filing.spouse?.phoneNumber) ||
      isBlank(filing.spouse?.emailAddress)
    ) {
      missing.push("Your spouse's address and contact information, if safely known");
    }
    if (data.parentingPlan?.planStatus === undefined) {
      missing.push("Whether the parenting plan is agreed, proposed, or in dispute");
    }
    const plan = data.parentingPlan;
    if (!details) {
      missing.push("The detailed parenting-plan terms");
    } else {
      if (details.majorityDesignationParent === "undecided") {
        missing.push("The majority-residence designation used only when another law requires one");
      }
      if (
        details.springBreakMode === "one_parent" &&
        (!details.springBreakParent || details.springBreakParent === "undecided")
      ) {
        missing.push("Which parent has the entire spring break");
      }
      if (
        details.summerBreakMode === "one_parent" &&
        (!details.summerBreakParent || details.summerBreakParent === "undecided")
      ) {
        missing.push("Which parent has the entire summer break");
      }
    }
    if (
      plan &&
      [
        plan.decisionMakingEducation,
        plan.decisionMakingHealthcare,
        plan.decisionMakingReligion,
        plan.schoolDesignationParent,
      ].includes("undecided")
    ) {
      missing.push("All parenting decision-making and school-designation choices");
    }
    if (plan?.holidayScheduleMode === undefined) {
      missing.push("How holidays will be handled");
    } else if (plan.holidayScheduleMode === "specific") {
      const holidays = plan.holidaySchedules ?? [];
      if (holidays.length === 0) missing.push("At least one holiday assignment");
      for (const holiday of holidays) {
        if (holiday.rotation === "undecided") {
          missing.push(`Who has the children for ${holiday.name || "each holiday"}`);
        }
        if (holiday.rotation === "alternating" && holiday.oddYearParent === undefined) {
          missing.push(`Who has the children in odd-numbered years for ${holiday.name || "each holiday"}`);
        }
        if (isBlank(holiday.beginEndTime)) {
          missing.push(`Beginning and ending time for ${holiday.name || "each holiday"}`);
        }
      }
    }
  }

  if (formNumber.startsWith("12.902(f)")) {
    needsBothNames();
    const agreement = data.alimonyFactors?.alimonyAgreementStatus;
    if (agreement === "not_agreed" && data.alimonyFactors?.potentialAlimonyRecipient !== "none") {
      missing.push("The parties' agreed alimony terms, or confirmation that alimony is waived");
    }
    if (!data.settlementTerms) {
      missing.push("The marital settlement agreement terms");
    }
    if ((data.assetsDebts?.items ?? []).some((item) => item.agreedRecipient === "not_agreed")) {
      missing.push("An agreed recipient or responsible party for every asset and debt");
    }
  }

  return Array.from(new Set(missing));
}

export function buildFilingReadiness(options: {
  data: FilingPacketDraftData;
  /** ISO date the residency arithmetic is measured against. */
  asOfIso: string;
}): FilingReadiness {
  const { data, asOfIso } = options;
  const requested = data.filingDetails?.wantsFilingPacket === "yes";

  if (!requested) {
    return {
      requested: false,
      residency: {
        kind: "notProvided",
        message: "The filing packet was not requested, so no filing details were collected.",
      },
      forms: [],
      generalGaps: [],
    };
  }

  const wanted = selectedFormNumbers(data);
  const forms: FilingFormReadiness[] = [];

  for (const entry of OFFICIAL_FILING_FORMS) {
    if (!wanted.has(entry.form.formNumber)) continue;

    // The only form this app knowingly cannot help with, because it never
    // collects Social Security numbers.
    if (entry.form.formNumber === "12.902(j)") {
      forms.push({
        entry,
        status: "completeByHand",
        missing: ["Social Security numbers — this app never collects them"],
        reason:
          "Filed with the petition. This app deliberately does not collect Social Security numbers, because they " +
          "change none of its calculations and would make any breach far worse.",
      });
      continue;
    }

    const missing = missingForForm(entry.form.formNumber, data);
    forms.push({
      entry,
      status: missing.length === 0 ? "ready" : "needsInformation",
      missing,
      reason: entry.whenItApplies,
    });
  }

  const generalGaps: string[] = [];
  if (data.safetyComplexity?.domesticViolenceOrCoercion === "yes") {
    generalGaps.push(
      "You reported safety concerns. An uncontested filing assumes both spouses can negotiate freely; talk to an " +
        "attorney or a domestic violence advocate before filing anything.",
    );
  }
  if (data.safetyComplexity?.hasJurisdictionDispute === "yes") {
    generalGaps.push("You reported a jurisdiction dispute, which an uncontested packet cannot resolve.");
  }
  if (data.safetyComplexity?.incomeIsImputedOrDisputed === "yes") {
    generalGaps.push("Income is disputed or imputed, so the figures below may be contested.");
  }

  return { requested: true, residency: checkResidency(data, asOfIso), forms, generalGaps };
}

export interface TermSheetItem {
  readonly label: string;
  readonly value: string;
  /** Where the figure came from, so nothing in the packet is unsourced. */
  readonly basis: string;
}

export interface TermSheetSection {
  readonly id: "alimony" | "childSupport" | "equitableDistribution" | "parenting" | "maritalSettlement";
  readonly title: string;
  readonly items: readonly TermSheetItem[];
  /** Decisions this app deliberately leaves to an attorney. */
  readonly attorneyDecisions: readonly string[];
  /** Present when the section could not be stated, with the reason. */
  readonly unavailable?: string;
}

export interface SettlementTermSheet {
  readonly generatedAt: string;
  readonly sections: readonly TermSheetSection[];
  readonly disclaimer: string;
}

export const TERM_SHEET_DISCLAIMER =
  "This term sheet is a summary of stated agreements and calculated support/property information. It is not a marital settlement " +
  "agreement, it is not signed, and it binds nobody. It exists so a Florida attorney can draft the actual " +
  "agreement without re-gathering everything. The alimony section contains only terms the parties reported as agreed; " +
  "it never substitutes the app's alimony estimate for an agreement.";

const AGREED_ALIMONY_TYPE_LABELS = {
  bridge_the_gap: "Bridge-the-gap",
  rehabilitative: "Rehabilitative",
  durational: "Durational",
  lump_sum: "Lump sum",
  other: "Other",
} as const;

const AGREED_ALIMONY_FREQUENCY_LABELS = {
  weekly: "weekly",
  every_two_weeks: "every two weeks",
  twice_monthly: "twice monthly",
  monthly: "monthly",
  one_time: "one-time payment",
  other: "other frequency",
} as const;

const AGREED_ALIMONY_MODIFIABILITY_LABELS = {
  modifiable: "Modifiable",
  nonmodifiable: "Nonmodifiable",
  attorney_to_confirm: "Attorney to confirm",
} as const;

const AGREED_ALIMONY_PAYMENT_METHOD_LABELS = {
  direct: "Direct payment between spouses",
  state_disbursement_unit: "State Disbursement Unit",
  income_withholding: "Income withholding",
  other: "Other method",
  attorney_to_confirm: "Attorney to confirm",
} as const;

const AGREED_ALIMONY_SECURITY_LABELS = {
  none: "None",
  life_insurance: "Life insurance",
  other: "Other security",
  attorney_to_confirm: "Attorney to confirm",
} as const;

function alimonySection(data: FilingPacketDraftData): TermSheetSection {
  const attorneyDecisions = [
    "Draft the agreed terms into the applicable marital settlement agreement and proposed final judgment.",
    "Confirm enforceability, statutory limits, termination events, and any tax consequences.",
  ];

  const factors = data.alimonyFactors;
  if (factors?.alimonyAgreementStatus === "agreed_waiver") {
    return {
      id: "alimony",
      title: "Alimony",
      items: [
        {
          label: "Parties' stated agreement",
          value: "No alimony will be paid",
          basis: "Confirmed answer in the Agreed alimony terms section of the intake.",
        },
      ],
      attorneyDecisions,
    };
  }

  if (factors?.alimonyAgreementStatus !== "agreed_payment") {
    return {
      id: "alimony",
      title: "Alimony",
      items: [],
      attorneyDecisions,
      unavailable:
        "No agreed alimony terms were entered. The calculated alimony estimate is intentionally excluded from this filing packet.",
    };
  }

  const recipientIsSelf = factors.potentialAlimonyRecipient === "self";
  const recipient = recipientIsSelf
    ? data.filingDetails?.you?.fullLegalName || "You"
    : data.filingDetails?.spouse?.fullLegalName || "Your spouse";
  const payer = recipientIsSelf
    ? data.filingDetails?.spouse?.fullLegalName || "Your spouse"
    : data.filingDetails?.you?.fullLegalName || "You";
  const amount = formatCentsAsDollars(Math.round((factors.agreedAlimonyAmount ?? 0) * 100));

  return {
    id: "alimony",
    title: "Alimony",
    attorneyDecisions,
    items: [
      {
        label: "Parties' stated agreement",
        value: "Alimony will be paid under the terms below",
        basis: "Confirmed answer in the Agreed alimony terms section of the intake.",
      },
      {
        label: "Payer",
        value: payer,
        basis: "Derived from the confirmed recipient.",
      },
      {
        label: "Recipient",
        value: recipient,
        basis: "Confirmed answer in the intake.",
      },
      {
        label: "Agreed type",
        value: factors.agreedAlimonyType
          ? AGREED_ALIMONY_TYPE_LABELS[factors.agreedAlimonyType]
          : "Not entered",
        basis: "Parties' stated agreement.",
      },
      {
        label: "Agreed payment",
        value: `${amount} ${
          factors.agreedAlimonyFrequency
            ? AGREED_ALIMONY_FREQUENCY_LABELS[factors.agreedAlimonyFrequency]
            : "frequency not entered"
        }`,
        basis: "Parties' stated agreement; not the app's calculated estimate.",
      },
      {
        label: "Start date",
        value: factors.agreedAlimonyStartDate || "Not entered",
        basis: "Parties' stated agreement.",
      },
      {
        label: "Duration or ending condition",
        value: factors.agreedAlimonyEndCondition || "Not entered",
        basis: "Parties' stated agreement.",
      },
      {
        label: "Modification treatment",
        value: factors.agreedAlimonyModifiability
          ? AGREED_ALIMONY_MODIFIABILITY_LABELS[factors.agreedAlimonyModifiability]
          : "Not entered",
        basis: "Parties' stated agreement, subject to attorney drafting and enforceability review.",
      },
      {
        label: "Payment method",
        value: factors.agreedAlimonyPaymentMethod
          ? AGREED_ALIMONY_PAYMENT_METHOD_LABELS[factors.agreedAlimonyPaymentMethod]
          : "Not entered",
        basis: "Parties' stated agreement.",
      },
      {
        label: "Security",
        value: factors.agreedAlimonySecurity
          ? AGREED_ALIMONY_SECURITY_LABELS[factors.agreedAlimonySecurity]
          : "Not entered",
        basis: "Parties' stated agreement.",
      },
      {
        label: "Additional terms",
        value: factors.agreedAlimonyNotes?.trim() || "None entered",
        basis: "Parties' stated drafting notes.",
      },
    ],
  };
}

function childSupportSection(pkg: PackageViewModel, data: FilingPacketDraftData): TermSheetSection {
  const attorneyDecisions = [
    "Which parent claims each child as a dependant for tax purposes.",
    "How support is paid — directly, or through the State Disbursement Unit with income withholding.",
    "Who carries health insurance, and how uninsured medical costs are split.",
    "Whether any deviation from the guideline amount should be requested, and on what grounds.",
  ];

  if (data.children?.hasChildren !== "yes") {
    return {
      id: "childSupport",
      title: "Child support",
      items: [],
      attorneyDecisions: [],
      unavailable: "No children in this case, so no child support terms.",
    };
  }

  if (pkg.childSupport.kind !== "calculated") {
    return {
      id: "childSupport",
      title: "Child support",
      items: [],
      attorneyDecisions,
      unavailable:
        pkg.childSupport.kind === "needsInput"
          ? `Not stated: ${pkg.childSupport.message}`
          : `Not stated: ${
              "reason" in pkg.childSupport ? pkg.childSupport.reason : "the child support calculation did not complete."
            }`,
    };
  }

  const result = pkg.childSupport.result;
  const payer =
    result.obligorParentId === null
      ? "Neither parent — the guideline calculation nets to zero"
      : result.obligorParentId === SELF_PARENT_ID
        ? "You pay the other parent"
        : "The other parent pays you";

  return {
    id: "childSupport",
    title: "Child support",
    attorneyDecisions,
    items: [
      { label: "Children covered", value: String(result.numberOfChildren), basis: "Children entered in the intake." },
      {
        label: "Who pays",
        value: payer,
        basis: "The guideline calculation, §61.30.",
      },
      {
        label: "Monthly amount",
        value: `${formatCentsAsDollars(result.monthlyTransferAmountCents)} per month`,
        basis: result.substantialTimeSharingApplied
          ? "Guideline amount with the substantial time-sharing adjustment, §61.30(11)(b)."
          : "Guideline amount, §61.30.",
      },
      {
        label: "Child care included",
        value: formatCentsAsDollars(result.childCareAddOnCents),
        basis: "§61.30(7).",
      },
      {
        label: "Child health insurance included",
        value: formatCentsAsDollars(result.childHealthInsuranceAddOnCents),
        basis: "§61.30(8).",
      },
    ],
  };
}

function equitableDistributionSection(
  pkg: PackageViewModel,
  data: FilingPacketDraftData,
): TermSheetSection {
  const attorneyDecisions = [
    "How the family home is transferred — deed, refinance, sale, or continued joint ownership — and by when.",
    "Whether dividing any retirement account needs a Qualified Domestic Relations Order.",
    "Who is responsible for each debt, and what happens if they do not pay it.",
    "Whether an unequal division is justified under §61.075(1)(a)-(j).",
  ];

  if (pkg.equitableDistribution.kind !== "calculated") {
    return {
      id: "equitableDistribution",
      title: "Property and debts",
      items: [],
      attorneyDecisions,
      unavailable:
        pkg.equitableDistribution.kind === "needsInput"
          ? `Not stated: ${pkg.equitableDistribution.message}`
          : `Not stated: ${
              "reason" in pkg.equitableDistribution
                ? pkg.equitableDistribution.reason
                : "the property calculation did not complete."
            }`,
    };
  }

  const result = pkg.equitableDistribution.result;
  const scenario = result.distributionWithExclusions;
  const payment = scenario.equalizingPayment;
  const assignmentLabel = (recipient: string | undefined): string => {
    switch (recipient) {
      case "you":
        return data.filingDetails?.you?.fullLegalName || "You";
      case "spouse":
        return data.filingDetails?.spouse?.fullLegalName || "Your spouse";
      case "joint":
        return "Both parties jointly";
      case "sell_and_divide":
        return "Sell and divide the proceeds";
      default:
        return "Not agreed yet";
    }
  };
  const agreedAssignments = (data.assetsDebts?.items ?? []).map((item) => ({
    label: item.label || "Unnamed item",
    value: `${assignmentLabel(item.agreedRecipient)}; ${
      item.type === "liability" ? "balance" : "estimated value"
    } ${formatCentsAsDollars(Math.round((item.value ?? 0) * 100))}`,
    basis:
      item.agreedRecipient && item.agreedRecipient !== "not_agreed"
        ? "Reported settlement assignment for attorney drafting; not a binding transfer."
        : "No settlement assignment was entered.",
  }));

  return {
    id: "equitableDistribution",
    title: "Property and debts",
    attorneyDecisions,
    items: [
      {
        label: "Net marital estate",
        value: formatCentsAsDollars(scenario.netMaritalEstateCents),
        basis: "Marital assets less marital liabilities, §61.075.",
      },
      {
        label: "Equal-premise share each",
        value: `${formatCentsAsDollars(scenario.targetShareACents)} / ${formatCentsAsDollars(
          scenario.targetShareBCents,
        )}`,
        basis: "§61.075(1) begins from the premise of an equal division.",
      },
      {
        label: "Equalizing payment",
        value:
          payment.fromSpouse === null || payment.amountCents === 0
            ? "None needed"
            : `${formatCentsAsDollars(payment.amountCents)} from ${payment.fromSpouse} to ${payment.toSpouse}`,
        basis: "The cash payment that brings both sides to an equal share.",
      },
      ...agreedAssignments,
    ],
  };
}

function parentingSection(data: FilingPacketDraftData): TermSheetSection {
  if (data.children?.hasChildren !== "yes") {
    return {
      id: "parenting",
      title: "Parenting",
      items: [],
      attorneyDecisions: [],
      unavailable: "No children in this case, so no parenting terms.",
    };
  }

  const plan = data.parentingPlan ?? {};
  const details = data.parentingPlanDetails;
  const overnights = data.parentingTime?.overnightsWithYouPerYear;
  const holidayItems: TermSheetItem[] =
    plan.holidayScheduleMode === "specific"
      ? (plan.holidaySchedules ?? []).map((holiday) => {
          const assignment =
            holiday.rotation === "alternating"
              ? `Alternating; ${holiday.oddYearParent === "you" ? "you" : "the other parent"} in odd-numbered years`
              : holiday.rotation === "you_every_year"
                ? "You every year"
                : holiday.rotation === "other_parent_every_year"
                  ? "The other parent every year"
                  : holiday.rotation === "regular_schedule"
                    ? "Regular schedule"
                    : "Not decided";
          return {
            label: holiday.name || "Unnamed holiday",
            value: `${assignment}; ${holiday.beginEndTime?.trim() || "times not decided"}${
              holiday.notes?.trim() ? `; ${holiday.notes.trim()}` : ""
            }`,
            basis: "Parties' proposed holiday schedule for Form 12.995(a).",
          };
        })
      : [];

  return {
    id: "parenting",
    title: "Parenting",
    attorneyDecisions: [
      "The full time-sharing schedule, including holidays, school breaks, and travel.",
      "How parental responsibility is allocated for education, health, and religion.",
      "What happens if a parent wants to relocate, which Florida governs by statute.",
    ],
    items: [
      {
        label: "Overnights with you per year",
        value: overnights === undefined ? "Not answered" : `${overnights} of 365`,
        basis: "Used by the child support calculation, §61.30(11).",
      },
      {
        label: "Parenting plan status",
        value: plan.planStatus ?? "Not answered",
        basis: "Florida requires a parenting plan in every case involving minor children, §61.13(2)(b).",
      },
      {
        label: "Education decisions",
        value: plan.decisionMakingEducation ?? "Not answered",
        basis: "Parties' proposed allocation of parental responsibility.",
      },
      {
        label: "Extracurricular activities and costs",
        value: details?.extracurricularCosts?.trim() || "Not entered",
        basis: "Parties' proposed extracurricular terms.",
      },
      {
        label: "Winter/Christmas break",
        value: details?.winterBreakDetails?.trim() || plan.holidaySchedule?.trim() || "Not entered",
        basis: "Parties' proposed school-break schedule.",
      },
      {
        label: "Spring break",
        value: details?.springBreakDetails?.trim() || "Not entered",
        basis: "Parties' proposed school-break schedule.",
      },
      {
        label: "Travel",
        value:
          [
            details?.internationalTravelNoticeDays !== undefined
              ? `${details.internationalTravelNoticeDays} days' international-travel notice`
              : "",
            details?.internationalTravelSecurity?.trim(),
            details?.travelOther?.trim(),
          ]
            .filter(Boolean)
            .join("; ") || "Not entered",
        basis: "Parties' proposed travel and consent terms.",
      },
      {
        label: "Other parenting provisions",
        value: details?.otherProvisions?.trim() || "None entered",
        basis: "Parties' proposed additional parenting terms.",
      },
      ...holidayItems,
    ],
  };
}

function maritalSettlementSection(data: FilingPacketDraftData): TermSheetSection {
  const terms = data.settlementTerms;
  if (!terms) {
    return {
      id: "maritalSettlement",
      title: "Marital settlement agreement — additional terms",
      items: [],
      attorneyDecisions: ["Collect and review the remaining proposed settlement terms."],
      unavailable: "The marital settlement terms were not completed.",
    };
  }

  const unresolved = terms.unresolvedIssues?.trim() ?? "";
  return {
    id: "maritalSettlement",
    title: "Marital settlement agreement — additional terms",
    items: [
      {
        label: "Child medical, dental, insurance, education, and care terms",
        value: terms.otherChildSupportTerms?.trim() || "Not entered",
        basis: "Parties' reported terms for attorney drafting and Form 12.902(f)(1).",
      },
      {
        label: "Tax terms",
        value: terms.taxExemptionTerms?.trim() || "Not entered",
        basis: "Parties' reported tax-filing and allocation terms; tax-adviser review required.",
      },
      {
        label: "Other settlement obligations",
        value: terms.otherSettlementTerms?.trim() || "Not entered",
        basis: "Parties' reported additional financial obligations.",
      },
    ],
    attorneyDecisions:
      unresolved && unresolved.toLowerCase() !== "none."
        ? unresolved
            .split(/\n+/)
            .map((item) => item.replace(/^[-•]\s*/, "").trim())
            .filter(Boolean)
        : [],
  };
}

export function buildSettlementTermSheet(options: {
  data: FilingPacketDraftData;
  packageViewModel: PackageViewModel;
  generatedAt: string;
}): SettlementTermSheet {
  const { data, packageViewModel, generatedAt } = options;
  return {
    generatedAt,
    disclaimer: TERM_SHEET_DISCLAIMER,
    sections: [
      alimonySection(data),
      childSupportSection(packageViewModel, data),
      equitableDistributionSection(packageViewModel, data),
      parentingSection(data),
      maritalSettlementSection(data),
    ],
  };
}
