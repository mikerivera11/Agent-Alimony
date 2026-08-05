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
