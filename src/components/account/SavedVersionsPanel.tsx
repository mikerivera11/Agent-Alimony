"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Button, Card } from "@/components/ui";

/**
 * Saved-versions list with restore.
 *
 * Restoring is presented as "bring this back" rather than "undo", because the
 * server never deletes anything: the older answers are saved forward as a new
 * version, so the current state is still in the history afterwards. The copy
 * says so, since a person about to click on their own financial data should
 * not have to guess whether it is destructive.
 */

interface RevisionSummary {
  id: string;
  revision: number;
  restoredFromRevision: number | null;
  createdAt: string;
}

const CASE_POINTER_KEY = "florida-support-guide.case-pointer.v1";

function readCaseId(): string | null {
  try {
    const raw = window.localStorage.getItem(CASE_POINTER_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { caseId?: string }).caseId ?? null;
  } catch {
    return null;
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SavedVersionsPanel() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [busyRevision, setBusyRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/cases/${id}/revisions`);
      if (!response.ok) {
        setRevisions([]);
        return;
      }
      const body = (await response.json()) as { revisions: RevisionSummary[] };
      setRevisions(body.revisions);
    } catch {
      setError("Couldn't load your saved versions. Your answers on this device are unaffected.");
    }
  }, []);

  useEffect(() => {
    // The pointer lives in localStorage, which is only readable once mounted.
    // Reading it in an async step keeps the first render free of state writes.
    let cancelled = false;
    void (async () => {
      const id = readCaseId();
      if (cancelled) return;
      setCaseId(id);
      if (id) await refresh(id);
      else setRevisions([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const restore = useCallback(
    async (revision: number) => {
      if (!caseId) return;
      setBusyRevision(revision);
      setError(null);
      try {
        const response = await fetch(`/api/cases/${caseId}/revisions/${revision}/restore`, {
          method: "POST",
        });
        if (!response.ok) {
          setError("That version couldn't be restored. Nothing was changed.");
          return;
        }
        // The wizard reads its draft on mount, so a reload is the honest way to
        // show the restored answers everywhere at once rather than leaving
        // parts of the page showing what was on screen a moment ago.
        window.location.reload();
      } catch {
        setError("That version couldn't be restored. Nothing was changed.");
      } finally {
        setBusyRevision(null);
      }
    },
    [caseId],
  );

  if (!caseId || (revisions !== null && revisions.length === 0)) {
    return null;
  }

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">Saved versions</h2>
        <p className="text-sm text-muted">
          Every time your answers are saved, a version is kept. Bringing an older one
          back doesn&apos;t delete anything — your current answers stay in this list, so
          you can always change your mind again.
        </p>
      </div>

      {error ? <Alert variant="warning">{error}</Alert> : null}

      <ul className="divide-y divide-border">
        {(revisions ?? []).map((revision, index) => (
          <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm">
              <span className="font-medium text-ink">{formatWhen(revision.createdAt)}</span>
              {index === 0 ? <span className="ml-2 text-muted">(current)</span> : null}
              {revision.restoredFromRevision !== null ? (
                <span className="ml-2 text-muted">
                  restored from an earlier version
                </span>
              ) : null}
            </span>
            {index === 0 ? null : (
              <Button
                variant="secondary"
                size="sm"
                loading={busyRevision === revision.revision}
                onClick={() => void restore(revision.revision)}
              >
                Bring this version back
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
