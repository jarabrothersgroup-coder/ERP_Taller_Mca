/**
 * S132-29 — Resolución de cuentas contables: solo cuentas imputables.
 *
 * Defecto detectado en la verificación de Fase 1 (2026-10-30): varios
 * servicios resolvían cuentas por prefijo/código sin filtrar
 * `acepta_movimientos`, y con el plan de cuentas estándar elegían
 * **cuentas agrupadoras** (`4.1.01`, `1.1.01`, `3`):
 *
 *   - `POST /finance/contabilidad/asientos/automatico` → 422
 *     «la cuenta no acepta movimientos directos».
 *   - `POST /inventory/initial-load` → 422 (la contrapartida caía en
 *     `3 · PATRIMONIO`).
 *   - `centralizacion/*` y `cierre mensual` insertaban detalle directo
 *     en agrupadoras: asiento «balanceado» en cabecera pero imputado a
 *     cuentas de consolidación, sin validación.
 *
 * Este test fija la invariante: toda línea de asiento generada por
 * automatismos debe apuntar a una cuenta activa y con movimientos.
 *
 * @module tests/finance-account-resolution
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
import { resolvePostingAccount } from "../src/modules/finance/services/accounting/account-resolver.js";
import { NotFoundError } from "../src/shared/errors/app-error.js";
import {
  generarAsientoAutomatico,
} from "../src/modules/finance/services/index.js";
import { executeInitialLoad } from "../src/modules/inventory/services/initial-load.service.js";

const TENANT = "e2e-acct-res";
const TENANT_ID = "00000000-0000-4000-8000-0000acc70001";
const ADMIN_ID = "00000000-0000-4000-8000-0000acc70010";
const ADMIN_EMAIL = "admin@e2e-acct-res.test";

const TS = Date.now().toString(36);

/** Códigos exclusivos de este test (no colisionan con el seed). */
const ROOT = "9.7";
const GRUPO = `${ROOT}`;
const SUBGRUPO = `${ROOT}.01`;
const IMPUTABLE_A = `${ROOT}.01.001`;
const IMPUTABLE_B = `${ROOT}.01.002`;
const INACTIVA = `${ROOT}.01.003`;

/** Códigos del plan estándar que necesitan los automatismos. */
const CHART: Array<[string, string, string, number, boolean]> = [
  // [codigo, nombre, tipo, nivel, aceptaMovimientos]
  ["1.1.01", "CAJA Y BANCOS", "ACTIVO", 3, false],
  ["1.1.01.001", "CAJA CHICA", "ACTIVO", 4, true],
  ["1.1.03", "INVENTARIOS", "ACTIVO", 3, false],
  ["1.1.03.001", "REPUESTOS EN EXISTENCIA", "ACTIVO", 4, true],
  ["3", "PATRIMONIO", "PATRIMONIO", 1, false],
  ["3.1", "PATRIMONIO", "PATRIMONIO", 2, false],
  ["3.1.01.001", "CAPITAL SOCIAL", "PATRIMONIO", 4, true],
  ["4.1", "INGRESOS OPERACIONALES", "INGRESO", 2, false],
  ["4.1.01", "VENTAS", "INGRESO", 3, false],
  ["4.1.01.001", "VENTA DE SERVICIOS", "INGRESO", 4, true],
  ["6.1", "COSTO DE VENTAS", "COSTO", 2, false],
  ["6.1.01", "COSTOS DIRECTOS", "COSTO", 3, false],
  ["6.1.01.001", "COSTO DE REPUESTOS VENDIDOS", "COSTO", 4, true],
];

let app: FastifyInstance;
let bearer: string;

function sql() {
  return getDb() as unknown as {
    (s: TemplateStringsArray, ...v: unknown[]): Promise<any[]>;
    unsafe: (stmt: string) => Promise<unknown>;
  };
}

function auth(): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

async function pickId(res: { json: () => any }, label: string): Promise<string> {
  const body = res.json();
  const id = body?.id ?? body?.data?.id;
  if (typeof id !== "string") {
    throw new Error(`${label}: sin id en respuesta: ${JSON.stringify(body)}`);
  }
  return id;
}

