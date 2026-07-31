import type { IntakeDraftData } from "./draft";

export interface AttorneyEscalationFlag {
  id: string;
  label: string;
  reason: string;
}

export interface EscalationAssessment {
  /** Domestic violence or coercion was disclosed — highest priority, shown everywhere. */
  safetyConcern: boolean;
  /** Situations this preview tool can't safely or accurately estimate. */
  attorneyFlags: AttorneyEscalationFlag[];
}

/**
 * Looks across every topic's answers for situations that call for a real
 * attorney instead of (or in addition to) a self-help estimate: hidden
 * assets, complex business income, a special-needs child, jurisdiction
 * disputes, disputed/imputed income, and pre-2023 filings (a different legal
 * standard applies to alimony cases filed before Florida's 2023 reform).
 */
export function assessEscalation(data: IntakeDraftData): EscalationAssessment {
  const attorneyFlags: AttorneyEscalationFlag[] = [];

  if (data.assetsDebts.hasHiddenOrUnknownAssets === "yes") {
    attorneyFlags.push({
      id: "hidden-assets",
      label: "Possible hidden or unknown assets",
      reason:
        "Uncovering hidden assets often requires subpoenas or discovery tools that only an attorney can use.",
    });
  }

  if (data.assetsDebts.hasComplexBusinessInterests === "yes") {
    attorneyFlags.push({
      id: "complex-business",
      label: "Business ownership or complex business income",
      reason:
        "Valuing a business and figuring out true income from it usually needs a forensic accountant and an attorney.",
    });
  }

  if (data.children.children?.some((child) => child.hasSpecialNeeds === "yes")) {
    attorneyFlags.push({
      id: "special-needs-child",
      label: "A child with special needs",
      reason:
        "Support and parenting arrangements for a child with special needs often require tailored legal terms.",
    });
  }

  if (data.safetyComplexity.hasJurisdictionDispute === "yes") {
    attorneyFlags.push({
      id: "jurisdiction-dispute",
      label: "A dispute about which state (or country) should handle the case",
      reason: "Jurisdiction disputes can change which court has authority over your case entirely.",
    });
  }

  if (data.safetyComplexity.incomeIsImputedOrDisputed === "yes") {
    attorneyFlags.push({
      id: "imputed-disputed-income",
      label: "Disagreement about income, or income being imputed",
      reason:
        "When income is disputed or a court may 'impute' income (treat someone as earning more than they report), the numbers can shift significantly.",
    });
  }

  if (data.safetyComplexity.filedOrFilingBeforeJuly2023 === "yes") {
    attorneyFlags.push({
      id: "pre-2023-filing",
      label: "A case filed before Florida's 2023 alimony law changes",
      reason:
        "Florida's alimony law changed substantially on July 1, 2023. Cases filed before that date may follow different rules than this tool covers.",
    });
  }

  return {
    safetyConcern: data.safetyComplexity.domesticViolenceOrCoercion === "yes",
    attorneyFlags,
  };
}
