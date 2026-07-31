import { expect, test, type Page } from "@playwright/test";

import { seedCompleteDraft } from "./seedDraft";

/** Every dollar figure rendered on the results page, in order. */
async function resultsFigures(page: Page): Promise<string> {
  const text = await page.locator("main").innerText();
  return (text.match(/\$[\d,]+(\.\d+)?/g) ?? []).join("|");
}

async function chooseOnePage(page: Page) {
  await page.getByRole("radio", { name: /All on one page/ }).click();
  await expect(page.getByRole("heading", { name: "Everything on one page" })).toBeVisible();
}

test("the one-page layout produces exactly the same figures as the guided flow", async ({ page }) => {
  // Offering a second way in is only safe if it cannot change the answer, so
  // this compares every dollar figure on the results page rather than spot
  // checking one of them.
  await seedCompleteDraft(page);
  await page.goto("/intake");
  for (let step = 0; step < 12; step += 1) {
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.getByRole("button", { name: "Save and go to review" }).click();
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await page.waitForURL(/\/results$/);
  await expect(page.getByRole("heading", { name: "Child support (estimate)" })).toBeVisible();
  const guided = await resultsFigures(page);
  expect(guided.length).toBeGreaterThan(0);

  await page.evaluate(() => window.localStorage.clear());
  await seedCompleteDraft(page);
  await page.goto("/intake");
  await chooseOnePage(page);
  await page.getByRole("button", { name: "Check answers and review" }).click();
  await expect(page.getByRole("heading", { name: "Review your answers" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await page.waitForURL(/\/results$/);
  await expect(page.getByRole("heading", { name: "Child support (estimate)" })).toBeVisible();

  expect(await resultsFigures(page)).toBe(guided);
});

test("the one-page layout applies the same validation before review", async ({ page }) => {
  await page.goto("/intake");
  await chooseOnePage(page);

  await page.getByRole("button", { name: "Check answers and review" }).click();

  // An empty intake must not reach review just because it was filled in on one
  // page, and the person needs to be told which sections to go back to.
  await expect(page.getByRole("alert").filter({ hasText: /still need attention/i })).toBeVisible();
  await expect(page.getByRole("alert").getByRole("button", { name: "Case basics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review your answers" })).toHaveCount(0);
});

test("sections appear and disappear as the children answer changes", async ({ page }) => {
  await seedCompleteDraft(page);
  await page.goto("/intake");
  await chooseOnePage(page);

  const sections = page.locator("section[id^='section-']");
  await expect(sections).toHaveCount(13);
  await expect(page.locator("#section-parentingTime")).toHaveCount(1);

  await page.locator("#section-children").getByLabel(/no/i).first().check();

  // Parenting time and child costs only apply when there are children, and on
  // one page that has to update as the answer changes rather than on save.
  await expect(sections).toHaveCount(11);
  await expect(page.locator("#section-parentingTime")).toHaveCount(0);
  await expect(page.locator("#section-childCosts")).toHaveCount(0);
});

test("answers carry across when switching layouts", async ({ page }) => {
  await seedCompleteDraft(page);
  await page.goto("/intake");
  await chooseOnePage(page);

  const onePageCounty = page.locator("#section-caseBasics").getByLabel(/county/i).first();
  await onePageCounty.fill("Broward");
  await page.getByRole("button", { name: "Save progress" }).click();

  await page.getByRole("radio", { name: /Step by step/ }).click();

  // Switching layout is a presentation choice, so nothing typed may be lost.
  await expect(page.getByLabel(/county/i).first()).toHaveValue("Broward");
});
