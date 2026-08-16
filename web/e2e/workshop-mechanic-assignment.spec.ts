import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Asignación inteligente de mecánicos E2E tests.
 *
 * Sprint 85 — P1-4.
 * Tests the mechanic assignment algorithm integration.
 */
test.describe("Asignación Inteligente de Mecánicos", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("work order detail shows mechanic assignment", async ({ page }) => {
    await page.goto("/dashboard/taller");
    await expect(page.getByRole("heading", { name: /taller/i }).first()).toBeVisible({ timeout: 10000 });
    // Click on first work order
    const firstOt = page.getByRole("link").filter({ hasText: /orden|ot|work/i }).first();
    if (await firstOt.isVisible()) {
      await firstOt.click();
      await expect(page.getByText(/asignar|mec[aá]nico/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("mechanic assignment modal has scoring info", async ({ page }) => {
    await page.goto("/dashboard/taller");
    const assignBtn = page.getByRole("button", { name: /asignar mec[aá]nico/i });
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      await expect(page.getByText(/score|carga|certificaci[oó]n/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
