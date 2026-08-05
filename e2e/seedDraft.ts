import type { Page } from "@playwright/test";

import { getApplicableStepIds } from "../src/domain/intake";
import { createSampleDraft } from "../src/test/fixtures/sampleDraft";

/** Must match `STORAGE_KEY` in `src/domain/intake/storage.ts`. */
const DRAFT_STORAGE_KEY = "florida-support-guide.intake-draft.v1";

/**
 * Seeds a complete fictional draft straight into localStorage before the page
 * loads.
 *
 * The app used to ship a `?demo=1` route that did this for us, but a fictional
 * sample case has no business being reachable in a product where every other
 * number on screen is the user's own. Seeding from the test keeps the coverage
 * without shipping the shortcut: the browser sees exactly the state it would be
 * in after a real person filled in all thirteen sections.
 */
export async function seedCompleteDraft(page: Page): Promise<void> {
  const draft = createSampleDraft();
  await page.addInitScript(
    ([key, value]) => {
      // `addInitScript` runs on every navigation, so this must not clobber
      // work the test has already done — a test that edits an answer and then
      // navigates would otherwise silently get the pristine fixture back.
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    [DRAFT_STORAGE_KEY, JSON.stringify(draft)] as const,
  );
}

/**
 * Puts the browser back to the state of someone who has never used the app.
 *
 * Clearing localStorage is *not* enough, and assuming it was made this suite
 * pass locally while failing roughly one run in three against the deployed app.
 * The draft is mirrored to the server and keyed on a session cookie, and
 * `syncedStorage.load()` deliberately prefers the server copy — that is what
 * makes "come back tomorrow" work. Wiping only localStorage therefore leaves
 * the session intact, so the next `/intake` load quietly restores the finished
 * case from the API and opens on the review screen, where the controls a fresh
 * visitor sees do not exist. It is a race, which is why it was intermittent,
 * and it never reproduced locally because there is no database there for the
 * server copy to live in.
 */
export async function startFreshSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
}

/**
 * The intake steps the seeded draft actually walks through.
 *
 * Derived from the app's own step model rather than written out, because these
 * tests previously hard coded "thirteen steps" and silently went red the day a
 * fourteenth was added. A count that comes from the same source the screen
 * renders from cannot drift away from it.
 */
export function sampleDraftStepIds(): string[] {
  return getApplicableStepIds(createSampleDraft().data);
}

/**
 * Walks the guided wizard from the first step to the review screen.
 */
export async function advanceGuidedIntakeToReview(page: Page): Promise<void> {
  const stepCount = sampleDraftStepIds().length;
  for (let step = 0; step < stepCount - 1; step += 1) {
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.getByRole("button", { name: "Save and go to review" }).click();
}

/**
 * Walks the guided wizard from whichever step is on screen through to the
 * review screen. Counting the remaining steps from the step model rather than
 * by hand is what keeps this from rotting when a step is added.
 */
export async function advanceGuidedIntakeFromStepToReview(page: Page, stepId: string): Promise<void> {
  const stepIds = sampleDraftStepIds();
  const index = stepIds.indexOf(stepId);
  if (index < 0) throw new Error(`"${stepId}" is not an applicable step for the sample draft.`);
  for (let step = index; step < stepIds.length - 1; step += 1) {
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await page.getByRole("button", { name: "Save and go to review" }).click();
}

/**
 * Walks the guided wizard forward until `stepId` is on screen.
 *
 * The position is looked up in the step model rather than counted by hand, so
 * inserting a step earlier in the intake moves this along with it.
 */
export async function advanceGuidedIntakeToStep(page: Page, stepId: string): Promise<void> {
  const index = sampleDraftStepIds().indexOf(stepId);
  if (index < 0) throw new Error(`"${stepId}" is not an applicable step for the sample draft.`);
  for (let step = 0; step < index; step += 1) {
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
}
