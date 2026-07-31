import { expect, test } from "@playwright/test";

test("completes the fictional intake, calculates results, downloads a package, and reviews demo proposals", async ({
  page,
}) => {
  await page.goto("/intake?demo=1");
  await expect(page.getByText(/demo mode/i).first()).toBeVisible();

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
