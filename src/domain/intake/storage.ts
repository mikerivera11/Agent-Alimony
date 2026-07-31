import type { IntakeDraft } from "./draft";

/**
 * Storage contract for the intake draft. Every method is async so a future
 * server-backed implementation (saving to an account instead of a browser)
 * can drop in without changing any calling code. For now the only
 * implementation is browser `localStorage` — nothing is sent to a server.
 */
export interface IntakeDraftStorage {
  load(): Promise<IntakeDraft | null>;
  save(draft: IntakeDraft): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = "florida-support-guide.intake-draft.v1";

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Persists the draft to the browser's localStorage only. There is no
 * server-side account, so a draft only exists on the device and browser
 * profile it was created in — clearing site data or switching devices loses
 * it.
 */
export function createLocalStorageIntakeDraftStorage(
  storageKey: string = STORAGE_KEY,
): IntakeDraftStorage {
  return {
    async load() {
      if (!isBrowserStorageAvailable()) {
        return null;
      }
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          return null;
        }
        return JSON.parse(raw) as IntakeDraft;
      } catch {
        return null;
      }
    },
    async save(draft: IntakeDraft) {
      if (!isBrowserStorageAvailable()) {
        return;
      }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        // Storage can fail (private browsing, quota, etc). The wizard keeps
        // working in memory for the rest of the session; we just can't
        // persist across reloads.
      }
    },
    async clear() {
      if (!isBrowserStorageAvailable()) {
        return;
      }
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore — nothing more we can safely do here.
      }
    },
  };
}

/** In-memory storage used for tests and as a safe fallback when localStorage is unavailable. */
export function createInMemoryIntakeDraftStorage(): IntakeDraftStorage {
  let current: IntakeDraft | null = null;
  return {
    async load() {
      return current;
    },
    async save(draft: IntakeDraft) {
      current = draft;
    },
    async clear() {
      current = null;
    },
  };
}
