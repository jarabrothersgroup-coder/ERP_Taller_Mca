import { test, expect, type APIRequestContext } from "@playwright/test";
import { BACKEND_URL, getApiAuthHeaders, loginAsAdmin } from "./auth.setup";

/**
 * Configuración — CRUD de Sucursales (flujo UI del Sprint 113).
 *
 * Crea con el diálogo "Nueva Sucursal", edita en "Editar Sucursal" y
 * desactiva desde el diálogo de confirmación. Verifica cada paso por API.
 *
 * @see web/src/app/(dashboard)/dashboard/config/sucursales-section.tsx
 */

interface Sucursal {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
}

async function listSucursales(request: APIRequestContext, headers: Record<string, string>): Promise<Sucursal[]> {
  const res = await request.get(`${BACKEND_URL}/config/sucursales`, { headers });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Sucursal[];
}

async function getSucursal(request: APIRequestContext, headers: Record<string, string>, id: string): Promise<Sucursal> {
  // by-id devuelve la fila completa aunque esté desactivada (la lista filtra activa=true).
  const res = await request.get(`${BACKEND_URL}/config/sucursales/${id}`, { headers });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Sucursal;
}

async function ensureSucursal(request: APIRequestContext, headers: Record<string, string>, codigo: string, nombre: string): Promise<Sucursal> {
  // codigo es UNIQUE: se usa un sufijo por corrida para no colisionar con
  // filas soft-deleteadas (invisibles en la lista, presentes en la DB).
  //
  // Limpieza previa: la tabla pagina de a 10 (orden por inserción) en el UI y
  // el cuadro de búsqueda no está cableado (sin onSearchChange), así que una
  // fila fuera de la primera página no se puede editar/eliminar desde el UI.
  // Se desactivan por API las filas de corridas anteriores para que el fixture
  // (codigo con prefijo "0", que ordena primero en asc) quede SIEMPRE en la
  // página 1 y la prueba no dependa del volumen acumulado.
  const all = await listSucursales(request, headers);
  for (const stale of all.filter((s) => s.codigo.startsWith("0") || s.codigo.startsWith("E2E-"))) {
    await request.delete(`${BACKEND_URL}/config/sucursales/${stale.id}`, { headers });
  }
  const existing = (await listSucursales(request, headers)).find((s) => s.codigo === codigo);
  if (existing) return existing;
  const res = await request.post(`${BACKEND_URL}/config/sucursales`, {
    headers,
    data: { codigo, nombre, direccion: "Av. E2E 1234", ciudad: "Asunción", departamento: "Central" },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as Sucursal;
}

test.describe("Configuración — CRUD de Sucursales", () => {
  let headers: Record<string, string>;

  test.beforeEach(async ({ request }) => {
    headers = await getApiAuthHeaders(request);
  });

  test("crea una sucursal desde el diálogo", async ({ page, request }) => {
    await loginAsAdmin(page);
    const codigo = `E2E-${Date.now()}`;
    const nombre = `Sucursal E2E ${Date.now()}`;

    await page.goto("/dashboard/config");
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Sucursales" })).toBeVisible();

    await page.getByRole("button", { name: "Nueva Sucursal" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Nueva Sucursal" })).toBeVisible();

    await dialog.locator("#suc-nombre").fill(nombre);
    await dialog.locator("#suc-codigo").fill(codigo);
    await dialog.locator("#suc-direccion").fill("Av. E2E 1234");
    await dialog.locator("#suc-ciudad").fill("Asunción");
    await dialog.locator("#suc-departamento").selectOption("Central");
    await dialog.getByRole("button", { name: "Crear Sucursal" }).click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    const rows = await listSucursales(request, headers);
    expect(rows.some((s) => s.codigo === codigo && s.nombre === nombre && s.activa)).toBeTruthy();
  });

  test("edita una sucursal desde el diálogo", async ({ page, request }) => {
    await loginAsAdmin(page);
    const ts = Date.now();
    const sucursal = await ensureSucursal(request, headers, `0ED-${ts}`, `Sucursal E2E Editar ${ts}`);
    const nuevoNombre = `Sucursal E2E Editada ${ts}`;

    await page.goto("/dashboard/config");
    await expect(page.getByRole("heading", { name: "Sucursales" })).toBeVisible({ timeout: 15000 });

    // La limpieza en ensureSucursal dejó la tabla con ≤2 filas de prueba
    // (prefijo "0"): un click en "Ordenar por Código" (asc) las lleva a la
    // página 1 de forma determinística.
    const sortBtn = page.getByRole("button", { name: /Ordenar por Código/ });
    await sortBtn.click();

    const row = page.locator("tbody tr").filter({ hasText: sucursal.codigo });
    await expect(row).toHaveCount(1, { timeout: 10000 });
    await row.getByRole("button", { name: "Editar" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Editar Sucursal" })).toBeVisible();
    await dialog.locator("#suc-nombre").fill(nuevoNombre);
    await dialog.getByRole("button", { name: "Guardar Cambios" }).click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    const rows = await listSucursales(request, headers);
    expect(rows.some((s) => s.id === sucursal.id && s.nombre === nuevoNombre)).toBeTruthy();
  });

  test("elimina (desactiva) una sucursal desde el diálogo de confirmación", async ({ page, request }) => {
    await loginAsAdmin(page);
    const ts = Date.now();
    const sucursal = await ensureSucursal(request, headers, `0DL-${ts}`, `Sucursal E2E Eliminar ${ts}`);

    await page.goto("/dashboard/config");
    await expect(page.getByRole("heading", { name: "Sucursales" })).toBeVisible({ timeout: 15000 });

    const sortBtn = page.getByRole("button", { name: /Ordenar por Código/ });
    await sortBtn.click();

    const row = page.locator("tbody tr").filter({ hasText: sucursal.codigo });
    await expect(row).toHaveCount(1, { timeout: 10000 });
    await row.getByRole("button", { name: "Eliminar" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Eliminar Sucursal" })).toBeVisible();
    await dialog.getByRole("button", { name: "Eliminar" }).click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    // La lista solo muestra activa=true → verificar por-id que quedó desactivada.
    const byId = await getSucursal(request, headers, sucursal.id);
    expect(byId.activa).toBe(false);
  });
});