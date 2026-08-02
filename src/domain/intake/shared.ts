import { z } from "zod";

/**
 * Shared, reusable Zod building blocks for the Florida alimony intake wizard.
 * Kept intentionally small and plain so every step schema reads the same way.
 */

/** YYYY-MM-DD string that matches the native <input type="date"> format. */
export const isoDateSchema = z
  .string()
  .trim()
  .min(1, "Enter a date")
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use the date picker or type a date as YYYY-MM-DD",
  })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Enter a real date",
  });

export const optionalIsoDateSchema = z
  .union([isoDateSchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

/** A non-negative dollar amount. Blank fields are treated as $0. */
export const moneySchema = z.coerce
  .number({ message: "Enter a number, or 0 if none" })
  .nonnegative("Enter 0 or a positive amount")
  .max(100_000_000, "That amount looks too large — double-check it");

/**
 * A money field added after drafts were already in the wild.
 *
 * Drafts are stored as raw JSON in the browser and are never migrated, so a
 * draft saved before a field existed simply has no key for it. `moneySchema`
 * coerces `undefined` to `NaN` and rejects it, which would silently mark a
 * completed step incomplete and — worse — risk `NaN` reaching a money sum.
 * Defaulting to 0 keeps old drafts valid and keeps the arithmetic total.
 */
export const addedMoneySchema = moneySchema.default(0);

/** Whole-number count, such as overnights per year. Blank is treated as 0. */
export const countSchema = z.coerce
  .number({ message: "Enter a whole number, or 0 if none" })
  .int("Enter a whole number")
  .nonnegative("Enter 0 or a positive number");

export const yesNoSchema = z.enum(["yes", "no"], {
  message: "Choose yes or no",
});

export const shortTextSchema = z.string().trim().max(500, "Keep this under 500 characters");

export const requiredShortTextSchema = shortTextSchema.min(1, "This field is required");

export const longTextSchema = z.string().trim().max(2000, "Keep this under 2,000 characters");

export type YesNo = z.infer<typeof yesNoSchema>;
