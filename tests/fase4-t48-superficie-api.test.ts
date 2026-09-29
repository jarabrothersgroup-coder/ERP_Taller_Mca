/**
 * T-48 · Saneamiento de superficie de API
 *
 * Auditoría 2026-09-25 · Fase 4 (cierre de T-47).
 *
 * T-47 inventarió 255 endpoints que ningún código exercise. Al sondearlos contra
 * un servidor real, 6 estaban rotos de origen. Estos tests los fijan para que no
 * vuelvan a romperse en silencio: sin ellos, ninguna CI los tocaría nunca.
 *
 * Cada test cubre un defecto con causa raíz ya identificada — no es cobertura
 * por exercising, es cobertura de regresión de un bug concreto.
 *
 * Nota de método: estos casos se verificaron primero con `curl` contra un
 * servidor real (`tsx src/app.ts`), no solo con `app.inject`. Bajo vitest la
 * transformación SSR de drizzle rompe `sql` en cinco rutas y produce falsos
 * positivos; ver Docs/T47_INVENTARIO_RUTAS_SIN_CONSUMIDOR.md.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
import { NotFoundError } from "../src/shared/errors/app-error.js";
import { getRateAtDate } from "../src/modules/finance/services/accounting/exchange-rate.service.js";
import { getAvailableTables, getExportPreview } from "../src/modules/migration/migration.service.js";
import {
  getConsolidatedBalance,
  getConsolidatedPnL,
} from "../src/modules/finance/services/accounting/consolidated-report.service.js";

const T = "e2e-t48-surface";
const T_ID = "00000000-0000-0000-0000-0000f4800001";
const OTRO_ID = "00000000-0000-0000-0000-0000f4800002";
const ADMIN = "00000000-0000-0000-0000-0000f4800010";
const OT_ID = "00000000-0000-0000-0000-0000f4800999";
const VEHICULO = "00000000-0000-0000-0000-0000f4800998";
const CLIENTE = "00000000-0000-0000-0000-0000f4800997";
const INEXISTENTE = "00000000-0000-0000-0000-0000f4888888";
const EMAIL = "admin@e2e-t48.test";

let app: Awaited<ReturnType<typeof buildApp>>;
let token: string;

describe("T-48 · superficie de API", () => {
  beforeAll(async () => {
    const sql = getDb() as any;
    await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES (${T_ID}, ${T}, ${T}, ${T}, true), (${OTRO_ID}, ${"e2e-t48-otro"}, ${"e2e-t48-otro"}, ${"e2e-t48-otro"}, true)
      ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ADMIN}, ${T_ID}, ${EMAIL}, 'Admin T48', 'admin', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;

    app = await buildApp();
    await app.ready();
    token = generateToken({
      id: ADMIN,
      email: EMAIL,
      role: "admin",
      tenantId: T_ID,
      tenantSlug: T,
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    const sql = getDb() as any;
    await sql`DELETE FROM public.profiles WHERE tenant_id = ${T_ID}`;
    await sql`DELETE FROM public.tenants WHERE id = ${T_ID}`;
    await sql`DELETE FROM public.tenants WHERE id = ${OTRO_ID}`;
  }, 120_000);

  const auth = () => ({ authorization: `Bearer ${token}`, "x-tenant-slug": T });

  // ── 1. digital_signatures no existía (migración 0034) ────────────────
  it("la tabla digital_signatures existe y las rutas de firma responden", async () => {
    const sql = getDb() as any;
    const existe = await sql`
      SELECT to_regclass('public.digital_signatures') IS NOT NULL AS ok`;
    expect(existe[0].ok).toBe(true);

    // GET con orden inexistente: lista vacía, no 42P01.
    const res = await app.inject({
      method: "GET",
      url: `/workshop/signatures/${INEXISTENTE}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("guarda una firma y la recupera, con tenant-scoped", async () => {
    const sql = getDb() as any;
    // Idempotencia: si una corrida anterior falló a mitad del happy path, la
    // firma ya estaba persistida y el residuo se acumula (el INSERT no es
    // idempotente y la OT existe por ON CONFLICT DO NOTHING). Borrar la OT
    // arrastra las firmas por CASCADE; sin esto, cada reintento suma una firma.
    await sql`DELETE FROM ordenes_trabajo WHERE id = ${OT_ID}`;
    await sql`DELETE FROM vehiculos WHERE id = ${VEHICULO}`;
    await sql`DELETE FROM clients WHERE id = ${CLIENTE}`;
    // La FK digital_signatures → ordenes_trabajo exige una OT real, y la OT
    // exige cliente y vehículo reales. Cadena mínima verificada contra el esquema:
    //   clients(id,name,tenant_slug) → vehiculos(id,client_id,brand,model,
    //   engine_type,tenant_slug) → ordenes_trabajo(id,vehicle_id,client_id,status,
    //   hv_alert,hv_lockout_signed,tenant_slug)
    // engine_type es el enum tipo_motor: Nafta | Diésel | HEV | BEV.
    await sql`INSERT INTO clients (id, name, tenant_slug)
      VALUES (${CLIENTE}, ${"Cliente T48"}, ${T}) ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO vehiculos (id, client_id, brand, model, engine_type, tenant_slug)
      VALUES (${VEHICULO}, ${CLIENTE}, ${"Toyota"}, ${"Hilux"}, ${"Nafta"}, ${T})
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO ordenes_trabajo (id, vehicle_id, client_id, status, tenant_slug)
      VALUES (${OT_ID}, ${VEHICULO}, ${CLIENTE}, ${"En_Proceso"}, ${T})
      ON CONFLICT (id) DO NOTHING`;

    const alta = await app.inject({
      method: "POST",
      url: "/workshop/signatures",
      headers: { ...auth(), "content-type": "application/json" },
      payload: {
        ordenTrabajoId: OT_ID,
        tipo: "AUTORIZACION",
        firmaBase64: "iVBORw0KGgoAAAANSUhEUg==",
        clienteNombre: "Cliente T48",
      },
    });
    // POST correcto → 201 Created (convención REST, igual que el resto del API).
    expect(alta.statusCode).toBe(201);

    const listado = await app.inject({
      method: "GET",
      url: `/workshop/signatures/${OT_ID}`,
      headers: auth(),
    });
    expect(listado.statusCode).toBe(200);
    expect(listado.json()).toHaveLength(1);
    expect(listado.json()[0].tipo).toBe("AUTORIZACION");

    // Otro tenant no ve la firma del primero.
    const otro = await sql`SELECT count(*)::int AS n FROM digital_signatures
      WHERE orden_trabajo_id = ${OT_ID} AND tenant_slug = ${"e2e-t48-otro"}`;
    expect(otro[0].n).toBe(0);

    // Y las firmas se van con la OT (ON DELETE CASCADE).
    await sql`DELETE FROM public.ordenes_trabajo WHERE id = ${OT_ID}`;
    const tras = await sql`SELECT count(*)::int AS n FROM digital_signatures
      WHERE orden_trabajo_id = ${OT_ID}`;
    expect(tras[0].n).toBe(0);

    await sql`DELETE FROM public.vehiculos WHERE id = ${VEHICULO}`;
    await sql`DELETE FROM public.clients WHERE id = ${CLIENTE}`;
  });

  // ── 2. FK violada devolvía 500 opaco (error-handler 23503) ───────────
  it("una referencia inexistente devuelve 422, no 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/signatures",
      headers: { ...auth(), "content-type": "application/json" },
      payload: { ordenTrabajoId: INEXISTENTE, tipo: "AUTORIZACION", firmaBase64: "AA==" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("ValidationError");
  });

  // ── 3. getRateAtDate interpolaba un Date (ERR_INVALID_ARG_TYPE) ──────
  it("getRateAtDate acepta un Date sin romper postgres.js", async () => {
    const sql = getDb() as any;
    await sql`INSERT INTO tipos_cambio (moneda, fecha, compra, venta, tenant_slug)
      VALUES (${"USD"}, ${"2026-03-15"}, ${"7300.00"}, ${"7350.00"}, ${T})
      ON CONFLICT DO NOTHING`;

    // La firma tipada como Date es la que reventaba; no cambiar a string.
    const fila = await getRateAtDate(T, "USD", new Date("2026-03-15"));
    expect(fila).not.toBeNull();
    expect(Number(fila!.compra)).toBeGreaterThan(0);

    // Y la ruta HTTP, que es donde se rompía el 500.
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/tipos-cambio/2026-03-15?moneda=USD",
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);

    await sql`DELETE FROM public.tipos_cambio WHERE tenant_slug = ${T} AND moneda = ${"USD"}`;
  });

  // ── 4. TABLE_CONFIGS.plan_cuentas tenantScoped sin columna (42601) ───
  it("el preview de migración no rompe por plan_cuentas sin tenant_slug", async () => {
    // plan_cuentas es global: la config debe seguir siendo tenantScoped:false.
    // Con true, Drizzle emitía `undefined = $1` y tumbaba todo el módulo.
    const tablas = await getAvailableTables(T);
    expect(tablas.length).toBeGreaterThan(0);
    // getAvailableTables devuelve {key,name,rowCount,tenantScoped}.
    const planCuentas = tablas.find((t) => t.key === "plan_cuentas");
    expect(planCuentas).toBeDefined();
    // El criterio del fix: plan_cuentas es global, luego NO es tenant-scoped.
    expect(planCuentas!.tenantScoped).toBe(false);

    const preview = await getExportPreview(T);
    expect(preview).toHaveProperty("plan_cuentas");

    for (const ruta of ["/api/v1/migration/tables", "/api/v1/migration/preview"]) {
      const res = await app.inject({ method: "GET", url: ruta, headers: auth() });
      expect(res.statusCode, `${ruta} debe responder 200`).toBe(200);
    }
  });

  // ── 5. Error plano en consolidados → 500 en vez de 404 ──────────────
  it("un grupo de tenants inexistente da 404, no 500", async () => {
    for (const fn of [getConsolidatedBalance, getConsolidatedPnL]) {
      await expect(fn(INEXISTENTE, 2026, 1)).rejects.toBeInstanceOf(NotFoundError);
    }
    for (const ruta of ["balance", "pnl"]) {
      const res = await app.inject({
        method: "GET",
        url: `/finance/contabilidad/consolidado/${ruta}/${INEXISTENTE}/2026/1`,
        headers: auth(),
      });
      expect(res.statusCode, `consolidado/${ruta} debe dar 404`).toBe(404);
    }
  });
});
