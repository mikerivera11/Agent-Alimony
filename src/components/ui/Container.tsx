import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type ContainerWidth = "prose" | "default" | "wide";

interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  width?: ContainerWidth;
  children: ReactNode;
}

const WIDTHS: Record<ContainerWidth, string> = {
  // ~65ch reading measure for long-form legal/privacy copy.
  prose: "max-w-2xl",
  default: "max-w-3xl",
  wide: "max-w-5xl",
};

/** Centered, padded content column with a sensible reading measure. */
export function Container({
  as: Tag = "div",
  width = "default",
  className,
  children,
  ...rest
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-4 sm:px-6", WIDTHS[width], className)} {...rest}>
      {children}
    </Tag>
  );
}
