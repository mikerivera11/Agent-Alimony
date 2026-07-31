"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { secondaryButtonClasses, primaryButtonClasses } from "@/components/intake";
import type { ReviewedIntakeDraft } from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";
import { buildPackageViewModel } from "@/domain/package";

import { AlimonyOutcomeCard } from "./AlimonyOutcomeCard";
import { ChildSupportOutcomeCard } from "./ChildSupportOutcomeCard";
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
 */
export function ResultsExperience() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");

  useEffect(() => {
    let cancelled = false;
    const storage = createLocalStorageReviewedSnapshotStorage();
    storage.load().then((snapshot) => {
      if (cancelled) return;
      setState(snapshot ? { status: "ready", reviewed: snapshot } : { status: "empty" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const viewModel = useMemo(() => {
    if (state.status !== "ready") return null;
    return buildPackageViewModel(state.reviewed);
  }, [state]);

  const handleDownload = useCallback(async () => {
    if (state.status !== "ready") return;
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
  }, [state]);

  if (state.status === "loading") {
    return <p className="text-slate-700">Loading your results…</p>;
  }

  if (state.status === "empty" || !viewModel) {
    return <ResultsEmptyState />;
  }

  return (
    <div className="flex flex-col gap-8">
      <DisclaimerBanner />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white p-4">
        <p className="text-sm text-slate-700">
          Generated {new Date(viewModel.generatedAt).toLocaleString()}
          {viewModel.isDemo ? " — demo data" : ""}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleDownload} disabled={downloadState === "downloading"} className={primaryButtonClasses}>
            {downloadState === "downloading" ? "Preparing PDF…" : "Download PDF"}
          </button>
          <Link href="/documents" className={secondaryButtonClasses}>
            Go to documents
          </Link>
        </div>
      </section>

      {downloadState === "error" && (
        <p role="alert" className="rounded-md border-2 border-red-800 bg-red-50 p-3 text-red-950">
          Something went wrong generating the PDF. Please try again.
        </p>
      )}

      <ChildSupportOutcomeCard outcome={viewModel.childSupport} />
      <AlimonyOutcomeCard outcome={viewModel.alimony} />

      <section className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-950">Missing or unsupported items</h2>
        <MissingItemsPanel issues={viewModel.missingOrUnsupported} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-950">Illustrative scenarios</h2>
        <ScenariosPanel scenarios={viewModel.scenarios} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-950">Confirmed facts used in this estimate</h2>
        <ConfirmedFactsPanel entries={viewModel.confirmedFacts} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-950">Sources, citations &amp; assumptions</h2>
        <SourcesPanel sources={viewModel.sources} verifications={viewModel.verifications} assumptions={viewModel.assumptions} />
      </section>

      <p className="text-sm text-slate-600">
        Want to change an answer?{" "}
        <Link href="/intake" className="font-semibold underline">
          Return to guided intake
        </Link>
        .
      </p>
    </div>
  );
}
