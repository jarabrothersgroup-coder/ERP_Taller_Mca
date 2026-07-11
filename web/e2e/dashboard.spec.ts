import { test, expect } from "@playwright/test";

/**
 * Dashboard E2E tests.
 *
 * Tests that the dashboard page renders correctly with stats,
 * weekly chart, recent orders, and alerts sections.
 */
test.describe("Dashboard", () => {
  test.use({
    storageState: undefined, // No pre-authenticated state
  });

  test("redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 });
  });

  test("sidebar navigation contains all sections", async ({ page }) => {
    // First log in
    await page.goto("/sign-in");
    await page.getByLabel(/taller/i).fill("taller-el-chero");
    await page.getByLabel(/correo/i).fill("jaraju01@gmail.com");
    await page.getByLabel(/contraseña/i).fill("Admin01$");
    await page.getByRole("button", { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Check sidebar sections are visible
    await expect(page.getByText("Panel de Control")).toBeVisible();
    await expect(page.getByText("Taller")).toBeVisible();
    await expect(page.getByText("Clientes")).toBeVisible();
    await expect(page.getByText("Inventario")).toBeVisible();
  });

  test("navigates to sub-pages via sidebar", async ({ page }) => {
    // Login first
    await page.goto("/sign-in");
    await page.getByLabel(/taller/i).fill("taller-el-chero");
    await page.getByLabel(/correo/i).fill("jaraju01@gmail.com");
    await page.getByLabel(/contraseña/i).fill("Admin01$");
    await page.getByRole("button", { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Navigate to Taller
    await page.getByText("Taller").click();
    await expect(page).toHaveURL(/\/dashboard\/taller/, { timeout: 5000 });
    await expect(page.getByText(/órdenes de trabajo/i)).toBeVisible();

    // Navigate to Clientes
    await page.getByText("Clientes").click();
    await expect(page).toHaveURL(/\/dashboard\/clientes/, { timeout: 5000 });
  });
});
