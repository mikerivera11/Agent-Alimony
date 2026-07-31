import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type AlertVariant = "info" | "warning" | "danger" | "success" | "attorney";

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  /** Optional bold lead line rendered above the body. */
  title?: ReactNode;
  /** Use the heavier 2px border for high-priority safety/legal notices. */
  emphasis?: boolean;
  /** Hide the leading status icon when a notice reads better without it. */
  hideIcon?: boolean;
  children?: ReactNode;
}

const SURFACE: Record<AlertVariant, string> = {
  info: "border-info-border bg-info-surface text-info-text",
  warning: "border-warning-border bg-warning-surface text-warning-text",
  danger: "border-danger-border bg-danger-surface text-danger-text",
  success: "border-success-border bg-success-surface text-success-text",
  attorney: "border-attorney-border bg-attorney-surface text-attorney-text",
};

const ICON: Record<AlertVariant, string> = {
  info: "ℹ",
  warning: "▲",
  danger: "✕",
  success: "✓",
  attorney: "§",
};

/**
 * A tinted, bordered callout for information, warnings, errors, success, and
 * "talk to an attorney" notices. Pass an explicit `role` (e.g. "alert",
 * "status", "note") so assistive technology announces it appropriately.
 */
export function Alert({
  variant = "info",
  title,
  emphasis = false,
  hideIcon = false,
  className,
  children,
  ...rest
}: AlertProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl p-4 sm:p-5",
        emphasis ? "border-2" : "border",
        SURFACE[variant],
        className,
      )}
      {...rest}
    >
      {hideIcon ? null : (
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full text-xs font-bold"
        >
          {ICON[variant]}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
