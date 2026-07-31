"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import { createDemoDraft, createLocalStorageIntakeDraftStorage, type ReviewedIntakeDraft } from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";

import { IntakeWizard } from "./IntakeWizard";

interface IntakeExperienceProps {
  isDemo: boolean;
}

/**
 * Wires the reusable IntakeWizard up to real browser storage (and, for the
 * demo, the fictional example draft). This is the only place in the app that
 * decides *how* the draft is persisted, so swapping in a server-backed
 * storage adapter later only means changing this one call.
 */
export function IntakeExperience({ isDemo }: IntakeExperienceProps) {
  const router = useRouter();
  const storage = useMemo(() => createLocalStorageIntakeDraftStorage(), []);
  const reviewedStorage = useMemo(() => createLocalStorageReviewedSnapshotStorage(), []);
  const initialDraft = useMemo(() => (isDemo ? createDemoDraft() : undefined), [isDemo]);

  const handleReviewComplete = useCallback(
    async (reviewed: ReviewedIntakeDraft) => {
      await reviewedStorage.save(reviewed);
      router.push("/results");
    },
    [reviewedStorage, router],
  );

  return <IntakeWizard storage={storage} initialDraft={initialDraft} onReviewComplete={handleReviewComplete} />;
}
