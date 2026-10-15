/**
 * Sprint 120 — Lote 7: GETs de lectura de finance SIN test (T-47).
 *
 * Cubre las 31 rutas GET de `/finance/**` que aparecían en `withoutTest`
 * del escáner T-63 y no estaban en EXCLUDED. Solo lectura, todo local y
 * determinista (período vacío → ceros; IDs inexistentes → 404; año/mes
 * fuera de rango → 422 de ValidationError), sin dependencia externa:
 *
 *   - Estados financieros: balance-general, estado-resultados,
 *     flujo-efectivo, evolucion-patrimonio, notas-financieras
 *   - Centros de costo/arbol, integración resumen+check, consolidado
 *     balance+pnl (404 de grupo inexistente), depreciación activos/:id
 *   - tipos-cambio/actual (read-after-write), reserva-legal/saldo
 *   - RG 90: ventas, compras, retenciones
 *   - Fiscal: form120, ire, idu, isc, inr (listados de liquidaciones)
 *   - Treasury: cxc-pendientes, flujo-caja, movimientos/saldo-historico
 *   - Presupuestos: :id/comparativa (404), alertas
 *   - SIFEN: consultar (validación de query), documentos, documentos/:id,
 *     sync-log, contingencia/status
 *
 * `sifen/consultar` solo se ejercita por su rama de validación (cdc
 * requerido → 400): la rama feliz llama a la SOAP de la DNIT (fuera de
 * alcance de tests; `consultarDTE` captura el error de red).
 * `sifen/contingencia/status` hace 2 health-checks SOAP, que fallan rápido
 * y de forma determinista cuando no hay salida a internet (siempre 200).
 *
 * Patrón fase7 (tenant propio "e2e-s120fin", fixtures SQL idempotentes,
 * app.inject con template literals para el scanner de T-63).
 *
 * @module tests/fase7-s120-read-finance
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-s120fin";
const TENANT_ID = "00000000-0000-0000-0000-0000e2e4f120";
const ADMIN_ID = "00000000-0000-0000-0000-0000e2e4e120";
const ADMIN_EMAIL = "admin@e2e-s120fin.test";
/** UUID válido que no existe en ninguna tabla (404/422 limpios). */
const NO_EXISTE = "00000000-0000-0000-0000-0000dead0001";
const PERIODO = { anho: 2030, mes: 12 };

/**
 * `plan_cuentas` es global (sin tenant ni RLS). El estado de evolución
 * patrimonial (`equity-statement.service`) devuelve 422 si no existe NINGUNA
 * cuenta de tipo PATRIMONIO, así que este test siembra la suya y la borra.
 * Antes no lo hacía: sólo pasaba por filas que otro suite dejaba en la DB
 * local, y en una DB fresca (CI) fallaba con 422.
 */
const CUENTA_PATRIMONIO_CODIGO = "E2E-S120-PATRIMONIO";

let app: FastifyInstance;
let bearer: string;

// ─── Helpers ──────────────────────────────────────────────

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

/** SQL crudo (postgres.js) para fixtures/verificaciones fuera de requests. */
async function q<T = any>(
  strings: TemplateStringsArray,
  ...vals: unknown[]
): Promise<T[]> {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<T[]>;
  return sql(strings, ...vals);
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as unknown as (
    s: TemplateStringsArray,
    ...v: unknown[]
  ) => Promise<unknown>;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Sprint 120 Lectura', ${TENANT}, 'tenant_e2e_s120fin', true)
    ON CONFLICT (slug) DO NOTHING`;
  await sql`
    INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin Sprint 120 Lectura', 'admin', true)
    ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true`;

  // Fixture: cuenta patrimonial mínima (ver CUENTA_PATRIMONIO_CODIGO).
  await sql`DELETE FROM plan_cuentas WHERE codigo = ${CUENTA_PATRIMONIO_CODIGO}`;
  await sql`
    INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, activo)
    VALUES (${CUENTA_PATRIMONIO_CODIGO}, 'Patrimonio fixture S120', 'PATRIMONIO', 3, true)`;

  bearer = generateToken({
    id: ADMIN_ID,
    email: ADMIN_EMAIL,
    role: "admin",
    tenantId: TENANT_ID,
    tenantSlug: TENANT,
  });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await q`DELETE FROM plan_cuentas WHERE codigo = ${CUENTA_PATRIMONIO_CODIGO}`;
  await q`DELETE FROM tipos_cambio WHERE tenant_slug = ${TENANT}`;
  await q`DELETE FROM profiles WHERE id = ${ADMIN_ID}`;
  await q`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  await app?.close();
});

// ─── Estados financieros ──────────────────────────────────

