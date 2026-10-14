import { test, expect } from "@playwright/test";
import { BACKEND_URL, getApiAuthHeaders, loginAsAdmin } from "./auth.setup";

/**
 * Contabilidad — Cierre de período (flujo UI del Sprint 113).
 *
 * Verifica que el panel de cierre carga las operaciones de período y que el
 * diálogo "Registrar Tipo de Cambio" persiste una cotización contra
 * `/finance/contabilidad/tipos-cambio` (idempotente: upsert por
 * moneda+fecha+fuente). Se usa una fecha fija futura para que las regas de
 * la suite no colisionen con datos reales.
 *
 * @see web/src/app/(dashboard)/dashboard/contabilidad/cierre/page.tsx
 */

/** Fecha fija futura — determinista y fuera de los datos reales del taller. */
const TC_FECHA = "2099-12-31";
const TC_MONEDA = "USD";
const TC_VENTA = "7480";

test.describe("Contabilidad — Cierre de período", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("el panel de cierre carga las operaciones de período", async ({ page }) => {
    await page.goto("/dashboard/contabilidad/cierre");
    await expect(page.getByRole("heading", { name: "Cierre Contable" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Flujo Mensual")).toBeVisible();
    await expect(page.getByText("Apertura y Patrimonio")).toBeVisible();
    await expect(page.getByText("Cierre de Período")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar tipo de cambio" })).toBeVisible();
  });

  test("registra un tipo de cambio desde el panel de cierre", async ({ page, request }) => {
    const headers = await getApiAuthHeaders(request);

    await page.goto("/dashboard/contabilidad/cierre");
    await expect(page.getByRole("heading", { name: "Cierre Contable" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Registrar tipo de cambio" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Registrar Tipo de Cambio" })).toBeVisible();

    await dialog.locator("#tc-moneda").selectOption(TC_MONEDA);
    await dialog.locator("#tc-fecha").fill(TC_FECHA);
    await dialog.locator("#tc-compra").fill("7450");
    await dialog.locator("#tc-venta").fill(TC_VENTA);
    await dialog.getByRole("button", { name: "Registrar" }).click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    const res = await request.get(
      `${BACKEND_URL}/finance/contabilidad/tipos-cambio/${TC_FECHA}?moneda=${TC_MONEDA}`,
      { headers },
    );
    expect(res.ok()).toBeTruthy();
    const tc = await res.json();
    expect(Number(tc.venta)).toBe(7480);
  });
});