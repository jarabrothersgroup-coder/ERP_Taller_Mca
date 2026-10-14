import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Inventario — páginas sin E2E (Sprint 128).
 *
 * Smoke tests for inventario sub-pages previously without E2E coverage:
 * conteo, ordenes-compra, tecdoc, herramientas (already in dashboard-smoke).
 */
test.describe("Inventario — smoke (páginas sin E2E previo)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("inventario/conteo renders", async ({ page }) => {
    await page.goto("/dashboard/inventario/conteo", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("inventario/ordenes-compra renders", async ({ page }) => {
    await page.goto("/dashboard/inventario/ordenes-compra", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("inventario/tecdoc renders", async ({ page }) => {
    await page.goto("/dashboard/inventario/tecdoc", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Contabilidad — páginas sin E2E (Sprint 128).
 */
test.describe("Contabilidad — smoke (páginas sin E2E previo)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("contabilidad/diagnostico renders", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/diagnostico", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("contabilidad/evolucion-patrimonio renders", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/evolucion-patrimonio", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });

  test("contabilidad/notas-financieras renders", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/notas-financieras", { timeout: 30000 });
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("main, [role=main], [data-testid]").first()).toBeVisible({ timeout: 10000 });
  });
});
