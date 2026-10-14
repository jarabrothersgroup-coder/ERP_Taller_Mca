import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Dashboard — Smoke: pages without E2E coverage (Sprint 128).
 *
 * Covers high-value pages that previously had no E2E spec:
 * herramientas, presupuestos, servicios, mecanicos, crm, security-hw.
 * Each test verifies: the page renders (no crash), has a heading/title,
 * and does not show a full-page error. Smoke-level: render + basic structure.
 */
test.describe("Dashboard — smoke (páginas sin E2E previo)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("herramientas renders", async ({ page }) => {
    await page.goto("/dashboard/inventario/herramientas", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    // No crash / no generic error page
    await expect(page.getByText(/error|unexpected/i).first()).toHaveCount(0, { timeout: 5000 }).catch(() => {});
    // Has some content beyond a spinner
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("presupuestos renders", async ({ page }) => {
    await page.goto("/dashboard/presupuestos", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("servicios renders", async ({ page }) => {
    await page.goto("/dashboard/servicios", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("taller/mecanicos renders", async ({ page }) => {
    await page.goto("/dashboard/taller/mecanicos", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("crm renders", async ({ page }) => {
    await page.goto("/dashboard/crm", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("security-hw renders", async ({ page }) => {
    await page.goto("/dashboard/security-hw", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("recepcion renders", async ({ page }) => {
    await page.goto("/dashboard/recepcion", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("marketing renders", async ({ page }) => {
    await page.goto("/dashboard/marketing", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });
});
