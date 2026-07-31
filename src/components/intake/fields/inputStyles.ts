import { buttonClasses } from "@/components/ui";

/**
 * Shared Tailwind class fragments for intake form controls. Centralized so
 * every field looks and behaves the same: >=44px touch target, a clear focus
 * ring, and high-contrast borders/text. All colors come from the semantic
 * design tokens (see `globals.css`) so light/dark mode and any future palette
 * change flow through automatically.
 */
export const textInputClasses =
  "min-h-11 w-full rounded-lg border border-field-border bg-surface px-3.5 py-2.5 text-base text-ink shadow-xs transition-[border-color,box-shadow] placeholder:text-ink-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-surface disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-subtle";

export const selectClasses = textInputClasses;

export const textareaClasses = `${textInputClasses} min-h-24 resize-y`;

export const labelClasses = "block text-base font-semibold text-ink";

export const hintClasses = "text-sm text-ink-muted";

export const errorClasses = "text-sm font-semibold text-danger-solid";

/**
 * Button class strings kept for backwards compatibility with existing
 * imports. They now delegate to the shared `buttonClasses()` primitive so the
 * whole app shares one button definition.
 */
export const primaryButtonClasses = buttonClasses("primary", "md");

export const secondaryButtonClasses = buttonClasses("secondary", "md");

export const dangerLinkClasses = buttonClasses("danger", "sm", "text-danger-text");
