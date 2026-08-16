/**
 * Accounting E2E Tests — Sprint 83
 *
 * Tests the accounting dashboard (plan de cuentas), integración contable,
 * and estado de flujo de efectivo pages.
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

    // Should show key elements: plan de cuentas and sub-navigation tabs
    await expect(page.getByText(/plan de cuentas/i).first()).toBeVisible();
    await expect(page.getByText(/integración/i).first()).toBeVisible();
    await expect(page.getByText(/flujo efectivo/i).first()).toBeVisible();
  });

  test("should display integration module status", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/integracion");

    // Should show module cards
    await expect(page.getByRole("heading", { name: /integración contable/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/configuradores/i).first()).toBeVisible();
  });

  test("should show cash flow page", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/flujo-efectivo");
    await expect(page.getByRole("heading", { name: /flujo de efectivo/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
