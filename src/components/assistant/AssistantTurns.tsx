"use client";

import { AnswerBody } from "./AnswerBody";
import type { AssistantTurn } from "./useAssistantConversation";

interface AssistantTurnsProps {
  turns: readonly AssistantTurn[];
  pending: boolean;
}

/**
 * Renders a transcript. Every answer shows its citations and which adapter
 * produced it, because a user needs to be able to check the law themselves —
 * that verifiability is the point of the assistant, not decoration.
 */
export function AssistantTurns({ turns, pending }: AssistantTurnsProps) {
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {turns.map((turn) => (
        <div key={turn.id} className="flex flex-col gap-2">
          <p className="self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm font-medium text-primary-ink">
            {turn.question}
          </p>

          {turn.error ? (
            <p
              role="alert"
              className="rounded-lg border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-text"
            >
              {turn.error}
            </p>
          ) : null}

          {turn.answer ? (
            <div
              data-testid="assistant-answer"
              className="flex flex-col gap-3 rounded-2xl rounded-bl-sm border border-border bg-surface px-3 py-3 text-sm text-ink"
            >
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
  );
}
