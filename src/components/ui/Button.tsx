import type { ButtonHTMLAttributes, ReactNode } from "react";

import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonClasses";
import { cn } from "./cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and marks the control busy while keeping its label. */
  loading?: boolean;
  children: ReactNode;
}

/**
 * The primary interactive control. Variants: primary / secondary / ghost /
 * danger. Sizes: sm / md / lg. When `loading` is true the button is disabled,
 * announces `aria-busy`, and shows a spinner — but keeps its visible label so
 * its accessible name never changes mid-flight.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size), className)}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 motion-safe:animate-spin"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
