"use client";

import { useEffect, useState } from "react";

interface SavedIndicatorProps {
  /** ISO timestamp of the last answer change. */
  updatedAt: string;
}

/**
 * Saving is automatic and silent, which is only reassuring if you can see it
 * happened. This turns the draft's `updatedAt` into plain language and keeps
 * it current, so someone filling in a long financial form can tell at a glance
 * that nothing has been lost.
 */
export function SavedIndicator({ updatedAt }: SavedIndicatorProps) {
  const [, forceTick] = useState(0);

  // Re-render on a slow interval so "a moment ago" does not sit there lying
  // ten minutes later.
  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const label = describeSavedAt(updatedAt);
  if (!label) return null;

  return (
    <p
      className="flex flex-none items-center gap-1.5 whitespace-nowrap text-sm text-ink-muted"
      data-testid="saved-indicator"
    >
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-success-border" />
      <span>
        Saved {label} <span className="text-ink-subtle">on this device</span>
      </span>
    </p>
  );
}

export function describeSavedAt(updatedAt: string, now: number = Date.now()): string | null {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return null;

  const elapsedSeconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return "just now";

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  return new Date(timestamp).toLocaleDateString();
}
