import type { ProposedFieldValue } from "@/server/extraction";

/**
 * Coerces a user-typed edit string back toward the original value's type
 * where reasonable (e.g. keeps a numeric field numeric), falling back to a
 * plain string. Pure and side-effect free so it's directly unit-testable.
 */
export function coerceEditedValue(original: ProposedFieldValue, editedText: string): ProposedFieldValue {
  if (typeof original === "number") {
    const parsed = Number(editedText);
    return Number.isFinite(parsed) && editedText.trim() !== "" ? parsed : editedText;
  }
  if (typeof original === "boolean") {
    if (editedText.trim().toLowerCase() === "true") return true;
    if (editedText.trim().toLowerCase() === "false") return false;
    return editedText;
  }
  return editedText;
}

/** Renders any allowed proposed value as plain display text. */
export function formatProposedValue(value: ProposedFieldValue): string {
  if (value === null) {
    return "(none)";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val === null ? "(none)" : String(val)}`)
      .join(", ");
  }
  return String(value);
}
