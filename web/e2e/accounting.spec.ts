/**
 * Accounting E2E Tests — Sprint 83
 *
 * Tests the accounting dashboard, balance general, estado de resultados,
 * and module integration pages.
 *
 * @module web/e2e/accounting
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

test.describe("Accounting Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should load the accounting dashboard", async ({ page }) => {
    await page.goto("/dashboard/contabilidad");
    await expect(page.getByRole("heading", { name: /contabilidad/i })).toBeVisible({ timeout: 10000 });

    // Should show key elements: plan de cuentas, balance, reports
    await expect(page.getByText(/plan de cuentas/i).first()).toBeVisible();
    await expect(page.getByText(/balance general/i).first()).toBeVisible();
  });

  test("should display balance general", async ({ page }) => {
    await page.goto("/dashboard/contabilidad");
    // Click on "Balance General" tab
    await page.getByText(/balance general/i).click();

    // Should see balance sections
    await expect(page.getByText(/activo/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/pasivo/i).first()).toBeVisible();
    await expect(page.getByText(/patrimonio/i).first()).toBeVisible();
  });

  test("should display estado de resultados", async ({ page }) => {
    await page.goto("/dashboard/contabilidad");
    await page.getByText(/estado de resultados/i).click();

    await expect(page.getByText(/ingresos/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/costos/i).first()).toBeVisible();
  });

  test("should show integration module status", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/integracion");

    // Should show module cards
    await expect(page.getByText(/integración contable/i).first()).toBeVisible({ timeout: 10000 });

    // Should list configuradores
    await expect(page.getByText(/compras/i).first()).toBeVisible();
    await expect(page.getByText(/sifen/i).first()).toBeVisible();
  });

  test("should show cash flow page", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/flujo-efectivo");
    await expect(page.getByText(/flujo de efectivo/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("should show equity statement page", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/evolucion-patrimonio");
    await expect(page.getByText(/evolución.*patrimonio/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("should show financial notes page", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/notas-financieras");
    await expect(page.getByText(/notas.*estados.*financieros/i).first()).toBeVisible({ timeout: 10000 });
  });
});
