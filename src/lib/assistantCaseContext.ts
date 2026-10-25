import { z } from "zod";

const formulaValueSchema = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);

const formulaStepSchema = z.object({
  stepId: z.string().min(1).max(100),
  description: z.string().min(1).max(1_000),
  citation: z.string().max(250).optional(),
  values: z
    .record(z.string().max(100), formulaValueSchema)
    .refine((values) => Object.keys(values).length <= 30, "A formula step can contain at most 30 values"),
});

const citationSchema = z.object({
  citation: z.string().min(1).max(250),
  title: z.string().max(500).optional(),
  url: z.string().url().startsWith("https://").max(2_000).optional(),
});

/**
 * Minimal, read-only calculation data the assistant may explain.
 *
 * This deliberately excludes names, addresses, uploaded text, and the mutable
 * intake draft. Every figure is copied from the deterministic rules outcome.
 */
export const assistantCaseContextSchema = z.object({
  kind: z.literal("child_support_calculation"),
  rulesetId: z.string().min(1).max(100),
  monthlyTransferAmountCents: z.number().int().nonnegative(),
  obligorParent: z.enum(["Parent 1", "Parent 2", "No transfer"]),
  combinedNetMonthlyIncomeCents: z.number().int().nonnegative(),
  totalMinimumChildSupportNeedCents: z.number().int().nonnegative(),
  substantialTimeSharingApplied: z.boolean(),
  formulaTrace: z.array(formulaStepSchema).min(1).max(20),
  citations: z.array(citationSchema).max(20),
  assumptions: z.array(z.string().min(1).max(1_000)).max(20),
});

export type AssistantCaseContext = z.infer<typeof assistantCaseContextSchema>;
