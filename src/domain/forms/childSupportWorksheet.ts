/**
 * Florida child support guidelines worksheet.
 *
 * Lines follow the order Fla. Stat. §61.30 prescribes — gross income, then
 * allowable deductions, then net, then combined net, then the guideline need,
 * then add-ons, then each parent's percentage share — because that order *is*
 * the statute's computation, and it is the same order the official Child
 * Support Guidelines Worksheet walks through. Deriving the layout from the
 * statute rather than from the form means a form revision cannot silently
 * invalidate it.
 *
 * Every figure here comes from `calculateFloridaChildSupport`. Nothing on this
 * worksheet is computed locally, so the worksheet cannot disagree with the
 * results screen or with the generated package.
 */

import { formatCentsAsDollars } from "@/domain/package";
import type { ChildSupportResult, RuleOutcome, StatutoryCitation } from "@/domain/rules";

import type { FormLine, FormWorksheet, OfficialFormReference } from "./types";

/**
 * The official form this worksheet corresponds to.
 *
 * `verified` means the form's number, title, and revision footer were read out
 * of the court's own PDF rather than inferred. They were: the revision below
 * came from the document's body text, not from its metadata title, which on
 * these forms is stale. Filename-based dating is likewise unreliable — this
 * form's filename implies 11/20 while its footer reads 06/25. The download URL
 * carries an opaque CMS content id that cannot be guessed; a plausible-looking
 * invented URL for form 12.995(a) turned out to serve the Dependency Benchbook.
 */
export const CHILD_SUPPORT_GUIDELINES_FORM: OfficialFormReference = {
  formNumber: "12.902(e)",
  title: "Child Support Guidelines Worksheet",
  revision: "06/25",
  url: "https://www.flcourts.gov/content/download/685815/file_pdf/902%28e%29.pdf",
  verified: true,
  note:
    "The revision above was read from the footer of the court's own PDF on 2026-07-31. Check that the " +
    "revision date in the footer of the copy you file matches; if it does not, the court's copy is newer " +
    "than this one and it governs.",
};

