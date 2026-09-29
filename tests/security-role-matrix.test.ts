/**
 * T-21c — Matriz rol × endpoint sobre destructivos (SEG-04)
 *
 * La auditoría 2026-09-25 marcó `requireManager` con 0 usos: 12 endpoints
 * destructivos (delete clientes, batch OT, bulk inventario, transferencias,
 * anular asientos/SIFEN, presupuestos, ajustes de periodo) estaban sólo con
 * auth, y cerrar-periodo / cron cierre-mensual sin requireAdmin.
 *
 * Para cada endpoint se verifica:
 *   - sin sesión           → 403 (CSRF rechaza el state-changing sin Bearer)
 *   - Bearer inválido      → 401 (auth-gate exige perfil)
 *   - rol user/mechanic    → 403 (prueba de que el guard EXISTE)
 *   - rol manager          → 403 sólo si el guard es requireAdmin
 *   - rol manager/admin    → pasa el guard (status distinto de 401/403) cuando
 *                            el handler es no-op/seguro de ejecutar
 *
 * Filas con `exec: false` no se ejecutan con roles altos (SIFEN haría una
 * llamada SOAP real; cerrar-periodo/cierre-mensual escribirían cierres) — su
 * guard queda probado por los 403 de roles bajos.
 *
 * @module tests/security-role-matrix
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-role-matrix";
const TENANT_ID = "00000000-0000-0000-0000-0000e2220000";
const ROLE_IDS: Record<string, string> = {
  admin: "00000000-0000-0000-0000-0000e2220001",
  manager: "00000000-0000-0000-0000-0000e2220002",
  mechanic: "00000000-0000-0000-0000-0000e2220003",
  user: "00000000-0000-0000-0000-0000e2220004",
};
const FAKE_UUID = "11111111-1111-4111-8111-111111111111";
const FAKE_UUID_2 = "22222222-2222-4222-8222-222222222222";
const FAKE_CDC = "12345678901234567890123456789012345678901234"; // 44 chars

type Role = "admin" | "manager" | "mechanic" | "user";

let app: FastifyInstance;
const tokens = {} as Record<Role, string>;

interface MatrixRow {
  name: string;
  method: "POST" | "DELETE";
  url: string;
  payload?: unknown;
  guard: "manager" | "admin";
  /** Ejecutar también con roles altos (handler no-op/seguro). */
  exec: boolean;
}

