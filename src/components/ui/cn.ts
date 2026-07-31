export type ClassValue = string | number | false | null | undefined;

/**
 * Tiny className joiner. Filters out falsy values and joins the rest with a
 * space. Intentionally dependency-free — our primitives keep base and variant
 * classes non-conflicting, so consumer `className` overrides are additive
 * (spacing, width, alignment) rather than needing Tailwind-aware merging.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
