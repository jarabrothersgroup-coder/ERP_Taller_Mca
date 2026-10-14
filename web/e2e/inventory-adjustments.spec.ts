import { test, expect, type APIRequestContext } from "@playwright/test";
import { BACKEND_URL, getApiAuthHeaders, loginAsAdmin } from "./auth.setup";

/**
 * Inventario — Ajustes de stock con aprobación (flujo UI del Sprint 113).
 *
 * Crea una solicitud desde el diálogo "Nueva Solicitud de Ajuste", la
 * aprueba y rechaza otra por el diálogo de rechazo. Toda la verificación es
 * por API contra `/inventory/adjustments/pending` (el store es en memoria,
 * vive en el backend de la suite).
 *
 * @see web/src/app/(dashboard)/dashboard/inventario/movimientos/adjustments-card.tsx
 */

const REPUESTO_CODIGO = "E2E-REPUESTO-QA";

interface AdjustmentRequest {
  id: string;
  repuestoId: string;
  cantidad: number;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
}

async function ensureRepuesto(request: APIRequestContext, headers: Record<string, string>): Promise<string> {
  const list = await (await request.get(
    `${BACKEND_URL}/inventory/repuestos?search=${REPUESTO_CODIGO}&limit=5`,
    { headers },
  )).json();
  const existing = (list.items ?? []).find((i: { codigo: string }) => i.codigo === REPUESTO_CODIGO);
  if (existing) return existing.id;

  const res = await request.post(`${BACKEND_URL}/inventory/repuestos`, {
    headers,
    data: {
      codigo: REPUESTO_CODIGO,
      descripcion: "Filtro de aceite — E2E",
      categoria: "Consumibles",
      precioCosto: 25000,
      precioVenta: 40000,
      stockActual: 50,
      stockMinimo: 5,
    },
  });
  expect(res.ok()).toBeTruthy();
  const created = await res.json();
  return created.id;
}

async function listPending(request: APIRequestContext, headers: Record<string, string>): Promise<AdjustmentRequest[]> {
  const res = await request.get(`${BACKEND_URL}/inventory/adjustments/pending`, { headers });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as AdjustmentRequest[];
}

async function createPendingAjuste(
  request: APIRequestContext,
  headers: Record<string, string>,
  repuestoId: string,
  cantidad: number,
): Promise<AdjustmentRequest> {
  const res = await request.post(`${BACKEND_URL}/inventory/adjustments`, {
    headers,
    data: { repuestoId, cantidad, motivo: "Conteo físico (E2E)" },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as AdjustmentRequest;
}

test.describe("Inventario — Ajustes de stock (aprobar / rechazar)", () => {
  let headers: Record<string, string>;
  let repuestoId: string;
  let rejectCantidad: number;

  test.beforeAll(async ({ request }) => {
    headers = await getApiAuthHeaders(request);
    repuestoId = await ensureRepuesto(request, headers);
    rejectCantidad = 150 + (Date.now() % 1000);
    await createPendingAjuste(request, headers, repuestoId, rejectCantidad);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("crea una solicitud desde el diálogo y la aprueba", async ({ page, request }) => {
    const approveCantidad = 150 + (Date.now() % 1000);

    await page.goto("/dashboard/inventario/movimientos");
    await expect(page.getByRole("heading", { name: "Movimientos de Stock" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Ajustes de Stock")).toBeVisible();

    await page.getByRole("button", { name: "Nuevo Ajuste" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Nueva Solicitud de Ajuste" })).toBeVisible();

    await dialog.locator("#ajuste-repuesto").selectOption(repuestoId);
    await dialog.locator("#ajuste-cantidad").fill(String(approveCantidad));
    await dialog.getByRole("button", { name: "Crear Solicitud" }).click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    await expect
      .poll(
        () => listPending(request, headers).then((rows) => rows.some((r) => r.cantidad === approveCantidad)),
        { timeout: 15000 },
      )
      .toBe(true);

    const pendingRow = page.locator("tbody tr").filter({ hasText: String(approveCantidad) });
    await pendingRow.getByRole("button", { name: "Aprobar" }).click();

    await expect
      .poll(
        () => listPending(request, headers).then((rows) => rows.some((r) => r.cantidad === approveCantidad)),
        { timeout: 15000 },
      )
      .toBe(false);
  });

  test("rechaza una solicitud pendiente desde el diálogo de rechazo", async ({ page, request }) => {
    await page.goto("/dashboard/inventario/movimientos");
    await expect(page.getByRole("heading", { name: "Movimientos de Stock" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Ajustes de Stock")).toBeVisible();

    const pendingRow = page.locator("tbody tr").filter({ hasText: String(rejectCantidad) });
    await pendingRow.getByRole("button", { name: "Rechazar" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Rechazar Ajuste" })).toBeVisible();
    await dialog.locator("#reject-motivo").fill("Diferencia de conteo no justificada (E2E)");
    await dialog.getByRole("button", { name: "Rechazar" }).click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    await expect
      .poll(
        () => listPending(request, headers).then((rows) => rows.some((r) => r.cantidad === rejectCantidad)),
        { timeout: 15000 },
      )
      .toBe(false);
  });
});