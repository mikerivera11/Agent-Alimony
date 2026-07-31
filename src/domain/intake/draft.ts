import type {
  AlimonyFactors,
  AssetsDebts,
  CaseBasics,
  ChildCosts,
  Children,
  Deductions,
  DocumentReadiness,
  HouseholdExpenses,
  Income,
  Marriage,
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
  income: Partial<Income>;
  deductions: Partial<Deductions>;
  childCosts: Partial<ChildCosts>;
  householdExpenses: Partial<HouseholdExpenses>;
  assetsDebts: Partial<AssetsDebts>;
  alimonyFactors: Partial<AlimonyFactors>;
  safetyComplexity: Partial<SafetyComplexity>;
  documentReadiness: Partial<DocumentReadiness>;
}

export type IntakeStepId = keyof IntakeDraftData;

export interface IntakeDraft {
  /** Random id generated on first save, used only as a local storage key/version anchor. */
  draftId: string;
  createdAt: string;
  updatedAt: string;
  /** True only for the built-in fictional example draft — never real user data. */
  isDemo: boolean;
  /** Topics the person has actively confirmed via "Save and continue". */
  completedStepIds: IntakeStepId[];
  data: IntakeDraftData;
}

export const EMPTY_INTAKE_DRAFT_DATA: IntakeDraftData = {
  caseBasics: {},
  marriage: {},
  spouses: {},
  children: { children: [] },
  parentingTime: {},
  income: {},
  deductions: {},
  childCosts: {},
  householdExpenses: {},
  assetsDebts: {},
  alimonyFactors: {},
  safetyComplexity: {},
  documentReadiness: {},
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
    isDemo: false,
    completedStepIds: [],
    data: structuredCloneDraftData(EMPTY_INTAKE_DRAFT_DATA),
  };
}

export function structuredCloneDraftData(data: IntakeDraftData): IntakeDraftData {
  return JSON.parse(JSON.stringify(data)) as IntakeDraftData;
}
