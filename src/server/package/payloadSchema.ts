import { z } from "zod";

import {
  alimonyFactorsSchema,
  assetsDebtsSchema,
  caseBasicsSchema,
  childCostsSchema,
  childrenSchema,
  deductionsSchema,
  documentReadinessSchema,
  filingDetailsSchema,
  householdExpensesSchema,
  incomeSchema,
  marriageSchema,
  parentingPlanSchema,
  parentingTimeSchema,
  safetyComplexitySchema,
  spousesSchema,
} from "@/domain/intake";

/**
 * Strict validation schema for the POST /api/package request body.
 *
 * Deliberately mirrors the exact shape of `ReviewedIntakeDraft` using the
 * same Zod schemas the intake wizard itself validates each topic against —
 * every leaf value is a bounded number, a bounded/whitelisted string, or an
 * enum. There is no field anywhere in this schema that accepts arbitrary
 * markup/HTML, and the outer envelope is `.strict()` so no additional,
 * unexpected top-level keys (e.g. a client-supplied "precomputed result")
 * can be smuggled in. The server never trusts a client-computed outcome —
 * it always re-derives the view model from this validated topic data.
 */
export const packageRequestSchema = z
  .object({
    reviewedDraft: z
      .object({
        draftId: z.string().trim().min(1).max(200),
        reviewedAt: z.string().trim().min(1).max(100),
        data: z
          .object({
            caseBasics: caseBasicsSchema,
            marriage: marriageSchema,
            spouses: spousesSchema,
            children: childrenSchema,
            parentingTime: parentingTimeSchema.optional(),
            parentingPlan: parentingPlanSchema.optional(),
            income: incomeSchema,
            deductions: deductionsSchema,
            childCosts: childCostsSchema.optional(),
            householdExpenses: householdExpensesSchema,
            assetsDebts: assetsDebtsSchema,
            alimonyFactors: alimonyFactorsSchema,
            safetyComplexity: safetyComplexitySchema,
            documentReadiness: documentReadinessSchema,
            filingDetails: filingDetailsSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type PackageRequest = z.infer<typeof packageRequestSchema>;
