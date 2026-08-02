import type { IntakeDraft } from "./draft";
import { clearLocalCaseData } from "./localData";
import { createLocalStorageIntakeDraftStorage, type IntakeDraftStorage } from "./storage";

/**
 * Draft storage that keeps the browser copy and a server-saved copy in step.
 *
 * The browser copy stays authoritative for *responsiveness*: every keystroke
 * still lands in localStorage immediately, so the wizard never waits on the
 * network and still works if the server is unreachable. The server copy is
 * what makes the draft outlive this browser — a different device, a cleared
 * cache, a new laptop — and what version history is built on.
 *
 * Saving to the server is best-effort by design. A failed sync must never
 * lose or block what the person is typing, so failures are surfaced through a
 * status callback for the UI to report rather than thrown at the caller.
 *
 * Every save appends a revision server-side, which is deliberate: the point of
 * the feature is being able to go back to how things were, and that is only
 * possible if the intermediate states were actually recorded.
 */

const CASE_POINTER_KEY = "florida-support-guide.case-pointer.v1";
const LOCAL_OWNER_KEY = "florida-support-guide.local-owner.v1";

export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "conflict";

interface CasePointer {
  caseId: string;
  revision: number;
}

function readPointer(): CasePointer | null {
  try {
    const raw = window.localStorage.getItem(CASE_POINTER_KEY);
    return raw ? (JSON.parse(raw) as CasePointer) : null;
  } catch {
    return null;
  }
}

function writePointer(pointer: CasePointer | null): void {
  try {
    if (pointer) {
      window.localStorage.setItem(CASE_POINTER_KEY, JSON.stringify(pointer));
    } else {
      window.localStorage.removeItem(CASE_POINTER_KEY);
    }
  } catch {
    // Losing the pointer costs a duplicate case at worst, never data.
  }
}

/**
 * Drops the local mirror when it belongs to somebody else.
 *
 * On a shared computer the browser copy outlives the session, so without this
 * the next person to sign in would be shown the previous person's income,
 * assets, and debts — and would then save them into their own account.
 *
 * The one transition that must *not* clear anything is anonymous -> signed in.
 * That is somebody signing in to keep the draft they were already working on,
 * and the server has just claimed it for their account.
 */
async function reconcileLocalOwner(doFetch: typeof fetch): Promise<boolean> {
  let current: string | null = null;
  try {
    const response = await doFetch("/api/auth/session", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return false;
    const body = await json<{ userId?: string | null }>(response);
    current = body?.userId ?? null;
  } catch {
    // Unknown identity. Clearing on a guess would destroy someone's work
    // during a network blip, so the local copy is left alone.
    return false;
  }

  let previous: string | null | undefined;
  try {
    const raw = window.localStorage.getItem(LOCAL_OWNER_KEY);
    previous = raw === null ? undefined : (JSON.parse(raw) as string | null);
  } catch {
    previous = undefined;
  }

  const firstRun = previous === undefined;
  const claimingAnonymousDraft = previous === null && current !== null;
  const sameOwner = previous === current;

  const belongsToSomeoneElse = !firstRun && !claimingAnonymousDraft && !sameOwner;
  if (belongsToSomeoneElse) {
    clearLocalCaseData();
  }

  try {
    window.localStorage.setItem(LOCAL_OWNER_KEY, JSON.stringify(current));
  } catch {
    // Not being able to record the owner only costs this check next time.
  }

  return belongsToSomeoneElse;
}

async function json<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export interface SyncedStorageOptions {
  local?: IntakeDraftStorage;
  onStatusChange?: (status: SyncStatus) => void;
  fetchImpl?: typeof fetch;
}

export function createSyncedIntakeDraftStorage(
  options: SyncedStorageOptions = {},
): IntakeDraftStorage {
  const local = options.local ?? createLocalStorageIntakeDraftStorage();
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const report = options.onStatusChange ?? (() => {});

  // Saves are serialised through this chain. Concurrent PUTs would race on
  // `expectedRevision` and produce spurious conflicts against ourselves.
  let queue: Promise<void> = Promise.resolve();

  async function pushToServer(draft: IntakeDraft): Promise<void> {
    const pointer = readPointer();
    report("saving");

    try {
      if (!pointer) {
        const response = await doFetch("/api/cases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draft }),
        });
        if (!response.ok) {
          report("offline");
          return;
        }
        const created = await json<{ id: string; revision: number }>(response);
        if (created) writePointer({ caseId: created.id, revision: created.revision });
        report("saved");
        return;
      }

      const response = await doFetch(`/api/cases/${pointer.caseId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft, expectedRevision: pointer.revision }),
      });

      if (response.status === 409) {
        // Another tab or device advanced the case. Adopting its revision and
        // reporting the conflict is safer than overwriting: the person is told
        // rather than silently losing whichever copy lost the race.
        const conflict = await json<{ revision?: number }>(response);
        if (typeof conflict?.revision === "number") {
          writePointer({ caseId: pointer.caseId, revision: conflict.revision });
        }
        report("conflict");
        return;
      }

      if (response.status === 404) {
        // The case is gone (signed out, revoked, deleted). Forget the pointer
        // so the next save starts a fresh one instead of failing forever.
        writePointer(null);
        report("offline");
        return;
      }

      if (!response.ok) {
        report("offline");
        return;
      }

      const saved = await json<{ revision?: number }>(response);
      if (typeof saved?.revision === "number") {
        writePointer({ caseId: pointer.caseId, revision: saved.revision });
      }
      report("saved");
    } catch {
      // Network failure. The local copy already holds everything typed.
      report("offline");
    }
  }

  return {
    async load() {
      if (await reconcileLocalOwner(doFetch)) {
        // The mirror belonged to a different person. Everything below must
        // start from the server, never from what is left on this device.
        await local.clear();
      }
      const localDraft = await local.load();

      try {
        const response = await doFetch("/api/cases", { headers: { accept: "application/json" } });
        if (!response.ok) return localDraft;

        const body = await json<{ cases?: { id: string; revision: number }[] }>(response);
        const newest = body?.cases?.[0];
        if (!newest) return localDraft;

        const detail = await doFetch(`/api/cases/${newest.id}`);
        if (!detail.ok) return localDraft;

        const record = await json<{ draft?: IntakeDraft; revision?: number }>(detail);
        if (!record?.draft || typeof record.revision !== "number") return localDraft;

        writePointer({ caseId: newest.id, revision: record.revision });

        // An empty server draft must not clobber real local answers — that is
        // the shape a freshly created account has, and it would be a terrible
        // first impression to wipe someone's work by signing in.
        if (Object.keys(record.draft as object).length === 0) return localDraft;

        await local.save(record.draft);
        return record.draft;
      } catch {
        return localDraft;
      }
    },

    async save(draft: IntakeDraft) {
      await local.save(draft);
      queue = queue.then(() => pushToServer(draft)).catch(() => {});
      // Not awaited: typing must never wait on the network.
    },

    async clear() {
      await local.clear();
      writePointer(null);
    },
  };
}
