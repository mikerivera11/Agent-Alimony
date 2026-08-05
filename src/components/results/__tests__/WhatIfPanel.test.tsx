/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildReviewedDraft } from "@/domain/intake";
import { formatCentsAsDollars } from "@/domain/package";
import { calculateScenario } from "@/domain/scenario";
import { createSampleDraft } from "@/test/fixtures/sampleDraft";

import { WhatIfPanel } from "../WhatIfPanel";

/**
 * The panel's job is to make a hypothetical unmistakably hypothetical while
 * still showing a real number. Both halves are tested: that it says so, and
 * that the figure it shows is the one the deterministic engine produced.
 */

const reviewed = buildReviewedDraft(createSampleDraft());

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      // The server is the one that calculates. Standing in for it with the
      // same function keeps this a test of the panel, not of the network.
      const scenario = calculateScenario(reviewed, body.overrides);
      return new Response(JSON.stringify({ ok: true, scenario }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WhatIfPanel", () => {
  it("says up front that nothing is saved", () => {
    render(<WhatIfPanel reviewed={reviewed} />);

    expect(screen.getByText(/nothing here is saved to your case/i)).toBeInTheDocument();
  });

  it("shows a deterministic figure and labels the result hypothetical", async () => {
    render(<WhatIfPanel reviewed={reviewed} />);

    fireEvent.change(screen.getByLabelText(/your monthly gross income/i), { target: { value: "9000" } });
    fireEvent.click(screen.getByRole("button", { name: /try this what-if/i }));

    const result = await screen.findByTestId("what-if-result");
    expect(result).toHaveTextContent(/hypothetical — not saved/i);

    const expected = calculateScenario(reviewed, { selfMonthlyGrossIncomeCents: 900_000 });
    expect(expected.childSupport?.kind).toBe("calculated");
    if (expected.childSupport?.kind !== "calculated") return;
    // Exact, not "contains": a substring match passes against a wrong figure
    // whenever the right one happens to be a prefix of it.
    expect(screen.getByTestId("what-if-child-support").textContent).toBe(
      formatCentsAsDollars(expected.childSupport.result.monthlyTransferAmountCents),
    );
  });

  it("echoes what it changed, and what it changed from", async () => {
    render(<WhatIfPanel reviewed={reviewed} />);

    fireEvent.change(screen.getByLabelText(/your monthly gross income/i), { target: { value: "9000" } });
    fireEvent.click(screen.getByRole("button", { name: /try this what-if/i }));

    const result = await screen.findByTestId("what-if-result");
    expect(result).toHaveTextContent(/Your monthly gross income:/);
    expect(result).toHaveTextContent(/→ \$9,000/);
  });

  it("asks for a number instead of posting an empty what-if", async () => {
    render(<WhatIfPanel reviewed={reviewed} />);

    fireEvent.click(screen.getByRole("button", { name: /try this what-if/i }));

    expect(await screen.findByText(/enter at least one number/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to run against out-of-date figures", async () => {
    render(<WhatIfPanel reviewed={reviewed} disabled />);

    expect(screen.getByText(/recalculate first/i)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /try this what-if/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
