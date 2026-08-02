"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  INTAKE_STEPS,
  createSyncedIntakeDraftStorage,
  type IntakeScreenId,
  type IntakeStepId,
  type ReviewedIntakeDraft,
} from "@/domain/intake";
import type { SyncStatus } from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";
import { SavedVersionsPanel } from "@/components/account";
import { Alert } from "@/components/ui";

import { IntakeWizard } from "./IntakeWizard";

/**
 * Turns a `?step=` value into a screen the wizard can open, ignoring anything
 * unrecognised. Accepts `review` so `/results` can link straight to the screen
 * where every topic is editable.
 */
export function parseStepParam(value: string | null): IntakeScreenId | undefined {
  if (!value) return undefined;
  if (value === "review") return "review";
  return value in INTAKE_STEPS ? (value as IntakeStepId) : undefined;
}

/**
 * Wires the reusable IntakeWizard up to real storage. This is the only place
 * in the app that decides *how* the draft is persisted.
 *
 * The draft is written to the browser first and mirrored to the server behind
 * it, so typing never waits on the network and a server that is unreachable
 * costs history rather than answers.
 */
export function IntakeExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const storage = useMemo(
    () => createSyncedIntakeDraftStorage({ onStatusChange: setSyncStatus }),
    [],
  );
  const reviewedStorage = useMemo(() => createLocalStorageReviewedSnapshotStorage(), []);
  const initialScreenId = parseStepParam(searchParams.get("step"));

  const handleReviewComplete = useCallback(
    async (reviewed: ReviewedIntakeDraft) => {
      await reviewedStorage.save(reviewed);
      router.push("/results");
    },
    [reviewedStorage, router],
  );

  return (
    <div className="space-y-8">
      {syncStatus === "conflict" ? (
        <Alert variant="warning" title="These answers were also changed somewhere else">
          This case was updated in another tab or on another device after this page
          loaded. Nothing has been lost — every version is kept — but to avoid one
          copy overwriting the other, reload this page to see the most recent answers
          before you continue.
        </Alert>
      ) : null}
      {syncStatus === "offline" ? (
        <Alert variant="info" title="Saved on this device only">
          Your answers are safe on this device, but we couldn&apos;t reach the server
          to save a copy you can get back to later. We&apos;ll keep trying.
        </Alert>
      ) : null}
      <IntakeWizard
        storage={storage}
        initialScreenId={initialScreenId}
        onReviewComplete={handleReviewComplete}
      />
      <SavedVersionsPanel />
    </div>
  );
}
