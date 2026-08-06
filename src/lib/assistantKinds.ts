export const ASSISTANT_KINDS = ["legal", "financial_options"] as const;

export type AssistantKind = (typeof ASSISTANT_KINDS)[number];

export const FINANCIAL_SUGGESTED_QUESTIONS = [
  "Should I use a home equity line or sell investments to fund a lump sum?",
  "What should I compare before borrowing against my home?",
  "What tax information matters before I sell stock?",
  "How much liquidity should I preserve during and after divorce?",
] as const;
