/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildReviewedDraft, createLocalStorageIntakeDraftStorage } from "@/domain/intake";
import { createLocalStorageReviewedSnapshotStorage } from "@/domain/integration";

import { ResultsExperience } from "../ResultsExperience";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ResultsExperience", () => {
  it("shows an empty-state link to intake when no reviewed snapshot has been saved", async () => {
    render(<ResultsExperience />);

    expect(await screen.findByText(/no reviewed intake found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to guided intake/i })).toHaveAttribute("href", "/intake");
  });

  it("renders the disclaimer and deterministic child-support and alimony results", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());
    await createLocalStorageReviewedSnapshotStorage().save(reviewed);

    render(<ResultsExperience />);

    await waitFor(() => expect(screen.queryByText(/loading your results/i)).not.toBeInTheDocument());

    expect(screen.getByText(/estimate only.*not legal advice/i)).toBeInTheDocument();
    expect(screen.getByText(/child support \(estimate\)/i)).toBeInTheDocument();
    expect(screen.getByText(/alimony \(estimate\)/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated monthly amount range/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download advance credit agreement/i }),
    ).toBeInTheDocument();
  });

  it("links outstanding court-form questions to the questionnaire section that answers them", async () => {
    const reviewed = buildReviewedDraft(createSampleDraft());
    const parentingPlan = reviewed.data.parentingPlan!;
    await createLocalStorageReviewedSnapshotStorage().save({
      ...reviewed,
      data: {
        ...reviewed.data,
        filingDetails: {
          ...reviewed.data.filingDetails!,
          judicialCircuit: "",
        },
        parentingPlan: {
          ...parentingPlan,
          holidaySchedules: parentingPlan.holidaySchedules.map((holiday) => ({
        ...holiday,
        beginEndTime: "",
          })),
        },
      },
    });

    render(<ResultsExperience />);

    expect(await screen.findByText(/finish the remaining court-form questions/i)).toBeInTheDocument();
    expect(screen.getAllByText("The judicial circuit")).toHaveLength(1);
    expect(screen.getByText(/forms 12\.928, 12\.901\(b\)\(1\)/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /answer in attorney filing packet \(optional\)/i }),
    ).toHaveAttribute("href", "/intake?step=filingDetails");
    expect(screen.getByText("Beginning and ending time for Thanksgiving")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /answer in parenting plan/i })).toHaveAttribute(
      "href",
      "/intake?step=parentingPlanDetails",
    );
    expect(
      screen.getByRole("button", { name: /download partially populated court forms/i }),
    ).toBeEnabled();
  });

  it("shows how to refresh stale court forms and enables download after updating", async () => {
    const draft = createSampleDraft();
    const reviewed = {
      ...buildReviewedDraft(draft),
      reviewedAt: new Date(Date.now() - 60_000).toISOString(),
    };
    await createLocalStorageReviewedSnapshotStorage().save(reviewed);
    if (!draft.data.income.self) throw new Error("Expected sample income.");
    draft.data.income.self.wages += 100;
    draft.updatedAt = new Date().toISOString();
    await createLocalStorageIntakeDraftStorage().save(draft);

    render(<ResultsExperience />);

    const downloadButton = await screen.findByRole("button", {
      name: /download populated court forms/i,
    });
    expect(downloadButton).toBeDisabled();
    expect(screen.getByText(/update the forms with your latest answers/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /update court forms with latest answers/i }),
    );

    await waitFor(() => expect(downloadButton).toBeEnabled());
    expect(screen.queryByText(/update the forms with your latest answers/i)).not.toBeInTheDocument();
  });
});
