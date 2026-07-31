import { expect, test } from "@playwright/test";

async function openAssets(page: import("@playwright/test").Page) {
  await page.goto("/intake");
  await page.getByRole("radio", { name: /All on one page/ }).click();
  return page.locator("#section-assetsDebts");
}

test("works out equity today and projects it across a range of growth rates", async ({ page }) => {
  const section = await openAssets(page);

  await section.getByLabel("Work out the equity in a home").check();
  await section.getByLabel("What is the home worth today?").fill("500000");
  await section.getByLabel("Mortgage payoff balance").fill("300000");

  await expect(section.getByText("$200,000").first()).toBeVisible();

  await section.getByText("Project how the equity could grow").click();
  await section.getByLabel("Estimated growth per year").fill("3");
  await section.getByLabel("Years to project").fill("5");

  // $500k at 3% for 5 years is $579,637; the flat $300k mortgage leaves
  // $279,637 of equity. Leverage: a 15.9% value gain is a 39.8% equity gain.
  const row = section.getByRole("row", { name: /3\.00% \(yours\)/ });
  await expect(row).toContainText("$579,637");
  await expect(row).toContainText("$279,637");
  await expect(row).toContainText("+$79,637");

  // A lone projected number reads as a prediction, so comparison rates and the
  // §61.075(7) caveat must both be on screen with it.
  await expect(section.getByRole("row", { name: /0\.00%/ })).toContainText("$200,000");
  await expect(section.getByText(/planning figures/i)).toBeVisible();
  await expect(section.getByText(/§61\.075\(7\)/).first()).toBeVisible();
});

test("reports an underwater home as a debt rather than negative equity", async ({ page }) => {
  const section = await openAssets(page);

  await section.getByLabel("Work out the equity in a home").check();
  await section.getByLabel("What is the home worth today?").fill("250000");
  await section.getByLabel("Mortgage payoff balance").fill("300000");

  await expect(section.getByText("$0").first()).toBeVisible();
  await expect(section.getByText(/\$50,000 more than the home is worth/)).toBeVisible();
});

test("flags commingled premarital savings as needing tracing", async ({ page }) => {
  const section = await openAssets(page);

  await section.getByRole("button", { name: /Add an asset or debt/ }).click();
  await section.getByLabel(/What is it/i).first().fill("Savings before marriage");
  await section.getByLabel(/shared \(marital\)/i).first().selectOption("nonmarital");

  // The commingling question only applies to separate property.
  const commingled = section.getByLabel(/mixed with shared/i);
  await expect(commingled).toBeVisible();
  await commingled.check();

  await expect(section.getByText(/tracing/i).first()).toBeVisible();
  await expect(section.getByText(/§61\.075\(6\)\(a\)1\.b/)).toBeVisible();
});
