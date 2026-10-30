"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alert, Button, Card, buttonClasses } from "@/components/ui";
import { buildFilingReadiness, POPULATED_OFFICIAL_FORM_NUMBERS } from "@/domain/forms";
import {
  INTAKE_STEPS,
  buildReviewedDraft,
  createLocalStorageIntakeDraftStorage,
  isDraftReadyForReview,
  isReviewedSnapshotStale,
  type IntakeDraft,
  type IntakeStepId,
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
import { WhatIfPanel } from "./WhatIfPanel";
import { SourcesPanel } from "./SourcesPanel";

type LoadState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; reviewed: ReviewedIntakeDraft };

type DownloadState = "idle" | "downloading" | "error";

interface OfficialFormQuestion {
  readonly question: string;
  readonly formNumbers: readonly string[];
}

interface OfficialFormQuestionGroup {
  readonly stepId: IntakeStepId;
  readonly title: string;
  readonly questions: readonly OfficialFormQuestion[];
}

function stepForOfficialFormQuestion(question: string): IntakeStepId {
  if (question === "Whether you are the petitioner or respondent") return "spouses";
  if (question === "The date you married") return "marriage";
  if (question === "Your income by category") return "income";
  if (question === "Your monthly household expenses") return "householdExpenses";
  if (question === "Your assets and debts") return "assetsDebts";
  if (question.includes("alimony terms") || question.includes("alimony is waived")) {
    return "alimonyFactors";
  }
  if (
    question.includes("marital settlement") ||
    question.includes("agreed recipient") ||
    question.includes("responsible party")
  ) {
    return "settlementTerms";
  }
  if (
    question.includes("parenting plan") ||
    question.includes("holiday") ||
    question.includes("school break") ||
    question.includes("exchange") ||
    question.includes("transportation") ||
    question.includes("travel") ||
    question.includes("communication") ||
    question.includes("majority-residence") ||
    question.includes("spring break") ||
    question.includes("summer break") ||
    question.includes("decision-making") ||
    question.includes("school-designation") ||
    question.includes("detailed parenting") ||
    question.startsWith("Who has the children") ||
    question.startsWith("Beginning and ending time")
  ) {
    return "parentingPlanDetails";
  }
  return "filingDetails";
}

function groupOfficialFormQuestions(
  forms: ReadonlyArray<{
    readonly formNumber: string;
    readonly missing: readonly string[];
  }>,
): OfficialFormQuestionGroup[] {
  const groups = new Map<
    IntakeStepId,
    Map<string, Set<string>>
  >();

  for (const form of forms) {
    for (const question of form.missing) {
      const stepId = stepForOfficialFormQuestion(question);
      const questions = groups.get(stepId) ?? new Map<string, Set<string>>();
      const formNumbers = questions.get(question) ?? new Set<string>();
      formNumbers.add(form.formNumber);
      questions.set(question, formNumbers);
      groups.set(stepId, questions);
    }
  }

  return Array.from(groups, ([stepId, questions]) => ({
    stepId,
    title: INTAKE_STEPS[stepId].title,
    questions: Array.from(questions, ([question, formNumbers]) => ({
      question,
      formNumbers: Array.from(formNumbers),
    })),
  }));
}

/** Which download is in flight, so one button's spinner never appears on another. */
type DownloadTarget =
  | "package"
  | "child-support-guidelines"
  | "parenting-plan"
  | "filing-packet"
  | "court-forms"
  | "court-forms-preview"
  | "alimony-advance-agreement";

