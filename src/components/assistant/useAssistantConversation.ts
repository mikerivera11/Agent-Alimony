"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { IntakeStepId } from "@/domain/intake";
import type { AssistantKind } from "@/lib/assistantKinds";

export interface AssistantCitation {
  citation: string;
  title?: string;
  url?: string;
}

export interface AssistantEscalation {
  topic: string;
  message: string;
  severity: "urgent" | "important";
}

export interface AssistantAnswerPayload {
  content: string;
  citations: AssistantCitation[];
  escalations: AssistantEscalation[];
  source: string;
  outOfScope: boolean;
  guardrailNote?: string;
}

export interface AssistantTurn {
  id: string;
  kind: AssistantKind;
  question: string;
  answer?: AssistantAnswerPayload;
  error?: string;
}

/** Prior turns sent back for context. Kept short — these are focused side questions, not a long thread. */
const MAX_HISTORY_MESSAGES = 6;

/**
 * Conversation state for the assistant, shared by every surface that offers
 * it. The transcript lives in memory only and is never persisted: questions
 * here routinely contain financial and family details, and the least-retention
 * default is to keep none of it.
 *
 * The topic is read at send time rather than captured when the conversation
 * starts, so moving to another section mid-thread scopes the *next* question
 * correctly instead of silently answering from the section you have left.
 */
export function useAssistantConversation(getTopic: () => IntakeStepId | undefined, kind: AssistantKind) {
  const [allTurns, setAllTurns] = useState<AssistantTurn[]>([]);
  const [pending, setPending] = useState(false);
  const nextTurnIdRef = useRef(0);
  // Mirrored into a ref so `ask` can read the latest transcript without being
  // recreated on every turn. Written in an effect rather than during render,
  // which React forbids.
  const turnsRef = useRef<AssistantTurn[]>([]);
  useEffect(() => {
    turnsRef.current = allTurns;
  }, [allTurns]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      const id = `turn-${(nextTurnIdRef.current += 1)}`;
      const history = turnsRef.current
        .filter((turn) => turn.kind === kind && turn.answer)
        .flatMap((turn) => [
          { role: "user" as const, content: turn.question },
          { role: "assistant" as const, content: turn.answer?.content ?? "" },
        ])
        .slice(-MAX_HISTORY_MESSAGES);

      setAllTurns((previous) => [...previous, { id, kind, question: trimmed }]);
      setPending(true);

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            question: trimmed,
            history,
            topic: kind === "legal" ? getTopic() : undefined,
          }),
        });
        const payload = await response.json();

        setAllTurns((previous) =>
          previous.map((turn) => {
            if (turn.id !== id) return turn;
            return response.ok && payload?.ok
              ? { ...turn, answer: payload.answer as AssistantAnswerPayload }
              : { ...turn, error: payload?.error?.message ?? "The assistant could not answer just now." };
          }),
        );
      } catch {
        setAllTurns((previous) =>
          previous.map((turn) =>
            turn.id === id
              ? { ...turn, error: "The assistant could not be reached. Check your connection and try again." }
              : turn,
          ),
        );
      } finally {
        setPending(false);
      }
    },
    [getTopic, kind, pending],
  );

  const reset = useCallback(() => {
    setAllTurns((previous) => previous.filter((turn) => turn.kind !== kind));
  }, [kind]);

  return { turns: allTurns.filter((turn) => turn.kind === kind), pending, ask, reset };
}
