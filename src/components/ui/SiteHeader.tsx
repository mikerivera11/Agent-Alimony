import Link from "next/link";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account";

import { Container } from "./Container";

/** Small brand mark — a stylized set of balance scales. Decorative only. */
function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 flex-none items-center justify-center rounded-lg bg-primary text-primary-ink shadow-sm"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M12 3v16M6 20h12M4 8h16M8 8l-3 6a3 3 0 0 0 6 0L8 8Zm8 0l-3 6a3 3 0 0 0 6 0l-3-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

interface SiteHeaderProps {
  /** When true, the wordmark is a back-link to the landing page. */
  backToHome?: boolean;
  /** Right-aligned actions (e.g. the Quick exit control). */
  actions?: ReactNode;
  /**
   * Hides the sign-in control. Used on pages about privacy and safety, where
   * an invitation to create an account would cut against what the page is
   * telling the reader.
   */
  hideAccountMenu?: boolean;
}

/**
 * Sticky, translucent app header used across every screen. Keeps the product
 * wordmark on the left and a slot for safety/navigation actions on the right.
 */
export function SiteHeader({ backToHome = false, actions, hideAccountMenu = false }: SiteHeaderProps) {
  const wordmark = (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="text-base font-semibold tracking-tight text-ink">
        {backToHome ? "← Florida Support Guide" : "Florida Support Guide"}
      </span>
    </span>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <Container
        width="wide"
        className="flex flex-wrap items-center justify-between gap-3 py-3"
      >
        {backToHome ? (
          <Link
            href="/"
            className="rounded-lg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {wordmark}
          </Link>
        ) : (
          wordmark
        )}
        <span className="flex items-center gap-3">
          {hideAccountMenu ? null : <AccountMenu />}
          {actions}
        </span>
      </Container>
    </header>
  );
}
