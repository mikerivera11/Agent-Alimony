/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";

import { INTAKE_STEPS, type ParentingPlan } from "@/domain/intake";

import { ParentingPlanFields } from "../steps/ParentingPlanFields";

function Builder() {
  const defaults = INTAKE_STEPS.parentingPlan.defaultValues as ParentingPlan;
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useForm<ParentingPlan>({ defaultValues: defaults });
  return <ParentingPlanFields register={register} control={control} setValue={setValue} errors={errors} />;
}

afterEach(cleanup);

describe("ParentingPlanFields holiday schedule builder", () => {
  it("shows the three alternating major-holiday proposals and explains they are not legal defaults", () => {
    render(<Builder />);

    expect(screen.getByText(/proposed defaults, not Florida legal defaults/i)).toBeInTheDocument();
    for (const name of ["Thanksgiving", "Christmas", "New Year's Day"]) {
      const holiday = screen.getByRole("group", { name });
      expect(within(holiday).getByLabelText(/Who has the children/i)).toHaveValue("alternating");
    }
  });

  it("puts Christmas opposite Thanksgiving in odd-numbered years", () => {
    render(<Builder />);

    const thanksgiving = screen.getByRole("group", { name: "Thanksgiving" });
    const christmas = screen.getByRole("group", { name: "Christmas" });
    expect(within(thanksgiving).getByLabelText(/Odd-numbered years/i)).toHaveValue("you");
    expect(within(christmas).getByLabelText(/Odd-numbered years/i)).toHaveValue("other_parent");
  });

  it("adds and removes a custom holiday without disturbing the major holidays", () => {
    render(<Builder />);

    fireEvent.click(screen.getByRole("button", { name: /add another holiday/i }));
    const customName = screen.getAllByLabelText(/Holiday or special day/i).at(-1);
    expect(customName).toBeDefined();
    fireEvent.change(customName!, { target: { value: "Child's birthday" } });

    const custom = screen.getByRole("group", { name: "Child's birthday" });
    expect(custom).toBeInTheDocument();
    fireEvent.click(within(custom).getByRole("button", { name: /remove child's birthday/i }));

    expect(screen.queryByRole("group", { name: "Child's birthday" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Thanksgiving" })).toBeInTheDocument();
  });
});
