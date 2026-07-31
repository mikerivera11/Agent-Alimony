"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  INTAKE_STEPS,
  createLocalStorageIntakeDraftStorage,
  type IntakeScreenId,
  type IntakeStepId,
  type ReviewedIntakeDraft,
} from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";

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
 * Wires the reusable IntakeWizard up to real browser storage. This is the only
 * place in the app that decides *how* the draft is persisted, so swapping in a
 * server-backed storage adapter later only means changing this one call.
 */
export function IntakeExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storage = useMemo(() => createLocalStorageIntakeDraftStorage(), []);
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
    <IntakeWizard
      storage={storage}
      initialScreenId={initialScreenId}
      onReviewComplete={handleReviewComplete}
    />
  );
}
