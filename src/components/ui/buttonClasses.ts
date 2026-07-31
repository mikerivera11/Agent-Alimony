import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Shared base + variant classes for anything that should look like a button.
 * Exposed as a function (not just a component) so Next.js `<Link>` and native
 * `<a>` elements can adopt the exact same styling by passing the result to
 * `className` — keeping a single source of truth for every clickable control.
 *
 * All controls keep a >=44px touch target and a visible focus ring for
 * accessibility.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-ink shadow-sm hover:bg-primary-hover active:bg-primary-hover disabled:opacity-55",
  secondary:
    "border border-border-strong bg-surface text-ink shadow-xs hover:bg-surface-hover disabled:opacity-55",
  ghost: "text-primary hover:bg-primary-surface disabled:opacity-55",
  danger:
    "border-2 border-danger-border bg-danger-surface text-danger-text shadow-xs hover:brightness-[0.97] disabled:opacity-55",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 min-w-11 px-4 py-2 text-sm",
  md: "min-h-11 min-w-11 px-5 py-2.5 text-base",
  lg: "min-h-12 px-6 py-3 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}
