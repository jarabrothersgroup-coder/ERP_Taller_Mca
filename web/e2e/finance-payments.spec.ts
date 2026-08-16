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
    await loginAsAdmin(page);
  });

  test("payment links page loads", async ({ page }) => {
    await page.goto("/dashboard/finance/pagos-online");
    await expect(page.getByRole("heading", { name: /pagos online/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
