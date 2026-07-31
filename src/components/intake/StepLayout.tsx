"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { SectionAssistant } from "@/components/assistant";
import type { IntakeStepId } from "@/domain/intake";

interface StepLayoutProps {
  stepId: IntakeStepId;
  title: string;
  summary: string;
  whyWeAsk: string;
  children: ReactNode;
}

/**
 * Chrome shared by every wizard topic: an auto-focused heading (so keyboard
 * and screen-reader users land on the new topic immediately after
 * navigating), a one-line summary, an always-visible "why we ask" box, and an
 * inline assistant for questions about this specific topic.
 * Mount this with a `key` that changes per step so the heading re-focuses on
 * every topic change.
 */
export function StepLayout({ stepId, title, summary, whyWeAsk, children }: StepLayoutProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="animate-step-in flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-ink outline-none sm:text-3xl">
          {title}
        </h1>
        <p className="text-lg text-ink-muted">{summary}</p>
      </div>
      <p className="rounded-xl border border-info-border bg-info-surface px-4 py-3 text-sm text-info-text">
        <span className="font-semibold">Why we ask: </span>
        {whyWeAsk}
      </p>
      <SectionAssistant stepId={stepId} followsPage />
      {children}
    </div>
  );
}
