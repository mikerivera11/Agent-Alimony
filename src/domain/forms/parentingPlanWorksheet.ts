/**
 * Florida parenting plan worksheet.
 *
 * Structured to follow the five things Fla. Stat. §61.13(2)(b) requires a
 * court-approved parenting plan to contain, in the statute's own order:
 * daily tasks, the time-sharing schedule, who is responsible for health care
 * and school-related matters, how the parents communicate with the child, and
 * where exchanges happen.
 *
 * Two things this deliberately does not do.
 *
 * It does not produce Form 12.995(a). A parenting plan is a document a judge
 * approves and is then bound by; generating one from a form-filling exercise
 * would be drafting a legal instrument, which is the line this application
 * does not cross for settlement agreements either.
 *
 * It does not fill gaps. Where a term has not been decided, the worksheet says
 * so, in that term's own place. A parenting plan with a plausible-sounding
 * schedule nobody actually agreed to is worse than one with a visible hole,
 * because the hole is what prompts the conversation.
 */

import type { Children, ParentingPlan, ParentingTime } from "@/domain/intake";
import type { StatutoryCitation } from "@/domain/rules";

import type { FormLine, FormWorksheet, OfficialFormReference } from "./types";

/**
 * Verified 2026-07-31 by extracting the content streams of the linked PDF: of
 * 47,262 text strings in the document, exactly one carries a date, and it is
 * the footer reading "Parenting Plan (03/09)". Note that the court publishes a
 * *separate* instructions document for this form whose own footer reads
 * (02/18) — that date belongs to the instructions, not to the form, and must
 * not be copied here. The PDF `Title` metadata happens to agree with the
 * footer on this form, which is luck rather than a rule: on 12.902(e) the
 * filename implies 11/20 while the footer reads 06/25.
 */
export const PARENTING_PLAN_FORM: OfficialFormReference = {
  formNumber: "12.995(a)",
  title: "Parenting Plan",
  revision: "03/09",
  url: "https://www.flcourts.gov/content/download/686031/file_pdf/995a.pdf",
  verified: true,
  note:
    "The revision above was read from the footer of the court's own PDF on 2026-07-31. Florida also publishes " +
    "a supervised/safety-focused variant (12.995(b)) and a relocation/long-distance variant (12.995(c)), and " +
    "which one fits your case is a decision for you and an attorney. Check the revision date in the footer of " +
    "the copy you file.",
};

const PARENTING_PLAN_CITATIONS: readonly StatutoryCitation[] = [
  {
    citation: "Fla. Stat. §61.13(2)(b)",
    title: "What a parenting plan must contain",
    url: "https://www.flsenate.gov/Laws/Statutes/2025/61.13",
  },
  {
    citation: "Fla. Stat. §61.13(2)(c)",
    title: "Best interests, equal time-sharing presumption, and shared parental responsibility",
    url: "https://www.flsenate.gov/Laws/Statutes/2025/61.13",
  },
];

const UNDECIDED = "Not decided yet";

function responsibility(value: string | undefined, selfLabel: string, otherLabel: string): string {
  switch (value) {
    case "shared":
      return "Shared — both parents confer and decide together";
    case "you":
      return selfLabel;
    case "other_parent":
      return otherLabel;
    default:
      return UNDECIDED;
  }
}

function narrative(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNDECIDED;
}

