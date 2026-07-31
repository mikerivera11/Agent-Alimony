import type { ComponentType } from "react";

import type { IntakeStepId } from "@/domain/intake";

import {
  AlimonyFactorsFields,
  AssetsDebtsFields,
  CaseBasicsFields,
  ChildCostsFields,
  ChildrenFields,
  DeductionsFields,
  DocumentReadinessFields,
  HouseholdExpensesFields,
  IncomeFields,
  MarriageFields,
  ParentingTimeFields,
  SafetyComplexityFields,
  SpousesFields,
  type StepFieldsProps,
} from "./steps";

/**
 * Maps each topic id to the component that renders its fields. Each
 * component is typed against its own topic's data shape (see `steps/*`), so
 * this registry necessarily erases those individual types to a common shape
 * — the Wizard is what supplies matching `register`/`errors`/`control` for
 * whichever topic is active.
 */
export const STEP_FIELD_COMPONENTS: Record<
  IntakeStepId,
  ComponentType<StepFieldsProps<Record<string, unknown>>>
> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous per-topic field shapes
  caseBasics: CaseBasicsFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marriage: MarriageFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spouses: SpousesFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: ChildrenFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentingTime: ParentingTimeFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  income: IncomeFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deductions: DeductionsFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  childCosts: ChildCostsFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  householdExpenses: HouseholdExpensesFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assetsDebts: AssetsDebtsFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alimonyFactors: AlimonyFactorsFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  safetyComplexity: SafetyComplexityFields as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documentReadiness: DocumentReadinessFields as any,
};
