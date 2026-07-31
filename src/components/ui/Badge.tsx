import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const TONES: Record<BadgeTone, string> = {
  neutral: "border-border-strong bg-surface-2 text-ink-muted",
  brand: "border-primary-border bg-primary-surface text-info-text",
  info: "border-info-border bg-info-surface text-info-text",
  success: "border-success-border bg-success-surface text-success-text",
  warning: "border-warning-border bg-warning-surface text-warning-text",
  danger: "border-danger-border bg-danger-surface text-danger-text",
};

/** A compact status/label pill. */
export function Badge({ tone = "neutral", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
