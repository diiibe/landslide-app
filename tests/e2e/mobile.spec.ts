import { test, expect, devices } from "@playwright/test";

test.describe("mobile @ 360x640", () => {
  test.use({ viewport: { width: 360, height: 640 }, hasTouch: true });

  test("drawer starts closed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-drawer="closed"]').first()).toBeVisible();
  });

  test("tapping the handle opens the drawer", async ({ page }) => {
    await page.goto("/");
    const handle = page.getByRole("button", { name: /toggle side panel/i });
    await handle.tap();
    await expect(page.locator('[data-drawer="open"]').first()).toBeVisible();
  });

  test("tapping the backdrop closes the drawer", async ({ page }) => {
    await page.goto("/");
    const handle = page.getByRole("button", { name: /toggle side panel/i });
    await handle.tap();
    await expect(page.locator('[data-drawer="open"]').first()).toBeVisible();

    // Tap on the visible backdrop (left side of viewport, well away from the panel).
    await page.mouse.click(20, 320);
    await expect(page.locator('[data-drawer="closed"]').first()).toBeVisible();
  });

  test("Escape key closes the drawer on mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /toggle side panel/i }).tap();
    await expect(page.locator('[data-drawer="open"]').first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-drawer="closed"]').first()).toBeVisible();
  });

  test("no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflowed).toBe(false);
  });

  test("topbar brand and theme toggle stay inside viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("FVG Landslide")).toBeVisible();
    await expect(page.getByRole("button", { name: /toggle (light|dark) theme/i })).toBeVisible();
  });

  test("basemap pill touch target ≥ 44px", async ({ page }) => {
    await page.goto("/");
    // Open the drawer is not needed — basemap pills live in the LayersPanel overlay
    // which is on the map even when the drawer is closed. Open the panel head.
    const head = page.getByRole("button", { name: /^layers/i }).first();
    if (await head.isVisible()) await head.tap();

    const pill = page.getByRole("button", { name: /^outdoors$/i }).first();
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("tablet @ 768x1024", () => {
  test.use({ viewport: { width: 768, height: 1024 }, hasTouch: true });

  test("drawer starts closed at the breakpoint (max-width: 768px is inclusive)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator('[data-drawer="closed"]').first()).toBeVisible();
  });

  test("no horizontal overflow at 768px", async ({ page }) => {
    await page.goto("/");
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflowed).toBe(false);
  });
});

test.describe("iPhone 14 Pro device profile", () => {
  test.use({ ...devices["iPhone 14 Pro"] });

  test("loads and renders without overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("FVG Landslide")).toBeVisible();
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflowed).toBe(false);
  });
});
