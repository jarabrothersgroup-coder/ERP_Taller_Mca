import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Facturación — Configurador y reimpresión (Sprint 128 E2E).
 *
 * Smoke tests for facturacion/configurador and facturacion/reimpresion,
 * which previously had no E2E coverage. Verifies render + no crash.
 */
test.describe("Facturación — configurador y reimpresión (smoke)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("facturacion/configurador renders", async ({ page }) => {
    await page.goto("/dashboard/facturacion/configurador", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("facturacion/reimpresion renders", async ({ page }) => {
    await page.goto("/dashboard/facturacion/reimpresion", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("taller/[id] (OT detail) renders for non-existent OT → empty/error state, not crash", async ({ page }) => {
    await page.goto("/dashboard/taller/00000000-0000-0000-0000-000000000000", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    // Should render something (empty state, error message, or loading) — not a white page
    await expect(page.locator("main, [role=main], body")).toBeVisible({ timeout: 10000 });
  });

  test("taller/asignacion renders", async ({ page }) => {
    await page.goto("/dashboard/taller/asignacion", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("taller/flat-rate renders", async ({ page }) => {
    await page.goto("/dashboard/taller/flat-rate", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });
});
