import { test, expect } from "@playwright/test";
import { getApiAuthHeaders, BACKEND_URL } from "./auth.setup";
import { EXPECTED_MOBILE } from "./expected-data";

/**
 * (f) Móvil — los 4 breaks de TRN-01 cubiertos con datos reales.
 *
 * La auditoría 2026-09-25 encontró que la app llamaba a 4 endpoints que no
 * existen. T-20 reconectó el cliente (`mobile/src/api/client.ts`), pero T-62
 * dejó constancia de que **ninguno estaba cubierto**: el contrato podía volver
 * a romperse sin que nada se pusiera en rojo.
 *
 * Este spec lo cierra en la única superficie que se puede automatizar hoy
 * (la app no tiene runner de tests): contra el backend real que usa el móvil,
 * con el dataset de `scripts/seed-e2e.ts`.
 *
 * Los 4 breaks:
 *  1. `/workshop/ordenes/:id/hv-lockout` → real `sign-lockout`
 *     (requisito de seguridad EV/HEV: la firma de bloqueo de alta tensión).
 *  2. `/scheduling/citas` → real `/scheduling/appointments`.
 *  3. `/inventory/stock/movement` → real `/inventory/repuestos/salida`.
 *  4. `/intelligence/dashboard` → real `/workshop/analytics/dashboard`.
 *
 * @module web/e2e/mobile-flows-data
 */

type Headers = Record<string, string>;

/** GET que devuelve lista: acepta `{items,…}` o array plano. */
function itemsOf(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const items = (body as { items?: unknown[] })?.items;
  return Array.isArray(items) ? items : [];
}

