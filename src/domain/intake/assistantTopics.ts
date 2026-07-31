import type { IntakeStepId } from "./draft";

/**
 * Connects each intake topic to the Florida material that explains it.
 *
 * This exists so someone stuck on a section can ask a question *in place* and
 * get an answer grounded in the same statutes the calculations use, instead of
 * abandoning the form to go hunting.
 *
 * Two deliberate constraints:
 *
 * 1. `knowledgeEntryIds` and `keywords` only *bias retrieval* toward the right
 *    part of the curated knowledge base. They never become instructions to a
 *    model, and they cannot introduce legal content of their own — the
 *    substance still comes from the knowledge base entry.
 * 2. The topic travelling from browser to server is a fixed step id from this
 *    map, not free text. There is therefore no path for a person's typing to
 *    steer grounding, which keeps the untrusted-input boundary intact.
 */
export interface IntakeAssistantTopic {
  /** Knowledge base entries most likely to answer questions about this topic. */
  readonly knowledgeEntryIds: readonly string[];
  /**
   * Chapter 61 sections that govern this topic. Like `knowledgeEntryIds`,
   * these only re-rank statutory chunks the question already matched; they
   * cannot lift an irrelevant chunk over the relevance threshold.
   */
  readonly statuteSections: readonly string[];
  /** Extra terms that bias retrieval toward this topic's subject matter. */
  readonly keywords: readonly string[];
  /** Plain-language starters, so the box is useful before anyone knows what to ask. */
  readonly suggestedQuestions: readonly string[];
}

