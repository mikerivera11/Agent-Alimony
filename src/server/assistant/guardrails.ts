/**
 * Guardrails for the Florida family-law information assistant.
 *
 * The assistant is deliberately NOT an "AI attorney". These pure functions
 * enforce the boundaries the product depends on, independently of whatever a
 * model returns:
 *
 *  1. Text a person types is untrusted DATA. It can never change the
 *     assistant's instructions, the rules engine, or any formula.
 *  2. The assistant never produces legal figures. Every dollar amount comes
 *     from the deterministic rulesets, never from a language model.
 *  3. Certain disclosures (domestic violence, coercion, hidden assets,
 *     complex business income, special-needs children, jurisdiction
 *     disputes) must escalate to a licensed Florida attorney.
 *
 * Everything here is pure and synchronous so it can be unit-tested and run
 * on both the request and the response side of a model call.
 */

export type EscalationTopic =
  | "domesticViolence"
  | "coercionOrDuress"
  | "hiddenAssets"
  | "complexBusinessIncome"
  | "specialNeedsChild"
  | "jurisdictionDispute"
  | "activeCourtDeadline";

export interface EscalationSignal {
  readonly topic: EscalationTopic;
  /** Plain-language explanation shown to the person. */
  readonly message: string;
  /** Highest-urgency signals are surfaced first and never suppressed. */
  readonly severity: "urgent" | "important";
}

interface EscalationRule {
  readonly topic: EscalationTopic;
  readonly severity: EscalationSignal["severity"];
  readonly patterns: readonly RegExp[];
  readonly message: string;
}

/**
 * Verb stems describing physical harm. Each is matched as a stem plus up to
 * four trailing word characters, which covers the inflections people actually
 * type ("hit"/"hits"/"hitting", "shov[e|es|ed|ing]", "strangl[e|ed|ing]")
 * without needing every form enumerated. Over-matching a word like "hitch" is
 * acceptable: a person or child must also appear nearby, and the cost of a
 * false positive is one extra safety notice.
 */
const VIOLENCE_VERB_STEMS = [
  "hit",
  "hurt",
  "harm",
  "punch",
  "slap",
  "smack",
  "kick",
  "shov",
  "push",
  "beat",
  "grab",
  "chok",
  "strangl",
  "threaten",
  "stalk",
  "attack",
  "assault",
  "bruis",
  "burn",
  "drag",
  "spit",
  "bit",
  "batter",
  "intimidat",
  "terroriz",
  "terroris",
  "threw",
  "thrown",
  "scream",
  "yell",
  "rage",
  "smash",
] as const;

/** Who the harm is directed at. */
const VIOLENCE_OBJECT = "(?:me|my|us|him|her|them|child|children|kids?|baby)";

/** Words describing being in fear. */
const FEAR_TERM = "(?:afraid|scared|unsafe|not safe|fear(?:ful|s|ed)?|terrified|frightened|petrified|walking on eggshells)";

/** Who the fear is about. */
const FEAR_SUBJECT = "(?:husband|wife|spouse|partner|ex|him|her|them|he|she)";

const VIOLENCE_VERB_PATTERN = new RegExp(
  `\\b(?:${VIOLENCE_VERB_STEMS.join("|")})\\w{0,4}\\b.{0,30}\\b${VIOLENCE_OBJECT}\\b`,
  "i",
);

/**
 * Detection is intentionally recall-biased: a false positive shows an extra
 * "talk to a lawyer / here is a hotline" notice, which is harmless. A false
 * negative could leave someone without a safety referral.
 */
