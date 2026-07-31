/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { UseFormRegisterReturn } from "react-hook-form";

import { TextField } from "../fields/TextField";
import { YesNoField } from "../fields/YesNoField";
import { IntakeModeToggle } from "../IntakeModeToggle";
import { ProgressIndicator } from "../ProgressIndicator";

afterEach(() => {
  cleanup();
});

/** A minimal stand-in for react-hook-form's `register(...)` return value. */
function fakeRegistration(name: string): UseFormRegisterReturn {
  return {
    name,
    onChange: async () => true,
    onBlur: async () => true,
    ref: () => undefined,
  };
}

describe("TextField accessibility", () => {
  it("associates the visible label with the input via htmlFor/id", () => {
    render(
      <TextField
        id="petitioner-name"
        label="Your full legal name"
        registration={fakeRegistration("petitionerName")}
      />,
    );

    const input = screen.getByLabelText(/Your full legal name/);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "petitioner-name");
  });

  it("links hint, example, and error text through aria-describedby so screen readers announce all of them", () => {
    render(
      <TextField
        id="petitioner-name"
        label="Your full legal name"
        hint="We ask so the paperwork uses your correct legal name."
        example="Jordan A. Rivera"
        error="Enter your full name."
        registration={fakeRegistration("petitionerName")}
      />,
    );

    const input = screen.getByLabelText(/Your full legal name/);
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const describedIds = describedBy.split(" ").filter(Boolean);

    expect(describedIds).toEqual(["petitioner-name-hint", "petitioner-name-example", "petitioner-name-error"]);
    expect(input).toHaveAttribute("aria-invalid", "true");

    // Every id referenced by aria-describedby must exist and hold the matching copy.
    expect(document.getElementById("petitioner-name-hint")).toHaveTextContent(
      "We ask so the paperwork uses your correct legal name.",
    );
    expect(document.getElementById("petitioner-name-example")).toHaveTextContent("Jordan A. Rivera");

    const errorNode = document.getElementById("petitioner-name-error");
    expect(errorNode).toHaveTextContent("Enter your full name.");
    // Errors must be announced proactively, not just discoverable on request.
    expect(errorNode).toHaveAttribute("role", "alert");
  });

  it("does not mark the field invalid when there is no error", () => {
    render(<TextField id="petitioner-name" label="Your full legal name" registration={fakeRegistration("x")} />);
    expect(screen.getByLabelText(/Your full legal name/)).toHaveAttribute("aria-invalid", "false");
  });
});

describe("YesNoField (radio group) accessibility and keyboard behavior", () => {
  it("groups the two options under a single fieldset/legend instead of a plain label", () => {
    render(
      <YesNoField
        id="has-children"
        legend="Do you and your spouse have any children together?"
        registration={fakeRegistration("hasChildren")}
      />,
    );

    const group = screen.getByRole("group", { name: /Do you and your spouse have any children together\?/ });
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No" })).toBeInTheDocument();
  });

  it("lets a user pick an option with a click/change event and updates checked state", () => {
    render(
      <YesNoField
        id="has-children"
        legend="Do you and your spouse have any children together?"
        registration={fakeRegistration("hasChildren")}
      />,
    );

    const yesOption = screen.getByRole("radio", { name: "Yes" }) as HTMLInputElement;
    const noOption = screen.getByRole("radio", { name: "No" }) as HTMLInputElement;

    expect(yesOption.checked).toBe(false);
    fireEvent.click(yesOption);
    expect(yesOption.checked).toBe(true);
    expect(noOption.checked).toBe(false);
  });

  it("exposes the error as an alert associated with the fieldset", () => {
    render(
      <YesNoField
        id="has-children"
        legend="Do you and your spouse have any children together?"
        error="Choose yes or no."
        registration={fakeRegistration("hasChildren")}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Choose yes or no.");
    const group = screen.getByRole("group", { name: /Do you and your spouse have any children together\?/ });
    expect(group.getAttribute("aria-describedby")).toContain("has-children-error");
  });
});

describe("ProgressIndicator accessibility", () => {
  const steps = [
    { id: "caseBasics", title: "Case basics" },
    { id: "marriage", title: "Marriage" },
    { id: "children", title: "Children" },
  ];

  it("exposes a standard progressbar role with numeric value and announces the current step politely", () => {
    render(<ProgressIndicator steps={steps} currentStepId="marriage" completedStepIds={["caseBasics"]} />);

    const progressbar = screen.getByRole("progressbar", { name: "Overall progress" });
    expect(progressbar).toHaveAttribute("aria-valuenow", "67");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");

    expect(screen.getByText("Step 2 of 3: Marriage")).toBeInTheDocument();
  });

  it("marks only the current step with aria-current so assistive tech announces location in the wizard", () => {
    render(<ProgressIndicator steps={steps} currentStepId="children" completedStepIds={["caseBasics", "marriage"]} />);

    const currentItem = screen.getByText(/3\. Children/).closest("li");
    expect(currentItem).toHaveAttribute("aria-current", "step");

    const earlierItem = screen.getByText(/1\. Case basics/).closest("li");
    expect(earlierItem).not.toHaveAttribute("aria-current");
  });
});

describe("IntakeModeToggle accessibility", () => {
  it("exposes the two layouts as a labelled radio group with exactly one selected", () => {
    render(<IntakeModeToggle mode="guided" onChange={() => undefined} />);

    const group = screen.getByRole("radiogroup", { name: /How would you like to fill this in/ });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios.filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: /Step by step/ })).toHaveAttribute("aria-checked", "true");
  });

  it("reports the selected layout so the choice is not conveyed by colour alone", () => {
    render(<IntakeModeToggle mode="allAtOnce" onChange={() => undefined} />);

    expect(screen.getByRole("radio", { name: /All on one page/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Step by step/ })).toHaveAttribute("aria-checked", "false");
  });

  it("reports the layout the person picked", () => {
    const changes: string[] = [];
    render(<IntakeModeToggle mode="guided" onChange={(mode) => changes.push(mode)} />);

    fireEvent.click(screen.getByRole("radio", { name: /All on one page/ }));

    expect(changes).toEqual(["allAtOnce"]);
  });
});
