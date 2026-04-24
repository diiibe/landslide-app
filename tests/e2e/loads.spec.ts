import { test, expect } from "@playwright/test";

test("app loads and shows drawer groups", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("FVG Landslide")).toBeVisible();
  await expect(page.getByRole("button", { name: /^view/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^monitoring/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^analytics/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^model/i })).toBeVisible();
});

test("J.3 button in LayersPanel exists", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^J\.3$/ }).first()).toBeVisible();
});

test("collapsing drawer flips data attribute", async ({ page }) => {
  await page.goto("/");
  const handle = page.getByRole("button", { name: /toggle side panel/i });
  await handle.click();
  await expect(page.locator('[data-drawer="closed"]').first()).toBeVisible();
});
