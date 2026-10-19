/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
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
      "/intake?step=parentingPlan",
    );
  });
});