const WORKSHEET_DOWNLOADS: ReadonlyArray<{
  readonly target: DownloadTarget;
  readonly label: string;
  readonly filename: string;
  readonly description: string;
}> = [
  {
    target: "child-support-guidelines",
    label: "Child support guidelines worksheet",
    filename: "florida-child-support-guidelines-worksheet.pdf",
    description:
      "Your figures laid out in the order Fla. Stat. \u00a761.30 computes them \u2014 the same order Form 12.902(e) walks through.",
  },
  {
    target: "parenting-plan",
    label: "Parenting plan worksheet",
    filename: "florida-parenting-plan-worksheet.pdf",
    description:
      "The terms Fla. Stat. \u00a761.13(2)(b) requires a parenting plan to cover, with anything undecided listed as an open question.",
  },
];

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
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  // Read from the reviewed snapshot rather than the live draft, so the offer
  // matches the answers the packet would actually be built from.
  const wantsFilingPacket = reviewed?.data.filingDetails?.wantsFilingPacket === "yes";
  const wantsAlimonyAdvanceAgreement =
    reviewed?.data.alimonyAdvance?.wantsAdvanceAgreement === "yes";
  const officialFormQuestionGroups = useMemo(() => {
    if (!reviewed || !viewModel || !wantsFilingPacket) return [];
    const populated = new Set<string>(POPULATED_OFFICIAL_FORM_NUMBERS);
    const forms = buildFilingReadiness({
      data: reviewed.data,
      asOfIso: viewModel.generatedAt.slice(0, 10),
    }).forms
      .filter((form) => populated.has(form.entry.form.formNumber) && form.status === "needsInformation")
      .map((form) => ({
        formNumber: form.entry.form.formNumber,
        missing: form.missing,
      }));
    return groupOfficialFormQuestions(forms);
  }, [reviewed, viewModel, wantsFilingPacket]);
  const hasOfficialFormGaps = officialFormQuestionGroups.length > 0;

  /**
   * One download path for the packet and every worksheet. They all post the
   * confirmed answers and let the server recalculate; the client never sends a
   * figure. Sharing the path means a worksheet cannot quietly acquire a
   * different trust model than the packet.
   */
  const runDownload = useCallback(
    async (target: DownloadTarget, url: string, filename: string) => {
      if (state.status !== "ready" || isStale) return;
      setDownloadTarget(target);
      setDownloadState("downloading");
      setDownloadError(null);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewedDraft: state.reviewed }),
        });
        if (!response.ok) {
          // A 409 carries a specific, actionable reason; anything else does not.
          const message =
            response.status === 409
              ? ((await response.json().catch(() => null))?.error ?? null)
              : null;
          throw new Error(message ?? `Server responded with ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        setDownloadState("idle");
      } catch (error) {
        setDownloadError(error instanceof Error ? error.message : null);
        setDownloadState("error");
      } finally {
        setDownloadTarget(null);
      }
    },
    [state, isStale],
  );

  const handleDownload = useCallback(
    () => runDownload("package", "/api/package", "florida-support-estimate.pdf"),
    [runDownload],
  );

  const handleCourtFormsPreviewDownload = useCallback(async () => {
    if (!draft) return;
    setDownloadTarget("court-forms-preview");
    setDownloadState("downloading");
    setDownloadError(null);
    try {
      const response = await fetch("/api/package/court-forms-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Server responded with ${response.status}`);
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "currently-populated-florida-court-forms-review-draft.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setDownloadState("idle");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "The court forms could not be generated.");
      setDownloadState("error");
    } finally {
      setDownloadTarget(null);
    }
  }, [draft]);

  const hasCourtFormsDraft =
    wantsFilingPacket || draft?.data.filingDetails.wantsFilingPacket === "yes";
  const handleVisibleCourtFormsDownload = useCallback(() => {
    if (wantsFilingPacket && !isStale) {
      return runDownload(
        "court-forms",
        "/api/package/court-forms",
        "populated-florida-court-forms-review-draft.pdf",
      );
    }
    return handleCourtFormsPreviewDownload();
  }, [handleCourtFormsPreviewDownload, isStale, runDownload, wantsFilingPacket]);

  if (state.status === "loading") {
    return <p className="text-ink-muted">Loading your results…</p>;
  }

  if (state.status === "empty" || !viewModel) {
    const canDownloadCourtForms = draft?.data.filingDetails.wantsFilingPacket === "yes";
    return (
      <div className="flex flex-col gap-6">
        <ResultsEmptyState />
        {canDownloadCourtForms ? (
          <Card padding="lg" className="flex flex-col items-start gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Your court forms are available now</h2>
              <p className="mt-2 text-ink-muted">
                Download the revision-locked Florida forms populated with the answers currently saved. Missing
                answers remain blank and are listed on the cover page. The child-support worksheet is included only
                after the deterministic calculation is complete.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleCourtFormsPreviewDownload}
              loading={downloadState === "downloading" && downloadTarget === "court-forms-preview"}
              disabled={downloadState === "downloading"}
            >
              {downloadState === "downloading" && downloadTarget === "court-forms-preview"
                ? "Preparing court forms..."
                : "Download currently populated court forms"}
            </Button>
            {downloadState === "error" ? (
              <Alert variant="danger" role="alert">
                {downloadError ?? "The court forms could not be generated."}
              </Alert>
            ) : null}
          </Card>
        ) : null}
      </div>
    );
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
            loading={downloadState === "downloading" && downloadTarget === "package"}
            disabled={isStale || downloadState === "downloading"}
          >
            {downloadState === "downloading" && downloadTarget === "package" ? "Preparing PDF…" : "Download PDF"}
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
          {downloadError ?? "Something went wrong generating the PDF. Please try again."}
        </Alert>
      )}

      {hasCourtFormsDraft ? (
        <Card className="flex flex-col gap-4 border-2 border-primary">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Official Florida court forms</p>
            <h2 className="text-2xl font-semibold text-ink">Your populated court forms</h2>
            <p className="text-sm text-ink-muted">
              These are the revision-locked official Florida PDFs with your saved answers inserted—not the
              worksheets shown below. Unknown answers remain blank and are listed on the cover page for attorney
              review.
            </p>
          </div>
          <div>
            <Button
              type="button"
              onClick={handleVisibleCourtFormsDownload}
              loading={
                downloadState === "downloading" &&
                (downloadTarget === "court-forms" || downloadTarget === "court-forms-preview")
              }
              disabled={downloadState === "downloading"}
            >
              {downloadState === "downloading" &&
              (downloadTarget === "court-forms" || downloadTarget === "court-forms-preview")
                ? "Preparing official court forms..."
                : hasOfficialFormGaps
                  ? "Download partially populated official court forms"
                  : "Download populated official court forms"}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-ink">Court form worksheets</h2>
          <p className="text-sm text-ink-muted">
            These are worksheets, not court forms. Each one lays your confirmed answers out in the order the
            matching Florida form asks for them, so you or your attorney can transcribe them onto the current
            official form. Download the form itself from the Florida Courts website and check the revision date
            in its footer \u2014 a superseded form is refused at the clerk\u2019s window.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {WORKSHEET_DOWNLOADS.map((worksheet) => (
            <div key={worksheet.target} className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-sm text-ink-muted">{worksheet.description}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runDownload(
                    worksheet.target,
                    `/api/package/worksheet?form=${worksheet.target}`,
                    worksheet.filename,
                  )
                }
                loading={downloadState === "downloading" && downloadTarget === worksheet.target}
                disabled={isStale || downloadState === "downloading"}
              >
                {worksheet.label}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {wantsFilingPacket && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-ink">Attorney filing packet details</h2>
            <p className="text-sm text-ink-muted">
              Everything an attorney needs to prepare an uncontested filing: which Florida forms your case calls for,
              which answers you have already given for each, exactly what is still missing, and a term sheet covering
              alimony, child support, property, and parenting. It is not a court filing and not a settlement
              agreement — an attorney drafts and files those.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-ink-muted">
              Download the attorney packet for the full readiness analysis, missing-answer list, and settlement term
              sheet. The separate official court-form download is highlighted above.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  runDownload("filing-packet", "/api/package/filing-packet", "attorney-filing-packet.pdf")
                }
                loading={downloadState === "downloading" && downloadTarget === "filing-packet"}
                disabled={isStale || downloadState === "downloading"}
              >
                Download filing packet
              </Button>
            </div>
          </div>
          {isStale ? (
            <Alert variant="warning" emphasis title="Update the forms with your latest answers">
              <div className="flex flex-col gap-3">
                <p className="text-sm">
                  You answered or changed questionnaire items after these results were generated. Refresh the reviewed
                  answers before downloading so the court forms use what you entered most recently.
                </p>
                <div>
                  {canRecalculate ? (
                    <Button type="button" onClick={handleRecalculate}>
                      Update court forms with latest answers
                    </Button>
                  ) : (
                    <Link href="/intake?step=review" className={buttonClasses("primary", "md")}>
                      Finish and review the latest answers
                    </Link>
                  )}
                </div>
              </div>
            </Alert>
          ) : null}
          {hasOfficialFormGaps ? (
            <Alert variant="warning" emphasis title="Finish the remaining court-form questions">
              <p className="text-sm">
                You can download the forms now. These unanswered items will remain blank and will also be listed on
                the PDF cover page so they cannot be mistaken for completed answers.
              </p>
              <div className="mt-3 space-y-4">
                {officialFormQuestionGroups.map((group) => (
                  <div key={group.stepId}>
                    <h3 className="font-semibold">{group.title}</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {group.questions.map((item) => (
                        <li key={item.question}>
                          {item.question}{" "}
                          <span className="text-ink-muted">
                            (Form{item.formNumbers.length > 1 ? "s" : ""} {item.formNumbers.join(", ")})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/intake?step=${group.stepId}`}
                      className="mt-2 inline-block font-semibold text-primary underline underline-offset-4"
                    >
                      Answer in {group.title}
                    </Link>
                  </div>
                ))}
              </div>
            </Alert>
          ) : null}
        </Card>
      )}

      {wantsAlimonyAdvanceAgreement && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-ink">
              Alimony settlement advance and credit acknowledgment
            </h2>
            <p className="text-sm text-ink-muted">
              Download a separate signable attorney-review draft recording the reported pre-judgment payment,
              how it will be credited against the final alimony settlement, and what happens if no final written
              agreement or judgment is entered. It is not a court order, legal advice, or automatically enforceable.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                runDownload(
                  "alimony-advance-agreement",
                  "/api/package/alimony-advance-agreement",
                  "pre-judgment-housing-advance-credit-agreement.pdf",
                )
              }
              loading={
                downloadState === "downloading" &&
                downloadTarget === "alimony-advance-agreement"
              }
              disabled={isStale || downloadState === "downloading"}
            >
              Download housing advance agreement
            </Button>
          </div>
        </Card>
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
        <h2 className="text-xl font-semibold text-ink">Try a different number</h2>
        <WhatIfPanel reviewed={state.reviewed} disabled={isStale} />
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
