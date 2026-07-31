import { expect, test } from "@playwright/test";

import { seedCompleteDraft } from "./seedDraft";

test("completes the intake, calculates results, downloads a package, and reviews extraction proposals", async ({
  page,
}) => {
  await seedCompleteDraft(page);
  await page.goto("/intake");

  for (let step = 0; step < 12; step += 1) {
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.getByRole("button", { name: "Save and go to review" }).click();

  await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(page).toHaveURL(/\/results$/);

  await expect(page.getByRole("heading", { name: "Child support (estimate)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alimony (estimate)" })).toBeVisible();
  await expect(page.getByText("Estimated monthly amount range")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("florida-support-estimate.pdf");

  await page.goto("/documents");
  await page.getByRole("button", { name: "Run fictional demo extraction" }).click();
  await expect(page.getByText(/demo data only/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).first().click();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});

test("keeps an excluded asset in the estate until a written agreement is confirmed", async ({
  page,
}) => {
  await seedCompleteDraft(page);
  await page.goto("/intake");

  // Walk to the assets and debts step.
  for (let step = 0; step < 9; step += 1) {
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await expect(page.getByRole("heading", { name: "Assets, debts, and support obligations" })).toBeVisible();

  // The demo ships the fictional 401(k) already marked to be left out, with the
  // written agreement confirmed. Withdrawing that confirmation must put the
  // asset straight back into the estate: Florida sets an asset aside only "by
  // valid written agreement of the parties" (Fla. Stat. 61.075(6)(b)4), so one
  // spouse cannot remove it alone.
  const agreement = page.getByRole("checkbox", {
    name: "Both spouses have a written agreement covering the items marked to be left out.",
  });
  await expect(agreement).toBeChecked();
  await agreement.uncheck();

  await expect(page.getByText(/yet confirmed a written agreement/i).first()).toBeVisible();
  await expect(page.getByText(/stays in the shared estate/i).first()).toBeVisible();

  await agreement.check();
  await expect(page.getByText(/yet confirmed a written agreement/i)).toHaveCount(0);

  for (let step = 9; step < 12; step += 1) {
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.getByRole("button", { name: "Save and go to review" }).click();
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(page).toHaveURL(/\/results$/);

  // Both scenarios stay visible so removing an asset visibly changes the
  // outcome instead of quietly shrinking the estate.
  await expect(page.getByText("Items excluded by written agreement removed")).toBeVisible();
  await expect(page.getByText("Excluded").first()).toBeVisible();
});
