"use client";

import { INTAKE_STEPS, type IntakeStepId } from "@/domain/intake";

import { useAssistantDock, useRegisterAssistantTopic } from "./AssistantDockContext";

interface SectionAssistantProps {
  stepId: IntakeStepId;
  /**
   * True when this section is the only one on screen (the guided wizard), so
   * the dock can follow the page. The one-page layout renders every section at
   * once, where "the current section" is meaningless — there, scope is set by
   * clicking this button.
   */
  followsPage?: boolean;
}

/**
 * Per-section entry point into the assistant.
 *
 * People get stuck at a specific question — "does my bonus count as income?" —
 * so the offer to explain has to sit next to the fields it explains. This used
 * to expand into its own chat panel, which meant a second, separate
 * conversation on every section. It now opens the side dock already scoped to
 * this section, so there is one thread that follows you through the form.
 */
export function SectionAssistant({ stepId, followsPage = false }: SectionAssistantProps) {
  const { open } = useAssistantDock();
  const sectionTitle = INTAKE_STEPS[stepId].title;

  useRegisterAssistantTopic(stepId, followsPage);

  return (
    <div className="rounded-xl border border-border bg-surface-2" data-testid={`section-assistant-${stepId}`}>
      <button
        type="button"
        onClick={() => open(stepId)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span aria-hidden="true">💬</span>
          Have a question about {sectionTitle.toLowerCase()}?
        </span>
        <span aria-hidden="true" className="flex-none text-sm font-medium text-primary">
          Ask
        </span>
      </button>
    </div>
  );
}
