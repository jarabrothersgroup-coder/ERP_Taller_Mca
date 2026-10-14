import { test, expect, type APIRequestContext } from "@playwright/test";
import { BACKEND_URL, getApiAuthHeaders, loginAsAdmin } from "./auth.setup";

/**
 * Tesorería — Transferencia entre cuentas (flujo UI del Sprint 113).
 *
 * Ejercita el `TransferDialog` de `/dashboard/tesoreria` contra el backend
 * real: crea dos cuentas bancarias idempotentes por código, envía una
 * transferencia desde la UI y la verifica por API. Las transferencias se
 * registran como un egreso (tipo "EGRESO") en origen y un ingreso (tipo
 * "INGRESO") en destino, ambos con `medioPago = "TRANSFERENCIA"`, por lo que
 * la verificación filtra por `medioPago` + concepto.
 *
 * @see web/src/app/(dashboard)/dashboard/tesoreria/transfer-dialog.tsx
 */

const CTA_ORIGEN_CODIGO = "E2E-QA-ORIGEN";
const CTA_DESTINO_CODIGO = "E2E-QA-DESTINO";

interface BankAccount {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

async function ensureCuenta(request: APIRequestContext, headers: Record<string, string>, codigo: string, nombre: string) {
  const list = await request.get(`${BACKEND_URL}/finance/treasury/cuentas`, { headers });
  const cuentas = (await list.json()) as BankAccount[];
  const existing = cuentas.find((c) => c.codigo === codigo);
  if (existing) return existing;

  const res = await request.post(`${BACKEND_URL}/finance/treasury/cuentas`, {
    headers,
    data: {
      codigo,
      nombre,
      tipo: "Corriente",
      moneda: "PYG",
      saldoInicial: "1000000",
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as BankAccount;
}

test.describe("Tesorería — Transferencia entre cuentas", () => {
  let headers: Record<string, string>;
  let origen: BankAccount;
  let destino: BankAccount;

  test.beforeAll(async ({ request }) => {
    headers = await getApiAuthHeaders(request);
    [origen, destino] = [
      await ensureCuenta(request, headers, CTA_ORIGEN_CODIGO, "Cuenta E2E Origen"),
      await ensureCuenta(request, headers, CTA_DESTINO_CODIGO, "Cuenta E2E Destino"),
    ];
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("transfiere fondos desde el diálogo y registra egreso + ingreso", async ({ page, request }) => {
    const concepto = `E2E transferencia ${Date.now()}`;

    await page.goto("/dashboard/tesoreria");
    await expect(page.getByRole("heading", { name: "Tesorería" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Transferir" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Transferencia entre Cuentas" })).toBeVisible();

    await dialog.locator("#tr-origen").selectOption(origen.id);
    await dialog.locator("#tr-destino").selectOption(destino.id);
    await dialog.locator("#tr-monto").fill("75000");
    await dialog.locator("#tr-concepto").fill(concepto);
    await dialog.getByRole("button", { name: "Transferir" }).click();

    await expect(dialog).toBeHidden({ timeout: 15000 });

    const egresos = await (await request.get(
      `${BACKEND_URL}/finance/treasury/movimientos?cuentaId=${origen.id}`,
      { headers },
    )).json();
    expect(
      egresos.some(
        (m: any) =>
          m.medioPago === "TRANSFERENCIA" &&
          m.concepto.includes(concepto) &&
          Number(m.monto) === 75000,
      ),
    ).toBeTruthy();

    const ingresos = await (await request.get(
      `${BACKEND_URL}/finance/treasury/movimientos?cuentaId=${destino.id}`,
      { headers },
    )).json();
    expect(
      ingresos.some(
        (m: any) =>
          m.medioPago === "TRANSFERENCIA" &&
          m.concepto.includes(concepto) &&
          Number(m.monto) === 75000,
      ),
    ).toBeTruthy();
  });
});