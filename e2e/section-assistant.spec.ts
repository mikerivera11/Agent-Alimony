import { expect, test } from "@playwright/test";

/**
 * The per-section assistant: a question asked next to the fields it is about,
 * answered from the same curated Florida material the standalone page uses.
 */

test("answers a question inline, grounded in the section's statutes", async ({ page }) => {
  await page.goto("/intake?step=assetsDebts");

  const panel = page.getByTestId("section-assistant-assetsDebts");
  await expect(panel).toBeVisible();

  await panel.getByRole("button", { name: /Have a question about/i }).click();

  // Suggested starters give people a way in before they know what to ask.
  await panel.getByRole("button", { name: /What makes an asset marital versus nonmarital/i }).click();

  await expect(panel.getByText(/equitable distribution/i).first()).toBeVisible({ timeout: 15_000 });
  // Grounded answers cite the statute they came from.
  await expect(panel.getByText(/61\.075/).first()).toBeVisible();
});

test("declines to guess when the knowledge base does not cover the question", async ({ page }) => {
  await page.goto("/intake?step=alimonyFactors");

  const panel = page.getByTestId("section-assistant-alimonyFactors");
  await panel.getByRole("button", { name: /Have a question about/i }).click();

  await panel.getByRole("textbox").fill("What is the best pizza topping in Naples?");
  await panel.getByRole("button", { name: "Ask" }).click();

  // Being asked from the alimony section must not turn an unanswerable
  // question into a confident answer about alimony.
  await expect(panel.getByText(/don't have verified Florida material/i)).toBeVisible({ timeout: 15_000 });
});

test("is available on every section of the one-page layout", async ({ page }) => {
  await page.goto("/intake");
  await page.getByRole("radio", { name: /All on one page/ }).click();

  await expect(page.getByTestId("section-assistant-income")).toBeVisible();
  await expect(page.getByTestId("section-assistant-alimonyFactors")).toBeVisible();
});
