/**
 * The attorney filing packet: what an uncontested Florida dissolution needs,
 * matched against what this person has actually answered.
 *
 * Two deliberate limits define this module.
 *
 * First, it does not fill in the official PDFs, for the reason given in
 * `types.ts`: their AcroForm fields are positional rather than semantic, so
 * writing into them produces an authoritative-looking document that may be
 * wrong in ways nobody can see. It reports readiness instead.
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
import { ALIMONY_FORM_LABELS } from "@/domain/rules";

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

  const selected = new Set<string>(["12.928", "12.902(j)", "12.932"]);

  if (hasChildren) {
    selected.add("12.901(b)(1)");
    selected.add("12.902(f)(1)");
    selected.add("12.902(e)");
    selected.add("12.995(a)");
    selected.add("12.902(d)");
    selected.add("12.990(c)(1)");
  } else if (hasPropertyOrDebt) {
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
    if (isBlank(filing.you?.address?.street) || isBlank(filing.you?.address?.city)) {
      missing.push("Your address");
    }
    if (isBlank(data.marriage?.marriageDate)) missing.push("The date you married");
    if (isBlank(filing.marriagePlaceCity) && isBlank(filing.marriagePlaceStateOrCountry)) {
      missing.push("Where you married");
    }
    if (isBlank(filing.floridaResidentSince)) missing.push("When Florida residence began");
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
      if (isBlank(child.addressHistory)) missing.push("Each child's five-year address history");
    }
  }

  if (formNumber === "12.995(a)") {
    if (data.parentingPlan?.planStatus === undefined) {
      missing.push("Whether the parenting plan is agreed, proposed, or in dispute");
    }
    const plan = data.parentingPlan;
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
  readonly id: "alimony" | "childSupport" | "equitableDistribution" | "parenting";
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
  "This term sheet is a summary of estimated figures and stated preferences. It is not a marital settlement " +
  "agreement, it is not signed, and it binds nobody. It exists so a Florida attorney can draft the actual " +
  "agreement without re-gathering everything. Every figure is an estimate produced from the answers given, not a " +
  "prediction of what a court would order.";

function alimonySection(pkg: PackageViewModel): TermSheetSection {
  const attorneyDecisions = [
    "Which form of alimony is appropriate, and for how long.",
    "Whether alimony is modifiable or non-modifiable, and whether either spouse waives it permanently.",
    "How alimony is treated for tax purposes.",
    "Whether life insurance must secure the obligation, and who pays for it.",
  ];

  if (pkg.alimony.kind !== "calculated") {
    return {
      id: "alimony",
      title: "Alimony",
      items: [],
      attorneyDecisions,
      unavailable:
        pkg.alimony.kind === "needsInput"
          ? `Not stated: ${pkg.alimony.message}`
          : `Not stated: ${"reason" in pkg.alimony ? pkg.alimony.reason : "the alimony calculation did not complete."}`,
    };
  }

  const result = pkg.alimony.result;
  const availableForms = result.formAvailability.filter((form) => form.available);

  return {
    id: "alimony",
    title: "Alimony",
    attorneyDecisions,
    items: [
      {
        label: "Length of marriage",
        value: `${result.marriageDurationMonths} months (${result.marriageDurationCategory})`,
        basis: "Marriage date to petition filing date, §61.08(4).",
      },
      {
        label: "Estimated monthly amount",
        value: `${formatCentsAsDollars(result.amountCeiling.rangeFloorCents)} to ${formatCentsAsDollars(
          result.amountCeiling.rangeCeilingCents,
        )} per month`,
        basis:
          result.amountCeiling.limitingFactor === "reasonableNeed"
            ? "Capped by the recipient's documented reasonable need, §61.08(8)."
            : "Capped by 35% of the difference in the spouses' net incomes, §61.08(8).",
      },
      {
        label: "Forms of alimony available",
        value:
          availableForms.length > 0
            ? availableForms
                .map((form) =>
                  form.maxDurationMonths === null
                    ? ALIMONY_FORM_LABELS[form.form]
                    : `${ALIMONY_FORM_LABELS[form.form]} (up to ${form.maxDurationMonths} months)`,
                )
                .join("; ")
            : "None available on these facts",
        basis: "§61.08(5)-(8), by length of marriage.",
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

function equitableDistributionSection(pkg: PackageViewModel): TermSheetSection {
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
  const overnights = data.parentingTime?.overnightsWithYouPerYear;

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
    ],
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
      alimonySection(packageViewModel),
      childSupportSection(packageViewModel, data),
      equitableDistributionSection(packageViewModel),
      parentingSection(data),
    ],
  };
}
