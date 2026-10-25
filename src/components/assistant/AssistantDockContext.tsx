"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { IntakeStepId } from "@/domain/intake";
import type { AssistantCaseContext } from "@/lib/assistantCaseContext";

interface AssistantDockValue {
  isOpen: boolean;
  /** Section the next question will be scoped to, if any. */
  topic: IntakeStepId | undefined;
  caseContext: AssistantCaseContext | undefined;
  open: (topic?: IntakeStepId) => void;
  openCaseContext: (context: AssistantCaseContext) => void;
  close: () => void;
  clearTopic: () => void;
  clearCaseContext: () => void;
  /**
   * Declares which section the page is currently showing, so opening the dock
   * from the launcher is scoped the same way as opening it from that section.
   */
  setPageTopic: (topic: IntakeStepId | undefined) => void;
}

const AssistantDockContext = createContext<AssistantDockValue | null>(null);

export function AssistantDockProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [topic, setTopic] = useState<IntakeStepId | undefined>(undefined);
  const [caseContext, setCaseContext] = useState<AssistantCaseContext | undefined>(undefined);

  const open = useCallback((next?: IntakeStepId) => {
    setCaseContext(undefined);
    if (next) setTopic(next);
    setIsOpen(true);
  }, []);

  const openCaseContext = useCallback((context: AssistantCaseContext) => {
    setTopic(undefined);
    setCaseContext(context);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);
  const clearTopic = useCallback(() => setTopic(undefined), []);
  const clearCaseContext = useCallback(() => setCaseContext(undefined), []);

  const setPageTopic = useCallback((next: IntakeStepId | undefined) => {
    // Only follows the page while the section is on screen. Leaving the intake
    // entirely drops the scope rather than answering a question asked from the
    // results page as though it came from whatever section was open last.
    setTopic(next);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      topic,
      caseContext,
      open,
      openCaseContext,
      close,
      clearTopic,
      clearCaseContext,
      setPageTopic,
    }),
    [isOpen, topic, caseContext, open, openCaseContext, close, clearTopic, clearCaseContext, setPageTopic],
  );

  return <AssistantDockContext.Provider value={value}>{children}</AssistantDockContext.Provider>;
}

export function useAssistantDock(): AssistantDockValue {
  const value = useOptionalAssistantDock();
  if (!value) {
    throw new Error("useAssistantDock must be used inside an AssistantDockProvider.");
  }
  return value;
}

export function useOptionalAssistantDock(): AssistantDockValue | null {
  return useContext(AssistantDockContext);
}

/**
 * Scopes the dock to a section for as long as that section is on screen.
 * Used by the guided wizard, where exactly one step is visible at a time.
 */
export function useRegisterAssistantTopic(topic: IntakeStepId | undefined, enabled = true) {
  const { setPageTopic } = useAssistantDock();

  useEffect(() => {
    if (!enabled) return;
    setPageTopic(topic);
    return () => setPageTopic(undefined);
  }, [topic, enabled, setPageTopic]);
}