describe("Sprint 120 · Estados financieros GET", () => {
  it("GET /finance/contabilidad/balance-general/:fecha → 200 balanceado", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/balance-general/${"2030-12-31"}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.activo).toBeDefined();
    expect(body.pasivo).toBeDefined();
    expect(body.patrimonio).toBeDefined();
    expect(typeof body.totalActivo).toBe("number");
    expect(typeof body.balanceado).toBe("boolean");
  });

  it("GET /finance/contabilidad/balance-general/:fecha con fecha inválida → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/balance-general/${"no-es-fecha"}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /finance/contabilidad/estado-resultados/:anho/:mes → 200 mensual", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/estado-resultados/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject(PERIODO);
    expect(body.tipo).toBe("MENSUAL");
    expect(typeof body.ingresos.total).toBe("number");
    expect(typeof body.costos.total).toBe("number");
    expect(typeof body.gastos.total).toBe("number");
  });

  it("GET /finance/contabilidad/estado-resultados/:anho/:mes?acumulado=true → acumulado", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/estado-resultados/${PERIODO.anho}/${PERIODO.mes}`,
      query: { acumulado: "true" },
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().tipo).toBe("ACUMULADO");
  });

  it("GET /finance/contabilidad/estado-resultados/:anho/:mes con año inválido → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/estado-resultados/${2019}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /finance/contabilidad/flujo-efectivo/:anho/:mes → 200 con las 3 actividades", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/flujo-efectivo/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject(PERIODO);
    expect(body.operativas).toBeDefined();
    expect(body.inversion).toBeDefined();
    expect(body.financiamiento).toBeDefined();
    expect(typeof body.saldoFinal).toBe("number");
  });

  it("GET /finance/contabilidad/flujo-efectivo/:anho/:mes con mes inválido → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/flujo-efectivo/${2030}/${13}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /finance/contabilidad/evolucion-patrimonio/:anho/:mes → 200 con grupos patrimoniales", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/evolucion-patrimonio/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject(PERIODO);
    expect(body.capital).toBeDefined();
    expect(body.reservas).toBeDefined();
    expect(body.resultados).toBeDefined();
    expect(typeof body.totalPatrimonioFinal).toBe("number");
  });

  it("GET /finance/contabilidad/notas-financieras/:anho/:mes → 200 con notas", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/notas-financieras/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject(PERIODO);
    expect(body.empresa).toBeDefined();
    expect(Array.isArray(body.notas)).toBe(true);
    expect(typeof body.generadoEn).toBe("string");
  });
});

// ─── Centros de costo, integración y consolidado ──────────

describe("Sprint 120 · Centros de costo, integración y consolidado", () => {
  it("GET /finance/contabilidad/centros-costo/arbol → 200 (array)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/centros-costo/arbol",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("GET /finance/contabilidad/centros-costo/arbol?soloActivos=true → 200 (array)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/centros-costo/arbol",
      query: { soloActivos: "true" },
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("GET /finance/contabilidad/integracion/resumen → 200 con tablero", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/integracion/resumen",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.modulosRegistrados).toBe("number");
    expect(Array.isArray(body.modulos)).toBe(true);
    expect(typeof body.totalMappings).toBe("number");
    expect(body.mappingsPorModulo).toBeDefined();
    expect(body.auditReciente).toBeDefined();
  });

  it("GET /finance/contabilidad/integracion/check/:modulo → 200 con salud", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/integracion/check/${"WORKSHOP"}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.modulo).toBe("WORKSHOP");
    expect(typeof body.registrado).toBe("boolean");
    expect(typeof body.mappingsDefinidos).toBe("number");
    expect(["OK", "INCOMPLETO"]).toContain(body.salud);
  });

  it("GET /finance/contabilidad/consolidado/balance/:groupId/:anho/:mes con grupo inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/consolidado/balance/${NO_EXISTE}/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(404);
  });

  it("GET /finance/contabilidad/consolidado/pnl/:groupId/:anho/:mes con grupo inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/consolidado/pnl/${NO_EXISTE}/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(404);
  });

  it("GET /finance/contabilidad/depreciacion/activos/:id inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/contabilidad/depreciacion/activos/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(404);
  });
});

// ─── Tipos de cambio y reserva legal ──────────────────────

describe("Sprint 120 · Tipos de cambio y reserva legal", () => {
  it("GET /finance/contabilidad/tipos-cambio/actual → 200 read-after-write", async () => {
    const creado = await app.inject({
      method: "POST",
      url: "/finance/contabilidad/tipos-cambio",
      headers: auth(),
      payload: {
        moneda: "USD",
        fecha: "2030-12-01",
        compra: 7000,
        venta: 7100,
        fuente: "MANUAL",
      },
    });
    expect([200, 201], creado.body).toContain(creado.statusCode);

    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/tipos-cambio/actual",
      query: { moneda: "USD" },
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.moneda).toBe("USD");
    expect(body.venta).toBe("7100.00");
  });

  it("GET /finance/contabilidad/reserva-legal/saldo → 200 con saldo numérico", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/contabilidad/reserva-legal/saldo",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(typeof res.json().saldo).toBe("number");
  });
});

// ─── RG 90 ────────────────────────────────────────────────

describe("Sprint 120 · RG 90 (lectura)", () => {
  it("GET /finance/rg90/ventas/:anho/:mes → 200 JSON", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/rg90/ventas/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject(PERIODO);
    expect(body.formato).toBe("JSON");
    expect(typeof body.totalVentas).toBe("string");
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("GET /finance/rg90/ventas/:anho/:mes?formato=CSV → 200 con contenido", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/rg90/ventas/${PERIODO.anho}/${PERIODO.mes}`,
      query: { formato: "CSV" },
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.formato).toBe("CSV");
    expect(typeof body.contenido).toBe("string");
  });

  it("GET /finance/rg90/ventas/:anho/:mes con año inválido → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/rg90/ventas/${2019}/${12}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(422);
  });

  it("GET /finance/rg90/compras/:anho/:mes → 200 JSON", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/rg90/compras/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject(PERIODO);
    expect(typeof body.totalCompras).toBe("string");
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("GET /finance/rg90/retenciones/:anho/:mes → 200 JSON", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/rg90/retenciones/${PERIODO.anho}/${PERIODO.mes}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.periodo).toMatchObject(PERIODO);
    expect(typeof body.totalRetenido).toBe("string");
    expect(Array.isArray(body.entries)).toBe(true);
  });
});

