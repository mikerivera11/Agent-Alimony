import { expect, test } from "@playwright/test";

import { seedCompleteDraft } from "./seedDraft";

/**
 * Covers the "save, edit, and come back after finishing" journey.
 *
 * The riskiest failure here is silent: finishing the intake, changing an
 * answer, and having `/results` keep showing — and keep exporting — the old
 * figures. These tests exist mainly to make that impossible to reintroduce.
 */

test("keeps a half-finished answer when you navigate away and come back", async ({ page }) => {
  await page.goto("/intake");

  // Type into the first topic but deliberately do not submit it.
  const county = page.getByLabel(/county/i).first();
  await county.fill("Hillsborough");

  // Autosave is debounced; the indicator confirms it landed.
  await expect(page.getByTestId("saved-indicator")).toBeVisible();
  await page.waitForTimeout(1200);

  await page.reload();

  await expect(page.getByLabel(/county/i).first()).toHaveValue("Hillsborough");
});

test("resumes on the topic you were last looking at", async ({ page }) => {
  await page.goto("/intake");

  // Complete the first topic so the wizard genuinely advances off it.
  await page.getByLabel(/Florida county/i).fill("Hillsborough");
  await page.getByLabel(/Petition filing date/i).fill("2026-01-15");
  await page.getByRole("button", { name: /Save and continue/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your marriage" })).toBeVisible();

  // Leave the app entirely, then return with no query string.
  await page.goto("/legal");
  await page.goto("/intake");

  await expect(page.getByRole("heading", { level: 1, name: "Your marriage" })).toBeVisible();
});

test("deep links straight to a topic from a query string", async ({ page }) => {
  await page.goto("/intake?step=assetsDebts");
  await expect(
    page.getByRole("heading", { level: 1, name: "Assets, debts, and support obligations" }),
  ).toBeVisible();
});

test("warns and blocks export when answers change after the estimate was generated", async ({ page }) => {
  await seedCompleteDraft(page);
  await page.goto("/intake?step=review");

  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(page).toHaveURL(/\/results/);

  // A freshly confirmed estimate must not claim to be stale.
  await expect(page.getByText(/These figures are out of date/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Download PDF/i })).toBeEnabled();

  // Change an answer through the same route a person would use. The seeding
  // init script re-runs on navigation, so edit within this page load.
  await page.getByRole("link", { name: "Edit my answers" }).click();
  await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible();

  await page.getByRole("button", { name: /Gross income/i }).first().click();
  await page.getByLabel("Wages or salary").first().fill("98765");
  await page.getByRole("button", { name: /Save and continue/ }).click();

  await page.goto("/results");

  await expect(page.getByText(/These figures are out of date/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Download PDF/i })).toBeDisabled();

  // Recalculating clears the warning and restores export.
  await page.getByRole("button", { name: /Recalculate with my latest answers/i }).click();
  await expect(page.getByText(/These figures are out of date/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Download PDF/i })).toBeEnabled();
});
