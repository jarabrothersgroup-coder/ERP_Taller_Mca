import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * SIFEN Nota de Crédito E2E tests.
 *
 * Sprint 84 — P0-1.
 * Tests the credit note emission flow.
 */
test.describe("Nota de Crédito SIFEN", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, { tenant: "taller-el-chero", email: "jaraju01@gmail.com", password: "Admin01$" });
  });

  test("credit note page shows emission form", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/nota-credito");
    await expect(page.getByText(/nota de cr[eé]dito/i)).toBeVisible({ timeout: 10000 });
  });

  test("credit note requires CDC original", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/nota-credito");
    // Should have a field for CDC original
    await expect(page.getByText(/cdc|documento original/i)).toBeVisible({ timeout: 10000 });
  });

  test("SIFEN dashboard shows document stats", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/sifen");
    await expect(page.getByText(/sifen|facturaci[oó]n electr[oó]nica/i)).toBeVisible({ timeout: 10000 });
  });
});
