"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  INTAKE_STEPS,
  createSyncedIntakeDraftStorage,
  type IntakeScreenId,
  type IntakeStepId,
  type ReviewedIntakeDraft,
} from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";
import { SavedVersionsPanel } from "@/components/account";

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
  const storage = useMemo(() => createSyncedIntakeDraftStorage(), []);
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
      <IntakeWizard
        storage={storage}
        initialScreenId={initialScreenId}
        onReviewComplete={handleReviewComplete}
      />
      <SavedVersionsPanel />
    </div>
  );
}