export const INTAKE_ASSISTANT_TOPICS: Record<IntakeStepId, IntakeAssistantTopic> = {
  caseBasics: {
    knowledgeEntryIds: ["app-scope", "financial-disclosure"],
    statuteSections: ["61.052", "61.046"],
    keywords: ["florida", "filing", "county", "jurisdiction", "dissolution"],
    suggestedQuestions: [
      "What can this app help me estimate, and what can't it do?",
      "What can this app do, and what can it not do?",
      "Do I have to live in Florida to file for divorce here?",
    ],
  },
  marriage: {
    knowledgeEntryIds: ["alimony-marriage-length", "alimony-forms"],
    statuteSections: ["61.08", "61.046"],
    keywords: ["marriage", "length of marriage", "short-term", "moderate-term", "long-term", "duration"],
    suggestedQuestions: [
      "How does the length of my marriage affect alimony?",
      "What counts as a short-term, moderate-term, or long-term marriage in Florida?",
      "Which dates does Florida use to measure how long we were married?",
    ],
  },
  spouses: {
    knowledgeEntryIds: ["alimony-factors", "alimony-forms"],
    statuteSections: ["61.08"],
    keywords: ["need", "ability to pay", "standard of living", "age", "health", "earning capacity"],
    suggestedQuestions: [
      "What does Florida mean by 'need' and 'ability to pay'?",
      "Does my spouse's health or age affect alimony?",
      "What if one of us has been out of the workforce?",
    ],
  },
  children: {
    knowledgeEntryIds: ["child-support-which-children", "child-support-basics"],
    statuteSections: ["61.30", "61.13", "61.046"],
    keywords: ["children", "child support", "minor child", "guidelines"],
    suggestedQuestions: [
      "How does Florida calculate child support?",
      "Do I include children from another marriage or relationship?",
      "Until what age is child support usually owed in Florida?",
      "Does child support change if we have more than one child?",
    ],
  },
  parentingTime: {
    knowledgeEntryIds: ["child-support-overnights", "child-support-basics"],
    statuteSections: ["61.13", "61.30", "61.046"],
    keywords: ["overnights", "time-sharing", "timesharing", "parenting plan", "substantial", "gross-up"],
    suggestedQuestions: [
      "How do overnights change the child support amount?",
      "What is the 20% substantial time-sharing threshold?",
      "How do I count overnights if our schedule changes seasonally?",
    ],
  },
  income: {
    knowledgeEntryIds: ["child-support-basics", "alimony-factors", "financial-disclosure"],
    statuteSections: ["61.30"],
    keywords: ["gross income", "income", "wages", "bonus", "self-employment", "imputed income"],
    suggestedQuestions: [
      "What counts as gross income under Florida law?",
      "How is self-employment or business income treated?",
      "What happens if someone is voluntarily unemployed or underemployed?",
    ],
  },
  deductions: {
    knowledgeEntryIds: ["child-support-basics", "child-support-which-children", "financial-disclosure"],
    statuteSections: ["61.30"],
    keywords: ["deductions", "allowable deductions", "net income", "taxes", "withholding"],
    suggestedQuestions: [
      "Which deductions does Florida allow when figuring net income?",
      "Are my taxes deducted before child support is calculated?",
      "Do union dues or mandatory retirement contributions count?",
    ],
  },
  childCosts: {
    knowledgeEntryIds: ["child-support-basics", "child-support-overnights"],
    statuteSections: ["61.30", "61.13"],
    keywords: ["childcare", "child care", "health insurance", "extraordinary", "medical"],
    suggestedQuestions: [
      "How are childcare costs shared between parents?",
      "How is the children's health insurance premium handled?",
      "How are the children's health insurance and uninsured medical costs handled?",
    ],
  },
  householdExpenses: {
    knowledgeEntryIds: ["alimony-factors", "financial-disclosure"],
    statuteSections: ["61.08", "61.30"],
    keywords: ["expenses", "household", "standard of living", "budget", "financial affidavit"],
    suggestedQuestions: [
      "Why do my monthly household expenses matter for alimony?",
      "What does 'standard of living during the marriage' mean?",
      "Do these expenses go on the Florida financial affidavit?",
    ],
  },
  assetsDebts: {
    knowledgeEntryIds: ["equitable-distribution", "retirement-accounts", "lump-sum"],
    statuteSections: ["61.075", "61.077"],
    keywords: [
      "assets",
      "debts",
      "equitable distribution",
      "marital",
      "nonmarital",
      "separate property",
      "commingled",
      "home equity",
      "401k",
      "retirement",
    ],
    suggestedQuestions: [
      "What makes an asset marital versus nonmarital in Florida?",
      "What happens if I had savings before the marriage but mixed it with joint money?",
      "How are retirement accounts like a 401(k) divided?",
    ],
  },
  alimonyFactors: {
    knowledgeEntryIds: ["alimony-factors", "alimony-forms", "alimony-amount-cap", "lump-sum"],
    statuteSections: ["61.08"],
    keywords: ["alimony", "spousal support", "durational", "bridge-the-gap", "rehabilitative", "factors"],
    suggestedQuestions: [
      "What factors does Florida consider when awarding alimony?",
      "What are the different types of alimony in Florida?",
      "Could a lump-sum payment work instead of monthly alimony?",
    ],
  },
  safetyComplexity: {
    knowledgeEntryIds: ["app-scope"],
    statuteSections: ["61.13", "61.052"],
    keywords: ["safety", "domestic violence", "hidden assets", "special needs", "attorney"],
    suggestedQuestions: [
      "When should I stop and talk to a Florida attorney?",
      "What kinds of situations mean I really need a lawyer?",
      "What if I think my spouse is hiding assets?",
    ],
  },
  documentReadiness: {
    knowledgeEntryIds: ["financial-disclosure", "alimony-forms"],
    statuteSections: ["61.30", "61.08"],
    keywords: ["documents", "disclosure", "financial affidavit", "tax return", "pay stub", "mandatory disclosure"],
    suggestedQuestions: [
      "Which documents does Florida require for financial disclosure?",
      "What is a Florida financial affidavit?",
      "How many months of pay stubs and bank statements do I need?",
    ],
  },
};

/** The step ids the assistant accepts as a grounding topic. */
export const INTAKE_ASSISTANT_TOPIC_IDS = Object.keys(INTAKE_ASSISTANT_TOPICS) as readonly IntakeStepId[];

export function isIntakeAssistantTopicId(value: unknown): value is IntakeStepId {
  return typeof value === "string" && value in INTAKE_ASSISTANT_TOPICS;
}
