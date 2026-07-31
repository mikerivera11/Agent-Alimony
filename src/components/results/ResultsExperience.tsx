"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alert, Button, Card, buttonClasses } from "@/components/ui";
import {
  buildReviewedDraft,
  createLocalStorageIntakeDraftStorage,
  isDraftReadyForReview,
  isReviewedSnapshotStale,
  type IntakeDraft,
  type ReviewedIntakeDraft,
} from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";
import { buildPackageViewModel } from "@/domain/package";

import { AlimonyOutcomeCard } from "./AlimonyOutcomeCard";
import { ChildSupportOutcomeCard } from "./ChildSupportOutcomeCard";
import { EquitableDistributionOutcomeCard } from "./EquitableDistributionOutcomeCard";
import { LumpSumOutcomeCard } from "./LumpSumOutcomeCard";
import { ConfirmedFactsPanel } from "./ConfirmedFactsPanel";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { MissingItemsPanel } from "./MissingItemsPanel";
import { ResultsEmptyState } from "./ResultsEmptyState";
import { ScenariosPanel } from "./ScenariosPanel";
import { SourcesPanel } from "./SourcesPanel";

type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; reviewed: ReviewedIntakeDraft };

type DownloadState = "idle" | "downloading" | "error";

/**
 * Client-side results experience: loads the reviewed intake snapshot from
 * `localStorage`, builds the package view model (a pure, client-safe
 * calculation — no server secrets involved), and renders every required
 * section. The "Download PDF" action POSTs the same reviewed snapshot to
 * `/api/package`, which independently re-validates and re-calculates
 * everything server-side before returning the file.
 *
 * The snapshot is a frozen point-in-time copy, so the live draft is loaded
 * alongside it purely to detect that answers have changed since — see
 * `isReviewedSnapshotStale`. Showing figures that contradict the person's own
 * answers, or letting them download such a PDF, would be worse than showing
 * nothing.
 */
export function ResultsExperience() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");

  useEffect(() => {
    let cancelled = false;
    const storage = createLocalStorageReviewedSnapshotStorage();
    const draftStorage = createLocalStorageIntakeDraftStorage();
    Promise.all([storage.load(), draftStorage.load()]).then(([snapshot, loadedDraft]) => {
      if (cancelled) return;
      setDraft(loadedDraft);
      setState(snapshot ? { status: "ready", reviewed: snapshot } : { status: "empty" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reviewed = state.status === "ready" ? state.reviewed : null;
  const isStale = isReviewedSnapshotStale(reviewed, draft);
  const canRecalculate = Boolean(draft && isDraftReadyForReview(draft));

  /**
   * Re-freezes the current answers into a new snapshot, which is exactly what
   * "Confirm and finish" does — so recalculating here never takes a different
   * path than the review screen.
   */
  const handleRecalculate = useCallback(async () => {
    if (!draft || !isDraftReadyForReview(draft)) return;
    const next = buildReviewedDraft(draft);
    await createLocalStorageReviewedSnapshotStorage().save(next);
    setState({ status: "ready", reviewed: next });
    setDownloadState("idle");
  }, [draft]);

  const viewModel = useMemo(() => {
    if (state.status !== "ready") return null;
    return buildPackageViewModel(state.reviewed);
  }, [state]);

  const handleDownload = useCallback(async () => {
    if (state.status !== "ready" || isStale) return;
    setDownloadState("downloading");
    try {
      const response = await fetch("/api/package", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewedDraft: state.reviewed }),
      });
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "florida-support-estimate.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadState("idle");
    } catch {
      setDownloadState("error");
    }
  }, [state, isStale]);

  if (state.status === "loading") {
    return <p className="text-ink-muted">Loading your results…</p>;
  }

  if (state.status === "empty" || !viewModel) {
    return <ResultsEmptyState />;
  }

  return (
    <div className="flex flex-col gap-8">
      <DisclaimerBanner />

      {isStale && (
        <Alert variant="warning" emphasis role="alert" title="These figures are out of date.">
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              You changed your answers after this estimate was generated, so the numbers below no longer
              match what you entered. Recalculate before relying on them or sharing them with an attorney.
            </p>
            <div className="flex flex-wrap gap-3">
              {canRecalculate ? (
                <Button type="button" onClick={handleRecalculate}>
                  Recalculate with my latest answers
                </Button>
              ) : (
                <Link href="/intake?step=review" className={buttonClasses("primary", "md")}>
                  Finish the missing answers
                </Link>
              )}
              <Link href="/intake?step=review" className={buttonClasses("secondary", "md")}>
                Review my answers
              </Link>
            </div>
          </div>
        </Alert>
      )}

      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Generated {new Date(viewModel.generatedAt).toLocaleString()}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={handleDownload}
            loading={downloadState === "downloading"}
            disabled={isStale}
          >
            {downloadState === "downloading" ? "Preparing PDF…" : "Download PDF"}
          </Button>
          <Link href="/intake?step=review" className={buttonClasses("secondary", "md")}>
            Edit my answers
          </Link>
          <Link href="/documents" className={buttonClasses("secondary", "md")}>
            Go to documents
          </Link>
        </div>
      </Card>

      {downloadState === "error" && (
        <Alert variant="danger" emphasis role="alert">
          Something went wrong generating the PDF. Please try again.
        </Alert>
      )}

      <ChildSupportOutcomeCard outcome={viewModel.childSupport} />
      <AlimonyOutcomeCard outcome={viewModel.alimony} />
      <EquitableDistributionOutcomeCard outcome={viewModel.equitableDistribution} />
      <LumpSumOutcomeCard lumpSum={viewModel.lumpSum} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">Missing or unsupported items</h2>
        <MissingItemsPanel issues={viewModel.missingOrUnsupported} />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">Illustrative scenarios</h2>
        <ScenariosPanel scenarios={viewModel.scenarios} />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">Confirmed facts used in this estimate</h2>
        <ConfirmedFactsPanel entries={viewModel.confirmedFacts} />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">Sources, citations &amp; assumptions</h2>
        <SourcesPanel sources={viewModel.sources} verifications={viewModel.verifications} assumptions={viewModel.assumptions} />
      </Card>

      <p className="text-sm text-ink-muted">
        Want to change an answer?{" "}
        <Link href="/intake?step=review" className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover">
          Return to your answers
        </Link>{" "}
        — everything you entered is still saved, and you can edit any topic and recalculate.
      </p>
    </div>
  );
}