const ESCALATION_RULES: readonly EscalationRule[] = [
  {
    topic: "domesticViolence",
    severity: "urgent",
    patterns: [
      /\b(domestic violence|abus(e|ed|es|ive|ing)|batter(y|ed|ing)|assault(ed|ing)?)\b/i,
      VIOLENCE_VERB_PATTERN,
      /\b(restraining|protective)\s+order\b/i,
      /\binjunction\b.{0,40}\b(protection|violence)\b/i,
      // Fear matched in both directions: "scared of my husband" and
      // "my husband ... makes me afraid" are the same disclosure.
      new RegExp(`\\b${FEAR_TERM}\\b.{0,40}\\b${FEAR_SUBJECT}\\b`, "i"),
      new RegExp(`\\b${FEAR_SUBJECT}\\b.{0,40}\\b${FEAR_TERM}\\b`, "i"),
      // Fear of leaving is a safety disclosure even with no subject named.
      new RegExp(`\\b${FEAR_TERM}\\b.{0,20}\\bto leave\\b`, "i"),
    ],
    message:
      "What you described may involve safety or abuse. Your safety comes first. In an emergency call 911. " +
      "The Florida Domestic Violence Hotline is 1-800-500-1119 and the National Domestic Violence Hotline is " +
      "1-800-799-7233. A Florida family-law attorney or a local certified domestic violence center can help you " +
      "ask the court for a protective injunction. This app cannot help with safety planning.",
  },
  {
    topic: "coercionOrDuress",
    severity: "urgent",
    patterns: [
      /\b(forc(ed|ing)|pressur(ed|ing)|coerc(ed|ion|ing)|threaten(ed|ing)?)\b.{0,40}\b(sign|agree|settle|waive)\b/i,
      /\b(sign|agree|settle|waive)\b.{0,40}\b(under (duress|pressure)|against my will|no choice)\b/i,
      /\b(controls?|controlling)\b.{0,30}\b(money|finances|accounts?|bank)\b/i,
    ],
    message:
      "You mentioned pressure to sign or agree to something. An agreement signed under duress or coercion can be " +
      "challenged, but that is a fact-specific legal question. Do not sign anything you are unsure about, and " +
      "speak with a licensed Florida family-law attorney before you do.",
  },
  {
    topic: "hiddenAssets",
    severity: "important",
    patterns: [
      /\b(hid(e|den|ing)|conceal(ed|ing)?|undisclosed|secret)\b.{0,40}\b(asset|account|money|income|property|crypto)\b/i,
      /\b(offshore|shell (company|corp)|crypto(currency)?|bitcoin)\b/i,
      /\b(transferr?(ed|ing)|mov(ed|ing))\b.{0,30}\b(money|assets?|funds?)\b.{0,30}\b(before|prior to)\b/i,
      /\b(dissipat(e|ed|ion)|wast(e|ed)|depleted)\b.{0,30}\b(asset|marital)\b/i,
    ],
    message:
      "Possible hidden, transferred, or dissipated assets need formal discovery — subpoenas, depositions, and " +
      "sometimes a forensic accountant. Florida also treats intentional dissipation of marital assets within " +
      "2 years before filing as a factor in dividing property (Fla. Stat. §61.075(1)(i)). This app only works " +
      "with figures you enter, so its estimates cannot account for assets you cannot see. Talk to a Florida " +
      "family-law attorney.",
  },
  {
    topic: "complexBusinessIncome",
    severity: "important",
    patterns: [
      /\b(owns?|owned|my)\b.{0,20}\b(business|company|practice|llc|s-?corp|corporation|partnership)\b/i,
      /\b(self-?employed|1099 (income|contractor)|k-?1|schedule c)\b/i,
      /\b(goodwill|business valuation|closely held)\b/i,
    ],
    message:
      "Business or self-employment income usually needs a professional valuation. Florida values a marital " +
      "interest in a closely held business at fair market value and treats enterprise goodwill as a marital " +
      "asset (Fla. Stat. §61.075(6)(a)1.f), and income available for support can differ from what a tax return " +
      "shows. This app does not value businesses. A Florida family-law attorney and often a forensic " +
      "accountant or business appraiser should review this.",
  },
  {
    topic: "specialNeedsChild",
    severity: "important",
    patterns: [
      /\b(special needs|disab(led|ility)|autis(m|tic)|iep\b|medically fragile)\b/i,
      /\b(child|kid|son|daughter)\b.{0,40}\b(disab(led|ility)|special needs|therapy|wheelchair)\b/i,
    ],
    message:
      "A child with a disability or significant special needs can change both support and time-sharing. Florida " +
      "directs courts to give special consideration to caring for a child with a mental or physical disability " +
      "(Fla. Stat. §61.08(3)(g)), support may continue past 18 in some circumstances, and extraordinary costs " +
      "may need separate treatment. This app's standard guideline math will not capture that. Please consult a " +
      "Florida family-law attorney.",
  },
  {
    topic: "jurisdictionDispute",
    severity: "important",
    patterns: [
      /\b(differ(ent|s)|another|other)\s+(state|country)\b/i,
      /\b(moved?|relocat(e|ed|ion)|mov(e|ing) (away|out of state))\b/i,
      /\b(military|deployed|deployment)\b/i,
      /\b(lives?|living|resid(es|ing))\b.{0,30}\b(out of state|overseas|abroad|another state)\b/i,
    ],
    message:
      "When a spouse or a child is in another state or country, which court can decide what becomes a real " +
      "question (residency requirements, the UCCJEA for children, and UIFSA for support). Military service adds " +
      "further protections. This app assumes a Florida case and does not analyze jurisdiction. Please confirm " +
      "with a Florida family-law attorney.",
  },
  {
    topic: "activeCourtDeadline",
    severity: "urgent",
    patterns: [
      /\b(hearing|trial|deadline|court date)\b.{0,30}\b(tomorrow|today|this week|monday|tuesday|wednesday|thursday|friday)\b/i,
      /\b(served|summons|default)\b.{0,30}\b(20 days|deadline|respond)\b/i,
      /\b(contempt|order to show cause)\b/i,
    ],
    message:
      "It sounds like you may be facing a court deadline. Missing one can permanently affect your case — in " +
      "Florida a response to a served petition is generally due within 20 days. This app is not a substitute " +
      "for counsel and cannot file anything for you. Contact a Florida family-law attorney immediately, or the " +
      "Florida Bar Lawyer Referral Service at 1-800-342-8011.",
  },
];