function percentFromBasisPoints(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

function parentLabel(parentId: string, selfParentId: string): string {
  return parentId === selfParentId ? "You" : "Other parent";
}

/**
 * Builds the worksheet. Returns `null` when child support was not calculated,
 * because a worksheet of blanks looks like a filled form that happens to be
 * empty, and someone would file it.
 */
export function buildChildSupportWorksheet(options: {
  readonly outcome: RuleOutcome<ChildSupportResult>;
  readonly ruleVersion: string;
  readonly effectiveDate: string;
  readonly rulesetId: string;
  readonly citations: readonly StatutoryCitation[];
  readonly generatedAt: string;
  /** Which parent id represents the person using the app. */
  readonly selfParentId: string;
  readonly childNamesOrInitials: readonly string[];
  readonly county?: string;
}): FormWorksheet | null {
  if (options.outcome.kind !== "calculated") return null;
  const result = options.outcome.result;
  const [first, second] = result.parents;
  const self = first.parentId === options.selfParentId ? first : second;
  const other = self === first ? second : first;

  const gaps: string[] = [];
  if (!options.county) {
    gaps.push("County — the official form asks for the circuit and county where the case is filed.");
  }
  gaps.push(
    "Case number, and the full legal names of both parents and each child. This app stores initials " +
      "by default and never asks for a case number, so these must be written in by hand.",
  );
  if (result.wasAboveSchedule) {
    gaps.push(
      "Combined net income is above the top of the §61.30(6) schedule, so the guideline amount is " +
        "computed under §61.30(6)(b) rather than read from the table.",
    );
  }

  const lines: FormLine[] = [
    { label: "Children covered by this worksheet", value: null, kind: "section" },
    {
      label: "Number of children",
      value: String(result.numberOfChildren),
      kind: "input",
      authority: "§61.30(1)(a)",
    },
    ...(options.childNamesOrInitials.length > 0
      ? [
          {
            label: "Children",
            value: options.childNamesOrInitials.join(", "),
            kind: "input" as const,
            explanation: "Enter each child's full legal name and date of birth on the official form.",
          },
        ]
      : []),

    { label: "Income", value: null, kind: "section" },
    {
      label: `Monthly gross income — ${parentLabel(self.parentId, options.selfParentId)}`,
      value: formatCentsAsDollars(self.monthlyGrossIncomeCents),
      kind: "input",
      authority: "§61.30(2)(a)",
    },
    {
      label: `Monthly gross income — ${parentLabel(other.parentId, options.selfParentId)}`,
      value: formatCentsAsDollars(other.monthlyGrossIncomeCents),
      kind: "input",
      authority: "§61.30(2)(a)",
    },
    {
      label: `Monthly net income — ${parentLabel(self.parentId, options.selfParentId)}`,
      value: formatCentsAsDollars(self.monthlyNetIncomeCents),
      kind: "computed",
      authority: "§61.30(3)",
      explanation: "Gross income minus the deductions §61.30(3) allows.",
    },
    {
      label: `Monthly net income — ${parentLabel(other.parentId, options.selfParentId)}`,
      value: formatCentsAsDollars(other.monthlyNetIncomeCents),
      kind: "computed",
      authority: "§61.30(3)",
    },
    {
      label: "Combined monthly net income",
      value: formatCentsAsDollars(result.combinedNetMonthlyIncomeCents),
      kind: "computed",
      authority: "§61.30(4)",
    },

    { label: "Guideline need", value: null, kind: "section" },
    {
      label: "Basic monthly child support need",
      value: formatCentsAsDollars(result.basicMonthlyNeedCents),
      kind: "computed",
      authority: "§61.30(6)",
      explanation: "Read from the statutory guidelines schedule for the combined net income and number of children.",
    },
    {
      label: "Child care costs added",
      value: formatCentsAsDollars(result.childCareAddOnCents),
      kind: "computed",
      authority: "§61.30(7)",
    },
    {
      label: "Child health insurance added",
      value: formatCentsAsDollars(result.childHealthInsuranceAddOnCents),
      kind: "computed",
      authority: "§61.30(8)",
    },
    {
      label: "Total minimum child support need",
      value: formatCentsAsDollars(result.totalMinimumChildSupportNeedCents),
      kind: "computed",
      authority: "§61.30(7)–(8)",
    },

    { label: "Each parent's share", value: null, kind: "section" },
    {
      label: `Percentage share of combined net income — ${parentLabel(self.parentId, options.selfParentId)}`,
      value: percentFromBasisPoints(self.incomeSharePercentBasisPoints),
      kind: "computed",
      authority: "§61.30(9)",
    },
    {
      label: `Percentage share of combined net income — ${parentLabel(other.parentId, options.selfParentId)}`,
      value: percentFromBasisPoints(other.incomeSharePercentBasisPoints),
      kind: "computed",
      authority: "§61.30(9)",
    },
    {
      label: `Share of the total need — ${parentLabel(self.parentId, options.selfParentId)}`,
      value: formatCentsAsDollars(self.dollarShareOfTotalNeedCents),
      kind: "computed",
      authority: "§61.30(9)",
    },
    {
      label: `Share of the total need — ${parentLabel(other.parentId, options.selfParentId)}`,
      value: formatCentsAsDollars(other.dollarShareOfTotalNeedCents),
      kind: "computed",
      authority: "§61.30(9)",
    },

    { label: "Time-sharing", value: null, kind: "section" },
    {
      label: `Overnights per year — ${parentLabel(self.parentId, options.selfParentId)}`,
      value: String(self.overnightsWithChild),
      kind: "input",
      authority: "§61.30(11)(b)",
    },
    {
      label: `Overnights per year — ${parentLabel(other.parentId, options.selfParentId)}`,
      value: String(other.overnightsWithChild),
      kind: "input",
      authority: "§61.30(11)(b)",
    },
    {
      label: "Substantial time-sharing adjustment applied",
      value: result.substantialTimeSharingApplied ? "Yes" : "No",
      kind: "computed",
      authority: "§61.30(11)(b)",
      explanation:
        "Applies when each parent has at least 20 percent of the overnights in a year, which is 73 nights.",
    },

    { label: "Result", value: null, kind: "section" },
    {
      label: "Parent who pays support",
      value:
        result.obligorParentId === null
          ? "Neither — the shares offset to zero"
          : parentLabel(result.obligorParentId, options.selfParentId),
      kind: "computed",
      authority: "§61.30(9)",
    },
    {
      label: "Monthly transfer amount",
      value: formatCentsAsDollars(result.monthlyTransferAmountCents),
      kind: "computed",
      authority: "§61.30(9), (11)",
      explanation:
        "A guideline figure, not a court order. §61.30(1)(a) lets a court vary from it by up to 5 percent, " +
        "and further with written findings.",
    },
    ...(result.socialSecurityCreditAppliedCents > 0
      ? [
          {
            label: "Social Security derivative benefit credited",
            value: formatCentsAsDollars(result.socialSecurityCreditAppliedCents),
            kind: "computed" as const,
            authority: "§61.30(2)(b)",
          },
        ]
      : []),
  ];

  return {
    id: "florida-child-support-guidelines-worksheet",
    title: "Florida Child Support Guidelines Worksheet",
    subtitle:
      "A worksheet prepared for attorney review. This is not Florida Supreme Court Approved Family Law " +
      "Form 12.902(e) and cannot be filed in its place.",
    officialForm: CHILD_SUPPORT_GUIDELINES_FORM,
    rulesetId: options.rulesetId,
    ruleVersion: options.ruleVersion,
    effectiveDate: options.effectiveDate,
    generatedAt: options.generatedAt,
    lines,
    citations: options.citations,
    gaps,
  };
}
