"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { INTAKE_ASSISTANT_TOPICS, INTAKE_STEPS, type IntakeStepId } from "@/domain/intake";
import { MAX_QUESTION_LENGTH } from "@/lib/assistantLimits";

import { AnswerBody } from "./AnswerBody";

/**
 * Inline "ask about this section" helper, mounted on every intake topic.
 *
 * Someone filling in a financial form gets stuck *at a specific question* —
 * "does my bonus count as income?" — and making them leave the form to find
 * out is how drafts get abandoned. This puts the same grounded assistant next
 * to the fields it explains, and tells the server which section the question
 * came from so retrieval starts in the right part of Florida law.
 *
 * It shares the standalone assistant's endpoint, guardrails, and disclaimer
 * rather than reimplementing any of them: this is a second doorway to one
 * assistant, not a second assistant. Like the standalone chat it keeps its
 * transcript in memory only — nothing here is persisted.
 */

interface AssistantCitation {
  citation: string;
  title?: string;
  url?: string;
}

interface AssistantEscalation {
  topic: string;
  message: string;
  severity: "urgent" | "important";
}

interface AssistantAnswerPayload {
  content: string;
  citations: AssistantCitation[];
  escalations: AssistantEscalation[];
  source: string;
  outOfScope: boolean;
  guardrailNote?: string;
}

interface Turn {
  id: string;
  question: string;
  answer?: AssistantAnswerPayload;
  error?: string;
}

/** Prior turns sent back for context. Kept short — this is a focused side question, not a long thread. */
const MAX_HISTORY_MESSAGES = 6;

interface SectionAssistantProps {
  stepId: IntakeStepId;
}

export function SectionAssistant({ stepId }: SectionAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const nextTurnIdRef = useRef(0);
  const panelId = useId();

  const topic = INTAKE_ASSISTANT_TOPICS[stepId];
  const sectionTitle = INTAKE_STEPS[stepId].title;

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    const id = `turn-${(nextTurnIdRef.current += 1)}`;
    const history = turns
      .filter((turn) => turn.answer)
      .flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer?.content ?? "" },
      ])
      .slice(-MAX_HISTORY_MESSAGES);

    setTurns((previous) => [...previous, { id, question: trimmed }]);
    setDraft("");
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed, history, topic: stepId }),
      });
      const payload = await response.json();

      setTurns((previous) =>
        previous.map((turn) => {
          if (turn.id !== id) return turn;
          return response.ok && payload?.ok
            ? { ...turn, answer: payload.answer as AssistantAnswerPayload }
            : { ...turn, error: payload?.error?.message ?? "The assistant could not answer just now." };
        }),
      );
    } catch {
      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === id
            ? { ...turn, error: "The assistant could not be reached. Check your connection and try again." }
            : turn,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="rounded-xl border border-border bg-surface-2" data-testid={`section-assistant-${stepId}`}>
      <h3>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span aria-hidden="true">💬</span>
            Have a question about {sectionTitle.toLowerCase()}?
          </span>
          <span aria-hidden="true" className="text-sm text-ink-muted">
            {isOpen ? "Hide" : "Ask"}
          </span>
        </button>
      </h3>

      {isOpen ? (
        <div id={panelId} className="flex flex-col gap-4 border-t border-border px-4 py-4">
          <p className="text-xs text-ink-muted">
            Answers explain Florida law in general terms using this app&apos;s cited sources. This is not legal
            advice and never calculates your figures — every dollar amount comes from the app&apos;s own
            deterministic calculators.
          </p>

          {turns.length === 0 ? (
            <ul className="flex flex-col gap-2">
              {topic.suggestedQuestions.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => void ask(question)}
                    disabled={pending}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-4" aria-live="polite">
            {turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-2">
                <p className="rounded-lg bg-surface-hover px-3 py-2 text-sm font-medium text-ink">{turn.question}</p>

                {turn.error ? (
                  <p role="alert" className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-text">
                    {turn.error}
                  </p>
                ) : null}

                {turn.answer ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-ink">
                    {turn.answer.escalations.map((escalation) => (
                      <p
                        key={escalation.topic}
                        role="note"
                        className="rounded-lg border border-attorney-border bg-attorney-surface px-3 py-2 text-sm text-attorney-text"
                      >
                        {escalation.message}
                      </p>
                    ))}

                    <AnswerBody content={turn.answer.content} />

                    {turn.answer.citations.length > 0 ? (
                      <ul className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-ink-muted">
                        {turn.answer.citations.map((citation) => (
                          <li key={citation.citation}>
                            {citation.url ? (
                              <a
                                href={citation.url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2 hover:text-ink"
                              >
                                {citation.citation}
                              </a>
                            ) : (
                              citation.citation
                            )}
                            {citation.title ? ` — ${citation.title}` : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <p className="text-xs text-ink-subtle">Answered by {turn.answer.source}</p>
                  </div>
                ) : null}
              </div>
            ))}

            {pending ? (
              <p role="status" className="text-sm text-ink-muted">
                Looking that up…
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask a question about {sectionTitle}
            </label>
            <textarea
              id={`${panelId}-input`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_QUESTION_LENGTH}
              rows={2}
              placeholder={`Ask anything about ${sectionTitle.toLowerCase()}…`}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pending || draft.trim().length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
              >
                {pending ? "Asking…" : "Ask"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
