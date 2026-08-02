/**
 * Removes every trace of a case from this browser.
 *
 * This exists because of what happens on a shared or public computer. The
 * draft is mirrored to `localStorage` so typing never waits on the network —
 * but that means signing out has to clear it too. Revoking the server session
 * alone leaves the previous person's income, assets, and debts sitting on
 * screen for whoever sits down next, and, worse, lets those answers get saved
 * into the *next* person's account when they sign in.
 *
 * The sweep is by **prefix**, not an enumerated list of keys. A list would be
 * correct on the day it was written and quietly wrong the first time someone
 * adds a new key without remembering this file — and the cost of that mistake
 * is disclosing somebody's divorce finances to a stranger. Resetting a layout
 * preference along the way is a trivial price for a rule that cannot drift.
 */

export const LOCAL_DATA_PREFIX = "florida-support-guide";

export function clearLocalCaseData(): void {
  if (typeof window === "undefined") return;

  try {
    const storage = window.localStorage;
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(LOCAL_DATA_PREFIX)) doomed.push(key);
    }
    // Collected first: removing while iterating shifts the indices.
    for (const key of doomed) storage.removeItem(key);
  } catch {
    // Private browsing or a disabled store. There is nothing to clear in that
    // case, because there was nothing persisted to begin with.
  }
}
