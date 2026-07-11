import { test, expect } from "@playwright/test";

/**
 * Page loading E2E tests.
 *
 * Verifies that all dashboard pages load correctly with their
 * expected content (titles, data tables, stats cards).
 */
test.describe("Dashboard Pages", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/sign-in");
    await page.getByLabel(/taller/i).fill("taller-el-chero");
    await page.getByLabel(/correo/i).fill("jaraju01@gmail.com");
    await page.getByLabel(/contraseña/i).fill("Admin01$");
    await page.getByRole("button", { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("inventory page shows product table", async ({ page }) => {
    await page.goto("/dashboard/inventario");
    await expect(page.getByText("Inventario")).toBeVisible();
    // Should show stats cards or table
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("clients page shows client table", async ({ page }) => {
    await page.goto("/dashboard/clientes");
    await expect(page.getByText(/clientes/i)).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("vehicles page shows vehicle table", async ({ page }) => {
    await page.goto("/dashboard/vehiculos");
    await expect(page.getByText(/vehículos/i)).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("facturacion page shows invoice table", async ({ page }) => {
    await page.goto("/dashboard/facturacion");
    await expect(page.getByText("Facturación")).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("contabilidad page shows accounts table", async ({ page }) => {
    await page.goto("/dashboard/contabilidad");
    await expect(page.getByText("Contabilidad")).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("tesoreria page shows treasury view", async ({ page }) => {
    await page.goto("/dashboard/tesoreria");
    await expect(page.getByText("Tesorería")).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("calendario page shows appointments", async ({ page }) => {
    await page.goto("/dashboard/calendario");
    await expect(page.getByText("Calendario")).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("analytics page shows KPIs", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await expect(page.getByText("Analytics")).toBeVisible();
  });

  test("whatsapp page shows messages", async ({ page }) => {
    await page.goto("/dashboard/whatsapp");
    await expect(page.getByText("WhatsApp")).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("seguridad page shows audit log", async ({ page }) => {
    await page.goto("/dashboard/seguridad");
    await expect(page.getByText(/seguridad|auditoría/i)).toBeVisible();
  });

  test("flotas page shows fleet table", async ({ page }) => {
    await page.goto("/dashboard/flotas");
    await expect(page.getByText(/flotas/i)).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });

  test("config page shows settings form", async ({ page }) => {
    await page.goto("/dashboard/config");
    await expect(page.getByText("Configuración")).toBeVisible();
  });

  test("usuarios page shows users table", async ({ page }) => {
    await page.goto("/dashboard/usuarios");
    await expect(page.getByText("Usuarios")).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 10000 });
  });
});
