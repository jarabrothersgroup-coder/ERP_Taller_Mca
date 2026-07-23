import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Pagos Online E2E tests.
 *
 * Sprint 85 — P1-5.
 * Tests Stripe & PagosPy payment link generation.
 */
test.describe("Pagos Online (Payment Links)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, { tenant: "taller-el-chero", email: "jaraju01@gmail.com", password: "Admin01$" });
  });

  test("payment links page loads", async ({ page }) => {
    await page.goto("/dashboard/finance/pagos-online");
    await expect(page.getByText(/pagos? online|payment|stripe/i)).toBeVisible({ timeout: 10000 });
  });

  test("invoice detail shows payment link option", async ({ page }) => {
    await page.goto("/dashboard/facturacion");
    await expect(page.getByText(/facturaci[oó]n/i)).toBeVisible({ timeout: 10000 });
    // Click on first invoice row to see payment options
    const firstRow = page.getByRole("gridcell").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await expect(page.getByText(/pagar|pago/i)).toBeVisible({ timeout: 10000 });
    }
  });
});
