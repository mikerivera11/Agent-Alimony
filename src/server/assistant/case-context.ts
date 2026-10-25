import type { AssistantCaseContext } from "@/lib/assistantCaseContext";

import type { AssistantAnswer } from "./adapter";
import { detectEscalationSignals, scanForPromptInjection } from "./guardrails";

const CALCULATION_QUESTION =
  /\b(child support|estimate|calculation|calculated|formula|income|deduction|overnight|time[- ]sharing|amount|figure|number|step)\b/i;

function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatFormulaValue(key: string, value: string | number | boolean | null): string {
  if (value === null) return "not provided";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number" && key.endsWith("Cents")) return formatDollars(value);
  if (typeof value === "number" && key.endsWith("BasisPoints")) return `${(value / 100).toFixed(2)}%`;
  return String(value);
}

function readableKey(key: string): string {
  return key
    .replace(/Cents$|BasisPoints$/u, "")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Za-z])(\d)/gu, "$1 $2")
    .replace(/(\d)([A-Za-z])/gu, "$1 $2")
    .replace(/^./u, (character) => character.toUpperCase());
}

/**
 * Answers only from the preserved rules-engine trace. No model receives these
 * figures and no arithmetic is performed here beyond display formatting.
 */
export function answerCaseContextQuestion(
  question: string,
  context: AssistantCaseContext | undefined,
): AssistantAnswer | null {
  if (!context || !CALCULATION_QUESTION.test(question) || scanForPromptInjection(question).detected) {
    return null;
  }

  const steps = context.formulaTrace.map((step, index) => {
    const values = Object.entries(step.values)
      .map(([key, value]) => `   - ${readableKey(key)}: ${formatFormulaValue(key, value)}`)
      .join("\n");
    return `${index + 1}. **${step.description}**${step.citation ? ` (${step.citation})` : ""}\n${values}`;
  });

  const payer =
    context.obligorParent === "No transfer"
      ? "The deterministic result did not indicate a monthly transfer between the parents."
      : `${context.obligorParent} is the paying parent in this estimate.`;

  const assumptions =
    context.assumptions.length > 0
      ? `\n\n**Assumptions used**\n${context.assumptions.map((item) => `- ${item}`).join("\n")}`
      : "";

  return {
    content:
      `Your child-support estimate was produced by the app's tested **${context.rulesetId}** rules engine, ` +
      "not by the assistant. I am reading back its preserved calculation trace.\n\n" +
      `**Estimated monthly transfer:** ${formatDollars(context.monthlyTransferAmountCents)}. ${payer}\n\n` +
      `**Combined net monthly income:** ${formatDollars(context.combinedNetMonthlyIncomeCents)}\n\n` +
      `**Total minimum child-support need:** ${formatDollars(context.totalMinimumChildSupportNeedCents)}\n\n` +
      `**Substantial time-sharing formula applied:** ${context.substantialTimeSharingApplied ? "Yes" : "No"}\n\n` +
      `**How the estimate was calculated**\n${steps.join("\n\n")}` +
      assumptions +
      "\n\nThis remains an estimate, not a court order. A lawyer can review whether any disputed income, deviation, " +
      "or case-specific fact should change what is presented to the court.",
    citations: context.citations,
    escalations: detectEscalationSignals(question),
    groundedIn: context.formulaTrace.map((step) => `calculation:${step.stepId}`),
    source: "Florida child-support rules engine (deterministic calculation trace)",
    outOfScope: false,
  };
}
