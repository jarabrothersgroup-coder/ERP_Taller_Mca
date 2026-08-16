import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * Page loading E2E tests.
 *
 * Verifies that all dashboard pages load correctly with their
 * expected content (titles, data tables, stats cards).
 */
test.describe("Dashboard Pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // Pages render their title as <h1>; the sidebar has <h4> section headers
  // with the same labels, so scope to the page's h1.
  const pageTitle = (page: import("@playwright/test").Page, name: string | RegExp) =>
    page.locator("h1").filter({ hasText: name }).first();

  const pageHasTable = async (page: import("@playwright/test").Page) => {
    await expect(page.locator("table, [role='grid']").first()).toBeVisible({ timeout: 15000 });
  };

  test("inventory page shows product table", async ({ page }) => {
    await page.goto("/dashboard/inventario");
    await expect(pageTitle(page, "Inventario")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("clients page shows client table", async ({ page }) => {
    await page.goto("/dashboard/clientes");
    await expect(pageTitle(page, "Clientes")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("vehicles page shows vehicle table", async ({ page }) => {
    await page.goto("/dashboard/vehiculos");
    await expect(pageTitle(page, "Vehículos")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("facturacion page shows invoice table", async ({ page }) => {
    await page.goto("/dashboard/facturacion");
    await expect(pageTitle(page, "Facturación")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("contabilidad page shows accounts table", async ({ page }) => {
    await page.goto("/dashboard/contabilidad");
    await expect(pageTitle(page, "Contabilidad")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("tesoreria page shows treasury view", async ({ page }) => {
    await page.goto("/dashboard/tesoreria");
    await expect(pageTitle(page, "Tesorería")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("calendario page shows appointments", async ({ page }) => {
    await page.goto("/dashboard/calendario");
    await expect(pageTitle(page, "Calendario")).toBeVisible({ timeout: 15000 });
  });

  test("analytics page shows KPIs", async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await expect(pageTitle(page, "Analytics")).toBeVisible({ timeout: 15000 });
  });

  test("whatsapp page shows messages", async ({ page }) => {
    await page.goto("/dashboard/whatsapp");
    await expect(pageTitle(page, "WhatsApp")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("seguridad page shows audit log", async ({ page }) => {
    await page.goto("/dashboard/seguridad");
    await expect(pageTitle(page, /seguridad/i)).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("flotas page shows fleet table", async ({ page }) => {
    await page.goto("/dashboard/flotas");
    await expect(pageTitle(page, /flotas/i)).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });

  test("config page shows settings form", async ({ page }) => {
    await page.goto("/dashboard/config");
    await expect(pageTitle(page, "Configuración")).toBeVisible({ timeout: 15000 });
  });

  test("usuarios page shows users table", async ({ page }) => {
    await page.goto("/dashboard/usuarios");
    await expect(pageTitle(page, "Usuarios")).toBeVisible({ timeout: 15000 });
    await pageHasTable(page);
  });
});
