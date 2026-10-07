import { test, expect } from "@playwright/test";
import { loginAsAdmin, getApiAuthHeaders, BACKEND_URL } from "./auth.setup";

/**
 * (a) Label printing — E2E con asserts de datos (T-18 / FIN-03).
 *
 * El spec anterior solo comprobaba "200 + es array + no hay error boundary",
 * que pasa con la pantalla rota (iba además a `/dashboard/taller/label-printing`,
 * una ruta que no existe). El criterio de aceptación de T-18 es:
 *
 *   "Config de impresión carga y guarda; reimpresión lista"
 *
 * y el flujo real de la página (`/dashboard/label-printing`): elegir un
 * repuesto y ver su etiqueta. Todo se contrasta contra datos de
 * `scripts/seed-e2e.ts` o contra filas que el propio spec crea.
 *
 * @module web/e2e/label-printing-data
 */

test.describe("Label printing — datos reales", () => {
  test.beforeEach(async ({ page }) => {
    // El flujo de UI (y el auth de las llamadas API de request context) vive
    // detrás del JWT de admin en localStorage.
    await loginAsAdmin(page);
  });

  test("config: carga, guarda y relee (criterio T-18)", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);

    const initial = await page.request.get(`${BACKEND_URL}/label-printing/config`, { headers });
    expect(initial.status()).toBe(200);
    const before = await initial.json();
    expect(before.printerProtocol).toBe("ESCPOS");
    expect(typeof before.paperWidthMm).toBe("number");

    // Escribe un ancho distinto al actual (no a un valor fijo: si un run
    // anterior quedó a medias, el test sigue siendo determinista).
    const original = before.paperWidthMm as number;
    const nuevo = original === 58 ? 80 : 58;

    const put = await page.request.put(`${BACKEND_URL}/label-printing/config`, {
      headers,
      data: { paperWidthMm: nuevo },
    });
    expect(put.status()).toBe(200);

    const saved = await page.request.get(`${BACKEND_URL}/label-printing/config`, { headers });
    expect((await saved.json()).paperWidthMm).toBe(nuevo);

    // Restaura: el config es del tenant, no del test.
    const restore = await page.request.put(`${BACKEND_URL}/label-printing/config`, {
      headers,
      data: { paperWidthMm: original },
    });
    expect(restore.status()).toBe(200);
    const restored = await page.request.get(`${BACKEND_URL}/label-printing/config`, { headers });
    expect((await restored.json()).paperWidthMm).toBe(original);
  });

  test("reimpresión lista: lista las facturas paginadas", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);
    const res = await page.request.get(`${BACKEND_URL}/label-printing/reimpresiones`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.pagination).toBe("object");
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(20);
    expect(typeof body.pagination.total).toBe("number");
    expect(typeof body.pagination.pages).toBe("number");
  });

  test("genera la etiqueta de un repuesto real desde la página", async ({ page }) => {
    const headers = await getApiAuthHeaders(page.request);
    const codigo = `E2E-ETQ-${Date.now()}`;

    // El spec crea su propio repuesto: no depende de que otro test haya
    // dejado uno, y su `codigo` es el que se contrasta en la vista previa.
    const create = await page.request.post(`${BACKEND_URL}/inventory/repuestos`, {
      headers,
      data: { codigo, descripcion: "Repuesto para etiqueta E2E", stockActual: 5, precioCosto: 100 },
    });
    expect(create.status()).toBe(201);
    const repuesto = await create.json();

    // Contrato del backend: el lookup por id devuelve `data` + payload ESC/POS.
    const label = await page.request.get(`${BACKEND_URL}/label-printing/repuesto/${repuesto.id}`, {
      headers,
    });
    expect(label.status()).toBe(200);
    const payload = await label.json();
    expect(payload.data.codigo).toBe(codigo);
    expect(payload.protocol).toBe("ESCPOS");
    expect(String(payload.payload).length).toBeGreaterThan(0);

    // Flujo de la UI: la página manda el id y pinta la preview en HTML.
    await page.goto("/dashboard/label-printing");
    await expect(
      page.getByRole("heading", { name: "Impresión de Etiquetas" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Algo salió mal" })).toHaveCount(0);

    // Hydration race: si el `fill` llega antes de que React hidrate, el input
    // controlado revierte el valor (React #418) y el botón queda deshabilitado
    // para siempre. `toPass` reintenta fill + value hasta que se sostenga.
    const input = page.getByPlaceholder("ID del repuesto");
    await expect(async () => {
      await input.fill(repuesto.id);
      await expect(input).toHaveValue(repuesto.id);
    }).toPass({ timeout: 15000 });
    await page.getByRole("button", { name: "Generar Etiqueta" }).first().click();

    // Sin preview no hubo contrato: el error del fetch se traga en console.error.
    await expect(page.getByText("Vista Previa")).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(codigo)).toBeVisible();
  });
});
