import { expect, test } from "@playwright/test";

/**
 * The assistant dock: one conversation, reachable from anywhere, scoped to
 * whichever section you asked from and answered from the same curated Florida
 * material the standalone page uses.
 */

test("answers a question from the section it was opened on, grounded in that section's statutes", async ({
  page,
}) => {
  await page.goto("/intake?step=assetsDebts");

  await page.getByTestId("section-assistant-assetsDebts").getByRole("button").click();

  const dock = page.getByTestId("assistant-dock");
  await expect(dock).toBeVisible();
  // The dock says what it is answering about, so the scope is never a guess.
  await expect(dock.getByText(/Answering about/i)).toContainText(/Assets, debts/i);

  // Suggested starters give people a way in before they know what to ask.
  await dock.getByRole("button", { name: /What makes an asset marital versus nonmarital/i }).click();

  // Asserted on the substance of the question and on the citation, not on any
  // particular phrasing. When ASSISTANT_PROVIDER=foundry a model rephrases the
  // same retrieved passages, so exact wording is provider-dependent; what must
  // hold either way is that the answer classifies assets and shows the statute
  // it came from.
  //
  // Both assertions target the *answer*, not the dock. Matching anywhere in the
  // dock passed the moment the question was echoed back — the starter itself
  // contains "nonmarital" — so this raced a live model call against a five
  // second default and failed most runs against the deployed app while passing
  // locally, where the fallback adapter answers instantly.
  const answer = dock.getByTestId("assistant-answer").first();
  await expect(answer).toBeVisible({ timeout: 30_000 });
  await expect(answer).toContainText(/nonmarital/i);
  // Grounded answers cite the statute they came from.
  await expect(answer).toContainText(/61\.075/);
});

test("declines to guess when the knowledge base does not cover the question", async ({ page }) => {
  await page.goto("/intake?step=alimonyFactors");

  await page.getByTestId("section-assistant-alimonyFactors").getByRole("button").click();

  const dock = page.getByTestId("assistant-dock");
  await dock.getByRole("textbox").fill("What is the best pizza topping in Naples?");
  await dock.getByRole("button", { name: "Ask", exact: true }).click();

  // Being asked from the alimony section must not turn an unanswerable
  // question into a confident answer about alimony.
  await expect(dock.getByText(/don't have verified Florida material/i)).toBeVisible({ timeout: 15_000 });
});

test("is reachable from every section of the one-page layout", async ({ page }) => {
  await page.goto("/intake");
  await page.getByRole("radio", { name: /All on one page/ }).click();

  await expect(page.getByTestId("section-assistant-income")).toBeVisible();
  await expect(page.getByTestId("section-assistant-alimonyFactors")).toBeVisible();
});

test("stays available across pages and keeps the thread while you move", async ({ page }) => {
  await page.goto("/intake?step=income");

  // Opening from the launcher picks up the section currently on screen.
  await page.getByTestId("assistant-dock-launcher").click();
  const dock = page.getByTestId("assistant-dock");
  await expect(dock.getByText(/Answering about/i)).toContainText(/income/i);

  await dock.getByRole("textbox").fill("How is child support calculated in Florida?");
  await dock.getByRole("button", { name: "Ask", exact: true }).click();
  // 30s rather than 15s: when a model is configured this round-trips to Azure.
  await expect(dock.getByText(/61\.30/).first()).toBeVisible({ timeout: 30_000 });

  // Escape closes it and the launcher brings the same conversation back.
  await page.keyboard.press("Escape");
  await expect(dock).toBeHidden();
  await page.getByTestId("assistant-dock-launcher").click();
  await expect(dock.getByText(/61\.30/).first()).toBeVisible();
});

test("can be widened from a section to anything", async ({ page }) => {
  await page.goto("/intake?step=alimonyFactors");
  await page.getByTestId("section-assistant-alimonyFactors").getByRole("button").click();

  const dock = page.getByTestId("assistant-dock");
  await expect(dock.getByText(/Answering about/i)).toBeVisible();

  await dock.getByRole("button", { name: /Ask about anything instead/i }).click();
  await expect(dock.getByText(/Answering about/i)).toHaveCount(0);
  // Falls back to the general starters.
  await expect(dock.getByRole("button", { name: /What financial documents do I have to provide/i })).toBeVisible();
});