async function crearOrden(): Promise<string> {
  const cliente = await app.inject({
    method: "POST",
    url: "/workshop/clientes",
    headers: auth(),
    payload: { name: `Cliente AcctRes ${TS}`, email: `acct-res-${TS}@test.dev` },
  });
  expect([200, 201], `POST clientes → ${cliente.statusCode}: ${cliente.body}`).toContain(
    cliente.statusCode,
  );
  const clientId = await pickId(cliente, "cliente");

  const vehiculo = await app.inject({
    method: "POST",
    url: "/workshop/vehiculos",
    headers: auth(),
    payload: {
      brand: "Toyota",
      model: "Corolla",
      clientId,
      licensePlate: `AR${TS}`.toUpperCase().slice(0, 7),
    },
  });
  expect([200, 201], `POST vehiculos → ${vehiculo.statusCode}: ${vehiculo.body}`).toContain(
    vehiculo.statusCode,
  );
  const vehicleId = await pickId(vehiculo, "vehiculo");

  const orden = await app.inject({
    method: "POST",
    url: "/workshop/ordenes",
    headers: auth(),
    payload: { vehicleId, clientId, description: `AcctRes ${TS}` },
  });
  expect([200, 201], `POST ordenes → ${orden.statusCode}: ${orden.body}`).toContain(
    orden.statusCode,
  );
  return pickId(orden, "orden");
}

/** Toda cuenta usada en un asiento debe ser imputable y estar activa. */
async function assertCuentasImputables(asientoId: string): Promise<void> {
  const s = sql();
  const noImputables = await s`
    SELECT pc.codigo, pc.nombre, pc.acepta_movimientos, pc.activo
    FROM asientos_detalle d
    JOIN plan_cuentas pc ON pc.id = d.cuenta_id
    WHERE d.asiento_id = ${asientoId}
      AND (pc.acepta_movimientos = false OR pc.activo = false)
  `;
  expect(
    noImputables,
    `el asiento ${asientoId} imputó cuentas agrupadoras/inactivas: ${JSON.stringify(noImputables)}`,
  ).toEqual([]);

  const total = await s`
    SELECT COUNT(*)::int AS lineas FROM asientos_detalle WHERE asiento_id = ${asientoId}
  `;
  expect(total[0].lineas).toBeGreaterThanOrEqual(2);
}

