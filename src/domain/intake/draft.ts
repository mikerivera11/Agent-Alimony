import type {
  AlimonyFactors,
  AssetsDebts,
  CaseBasics,
  ChildCosts,
  Children,
  Deductions,
  DocumentReadiness,
  FilingDetails,
  HouseholdExpenses,
  Income,
  Marriage,
  ParentingPlan,
  ParentingTime,
  SafetyComplexity,
  Spouses,
} from "./schema";

/**
 * The full intake draft, keyed by topic. Every topic's data is stored as a
 * `Partial<...>` because a person can save and leave at any point — we only
 * require complete, valid data for a topic once they try to move past it (or
 * when we build the missing-data summary on the review screen).
 */
export interface IntakeDraftData {
  caseBasics: Partial<CaseBasics>;
  marriage: Partial<Marriage>;
  spouses: Partial<Spouses>;
  children: Partial<Children>;
  parentingTime: Partial<ParentingTime>;
  parentingPlan: Partial<ParentingPlan>;
  income: Partial<Income>;
  deductions: Partial<Deductions>;
  childCosts: Partial<ChildCosts>;
  householdExpenses: Partial<HouseholdExpenses>;
  assetsDebts: Partial<AssetsDebts>;
  alimonyFactors: Partial<AlimonyFactors>;
  safetyComplexity: Partial<SafetyComplexity>;
  documentReadiness: Partial<DocumentReadiness>;
  filingDetails: Partial<FilingDetails>;
}

export type IntakeStepId = keyof IntakeDraftData;

/** Every screen the wizard can sit on, including the two non-topic screens. */
export type IntakeScreenId = IntakeStepId | "review" | "done";

export interface IntakeDraft {
  /** Random id generated on first save, used only as a local storage key/version anchor. */
  draftId: string;
  createdAt: string;
  /**
   * When an *answer* last changed. Navigation deliberately does not touch
   * this: `/results` compares it against the reviewed snapshot's `reviewedAt`
   * to decide whether the estimate on screen still matches the answers, and
   * merely walking back through the wizard must not make results look stale.
   */
  updatedAt: string;
  /** Topics the person has actively confirmed via "Save and continue". */
  completedStepIds: IntakeStepId[];
  /**
   * Where the person was last looking, so returning later (or coming back
   * from `/results` to change something) resumes in place instead of
   * restarting at the first topic. Optional so drafts saved before this
   * existed still load.
   */
  lastScreenId?: IntakeScreenId;
  data: IntakeDraftData;
}

export const EMPTY_INTAKE_DRAFT_DATA: IntakeDraftData = {
  caseBasics: {},
  marriage: {},
  spouses: {},
  children: { children: [] },
  parentingTime: {},
  parentingPlan: {},
  income: {},
  deductions: {},
  childCosts: {},
  householdExpenses: {},
  assetsDebts: {},
  alimonyFactors: {},
  safetyComplexity: {},
  documentReadiness: {},
  filingDetails: {},
};

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyDraft(): IntakeDraft {
  const now = new Date().toISOString();
  return {
    draftId: generateId(),
    createdAt: now,
    updatedAt: now,
    completedStepIds: [],
    data: structuredCloneDraftData(EMPTY_INTAKE_DRAFT_DATA),
  };
}

export function structuredCloneDraftData(data: IntakeDraftData): IntakeDraftData {
  return JSON.parse(JSON.stringify(data)) as IntakeDraftData;
}

/**
 * Fills in any step a stored draft predates.
 *
 * Drafts are persisted as plain JSON and read back with a cast, so a draft
 * saved before a step existed comes back missing that key entirely — and
 * every screen that reaches for `data[stepId]` gets `undefined`. That is not
 * hypothetical: adding the filing-details step made `/intake?step=review`
 * throw "Cannot convert undefined or null to object" for anyone with a draft
 * saved before it, because the review screen maps over the step list and calls
 * `Object.entries` on each one.
 *
 * Normalising on the way in fixes the whole class rather than that one step,
 * so the next step added does not reintroduce it. Stored answers always win;
 * this only supplies keys that are absent.
 */
export function normalizeDraftData(data: Partial<IntakeDraftData> | undefined): IntakeDraftData {
  const base = structuredCloneDraftData(EMPTY_INTAKE_DRAFT_DATA);
  if (!data) return base;
  // Keyed access over a union of step shapes is not sound to assign through,
  // so the merge happens once as a record. This is a boundary between JSON of
  // unknown vintage and the current shape, which is exactly where a cast
  // belongs.
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(data)) {
    if (key in base && value !== undefined && value !== null) {
      merged[key] = value;
    }
  }
  return merged as unknown as IntakeDraftData;
}

/** Same, for a whole draft envelope. */
export function normalizeDraft(draft: IntakeDraft): IntakeDraft {
  return { ...draft, data: normalizeDraftData(draft.data) };
}
