import type { Page } from "@playwright/test";

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
