import { buttonClasses } from "@/components/ui";

/**
 * Shared Tailwind class fragments for the `/documents` experience. All colors
 * come from the semantic design tokens (see `globals.css`), and the buttons
 * delegate to the shared `buttonClasses()` primitive so this feature stays
 * visually consistent with the rest of the app.
 */
export const primaryButtonClasses = buttonClasses("primary", "md");

export const secondaryButtonClasses = buttonClasses("secondary", "md");

export const dangerButtonClasses = buttonClasses("danger", "md");

export const cardClasses =
  "flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm";

export const badgeClasses =
  "inline-flex w-fit items-center rounded-pill border border-warning-border bg-warning-surface px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-warning-text";

export const alertClasses =
  "flex flex-col gap-1 rounded-xl border-2 border-danger-border bg-danger-surface p-4 text-danger-text";

export const successClasses =
  "flex flex-col gap-1 rounded-xl border-2 border-success-border bg-success-surface p-4 text-success-text";

export const fileInputClasses =
  "block w-full cursor-pointer rounded-lg border border-field-border bg-surface text-base text-ink shadow-xs file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-base file:font-semibold file:text-primary-ink hover:file:bg-primary-hover focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-surface";
