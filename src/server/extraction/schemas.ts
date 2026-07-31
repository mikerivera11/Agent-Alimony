import { z } from "zod";

/**
 * Zod schemas for untrusted, adapter-proposed field values. These describe
 * data an extraction adapter (mock or configured) is allowed to emit — never
 * business logic, never a "confirmed" status, and never a rule selection.
 * Field keys are constrained to plain dotted identifiers so a malicious or
 * malfunctioning document/adapter cannot smuggle anything but inert data.
 */

export const extractionProposalStatusSchema = z.enum(["proposed", "confirmed", "rejected"]);
export type ExtractionProposalStatus = z.infer<typeof extractionProposalStatusSchema>;

export const extractionRunStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "not_processed",
]);
export type ExtractionRunStatus = z.infer<typeof extractionRunStatusSchema>;

/** A proposed value is always an inert JSON primitive or a shallow record of primitives — never executable content. */
export const proposedFieldValueSchema: z.ZodType<
  string | number | boolean | null | Record<string, string | number | boolean | null>
> = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()])),
]);
export type ProposedFieldValue = z.infer<typeof proposedFieldValueSchema>;

export const sourceLocationSchema = z
  .object({
    page: z.number().int().positive().optional(),
    boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();
export type SourceLocation = z.infer<typeof sourceLocationSchema>;

/** A dotted, alphanumeric identifier only — never free text, never a rule/selector expression. */
const fieldKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/, {
    message: "fieldKey must be a plain dotted identifier (e.g. participant.grossMonthlyIncome).",
  });

/**
 * Shape an extraction adapter is allowed to emit for a single proposed field.
 * Deliberately has NO `status` property — adapters cannot propose a status;
 * the persistence layer always inserts new rows as `status: "proposed"`.
 */
export const adapterProposedFieldSchema = z
  .object({
    fieldKey: fieldKeySchema,
    value: proposedFieldValueSchema,
    sourceDocumentId: z.string().uuid(),
    sourcePage: z.number().int().positive().optional(),
    sourceLocation: sourceLocationSchema.optional(),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type AdapterProposedField = z.infer<typeof adapterProposedFieldSchema>;

/**
 * Full result contract every `ExtractionAdapter.run()` must satisfy. The
 * refinement forbids smuggling proposals under any status other than
 * "completed" — a "not_processed" or "failed" result must carry zero
 * proposals.
 */
export const adapterRunResultSchema = z
  .object({
    status: extractionRunStatusSchema,
    isDemo: z.boolean(),
    proposals: z.array(adapterProposedFieldSchema).max(200),
    errorMessage: z.string().max(1000).optional(),
  })
  .strict()
  .refine((result) => result.status === "completed" || result.proposals.length === 0, {
    message: "Only a 'completed' result may carry proposals.",
    path: ["proposals"],
  });
export type AdapterRunResult = z.infer<typeof adapterRunResultSchema>;

/**
 * Full persisted shape (DB row), used to validate data read back out of
 * storage before it is ever mapped into calculation facts (defense in
 * depth alongside the database's own enum/type constraints).
 */
export const extractionProposalRecordSchema = z.object({
  id: z.string().uuid(),
  extractionRunId: z.string().uuid(),
  caseId: z.string().uuid(),
  fieldKey: fieldKeySchema,
  value: proposedFieldValueSchema,
  confirmedValue: proposedFieldValueSchema.nullable(),
  sourceDocumentId: z.string().uuid(),
  sourcePage: z.number().int().positive().nullable(),
  sourceLocation: sourceLocationSchema.nullable(),
  /** Postgres `numeric` columns are returned as strings by the driver; coerce defensively. */
  confidence: z.coerce.number().min(0).max(1),
  status: extractionProposalStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  confirmedAt: z.date().nullable(),
});
export type ExtractionProposalRecord = z.infer<typeof extractionProposalRecordSchema>;