describe("S132-29 · resolver de cuentas imputables", () => {
  beforeAll(async () => {
    const s = sql();
    await s`
      INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, acepta_movimientos, activo)
      VALUES
        (${GRUPO}, 'Grupo test AcctRes', 'ACTIVO', 1, false, true),
        (${SUBGRUPO}, 'Subgrupo test AcctRes', 'ACTIVO', 2, false, true),
        (${IMPUTABLE_A}, 'Imputable A AcctRes', 'ACTIVO', 3, true, true),
        (${IMPUTABLE_B}, 'Imputable B AcctRes', 'ACTIVO', 3, true, true),
        (${INACTIVA}, 'Inactiva AcctRes', 'ACTIVO', 3, true, false)
      ON CONFLICT (codigo) DO UPDATE SET
        acepta_movimientos = EXCLUDED.acepta_movimientos,
        activo = EXCLUDED.activo
    `;
  });

  afterAll(async () => {
    await sql()`DELETE FROM plan_cuentas WHERE codigo LIKE ${`${ROOT}%`}`;
  });

  it("un código agrupador baja a su primer descendiente imputable", async () => {
    const [a, b] = await Promise.all([
      resolvePostingAccount({ codigos: [GRUPO], etiqueta: "test grupo" }),
      resolvePostingAccount({ codigos: [SUBGRUPO], etiqueta: "test subgrupo" }),
    ]);
    expect(a).toBe(b);

    const [fila] = await sql()`
      SELECT codigo, acepta_movimientos FROM plan_cuentas WHERE id = ${a}
    `;
    expect(fila.codigo).toBe(IMPUTABLE_A);
    expect(fila.acepta_movimientos).toBe(true);
  });

  it("un código imputable se resuelve exacto (no baja al hermano)", async () => {
    const id = await resolvePostingAccount({
      codigos: [IMPUTABLE_B],
      etiqueta: "test imputable",
    });
    const [fila] = await sql()`SELECT codigo FROM plan_cuentas WHERE id = ${id}`;
    expect(fila.codigo).toBe(IMPUTABLE_B);
  });

  it("por prefijo elige determinísticamente la primera cuenta imputable", async () => {
    const id = await resolvePostingAccount({
      prefijos: [`${SUBGRUPO}.`],
      etiqueta: "test prefijo",
    });
    const [fila] = await sql()`SELECT codigo FROM plan_cuentas WHERE id = ${id}`;
    expect(fila.codigo).toBe(IMPUTABLE_A);
  });

  it("ignora cuentas inactivas", async () => {
    await expect(
      resolvePostingAccount({ codigos: [INACTIVA], etiqueta: "test inactiva" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lanza NotFoundError con mensaje accionable si no hay cuentas", async () => {
    await expect(
      resolvePostingAccount({ codigos: ["99.99.999"], etiqueta: "cuenta inexistente" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("S132-29 · automatismos imputan solo a cuentas de movimiento", () => {
  beforeAll(async () => {
    const s = sql();
    await s`
      INSERT INTO tenants (id, name, slug, schema_name, is_active)
      VALUES (${TENANT_ID}, 'E2E AcctRes', ${TENANT}, 'tenant_e2e_acct_res', true)
      ON CONFLICT (slug) DO NOTHING
    `;
    await s`
      INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ADMIN_ID}, ${TENANT_ID}, ${ADMIN_EMAIL}, 'Admin AcctRes', 'admin', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET role = EXCLUDED.role, is_active = true
    `;

    // Plan de cuentas con agrupadoras: es el escenario que rompía el 422.
    for (const [codigo, nombre, tipo, nivel, acepta] of CHART) {
      await s`
        INSERT INTO plan_cuentas (codigo, nombre, tipo, nivel, acepta_movimientos, activo)
        VALUES (${codigo}, ${nombre}, ${tipo}, ${nivel}, ${acepta}, true)
        ON CONFLICT (codigo) DO NOTHING
      `;
    }

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
    const s = sql();
    const statements = [
      `DELETE FROM initial_inventory_loads WHERE tenant_slug = '${TENANT}'`,
      `DELETE FROM stock_movements WHERE tenant_slug = '${TENANT}'`,
      `DELETE FROM repuestos WHERE tenant_slug = '${TENANT}'`,
      `DELETE FROM asientos_detalle WHERE asiento_id IN (
         SELECT id FROM asientos_contables WHERE concepto LIKE '%AcctRes%' OR modulo_origen = 'SIFEN'
           AND orden_trabajo_id IN (SELECT id FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}')
       )`,
      `DELETE FROM asientos_contables WHERE concepto LIKE '%AcctRes%'
         OR orden_trabajo_id IN (SELECT id FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}')`,
      `DELETE FROM ordenes_trabajo WHERE tenant_slug = '${TENANT}'`,
      `DELETE FROM vehiculos WHERE tenant_slug = '${TENANT}'`,
      `DELETE FROM clients WHERE tenant_slug = '${TENANT}'`,
      `DELETE FROM profiles WHERE tenant_id = '${TENANT_ID}'`,
      `DELETE FROM tenants WHERE id = '${TENANT_ID}'`,
    ];
    for (const stmt of statements) {
      try {
        await s.unsafe(stmt);
      } catch (err) {
        console.error("[acct-res] cleanup falló:", stmt, err);
      }
    }
    await app.close();
  });

  it("generarAsientoAutomatico (OT) no imputa cuentas agrupadoras", async () => {
    const ordenId = await crearOrden();
    await sql()`UPDATE ordenes_trabajo SET total_cost = 250000 WHERE id = ${ordenId}`;

    const res = await generarAsientoAutomatico({
      ordenTrabajoId: ordenId,
      fecha: new Date(),
      concepto: `Facturación automática AcctRes ${TS}`,
    });

    expect(res.asiento.id).toBeTruthy();
    expect(res.asiento.totalDebe).toBe(res.asiento.totalHaber);
    expect(res.lineas).toHaveLength(4);
    await assertCuentasImputables(res.asiento.id);
  });

  it("executeInitialLoad usa una contrapartida patrimonial imputable", async () => {
    const res = await executeInitialLoad({
      tenantSlug: TENANT,
      concepto: `Carga inicial AcctRes ${TS}`,
      repuestos: [
        {
          codigo: `AR-${TS}`.toUpperCase().slice(0, 12),
          descripcion: "Repuesto de prueba AcctRes",
          categoria: "Filtros",
          cantidad: 2,
          valorEstimadoMercado: 50000,
        },
      ],
    });

    expect(res.asiento, "la carga inicial debe generar asiento").toBeTruthy();
    await assertCuentasImputables(res.asiento!.id);
  });
});
