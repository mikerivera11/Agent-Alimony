/**
 * The local, AI-free assistant adapter.
 *
 * This is the default and it is not a stub: it answers from the curated,
 * citation-backed knowledge base using deterministic retrieval. It never
 * fabricates legal content, so it is safe to ship with no AI provider
 * configured at all. When it has no verified material on a topic it says so
 * plainly instead of improvising.
 */


import type { AssistantAdapter, AssistantAnswer, AssistantRequest } from "./adapter";
import { gatherGrounding, groundingCitations, isUngrounded } from "./grounding";
import {
  containsCurrency,
  detectEscalationSignals,
  redactCurrency,
  scanForPromptInjection,
} from "./guardrails";
import { statuteChunkCitation, type StatuteChunk } from "./statuteCorpus";


const NO_MATCH_RESPONSE =
  "I don't have verified Florida material on that, so I'm not going to guess.\n\n" +
  "I can explain the areas this app covers: the types of alimony and how marriage length affects them, the " +
  "statutory limit on durational alimony, what a judge weighs when deciding alimony, how child support is " +
  "calculated, how overnights change support, how property is divided, what happens to retirement accounts, " +
  "lump-sum payments, and what financial documents you'll need.\n\n" +
  "If your question is about something else — or about what you specifically should do — a licensed Florida " +
  "family-law attorney is the right person to ask. The Florida Bar Lawyer Referral Service is 1-800-342-8011.";

const URGENT_NO_MATCH_RESPONSE =
  "Thank you for telling me. Please read the notice above first — it matters more than anything I can explain " +
  "about how the law works.\n\n" +
  "I'm a general information tool and I can't advise you on your situation or help with safety planning. What " +
  "you've described needs a real person: a licensed Florida family-law attorney, or one of the services listed " +
  "above.\n\n" +
  "If it would still help later, I can explain how Florida handles alimony, child support, or dividing " +
  "property. But please get support for the more urgent thing first.";

const INJECTION_RESPONSE =
  "I can only answer questions about how Florida family law works, using the verified material built into this " +
  "app. I can't take on a different role, change how I operate, or set aside how this app calculates figures.\n\n" +
  "If you have a question about alimony, child support, dividing property, or the documents you need, ask it " +
  "directly and I'll do my best.";

/**
 * Presents statutory chunks when no curated entry covers the question.
 *
 * Dollar amounts are redacted rather than quoted. Statutory thresholds are
 * enacted text, not calculations, so quoting them would arguably be
 * defensible — but "the assistant never states a dollar figure" is only
 * worth having as a guarantee if it is absolute and machine-checkable. A
 * reader who needs the exact threshold has the citation and a link to the
 * official text, and every figure this app produces comes from the
 * deterministic calculators instead.
 */
function formatStatuteOnlyAnswer(chunks: readonly StatuteChunk[]): string {
  const redacted = chunks.some((chunk) => containsCurrency(chunk.text));

  const quoted = chunks
    .map(
      (chunk) =>
        `**${chunk.citation} — ${chunk.sectionTitle}**\n\n> ${redactCurrency(chunk.text, "[amount — see the linked statute]")}\n\n[Read it on the Florida Senate site](${chunk.url})`,
    )
    .join("\n\n");

  return (
    "I don't have a plain-language explanation written for that question, but Florida law does address it. " +
    "Here is the statutory text itself:\n\n" +
    `${quoted}\n\n` +
    (redacted
      ? "Dollar amounts are left out above on purpose — this assistant never states figures. Use the link to " +
        "see the exact statutory text, and use the app's results screen for any amount in your own case.\n\n"
      : "") +
    "Statutes are written for lawyers, so if that is hard to apply to your situation, a licensed Florida " +
    "family-law attorney can tell you what it means for you. The Florida Bar Lawyer Referral Service is " +
    "1-800-342-8011."
  );
}

export class LocalAssistantAdapter implements AssistantAdapter {
  readonly name = "local";
  readonly label = "Florida statute reference (built in, no AI)";

  async answer(request: AssistantRequest): Promise<AssistantAnswer> {
    const escalations = detectEscalationSignals(request.question);

    // Escalations still surface on a refused turn: someone probing the
    // assistant may also be disclosing something that needs a referral.
    if (scanForPromptInjection(request.question).detected) {
      return {
        content: INJECTION_RESPONSE,
        citations: [],
        escalations,
        groundedIn: [],
        source: this.label,
        outOfScope: false,
        guardrailNote: "The request appeared to try to change how the assistant operates, so it was declined.",
      };
    }

    const grounding = gatherGrounding(request.question, request.topic);
    const hits = grounding.entries;

    if (isUngrounded(grounding)) {
      // Answering "I don't have material on that" to someone disclosing
      // abuse or a court deadline reads as a brush-off. When an urgent
      // signal fired, acknowledge it instead; the escalation itself carries
      // the referral and hotline information.
      const hasUrgentSignal = escalations.some((signal) => signal.severity === "urgent");

      return {
        content: hasUrgentSignal ? URGENT_NO_MATCH_RESPONSE : NO_MATCH_RESPONSE,
        citations: [],
        escalations,
        groundedIn: [],
        source: this.label,
        outOfScope: true,
      };
    }

    // With no curated entry, the statute itself is the answer. It is quoted
    // rather than paraphrased: paraphrasing enacted text without a lawyer in
    // the loop is exactly the kind of quiet interpretation this app avoids.
    if (hits.length === 0) {
      return {
        content: formatStatuteOnlyAnswer(grounding.statutes.map((hit) => hit.chunk)),
        citations: grounding.statutes.map((hit) => statuteChunkCitation(hit.chunk)),
        escalations,
        groundedIn: grounding.statutes.map((hit) => hit.chunk.id),
        source: this.label,
        outOfScope: false,
      };
    }

    const sections = hits.map((hit) => hit.entry.answer);

    // Beyond the topical escalations, some entries are inherently
    // attorney-review territory (retirement division, lump-sum structuring).
    const reviewNeeded = hits.some((hit) => hit.entry.requiresAttorneyReview);
    if (reviewNeeded) {
      sections.push(
        "This is an area where the details matter a great deal and mistakes are expensive. Please have a " +
          "licensed Florida family-law attorney review your specific situation.",
      );
    }

    return {
      content: sections.join("\n\n---\n\n"),
      // Only the curated entries' own citations are listed. See
      // groundingCitations() for why, and for why it lives there.
      citations: groundingCitations({ entries: hits, statutes: [] }),
      escalations,
      groundedIn: hits.map((hit) => hit.entry.id),
      source: this.label,
      outOfScope: false,
    };
  }
}
