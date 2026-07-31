import type { ReviewedIntakeDraft } from "@/domain/intake";

/**
 * Storage contract for handing a fully-reviewed intake snapshot off to the
 * results/package experience. Mirrors the shape of the intake wizard's own
 * draft storage (browser `localStorage` only, nothing sent to a server) so
 * the two features behave consistently, but is intentionally a separate key
 * and a separate module: a "reviewed" snapshot is an immutable, validated
 * point-in-time copy, not the mutable in-progress wizard draft.
 */
export interface ReviewedSnapshotStorage {
  load(): Promise<ReviewedIntakeDraft | null>;
  save(snapshot: ReviewedIntakeDraft): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = "florida-support-guide.reviewed.v1";

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Persists the reviewed snapshot to the browser's `localStorage` only.
 *
 * Integration step for the intake team: once `buildReviewedDraft(draft)`
 * succeeds (i.e. after `isDraftReadyForReview` is true and the person
 * confirms their review), call
 * `createLocalStorageReviewedSnapshotStorage().save(reviewedDraft)` so the
 * `/results` page can find it under this exact key.
 */
export function createLocalStorageReviewedSnapshotStorage(
  storageKey: string = STORAGE_KEY,
): ReviewedSnapshotStorage {
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
        return JSON.parse(raw) as ReviewedIntakeDraft;
      } catch {
        return null;
      }
    },
    async save(snapshot: ReviewedIntakeDraft) {
      if (!isBrowserStorageAvailable()) {
        return;
      }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        // Storage can fail (private browsing, quota, etc). The caller's UI
        // keeps working for the rest of the session; we just can't persist
        // the snapshot across reloads/navigation.
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
export function createInMemoryReviewedSnapshotStorage(): ReviewedSnapshotStorage {
  let current: ReviewedIntakeDraft | null = null;
  return {
    async load() {
      return current;
    },
    async save(snapshot: ReviewedIntakeDraft) {
      current = snapshot;
    },
    async clear() {
      current = null;
    },
  };
}
