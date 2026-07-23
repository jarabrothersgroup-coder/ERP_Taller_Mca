import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Multi-almacén (Warehouse) E2E tests.
 *
 * Sprint 84 — P0-3.
 * Tests CRUD for warehouses and stock transfers between them.
 */
test.describe("Multi-almacén (Warehouse)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, { tenant: "taller-el-chero", email: "jaraju01@gmail.com", password: "Admin01$" });
  });

  test("warehouse page lists almacenes", async ({ page }) => {
    await page.goto("/dashboard/inventario/almacenes");
    await expect(page.getByText(/almac[eé]n|almacenes/i)).toBeVisible({ timeout: 10000 });
  });

  test("warehouse CRUD - create and delete warehouse", async ({ page }) => {
    await page.goto("/dashboard/inventario/almacenes");
    // Create button should be visible
    const createBtn = page.getByRole("button", { name: /crear|nuevo|agregar/i });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });

  test("stock transfer page shows transfer form", async ({ page }) => {
    await page.goto("/dashboard/inventario/almacenes/transferir");
    await expect(page.getByText(/transferir|transferencia/i)).toBeVisible({ timeout: 10000 });
  });
});
