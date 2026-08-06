import { expect, test } from "@playwright/test";

import { seedCompleteDraft } from "./seedDraft";

test("builds and saves an alternating holiday schedule", async ({ page }) => {
  await seedCompleteDraft(page);
  await page.goto("/intake?step=parentingPlan");

  await expect(page.getByRole("heading", { name: "Parenting plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holiday schedule builder" })).toBeVisible();
  await expect(page.getByText(/proposed defaults, not Florida legal defaults/i)).toBeVisible();

  const thanksgiving = page.getByRole("group", { name: "Thanksgiving" });
  const christmas = page.getByRole("group", { name: "Christmas" });
  await expect(thanksgiving.getByLabel("Who has the children?")).toHaveValue("alternating");
  await expect(thanksgiving.getByLabel("Odd-numbered years")).toHaveValue("you");
  await expect(christmas.getByLabel("Odd-numbered years")).toHaveValue("other_parent");

  await page.getByRole("button", { name: /add another holiday/i }).click();
  const newHoliday = page.getByLabel("Holiday or special day").last();
  await newHoliday.fill("Child's birthday");
  const birthday = page.getByRole("group", { name: "Child's birthday" });
  await birthday.getByLabel("Who has the children?").selectOption("you_every_year");
  await birthday.getByLabel("Beginning and ending time").fill("9:00 a.m. until 7:00 p.m.");

  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.goto("/intake?step=parentingPlan");

  const savedBirthday = page.getByRole("group", { name: "Child's birthday" });
  await expect(savedBirthday.getByLabel("Who has the children?")).toHaveValue("you_every_year");
  await expect(savedBirthday.getByLabel("Beginning and ending time")).toHaveValue(
    "9:00 a.m. until 7:00 p.m.",
  );
});
