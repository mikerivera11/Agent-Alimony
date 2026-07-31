/**
 * How someone prefers to work through the intake. Both modes ask the same
 * questions against the same schemas and end at the same review screen — this
 * is purely a presentation choice.
 */
export type IntakeMode = "guided" | "allAtOnce";

export const INTAKE_MODES: readonly IntakeMode[] = ["guided", "allAtOnce"];

export const DEFAULT_INTAKE_MODE: IntakeMode = "guided";

export function isIntakeMode(value: unknown): value is IntakeMode {
  return value === "guided" || value === "allAtOnce";
}

const MODE_STORAGE_KEY = "florida-support-guide.intake-mode.v1";

/**
 * Remembers the chosen mode so someone who picked one long page doesn't get
 * dropped back into the step-by-step guide on their next visit.
 *
 * Only the preference is stored, never any answer, so this stays outside the
 * draft and is not cleared by "start over" — the person's working style
 * shouldn't reset just because their answers did.
 */
export function loadIntakeMode(): IntakeMode {
  try {
    if (typeof window === "undefined") return DEFAULT_INTAKE_MODE;
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    return isIntakeMode(raw) ? raw : DEFAULT_INTAKE_MODE;
  } catch {
    return DEFAULT_INTAKE_MODE;
  }
}

export function saveIntakeMode(mode: IntakeMode): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Private browsing or a full quota. The choice still applies for this
    // session; it just won't survive a reload.
  }
}

/*
 * The preference lives in localStorage, which React treats as an external
 * store. Exposing it through useSyncExternalStore rather than reading it in an
 * effect avoids both a hydration mismatch (the server cannot know the choice)
 * and the cascading re-render that setting state from an effect causes.
 */

const listeners = new Set<() => void>();
let cachedMode: IntakeMode | null = null;

export function subscribeIntakeMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cached so repeated renders don't re-read localStorage and break snapshot identity. */
export function getIntakeModeSnapshot(): IntakeMode {
  cachedMode ??= loadIntakeMode();
  return cachedMode;
}

/** The server has no access to the preference, so it always renders the default. */
export function getIntakeModeServerSnapshot(): IntakeMode {
  return DEFAULT_INTAKE_MODE;
}

export function setIntakeMode(mode: IntakeMode): void {
  cachedMode = mode;
  saveIntakeMode(mode);
  for (const listener of listeners) {
    listener();
  }
}

/** Test-only: drops the cached snapshot so each test starts clean. */
export function resetIntakeModeCache(): void {
  cachedMode = null;
}

