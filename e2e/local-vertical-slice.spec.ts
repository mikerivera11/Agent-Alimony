import { expect, test } from "@playwright/test";

import {
  advanceGuidedIntakeFromStepToReview,
  advanceGuidedIntakeToReview,
  advanceGuidedIntakeToStep,
  seedCompleteDraft,
} from "./seedDraft";

test("completes the intake, calculates results, downloads a package, and reviews extraction proposals", async ({
  page,
}) => {
  await seedCompleteDraft(page);
  await page.goto("/intake");

  await advanceGuidedIntakeToReview(page);

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

  await advanceGuidedIntakeToStep(page, "assetsDebts");
  await expect(page.getByRole("heading", { level: 1, name: "Assets, debts, and support obligations" })).toBeVisible();

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

  await advanceGuidedIntakeFromStepToReview(page, "assetsDebts");
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(page).toHaveURL(/\/results$/);

  // Both scenarios stay visible so removing an asset visibly changes the
  // outcome instead of quietly shrinking the estate.
  await expect(page.getByText("Items excluded by written agreement removed")).toBeVisible();
  await expect(page.getByText("Excluded").first()).toBeVisible();
});

test("offers the attorney filing packet only when it was asked for", async ({ page }) => {
  // The packet is the one section that collects home addresses and full legal
  // names, so the gate on it earning its keep matters as much as the download.
  await seedCompleteDraft(page);
  await page.goto("/intake");
  await advanceGuidedIntakeToReview(page);
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(page).toHaveURL(/\/results$/);

  await expect(page.getByRole("heading", { name: "Attorney filing packet" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download filing packet" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("attorney-filing-packet.pdf");
});

test("hides the filing packet for someone who only wanted an estimate", async ({ page }) => {
  await seedCompleteDraft(page);
  // Registered after the seed so it runs after it: init scripts run in the
  // order they were added, and this one edits what the seed just wrote.
  await page.addInitScript(() => {
    // Turn the opt-in back off in the seeded draft, the way someone who left
    // the last step alone would have it.
    const key = "florida-support-guide.intake-draft.v1";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft?.data?.filingDetails) draft.data.filingDetails.wantsFilingPacket = "no";
    window.localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.goto("/intake");
  await advanceGuidedIntakeToReview(page);
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(page).toHaveURL(/\/results$/);

  await expect(page.getByRole("heading", { name: "Child support (estimate)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attorney filing packet" })).toHaveCount(0);
});

test("runs a what-if against the real calculators without touching the saved case", async ({ page }) => {
  await seedCompleteDraft(page);
  await page.goto("/intake");
  await advanceGuidedIntakeToReview(page);
  await page.getByRole("button", { name: "Confirm and finish" }).click();
  await expect(page).toHaveURL(/\/results$/);

  const savedFigure = page.getByTestId("child-support-transfer-amount");
  await expect(savedFigure).toBeVisible();
  const savedChildSupport = (await savedFigure.textContent()) ?? "";
  expect(savedChildSupport).not.toBe("");

  const panel = page.getByTestId("what-if-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/nothing here is saved to your case/i)).toBeVisible();

  await panel.getByLabel("Your monthly gross income").fill("25000");
  await panel.getByRole("button", { name: "Try this what-if" }).click();

  const result = page.getByTestId("what-if-result");
  await expect(result).toBeVisible();
  // The echo is the safeguard: a person has to be able to see which number
  // was used, not just the answer it produced.
  await expect(result).toContainText("Your monthly gross income:");
  await expect(result).toContainText("$25,000");
  await expect(result).toContainText(/hypothetical/i);

  // The point of a what-if is that it recalculates. If the figure came back
  // identical to the saved one, the override never reached the engine.
  await expect(page.getByTestId("what-if-child-support")).not.toHaveText(savedChildSupport);

  // The saved estimate above must be exactly as it was. A what-if that
  // quietly rewrote the case would be the worst possible outcome here.
  await expect(savedFigure).toHaveText(savedChildSupport);

  // And it must survive a reload, i.e. nothing was persisted.
  await page.reload();
  await expect(page.getByTestId("what-if-result")).toHaveCount(0);
  await expect(page.getByTestId("child-support-transfer-amount")).toHaveText(savedChildSupport);
});