// ─── Motor fiscal DNIT ────────────────────────────────────

describe("Sprint 120 · Motor fiscal (listados)", () => {
  const rutas = [
    "/finance/fiscal/form120",
    "/finance/fiscal/ire",
    "/finance/fiscal/idu",
    "/finance/fiscal/isc",
    "/finance/fiscal/inr",
  ];

  for (const url of rutas) {
    it(`GET ${url} → 200 (array de liquidaciones)`, async () => {
      const res = await app.inject({
        method: "GET",
        url,
        headers: auth(),
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  }
});

// ─── Treasury ─────────────────────────────────────────────

describe("Sprint 120 · Treasury (lectura)", () => {
  it("GET /finance/treasury/cxc-pendientes → 200 (array)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/treasury/cxc-pendientes",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("GET /finance/treasury/flujo-caja → 200 con proyección", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/treasury/flujo-caja",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.saldoActual).toBe("string");
    expect(typeof body.flujoNetoProyectado).toBe("string");
    expect(typeof body.alertaSobregiro).toBe("boolean");
  });

  it("GET /finance/treasury/movimientos/saldo-historico/:cuentaId con cuenta inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/treasury/movimientos/saldo-historico/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(404);
  });
});

// ─── Presupuestos ─────────────────────────────────────────

describe("Sprint 120 · Presupuestos (lectura)", () => {
  it("GET /finance/presupuestos/:id/comparativa con presupuesto inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/presupuestos/${NO_EXISTE}/comparativa`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(404);
  });

  it("GET /finance/presupuestos/alertas → 200 (array)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/presupuestos/alertas",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

// ─── SIFEN (lectura) ──────────────────────────────────────

describe("Sprint 120 · SIFEN (lectura)", () => {
  it("GET /finance/sifen/consultar sin cdc → 400 (querystring requerida)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/sifen/consultar",
      headers: auth(),
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /finance/sifen/consultar con cdc de largo inválido → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/sifen/consultar",
      query: { cdc: "123" },
      headers: auth(),
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /finance/sifen/documentos → 200 paginado", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/sifen/documentos",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(typeof body.page).toBe("number");
  });

  it("GET /finance/sifen/documentos/:id inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/finance/sifen/documentos/${NO_EXISTE}`,
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(404);
  });

  it("GET /finance/sifen/sync-log → 200 paginado", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/sifen/sync-log",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /finance/sifen/contingencia/status → 200 con estado de cola", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/finance/sifen/contingencia/status",
      headers: auth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(typeof body.sifenDisponible).toBe("boolean");
    expect(typeof body.modoActivo).toBe("boolean");
    expect(typeof body.queueSize).toBe("number");
    expect(typeof body.pendientes).toBe("number");
    expect(typeof body.consultadoEn).toBe("string");
  });
});
