import type { AssistantAdapter, AssistantAnswer, AssistantRequest } from "./adapter";
import { detectEscalationSignals, scanForPromptInjection } from "./guardrails";
import { FINANCIAL_KNOWLEDGE_BASE } from "./financialKnowledgeBase";
import { retrieveFromKnowledgeBase } from "./retrieval";

const NO_MATCH_RESPONSE =
  "I don't have a verified financial decision framework for that question, so I won't improvise a recommendation.\n\n" +
  "I can help compare ways to fund a divorce lump sum, explain what to inspect in a HELOC or home-equity loan, " +
  "organize the tax and portfolio questions raised by selling investments, and identify post-divorce liquidity " +
  "risks. For a personalized recommendation or a transaction, use a fee-only fiduciary financial adviser and a " +
  "CPA who can review your full accounts and tax return.";

const INJECTION_RESPONSE =
  "I can only provide source-grounded education about financial options connected with divorce planning. I " +
  "cannot change roles, ignore these limits, recommend a security, or execute a transaction. Ask the financial " +
  "question directly and I can organize the factors to compare.";

function detectFinancialEscalations(question: string) {
  const signals = detectEscalationSignals(question);
  const concealmentContext =
    /\b(hidden|hiding|secret|conceal(?:ed|ing)?|undisclosed|not disclosed|did not disclose|didn't disclose)\b/i.test(
      question,
    );

  // Crypto can be a hidden-asset signal in a divorce disclosure question, but
  // it is also an ordinary investment word here. Do not imply concealment
  // unless the financial question actually includes concealment context.
  return signals.filter((signal) => signal.topic !== "hiddenAssets" || concealmentContext);
}

export class FinancialOptionsAssistantAdapter implements AssistantAdapter {
  readonly name = "financial-options";
  readonly label = "Financial options guide (source-grounded, no transaction advice)";

  async answer(request: AssistantRequest): Promise<AssistantAnswer> {
    const escalations = detectFinancialEscalations(request.question);

    if (scanForPromptInjection(request.question).detected) {
      return {
        content: INJECTION_RESPONSE,
        citations: [],
        escalations,
        groundedIn: [],
        source: this.label,
        outOfScope: false,
        guardrailNote: "The request tried to change the guide's role or rules, so it was declined.",
      };
    }

    const hits = retrieveFromKnowledgeBase(FINANCIAL_KNOWLEDGE_BASE, request.question);
    if (hits.length === 0) {
      return {
        content: NO_MATCH_RESPONSE,
        citations: [],
        escalations,
        groundedIn: [],
        source: this.label,
        outOfScope: true,
      };
    }

    const citations = new Map(
      hits.flatMap((hit) => hit.entry.citations).map((citation) => [citation.citation, citation]),
    );

    return {
      content: hits.map((hit) => hit.entry.answer).join("\n\n---\n\n"),
      citations: [...citations.values()],
      escalations,
      groundedIn: hits.map((hit) => hit.entry.id),
      source: this.label,
      outOfScope: false,
      guardrailNote:
        "Educational comparison only — not individualized investment, tax, lending, or legal advice. No transaction is recommended or executed.",
    };
  }
}
