import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Dashboard E2E tests.
 *
 * Tests that the dashboard renders, sidebar navigation works and
 * unauthenticated users are redirected to sign-in.
 */
test.describe("Dashboard", () => {
  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 });
  });

  test("sidebar navigation contains all sections", async ({ page }) => {
    await loginAsAdmin(page);

    // Sidebar section labels (sidebar renders twice: desktop + mobile drawer)
    await expect(page.getByText("Panel Ejecutivo").first()).toBeVisible();
    await expect(page.getByText("ERP Taller").first()).toBeVisible();
    await expect(page.getByText("Clientes").first()).toBeVisible();
    await expect(page.getByText("Inventario").first()).toBeVisible();
  });

  test("navigates to sub-pages via sidebar", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to Calendario
    // Timeout amplio: en modo dev la primera compilación de la página
    // puede tardar varios segundos y el router cliente no navega hasta completar.
    await page.getByRole("link", { name: /calendario/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/calendario/, { timeout: 20000 });

    // Navigate to Clientes
    await page.getByRole("link", { name: /clientes/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/clientes/, { timeout: 20000 });
  });
});