export function buildParentingPlanWorksheet(options: {
  readonly parentingPlan: Partial<ParentingPlan>;
  readonly parentingTime: Partial<ParentingTime>;
  readonly children: Partial<Children>;
  readonly generatedAt: string;
  readonly county?: string;
}): FormWorksheet | null {
  const plan = options.parentingPlan;
  const children = options.children.children ?? [];
  if (options.children.hasChildren !== "yes" || children.length === 0) return null;

  const gaps: string[] = [
    "Case number, and the full legal names and dates of birth of both parents and each child. This app " +
      "stores initials by default and never asks for a case number, so these must be written in by hand.",
  ];
  if (!options.county) gaps.push("The circuit and county where the case is or will be filed.");

  const undecidedTerms: string[] = [];
  const record = (label: string, value: string) => {
    if (value === UNDECIDED) undecidedTerms.push(label);
    return value;
  };

  const overnightsSelf = options.parentingTime.overnightsWithYouPerYear;
  const overnightsOther = options.parentingTime.overnightsWithOtherParentPerYear;

  const lines: FormLine[] = [
    { label: "Children", value: null, kind: "section" },
    {
      label: "Children covered by this plan",
      value: children.map((child) => child.nameOrInitials).filter(Boolean).join(", ") || UNDECIDED,
      kind: "input",
      explanation: "The official form asks for each child's full legal name and date of birth.",
    },

    { label: "Status", value: null, kind: "section" },
    {
      label: "Where this plan stands",
      value:
        plan.planStatus === "agreed"
          ? "Both parents have agreed to these terms"
          : plan.planStatus === "in_dispute"
            ? "The parents disagree — these are one parent's answers only"
            : "Proposed by one parent; not yet agreed",
      kind: "input",
    },

    { label: "Parental responsibility — who decides", value: null, kind: "section" },
    {
      label: "Education decisions",
      value: record("Education decisions", responsibility(plan.decisionMakingEducation, "You", "The other parent")),
      kind: "input",
      authority: "§61.13(2)(b)3.",
    },
    {
      label: "Health care decisions",
      value: record("Health care decisions", responsibility(plan.decisionMakingHealthcare, "You", "The other parent")),
      kind: "input",
      authority: "§61.13(2)(b)3.a.",
      explanation:
        "Where health care decisions are shared, either parent may consent to mental health treatment for the " +
        "child unless the plan says otherwise.",
    },
    {
      label: "Religious upbringing",
      value: record("Religious upbringing", responsibility(plan.decisionMakingReligion, "You", "The other parent")),
      kind: "input",
      authority: "§61.13(2)(b)3.c.",
    },
    {
      label: "Address used for school registration",
      value: record(
        "Address used for school registration",
        plan.schoolDesignationParent === "you"
          ? "Yours"
          : plan.schoolDesignationParent === "other_parent"
            ? "The other parent's"
            : UNDECIDED,
      ),
      kind: "input",
      authority: "§61.13(2)(b)3.b.",
      explanation: "This decides the school boundary, not the time-sharing schedule.",
    },
    {
      label: "Note on the legal default",
      value: null,
      kind: "note",
      authority: "§61.13(2)(c)2.",
      explanation:
        "A Florida court orders shared parental responsibility unless it finds that shared responsibility would " +
        "be detrimental to the child.",
    },

    { label: "Time-sharing schedule", value: null, kind: "section" },
    {
      label: "Weekday schedule",
      value: record("Weekday schedule", narrative(plan.weekdaySchedule)),
      kind: "input",
      authority: "§61.13(2)(b)2.",
    },
    {
      label: "Weekend schedule",
      value: record("Weekend schedule", narrative(plan.weekendSchedule)),
      kind: "input",
      authority: "§61.13(2)(b)2.",
    },
    {
      label: "Holidays and school breaks",
      value: record("Holidays and school breaks", narrative(plan.holidaySchedule)),
      kind: "input",
      authority: "§61.13(2)(b)2.",
    },
    {
      label: "Summer schedule",
      value: record("Summer schedule", narrative(plan.summerSchedule)),
      kind: "input",
      authority: "§61.13(2)(b)2.",
    },
    ...(typeof overnightsSelf === "number" && typeof overnightsOther === "number"
      ? [
          {
            label: "Overnights per year used for the child support estimate",
            value: `You: ${overnightsSelf}. Other parent: ${overnightsOther}.`,
            kind: "computed" as const,
            explanation:
              "Check that these match the schedule above. If they do not, the support estimate is built on a " +
              "different schedule than the one being proposed.",
          },
        ]
      : []),
    {
      label: "Note on the legal default",
      value: null,
      kind: "note",
      authority: "§61.13(2)(c)1.",
      explanation:
        "There is a rebuttable presumption that equal time-sharing is in the child's best interests. A parent " +
        "seeking a different schedule must prove by a preponderance of the evidence that equal time-sharing is not " +
        "in the child's best interests.",
    },

    { label: "Communication and exchanges", value: null, kind: "section" },
    {
      label: "How the child communicates with the other parent",
      value: record(
        "How the child communicates with the other parent",
        narrative(plan.communicationBetweenChildAndParent),
      ),
      kind: "input",
      authority: "§61.13(2)(b)4.",
    },
    {
      label: "Where exchanges happen",
      value: record("Where exchanges happen", narrative(plan.exchangeArrangements)),
      kind: "input",
      authority: "§61.13(2)(b)5.",
      explanation:
        "A court may require exchanges at a neutral safe location or a supervised visitation program where it " +
        "finds a risk or imminent threat of harm.",
    },

    { label: "Other", value: null, kind: "section" },
    {
      label: "Either parent expects to move more than 50 miles away",
      value: plan.relocationAnticipated === "yes" ? "Yes" : plan.relocationAnticipated === "no" ? "No" : UNDECIDED,
      kind: "input",
      explanation:
        "Relocation with a child is a separate legal process in Florida with its own requirements. Raise it with " +
        "an attorney rather than handling it in the parenting plan alone.",
    },
  ];

  if (undecidedTerms.length > 0) {
    gaps.push(
      `Terms not yet decided, which the court will need settled: ${undecidedTerms.join("; ")}.`,
    );
  }
  if (plan.planStatus === "in_dispute") {
    gaps.push(
      "The parents disagree about this plan. The entries above are one parent's position, not an agreement.",
    );
  }

  return {
    id: "florida-parenting-plan-worksheet",
    title: "Florida Parenting Plan Worksheet",
    subtitle:
      "A worksheet for discussion and attorney review. This is not Florida Supreme Court Approved Family Law " +
      "Form 12.995(a), is not a parenting plan, and cannot be filed or submitted for approval.",
    officialForm: PARENTING_PLAN_FORM,
    rulesetId: "florida-parenting-plan-worksheet",
    ruleVersion: "61.13-2025",
    effectiveDate: "2023-07-01",
    generatedAt: options.generatedAt,
    lines,
    citations: PARENTING_PLAN_CITATIONS,
    gaps,
  };
}
