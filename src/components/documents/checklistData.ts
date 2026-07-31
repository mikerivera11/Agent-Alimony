/**
 * Plain-language checklist of Florida disclosure materials commonly needed
 * for alimony/support cases. Purely informational — nothing here is
 * "checked off" against an upload; it exists to help someone gather the
 * right paperwork before they upload or bring anything to court.
 */
export interface DocumentChecklistItem {
  id: string;
  title: string;
  whyItHelps: string;
  examples: string[];
}

export const DOCUMENT_CHECKLIST: DocumentChecklistItem[] = [
  {
    id: "financial-affidavit",
    title: "Financial affidavit",
    whyItHelps:
      "Florida courts require a sworn financial affidavit from each party. It is the backbone document that everything else here supports or verifies.",
    examples: ["Short-form or long-form financial affidavit (Florida Family Law Form 12.902)"],
  },
  {
    id: "tax-returns",
    title: "Tax returns",
    whyItHelps:
      "Recent tax returns show a fuller picture of income (including self-employment or investment income) than a single pay stub can.",
    examples: ["Last 2–3 years of federal tax returns, all schedules and W-2/1099 attachments"],
  },
  {
    id: "income-documents",
    title: "W-2s, 1099s, and pay stubs",
    whyItHelps:
      "These verify current income and withholding, which is central to calculating support.",
    examples: ["Most recent 2–3 pay stubs", "Current-year W-2 or 1099 forms"],
  },
  {
    id: "bank-investment-retirement",
    title: "Bank, investment, and retirement statements",
    whyItHelps:
      "These show assets, savings, and any additional income (like interest or dividends) that a pay stub won't capture.",
    examples: ["Checking/savings statements", "Brokerage statements", "401(k)/IRA/pension statements"],
  },
  {
    id: "credit-card-debt",
    title: "Credit card and other debt statements",
    whyItHelps:
      "Debt obligations affect both parties' true monthly finances and are part of the disclosure picture, not just income.",
    examples: ["Credit card statements", "Personal loan or line-of-credit statements"],
  },
  {
    id: "insurance-childcare",
    title: "Insurance and childcare costs",
    whyItHelps:
      "Health insurance premiums and childcare costs are often shared or factored into support calculations.",
    examples: ["Health/dental insurance statements showing premium amounts", "Childcare or daycare invoices"],
  },
  {
    id: "property-mortgage",
    title: "Property and mortgage documents",
    whyItHelps:
      "Real estate is often a couple's largest asset or expense, and mortgage statements show payment amounts and remaining balances.",
    examples: ["Mortgage statements", "Property tax bills", "Recent appraisal or market value estimate"],
  },
  {
    id: "court-orders",
    title: "Existing court orders",
    whyItHelps:
      "Any prior orders (temporary support, custody, injunctions) establish what is already legally in effect.",
    examples: ["Temporary support orders", "Parenting plans", "Injunctions"],
  },
  {
    id: "other-evidence",
    title: "Other supporting evidence",
    whyItHelps:
      "Anything else relevant to income, expenses, or parenting that doesn't fit the categories above still helps build a complete, accurate picture.",
    examples: ["Business records for self-employment", "Correspondence about shared expenses"],
  },
];
