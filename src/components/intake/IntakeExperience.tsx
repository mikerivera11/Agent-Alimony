"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import { createLocalStorageIntakeDraftStorage, type ReviewedIntakeDraft } from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";

import { IntakeWizard } from "./IntakeWizard";

/**
 * Wires the reusable IntakeWizard up to real browser storage. This is the only
 * place in the app that decides *how* the draft is persisted, so swapping in a
 * server-backed storage adapter later only means changing this one call.
 */
export function IntakeExperience() {
  const router = useRouter();
  const storage = useMemo(() => createLocalStorageIntakeDraftStorage(), []);
  const reviewedStorage = useMemo(() => createLocalStorageReviewedSnapshotStorage(), []);

  const handleReviewComplete = useCallback(
    async (reviewed: ReviewedIntakeDraft) => {
      await reviewedStorage.save(reviewed);
      router.push("/results");
    },
    [reviewedStorage, router],
  );

  return <IntakeWizard storage={storage} onReviewComplete={handleReviewComplete} />;
}
