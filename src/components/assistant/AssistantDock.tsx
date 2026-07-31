"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";

import { INTAKE_ASSISTANT_TOPICS, INTAKE_STEPS } from "@/domain/intake";
import { MAX_QUESTION_LENGTH } from "@/lib/assistantLimits";
import { GENERAL_SUGGESTED_QUESTIONS } from "@/lib/suggestedQuestions";

import { QuickExitLink } from "@/components/intake/QuickExitLink";

import { AssistantTurns } from "./AssistantTurns";
import { useAssistantDock } from "./AssistantDockContext";
import { useAssistantConversation } from "./useAssistantConversation";

/**
 * Persistent side panel for asking questions about whatever is on screen.
 *
 * Someone filling in a financial form gets stuck *at a specific question* —
 * "does my bonus count as income?" — and making them leave the form to find
 * out is how drafts get abandoned. The panel stays available on every page and
 * keeps its transcript while you move between sections, so a follow-up doesn't
 * mean starting over.
 *
 * It shares the standalone assistant's endpoint, guardrails, and disclaimer
 * rather than reimplementing any of them: this is another doorway to one
 * assistant, not a second assistant.
 */
/**
 * Pages that already lead with the assistant, or that come before the user has
 * consented to anything. A floating "ask me" button on the landing page would
 * invite questions before the privacy and scope notices have been read, and on
 * the standalone assistant page it would just duplicate the page itself.
 */
const SUPPRESSED_PATHS = new Set(["/", "/assistant"]);

export function AssistantDock() {
  const pathname = usePathname();
  const { isOpen, topic, open, close, clearTopic } = useAssistantDock();
  const panelId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  // Read at send time so switching sections mid-thread scopes the next
  // question to where you actually are.
  const topicRef = useRef(topic);
  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);
  const getTopic = useCallback(() => topicRef.current, []);

  const { turns, pending, ask, reset } = useAssistantConversation(getTopic);

  const suppressed = SUPPRESSED_PATHS.has(pathname ?? "");

  const sectionTitle = topic ? INTAKE_STEPS[topic].title : undefined;
  const suggestions = topic
    ? INTAKE_ASSISTANT_TOPICS[topic].suggestedQuestions
    : GENERAL_SUGGESTED_QUESTIONS;

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        launcherRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, [turns, pending]);

  // Inset the page while the panel is open so the sticky header — and the
  // Quick exit control in it — stays visible rather than sitting underneath.
  useEffect(() => {
    const shouldInset = isOpen && !suppressed;
    document.body.classList.toggle("assistant-dock-open", shouldInset);
    return () => document.body.classList.remove("assistant-dock-open");
  }, [isOpen, suppressed]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft;
    setDraft("");
    void ask(question);
  }

  if (suppressed) return null;

  return (
    <>
      {!isOpen ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => open()}
          data-testid="assistant-dock-launcher"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-ink shadow-lg transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true">💬</span>
          Ask a question
        </button>
      ) : null}

      <aside
        id={panelId}
        role="complementary"
        aria-label="Florida family law assistant"
        data-testid="assistant-dock"
        hidden={!isOpen}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col border-l border-border bg-surface-2 shadow-2xl sm:max-w-md"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-ink">Ask about this page</h2>
            <p className="text-xs text-ink-muted">Florida family law, in plain language</p>
          </div>
          <div className="flex flex-none items-center gap-2">
            {/* Full-screen on small viewports, so the page's own Quick exit is
                hidden behind the panel — carry one here instead. */}
            <span className="sm:hidden">
              <QuickExitLink />
            </span>
            {turns.length > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                close();
                launcherRef.current?.focus();
              }}
              aria-label="Close the assistant"
              className="rounded-lg px-2 py-1 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              ✕
            </button>
          </div>
        </div>

        {sectionTitle ? (
          <div className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2">
            <p className="text-xs text-ink-muted">
              Answering about <span className="font-semibold text-ink">{sectionTitle}</span>
            </p>
            <button
              type="button"
              onClick={clearTopic}
              className="flex-none rounded-lg px-2 py-1 text-xs text-ink-muted underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Ask about anything instead
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs text-ink-muted">
            Answers explain Florida law in general terms using this app&apos;s cited sources. This is not legal
            advice and never calculates your figures — every dollar amount comes from the app&apos;s own
            deterministic calculators.
          </p>

          {turns.length === 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {suggestions.map((question) => (
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
          ) : (
            <div className="mt-4">
              <AssistantTurns turns={turns} pending={pending} />
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border px-4 py-3">
          <label htmlFor={`${panelId}-input`} className="sr-only">
            {sectionTitle ? `Ask a question about ${sectionTitle}` : "Ask a question about Florida family law"}
          </label>
          <textarea
            ref={inputRef}
            id={`${panelId}-input`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const question = draft;
                setDraft("");
                void ask(question);
              }
            }}
            maxLength={MAX_QUESTION_LENGTH}
            rows={2}
            placeholder={
              sectionTitle ? `Ask about ${sectionTitle.toLowerCase()}…` : "Ask about Florida alimony, support, or property…"
            }
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink-subtle">Enter to send</span>
            <button
              type="submit"
              disabled={pending || draft.trim().length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
            >
              {pending ? "Asking…" : "Ask"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