/** Scans free text for disclosures that require a human professional. */
export function detectEscalationSignals(text: string): readonly EscalationSignal[] {
  const signals: EscalationSignal[] = [];

  for (const rule of ESCALATION_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      signals.push({ topic: rule.topic, message: rule.message, severity: rule.severity });
    }
  }

  return signals.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "urgent" ? -1 : 1));
}

/**
 * Patterns that indicate someone is trying to override the assistant's
 * instructions, extract its configuration, or make it act as counsel.
 */
const INJECTION_PATTERNS: readonly RegExp[] = [
  /\bignore\b.{0,30}\b(previous|prior|above|earlier|all)\b.{0,20}\b(instruction|prompt|rule|direction)/i,
  /\bdisregard\b.{0,30}\b(previous|prior|above|earlier|all|your)\b.{0,20}\b(instruction|prompt|rule|training)/i,
  /\b(forget|override|bypass|reset)\b.{0,30}\b(instruction|prompt|rule|guardrail|system|restriction)/i,
  /\b(you are|act as|pretend to be|roleplay as|from now on you)\b.{0,40}\b(lawyer|attorney|counsel|judge)\b/i,
  /\b(system|developer)\s*(prompt|message|instruction)/i,
  /\breveal\b.{0,30}\b(prompt|instruction|configuration|system)/i,
  /\b(jailbreak|DAN mode|developer mode)\b/i,
  /\bnew\s+(instruction|rule|directive)s?\s*:/i,
  /<\/?(system|instruction|prompt)>/i,
];

export interface InjectionScanResult {
  readonly detected: boolean;
  readonly matchedPatternCount: number;
}

/**
 * Flags likely prompt-injection attempts. Detection never silently rewrites
 * the person's words; callers decide whether to refuse or to proceed with
 * the text clearly re-framed as untrusted data.
 */
export function scanForPromptInjection(text: string): InjectionScanResult {
  const matchedPatternCount = INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).length;
  return { detected: matchedPatternCount > 0, matchedPatternCount };
}

/**
 * Wraps untrusted text in an explicit data envelope, neutralising any
 * delimiter the person may have typed to imitate system framing.
 */
export function encloseUntrustedText(text: string): string {
  const neutralised = text.replace(/<\/?(system|instruction|prompt|assistant|user)>/gi, "");
  return `<untrusted_user_question>\n${neutralised}\n</untrusted_user_question>`;
}

const CURRENCY_PATTERN = /\$\s?\d[\d,]*(\.\d{2})?/g;

export interface FigureScanResult {
  readonly containsCurrency: boolean;
  readonly currencyMentions: readonly string[];
}

/**
 * Detects dollar figures in assistant output. Any hit is a guardrail
 * violation: every dollar amount the product shows must come from the
 * deterministic rulesets, so callers replace offending output rather than
 * displaying it.
 */
export function scanForCalculatedFigures(text: string): FigureScanResult {
  const currencyMentions = text.match(CURRENCY_PATTERN) ?? [];
  return { containsCurrency: currencyMentions.length > 0, currencyMentions };
}

/** Shown wherever the assistant is available. Not legal advice, not privileged. */
export const ASSISTANT_DISCLAIMER =
  "This assistant gives general legal information about Florida family law. It is not a lawyer, does not give " +
  "legal advice, and does not create an attorney-client relationship. Nothing you type here is protected by " +
  "attorney-client privilege. It cannot tell you what a judge will do in your case. Every dollar figure in this " +
  "app comes from the app's own deterministic calculators, never from the assistant.";
