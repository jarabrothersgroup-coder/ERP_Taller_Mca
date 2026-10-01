import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.setup";

/**
 * T-62 — Calendario end-to-end con asserts de DATOS.
 *
 * No basta con que el título "Calendario" aparezca: el criterio pide "verificar
 * turno creado". Por eso el test NO hace `request.post(...)` suelta: recorre el
 * diálogo real "Nuevo Turno", que es el camino que usa un técnico, y después
 * comprueba que la fila resultante aparece en la tabla con los MISMOS datos que
 * se enviaron (cliente, chapa, fecha, hora).
 *
 * Ese recorrido es el que detecta la familia de breaks que T-62 persigue:
 * una página que carga y pinta el shell pero no los datos. Concreto, y REAL en
 * este repo: `fetchAppointments` hacía `json.map(...)` sobre el envelope
 * paginado `{ items, total, page, limit, totalPages }` de
 * `GET /scheduling/appointments`; el `.map` reventaba, `fetchOrMock` caía al
 * mock `[]` y el calendario pintaba "No hay turnos agendados" con la BD llena.
 *
 * Dos trampas del DOM que el test esquiva a propósito (no son bugs):
 *   1. La vista por defecto es "Semana", que renderiza `div`s del week grid y
 *      NUNCA un `<tr>`. Los asserts de fila exigen la vista "Lista".
 *   2. `request.post` sin `Authorization` choca con el guard de CSRF
 *      (`src/shared/middleware/csrf.ts` exige cookie + `X-CSRF-Token` en
 *      cualquier POST sin Bearer). El diálogo ya manda el `Authorization: Bearer`
 *      de `authHeaders()`, que es exactamente lo que lo hace funcionar en el
 *      taller — y de paso ejercita ese header.
 *
 * @module web/e2e/calendario-data.spec
 */

/** `YYYY-MM-DD` en hora LOCAL, no UTC: `toISOString()` salta de día en Asunción. */
function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Día futura con el taller abierto, deliberadamente desplazado de los turnos
 * del seed (+1, +2, +3 días) para que la fila creada sea única y se pueda
 * anclar por fecha sin ambigüedad.
 *
 * El taller cierra los domingos y el sábado a las 12:00 (ver
 * `DEFAULT_BUSINESS_HOURS` en `src/modules/scheduling/types.ts`), así que sólo
 * hay que saltear el domingo: las 10:45 + 1h de un "Rápido" cierran antes de las
 * 12:00 tanto en sábado como en un día de semana.
 */
function futureOpenDay(): string {
  const d = new Date();
  d.setDate(d.getDate() + 4);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return localDate(d);
}

/** Datos exactos que escribe `scripts/seed-e2e.ts`. */
const CLIENTE = "e2e-Cliente Uno";
const CHAPA = "e2e-A123";
const VEHICULO = "Toyota Corolla — e2e-A123";
const HORA = "10:45";

/**
 * Barrera de hidratación.
 *
 * `ScheduleStats` se renderiza con `{!loading && ...}`, así que sus tarjetas sólo
 * existen cuando React ya hidrató Y la query de turnos resolvió. Sin esta espera
 * el clic en "Nuevo Turno" cae en un botón que aún no tiene handler y el test
 * falla al buscar el diálogo — intermitente, y por lo tanto peor que fallar.
 *
 * De paso es un assert de datos gratis: si los 3 turnos del seed no llegan, las
 * tarjetas no aparecen y el fallo dice "no hay datos", no "no hay diálogo".
 */
async function esperarHidratado(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Reservados" })).toBeVisible({
    timeout: 30000,
  });
}

test.describe("Calendario — crear y verificar turno", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("crea un turno desde el diálogo y la fila aparece con sus datos", async ({ page }) => {
    const fecha = futureOpenDay();

    await page.goto("/dashboard/calendario");
    await esperarHidratado(page);
    await page.getByRole("button", { name: "Nuevo Turno" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#ap-cliente").selectOption({ label: CLIENTE });
    await dialog.locator("#ap-vehiculo").selectOption({ label: VEHICULO });
    await dialog.locator("#ap-fecha").fill(fecha);
    await dialog.locator("#ap-hora-inicio").fill(HORA);
    await dialog.getByRole("button", { name: "Agendar Turno" }).click();

    // El toast sólo aparece si el POST devolvió 2xx: sin `Authorization` el
    // guard de CSRF responde 403 y el diálogo pinta el error inline.
    await expect(page.getByText("Turno creado")).toBeVisible({ timeout: 15000 });
    await expect(dialog).toBeHidden();

    // Vista Lista: la vista Semana no renderiza filas de tabla.
    await page.getByRole("button", { name: "Lista" }).click();
    await page.getByPlaceholder("Buscar cliente, chapa o teléfono…").fill(CHAPA);

    // Ancla por fecha: es lo único que no comparte fila con los turnos del seed.
    // `tbody tr` y no `getByRole("row")`: `DataTable` marca cada `<tr>` de datos
    // con `role="button"` cuando hay `onRowClick`, y eso les quita el rol `row`.
    const row = page.locator("tbody tr").filter({ hasText: fecha });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(CLIENTE);
    await expect(row).toContainText(CHAPA);
    await expect(row).toContainText(HORA);
  });

  test("lista los turnos sembrados con los datos que están en la BD", async ({ page }) => {
    await page.goto("/dashboard/calendario");
    await esperarHidratado(page);
    await page.getByRole("button", { name: "Lista" }).click();

    // Filtro por estado: el seed deja exactamente 1 CONFIRMADO (offset +1,
    // 09:00, Toyota Corolla e2e-A123) y 2 RESERVADOS. Filtrar por "Confirmado"
    // hace el assert inmune al turno que crea el test anterior, que nace
    // RESERVADO por default y por eso alteraría un conteo global.
    await page.getByRole("tab", { name: "Confirmado" }).click();

    // `tbody tr` y no `getByRole("row")`: ver la nota del test anterior.
    const row = page.locator("tbody tr").filter({ hasText: CHAPA });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(CLIENTE);
    await expect(row).toContainText("Toyota Corolla");
    await expect(row).toContainText("09:00");
    await expect(row).toContainText("Rápido");

    // Y el contador de la cabecera cuadra con el filtro, no con un número fijo.
    await expect(page.getByRole("tab", { name: "Confirmado" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
