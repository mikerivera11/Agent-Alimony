import { expect, test, type Page } from "@playwright/test";

import { INTAKE_STEP_ORDER } from "../src/domain/intake";
import { createSampleDraft } from "../src/test/fixtures/sampleDraft";

/**
 * Drafts saved by an older version of the app.
 *
 * Drafts are persisted as plain JSON and read back with a cast, so one saved
 * before a step existed comes back missing that key entirely. Adding the
 * filing-details step turned that into a blank "This page couldn't load" on
 * the review screen for anyone with an existing draft — `ReviewSummary` maps
 * over the step list and called `Object.entries` on each step's data.
 *
 * The step list comes from the app's own model rather than being written out,
 * so these keep covering whatever the newest step happens to be.
 */
const DRAFT_STORAGE_KEY = "florida-support-guide.intake-draft.v1";

async function seedDraftMissingSteps(page: Page, omit: readonly string[]): Promise<string[]> {
  const draft = createSampleDraft() as unknown as {
    data: Record<string, unknown>;
    completedStepIds?: string[];
  };
  for (const stepId of omit) delete draft.data[stepId];
  if (Array.isArray(draft.completedStepIds)) {
    draft.completedStepIds = draft.completedStepIds.filter((id) => !omit.includes(id));
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [DRAFT_STORAGE_KEY, JSON.stringify(draft)] as const,
  );
  return errors;
}

test("a draft saved before the newest step still reaches review", async ({ page }) => {
  const newest = INTAKE_STEP_ORDER[INTAKE_STEP_ORDER.length - 1];
  const errors = await seedDraftMissingSteps(page, [newest]);

  await page.goto("/intake?step=review");

  await expect(page.getByRole("heading", { level: 1, name: "Review your answers" })).toBeVisible();
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("a draft missing every step is empty rather than broken", async ({ page }) => {
  const errors = await seedDraftMissingSteps(page, INTAKE_STEP_ORDER);

  await page.goto("/intake?step=review");

  await expect(page.getByRole("heading", { level: 1, name: "Review your answers" })).toBeVisible();
  expect(errors, errors.join("\n")).toHaveLength(0);
});
