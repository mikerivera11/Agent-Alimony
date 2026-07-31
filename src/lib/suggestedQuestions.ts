/**
 * Starter questions offered when the assistant has no section to scope to.
 *
 * Shared by the standalone assistant page and the side dock so both offer the
 * same entry points. Each of these is covered by a test asserting it actually
 * retrieves grounded material — nothing is suggested that the assistant would
 * then decline to answer.
 */
export const GENERAL_SUGGESTED_QUESTIONS = [
  "What kinds of alimony can a Florida court award?",
  "How does the length of my marriage affect alimony?",
  "How is child support calculated in Florida?",
  "How is property divided in a Florida divorce?",
  "Can I pay alimony as a lump sum instead of monthly?",
  "What financial documents do I have to provide?",
] as const;