test.describe("Móvil — TRN-01: los 4 endpoints que la app usa", () => {
  let headers: Headers;

  test.beforeEach(async ({ request }) => {
    headers = await getApiAuthHeaders(request);
  });

  test("las 4 rutas rotas del cliente móvil siguen sin existir (401/404)", async ({ request }) => {
    const broken: Array<{ method: "GET" | "POST"; path: string }> = [
      { method: "POST", path: "/workshop/ordenes/00000000-0000-0000-0000-000000000000/hv-lockout" },
      { method: "GET", path: "/scheduling/citas" },
      { method: "POST", path: "/inventory/stock/movement" },
      { method: "GET", path: "/intelligence/dashboard" },
    ];

    for (const { method, path } of broken) {
      const res = await request.fetch(`${BACKEND_URL}${path}`, {
        method,
        headers,
        ...(method === "POST" ? { data: {} } : {}),
      });
      // Rutas inexistentes nunca corren el resolver de tenant, así que el
      // auth-gate responde 401 (aunque el Bearer sea válido); 404 sólo si el
      // tenant se resolviera. Lo importante: nunca 2xx (siguen muertas).
      expect(
        [401, 404],
        `${method} ${path} no debe volver a existir (status=${res.status()})`,
      ).toContain(res.status());
    }
  });

  test("HV lockout (EV/HEV): la firma del móvil se persiste en la OT", async ({ request }) => {
    // El seed crea una OT con hvAlert (fuera de la ventana de 30 días).
    const list = await request.get(
      `${BACKEND_URL}/workshop/ordenes?search=${encodeURIComponent(EXPECTED_MOBILE.hvOrdenSearch)}&limit=10`,
      { headers },
    );
    expect(list.status()).toBe(200);
    const body = await list.json();
    const hv = itemsOf(body).find(
      (o) => (o as { hvAlert?: boolean; description?: string }).hvAlert === true,
    ) as { id: string; description: string; hvAlert: boolean } | undefined;

    expect(hv, "el seed debe sembrar la OT con protocolo HV").toBeTruthy();
    expect(hv!.description).toContain(EXPECTED_MOBILE.hvOrdenSearch);

    const sign = await request.post(`${BACKEND_URL}/workshop/ordenes/${hv!.id}/sign-lockout`, {
      headers,
      data: { mechanicId: "admin@demo.com" },
    });
    expect(sign.status()).toBe(200);
    expect(await sign.json()).toMatchObject({ signed: true });

    // El estado que lee la app ("Lockout firmado ✓") viene de acá.
    const after = await request.get(`${BACKEND_URL}/workshop/ordenes/${hv!.id}`, { headers });
    expect(after.status()).toBe(200);
    const orden = await after.json();
    expect(orden.hvAlert).toBe(true);
    expect(orden.hvLockoutSigned).toBe(true);
  });

  test("HV lockout: una OT sin alerta HV no se puede firmar (422)", async ({ request }) => {
    const list = await request.get(
      `${BACKEND_URL}/workshop/ordenes?search=${encodeURIComponent(EXPECTED_MOBILE.plainOrdenSearch)}&limit=10`,
      { headers },
    );
    expect(list.status()).toBe(200);
    const body = await list.json();
    const plain = itemsOf(body).find(
      (o) => (o as { hvAlert?: boolean }).hvAlert === false,
    ) as { id: string } | undefined;
    expect(plain, "el seed debe dejar OTs sin alerta HV").toBeTruthy();

    const res = await request.post(`${BACKEND_URL}/workshop/ordenes/${plain!.id}/sign-lockout`, {
      headers,
      data: { mechanicId: "admin@demo.com" },
    });
    expect(res.status()).toBe(422);
    expect(await res.text()).toContain("alta tensión");
  });

  test("citas: /scheduling/appointments devuelve el envelope con los turnos sembrados", async ({
    request,
  }) => {
    const res = await request.get(`${BACKEND_URL}/scheduling/appointments?limit=50`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();

    // El bug original de T-62 en la web: `json.map()` sobre este mismo envelope
    // dejaba el calendario "vacío". El móvil desenvuelve `{items}` en
    // `listAppointments`, así que el envelope ES el contrato.
    expect(Array.isArray(body.items), "debe responder {items, total, …}").toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(EXPECTED_MOBILE.appointments.length);

    for (const turno of EXPECTED_MOBILE.appointments) {
      const found = itemsOf(body).some(
        (a) =>
          (a as { horaTurno?: string; estado?: string }).horaTurno === turno.horaTurno &&
          (a as { estado?: string }).estado === turno.estado,
      );
      expect(found, `falta el turno sembrado ${turno.horaTurno}/${turno.estado}`).toBe(true);
    }

    // El teléfono viaja hasta el móvil: es lo que el booking del portal usa (T-21).
    const primerTurno = itemsOf(body).find(
      (a) => (a as { horaTurno?: string }).horaTurno === "09:00",
    ) as { clientePhone?: string };
    expect(primerTurno.clientePhone).toBe(EXPECTED_MOBILE.portalPhone);
  });

  test("stock: la salida que registra el móvil descuenta de verdad", async ({ request }) => {
    const { initial, quantity, reason } = EXPECTED_MOBILE.stockSalida;
    const codigo = `E2E-MOVIL-${Date.now()}`;

    const create = await request.post(`${BACKEND_URL}/inventory/repuestos`, {
      headers,
      data: { codigo, descripcion: "Repuesto E2E móvil", stockActual: initial, precioCosto: 1000 },
    });
    expect(create.status()).toBe(201);
    const repuesto = await create.json();
    expect(repuesto.stockActual).toBe(initial);

    const salida = await request.post(`${BACKEND_URL}/inventory/repuestos/salida`, {
      headers,
      data: { repuestoId: repuesto.id, cantidad: quantity, motivo: reason },
    });
    expect(salida.status()).toBe(200);
    const out = await salida.json();
    expect(out.repuesto.stockAnterior).toBe(initial);
    expect(out.repuesto.stockActual).toBe(initial - quantity);
    expect(out.movimiento.cantidad).toBe(quantity);

    // Persistencia: lo que la pantalla de stock muestra después del refetch.
    const after = await request.get(`${BACKEND_URL}/inventory/repuestos/${repuesto.id}`, {
      headers,
    });
    expect(after.status()).toBe(200);
    expect((await after.json()).stockActual).toBe(initial - quantity);
  });

  test("dashboard: /workshop/analytics/dashboard cuenta OTs reales", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/workshop/analytics/dashboard`, { headers });
    expect(res.status()).toBe(200);
    const kpi = await res.json();

    for (const key of ["ordenes", "finanzas", "taller", "inventario"] as const) {
      expect(typeof kpi[key], `falta la sección ${key}`).toBe("object");
    }

    // Campos que `mobile/src/api/client.ts` (getDashboard) mapea a sus stats.
    expect(typeof kpi.ordenes.totalMes).toBe("number");
    expect(typeof kpi.finanzas.ingresosMes).toBe("number");
    expect(typeof kpi.taller.facturacionPromedioOT).toBe("number");

    // Cross-check: el agregado del dashboard y el total de la lista salen de la
    // misma tabla. Si alguien cambia el GROUP BY sin tocar la lista (o al
    // revés), el número deja de coincidir aunque ambos sigan "siendo un número".
    const listo = await request.get(`${BACKEND_URL}/workshop/ordenes?status=Listo&limit=1`, {
      headers,
    });
    expect(listo.status()).toBe(200);
    const totalListo = (await listo.json()).total as number;
    expect(totalListo).toBeGreaterThanOrEqual(EXPECTED_MOBILE.listoOrders);
    expect(kpi.ordenes.listo).toBe(totalListo);
    expect(kpi.ordenes.enProceso).toBeGreaterThanOrEqual(1);
  });
});
