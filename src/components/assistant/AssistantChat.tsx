"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert, Badge, Button, Card } from "@/components/ui";
import { MAX_QUESTION_LENGTH } from "@/lib/assistantLimits";
import {
  FINANCIAL_SUGGESTED_QUESTIONS,
  type AssistantKind,
} from "@/lib/assistantKinds";
import { GENERAL_SUGGESTED_QUESTIONS } from "@/lib/suggestedQuestions";

import { AnswerBody } from "./AnswerBody";
import { AssistantKindSelector } from "./AssistantKindSelector";

/**
 * Chat panel for the Florida family-law information assistant.
 *
 * The endpoint is stateless, so this component holds the transcript in
 * memory only: nothing is persisted and the transcript is gone on refresh.
 * That is deliberate — questions here carry sensitive family and financial
 * detail, and the least-retention default is to keep none of it.
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
  kind: AssistantKind;
  question: string;
  answer?: AssistantAnswerPayload;
  error?: string;
}

const MAX_HISTORY_MESSAGES = 10;

/** Only warn near the ceiling; a running count on every question is just noise. */
const COUNTER_VISIBLE_FROM = MAX_QUESTION_LENGTH - 2_000;

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [kind, setKind] = useState<AssistantKind>("legal");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const nextTurnIdRef = useRef(0);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, pending]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) {
      return;
    }

    const id = `turn-${(nextTurnIdRef.current += 1)}`;
    const history = turns
      .filter((turn) => turn.kind === kind && turn.answer)
      .flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer?.content ?? "" },
      ])
      .slice(-MAX_HISTORY_MESSAGES);

    setTurns((previous) => [...previous, { id, kind, question: trimmed }]);
    setDraft("");
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, question: trimmed, history }),
      });
      const payload = await response.json();

      setTurns((previous) =>
        previous.map((turn) => {
          if (turn.id !== id) {
            return turn;
          }
          return response.ok && payload?.ok
            ? { ...turn, answer: payload.answer as AssistantAnswerPayload }
            : { ...turn, error: payload?.error?.message ?? "The assistant could not answer just now." };
        }),
      );
    } catch {
      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === id
            ? { ...turn, error: "The assistant could not be reached. Please check your connection and try again." }
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

  const activeTurns = turns.filter((turn) => turn.kind === kind);
  const suggestions =
    kind === "financial_options" ? FINANCIAL_SUGGESTED_QUESTIONS : GENERAL_SUGGESTED_QUESTIONS;

  return (
    <div className="space-y-6">
      <Card padding="md">
        <AssistantKindSelector value={kind} onChange={setKind} disabled={pending} />
      </Card>

      {kind === "legal" ? (
        <Alert variant="attorney" emphasis title="This assistant is not a lawyer" role="note">
          It explains how Florida family law works in general terms. It does not give legal advice, does not create
          an attorney-client relationship, and nothing you type here is protected by attorney-client privilege. It
          cannot tell you what a judge will decide in your case. It also never calculates anything — every dollar
          amount in this app comes from the app&apos;s own deterministic calculators.
        </Alert>
      ) : (
        <Alert variant="attorney" emphasis title="Educational comparison — not a recommendation" role="note">
          This guide compares funding, tax, liquidity, and investment-risk factors using cited CFPB, IRS, and FINRA
          material. It does not recommend or execute a transaction. Confirm taxes with a CPA, loan terms with the
          lender, investments with a fiduciary adviser, and settlement terms with your attorney.
        </Alert>
      )}

      {activeTurns.length === 0 ? (
        <Card padding="md">
          <h2 className="text-base font-semibold text-ink">Not sure where to start?</h2>
          <p className="mt-1 text-sm text-ink-muted">Pick a question, or type your own below.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {suggestions.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => void ask(question)}
                  disabled={pending}
                  className="w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-left text-sm text-ink transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="space-y-6" aria-live="polite">
        {activeTurns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-4 py-3 text-sm text-white">
                {turn.question}
              </p>
            </div>

            {turn.error ? (
              <Alert variant="danger" role="alert">
                {turn.error}
              </Alert>
            ) : null}

            {turn.answer ? (
              <Card padding="md">
                {turn.answer.escalations.map((escalation) => (
                  <Alert
                    key={escalation.topic}
                    variant={escalation.severity === "urgent" ? "danger" : "attorney"}
                    emphasis={escalation.severity === "urgent"}
                    className="mb-4"
                    role={escalation.severity === "urgent" ? "alert" : "note"}
                    title={escalation.severity === "urgent" ? "Please read this first" : "Worth getting help with"}
                  >
                    {escalation.message}
                  </Alert>
                ))}

                <div className="text-sm leading-relaxed text-ink">
                  <AnswerBody content={turn.answer.content} />
                </div>

                {turn.answer.guardrailNote ? (
                  <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                    {turn.answer.guardrailNote}
                  </p>
                ) : null}

                {turn.answer.citations.length > 0 ? (
                  <div className="mt-5 border-t border-border pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Sources</h3>
                    <ul className="mt-2 space-y-1">
                      {turn.answer.citations.map((citation) => (
                        <li key={citation.citation} className="text-xs text-ink-muted">
                          {citation.url ? (
                            <a
                              href={citation.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="underline underline-offset-2 hover:text-ink"
                            >
                              {citation.citation}
                            </a>
                          ) : (
                            <span>{citation.citation}</span>
                          )}
                          {citation.title ? <span> — {citation.title}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="mt-4 flex items-center gap-2 text-xs text-ink-subtle">
                  <Badge tone="neutral">Answered by</Badge>
                  <span>{turn.answer.source}</span>
                </p>
              </Card>
            ) : null}
          </div>
        ))}

        {pending ? (
          <Card padding="md" tone="muted">
            <p className="text-sm text-ink-muted">Looking that up…</p>
          </Card>
        ) : null}

        <div ref={transcriptEndRef} />
      </div>

      <Card padding="md">
        <form onSubmit={handleSubmit}>
          <label htmlFor="assistant-question" className="block text-sm font-medium text-ink">
            {kind === "legal" ? "Ask a question about Florida family law" : "Ask about a financial option"}
          </label>
          <p id="assistant-question-hint" className="mt-1 text-xs text-ink-muted">
            Please leave out names, account numbers, and anything you would not want on a screen. This
            conversation is not saved and disappears when you leave the page.
          </p>
          <textarea
            id="assistant-question"
            aria-describedby="assistant-question-hint"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder={
              kind === "legal"
                ? "For example: how does the length of my marriage affect alimony?"
                : "For example: should I use a HELOC or sell investments for a lump sum?"
            }
            className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-subtle">
              {draft.length >= COUNTER_VISIBLE_FROM
                ? `${draft.length.toLocaleString()} / ${MAX_QUESTION_LENGTH.toLocaleString()} characters`
                : ""}
            </span>
            <Button type="submit" loading={pending} disabled={!draft.trim()}>
              Ask
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
