/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildReviewedDraft, createDemoDraft } from "@/domain/intake";
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
    const reviewed = buildReviewedDraft(createDemoDraft());
    await createLocalStorageReviewedSnapshotStorage().save(reviewed);

    render(<ResultsExperience />);

    await waitFor(() => expect(screen.queryByText(/loading your results/i)).not.toBeInTheDocument());

    expect(screen.getByText(/estimate only.*not legal advice/i)).toBeInTheDocument();
    expect(screen.getByText(/child support \(estimate\)/i)).toBeInTheDocument();
    expect(screen.getByText(/alimony \(estimate\)/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated monthly amount range/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeInTheDocument();
  });
});
