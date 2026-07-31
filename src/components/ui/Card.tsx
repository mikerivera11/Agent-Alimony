import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type CardPadding = "none" | "sm" | "md" | "lg";
type CardTone = "default" | "muted";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  padding?: CardPadding;
  tone?: CardTone;
  /** Adds a subtle hover lift — use only for interactive cards. */
  interactive?: boolean;
  children: ReactNode;
}

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

const TONE: Record<CardTone, string> = {
  default: "bg-surface",
  muted: "bg-surface-2",
};

/**
 * A surface container: rounded, bordered, softly shadowed. The default
 * building block for grouping content into a modern "panel".
 */
export function Card({
  as: Tag = "div",
  padding = "md",
  tone = "default",
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-border shadow-sm",
        TONE[tone],
        PADDING[padding],
        interactive &&
          "transition-shadow duration-150 hover:shadow-md focus-within:shadow-md",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