const MATRIX: MatrixRow[] = [
  {
    name: "DELETE /workshop/clientes/:id",
    method: "DELETE",
    url: `/workshop/clientes/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /workshop/ordenes/batch/status",
    method: "POST",
    url: "/workshop/ordenes/batch/status",
    payload: { ids: [FAKE_UUID], status: "Presupuestado" },
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /workshop/ordenes/batch/delete",
    method: "POST",
    url: "/workshop/ordenes/batch/delete",
    payload: { ids: [FAKE_UUID] },
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /inventory/bulk/import",
    method: "POST",
    url: "/inventory/bulk/import",
    payload: { rows: [] }, // handler responde 400 sin insertar nada
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /inventory/bulk/price-update",
    method: "POST",
    url: "/inventory/bulk/price-update",
    payload: { ids: [], field: "precioVenta", percentageChange: 1 }, // 400
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /inventory/bulk/stock-adjust",
    method: "POST",
    url: "/inventory/bulk/stock-adjust",
    payload: { adjustments: [] }, // 400
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /finance/treasury/transferencias",
    method: "POST",
    url: "/finance/treasury/transferencias",
    payload: {
      cuentaOrigenId: FAKE_UUID,
      cuentaDestinoId: FAKE_UUID_2,
      monto: "1000",
      concepto: "matriz roles",
    },
    guard: "manager",
    exec: true, // cuentas inexistentes → error de negocio, nunca 401/403
  },
  {
    name: "POST /finance/contabilidad/asientos/:id/anular",
    method: "POST",
    url: `/finance/contabilidad/asientos/${FAKE_UUID}/anular`,
    payload: { motivo: "matriz roles" },
    guard: "manager",
    exec: true, // asiento inexistente → 404
  },
  {
    name: "POST /finance/sifen/anular",
    method: "POST",
    url: "/finance/sifen/anular",
    payload: { cdc: FAKE_CDC, motivo: "matriz roles" },
    guard: "manager",
    exec: false, // anularDTE hace SOAP real a SIFEN — no se ejecuta en tests
  },
  {
    name: "DELETE /finance/presupuestos/:id",
    method: "DELETE",
    url: `/finance/presupuestos/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "DELETE /finance/presupuestos/items/:itemId",
    method: "DELETE",
    url: `/finance/presupuestos/items/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /finance/contabilidad/devengamiento/ajustes",
    method: "POST",
    url: "/finance/contabilidad/devengamiento/ajustes",
    payload: { ajustes: [{ concepto: "matriz roles", lineas: [{}, {}] }] },
    guard: "manager",
    exec: false, // podría escribir asientos de devengamiento si el handler avanzara
  },
  {
    name: "POST /finance/contabilidad/cerrar-periodo",
    method: "POST",
    url: "/finance/contabilidad/cerrar-periodo",
    payload: { hastaMes: 9 },
    guard: "admin",
    exec: false, // cerraría el periodo del tenant fixture
  },
  {
    name: "POST /finance/contabilidad/cron/cierre-mensual",
    method: "POST",
    url: "/finance/contabilidad/cron/cierre-mensual",
    payload: { anho: 2026, mes: 9 },
    guard: "admin",
    exec: false, // ejecutaría el cierre mensual real
  },
  // ── Fase 4 · T-42 — destructivos nuevos (matriz CRUD por módulo) ──
  {
    name: "DELETE /workshop/mechanic-profiles/:id",
    method: "DELETE",
    url: `/workshop/mechanic-profiles/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "DELETE /workshop/proveedores/:id",
    method: "DELETE",
    url: `/workshop/proveedores/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "DELETE /inventory/almacenes/:id",
    method: "DELETE",
    url: `/inventory/almacenes/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "POST /inventory/almacenes/transferir",
    method: "POST",
    url: "/inventory/almacenes/transferir",
    payload: { repuestoId: FAKE_UUID, cantidad: 1, almacenDestinoId: FAKE_UUID_2 },
    guard: "manager",
    exec: true,
  },
  {
    name: "DELETE /inventory/herramientas/:id",
    method: "DELETE",
    url: `/inventory/herramientas/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "DELETE /marketing/campaigns/:id",
    method: "DELETE",
    url: `/marketing/campaigns/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "DELETE /fleet/:id",
    method: "DELETE",
    url: `/fleet/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
  {
    name: "DELETE /dvi/:id",
    method: "DELETE",
    url: `/dvi/${FAKE_UUID}`,
    guard: "manager",
    exec: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────

function headers(opts: { role?: Role; bearer?: string } = {}): Record<string, string> {
  const h: Record<string, string> = { "x-tenant-slug": TENANT };
  if (opts.role) h.authorization = `Bearer ${tokens[opts.role]}`;
  else if (opts.bearer) h.authorization = opts.bearer;
  return h;
}

async function attempt(
  row: MatrixRow,
  opts: { role?: Role; bearer?: string } = {},
): Promise<number> {
  const res = await app.inject({
    method: row.method,
    url: row.url,
    headers: headers(opts),
    ...(row.payload !== undefined ? { payload: row.payload as object } : {}),
  });
  return res.statusCode;
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as any;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E Role Matrix', ${TENANT}, 'tenant_e2e_role_matrix', true)
    ON CONFLICT (slug) DO NOTHING
  `;
  for (const role of ["admin", "manager", "mechanic", "user"] as const) {
    const email = `${role}@e2e-role-matrix.test`;
    await sql`
      INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${ROLE_IDS[role]}, ${TENANT_ID}, ${email}, ${role}, ${role}, true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        role = EXCLUDED.role,
        is_active = true
    `;
    tokens[role] = generateToken({
      id: ROLE_IDS[role],
      email,
      role,
      tenantId: TENANT_ID,
      tenantSlug: TENANT,
    });
  }

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  try {
    const sql = getDb() as any;
    await sql`DELETE FROM profiles WHERE tenant_id = ${TENANT_ID}`;
    await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  } catch (err) {
    console.error("[security-role-matrix] cleanup falló:", err);
  }
  if (app) await app.close();
  const handles = (process as any)._getActiveHandles?.() ?? [];
  for (const h of handles) {
    if (h && typeof h.unref === "function") {
      try {
        h.unref();
      } catch {
        /* ignore */
      }
    }
  }
});

// ─── Matriz ───────────────────────────────────────────────

describe("T-21c — matriz rol × endpoint sobre destructivos (SEG-04)", () => {
  for (const row of MATRIX) {
    it(`${row.name} — guard require${row.guard === "admin" ? "Admin" : "Manager"}`, async () => {
      // Sin sesión → 403: el hook CSRF (preHandler registrado ANTES que
      // auth-gate) rechaza métodos state-changing sin Bearer/CSRF token
      // antes de que se evalue la autenticación.
      expect(await attempt(row), "sin sesión → CSRF").toBe(403);

      // Bearer inválido → 401: CSRF se salta con prefijo Bearer, llega a
      // auth-gate y éste exige perfil (UnauthorizedError).
      expect(await attempt(row, { bearer: "Bearer token-invalido" }), "token inválido").toBe(401);

      // Roles por debajo del guard → 403: demuestra que el guard EXISTE
      expect(await attempt(row, { role: "user" }), "rol user").toBe(403);
      expect(await attempt(row, { role: "mechanic" }), "rol mechanic").toBe(403);

      if (row.guard === "admin") {
        // manager no alcanza el nivel admin → 403
        expect(await attempt(row, { role: "manager" }), "rol manager vs guard admin").toBe(403);
      } else if (row.exec) {
        // manager SÍ pasa el guard (el handler responde lo que responda,
        // nunca 401/403) — esto prueba que el guard es requireManager
        // y no requireAdmin.
        const managerStatus = await attempt(row, { role: "manager" });
        expect(managerStatus, "rol manager debe pasar el guard").not.toBe(401);
        expect(managerStatus, "rol manager debe pasar el guard").not.toBe(403);

        const adminStatus = await attempt(row, { role: "admin" });
        expect(adminStatus, "admin hereda ≥ manager").not.toBe(401);
        expect(adminStatus, "admin hereda ≥ manager").not.toBe(403);
      }
      // exec:false con guard manager → passthrough de admin/manager no se
      // ejercita (ver docblock); el 403 de roles bajos prueba el guard.
    });
  }
});
