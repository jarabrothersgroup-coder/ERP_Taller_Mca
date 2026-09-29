/**
 * T-45 · FIN-04/07 — Anulación de factura + CRUD staff/payroll-summary.
 *
 * Cubre tres huecos que la auditoría encontró:
 *
 *   FIN-04  No existía vuelta atrás para una factura emitida. Ahora
 *           `voidInvoice` cambia el estado y genera el asiento de reverso en
 *           la MISMA transacción, con las salvaguardas fiscales paraguayas:
 *           idempotencia, rechazo de facturas cobradas y prohibición de anular
 *           en el sistema un DTE con CDC (solo la DNIT puede).
 *
 *   FIN-07a `mechanic_profiles` no tiene columna de tenant: el aislamiento se
 *           hereda por profile_id → profiles.tenant_id. GET/POST/PATCH no
 *           filtraban, así que un taller listaba y editaba los salaries de
 *           otro. Se comprueba el aislamiento en los cinco verbos.
 *
 *   FIN-07b `payroll_summary` y `commission_records` se colgaban de
 *           `tenant_id` y los listados no lo usaban: cualquier taller recibía
 *           la nómina de todos. Se comprueba el aislamiento y el CRUD nuevo.
 *
 * @module tests/fase4-t45-factura-staff-payroll
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, and, inArray, like, or } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
import { db } from "../src/shared/database/drizzle.js";
import {
  facturas,
  asientosContables,
  asientosDetalle,
  mechanicProfiles,
  payrollSummary,
} from "../src/shared/database/schema/index.js";
import { auditLog } from "../src/modules/finance/schema/audit-log.js";
import { planCuentas } from "../src/modules/finance/schema/accounting.js";
import { clients } from "../src/shared/database/schema/clients.js";
import { vehiculos } from "../src/modules/workshop/schema/vehiculos.js";
import { ordenesTrabajo } from "../src/modules/workshop/schema/ordenes-trabajo.js";

// ─── Fixtures ─────────────────────────────────

const T = "e2e-t45";
const OTRO = "e2e-t45-otro";

const T_ID = "00000000-0000-0000-0000-000000450001";
const OTRO_ID = "00000000-0000-0000-0000-000000450002";
const ADMIN = "00000000-0000-0000-0000-000000450010";
const MANAGER = "00000000-0000-0000-0000-000000450011";
const MECANICO = "00000000-0000-0000-0000-000000450012";
const CLIENTE = "00000000-0000-0000-0000-000000450020";
const VEHICULO = "00000000-0000-0000-0000-000000450021";
const OTRO_CLIENTE = "00000000-0000-0000-0000-000000450022";
const OTRO_VEHICULO = "00000000-0000-0000-0000-000000450023";
const OTRO_MECANICO = "00000000-0000-0000-0000-000000450013";

let app: FastifyInstance;

/** Perfiles de mecánico creados por los tests, para limpiar. */
let creadoIds: string[] = [];
/** Resúmenes de nómina creados, para limpiar. */
let resumenIds: string[] = [];
/** Órdenes creadas, para limpiar (las facturas cuelgan de ellas por FK). */
let ordenIds: string[] = [];

async function crearTenant(id: string, slug: string): Promise<void> {
  const sql = getDb() as any;
  await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${id}, ${slug}, ${slug}, ${slug}, true) ON CONFLICT (slug) DO NOTHING`;
}

function emailDe(userId: string, slug: string): string {
  return `${userId}@${slug}.test`;
}

function token(
  userId: string,
  email: string,
  role: string,
  tenantId: string,
  slug: string,
): string {
  return generateToken({ id: userId, email, role, tenantId, tenantSlug: slug });
}

function auth(bearer: string, slug = T) {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": slug };
}

/** Crea una orden de trabajo lista para facturar. */
async function crearOT(
  ordenId: string,
  clienteId: string,
  vehiculoId: string,
  slug: string,
  costo: number,
): Promise<void> {
  await db().insert(clients).values({
    id: clienteId,
    name: `Cliente ${ordenId.slice(0, 8)}`,
    ruc: null,
    email: null,
    phone: null,
    tenantSlug: slug,
  } as any).onConflictDoNothing();

  await db()
    .insert(vehiculos)
    .values({
      id: vehiculoId,
      clientId: clienteId,
      plate: `P${ordenId.slice(0, 7).toUpperCase()}`,
      brand: "Test",
      model: "Test",
      year: 2020,
      tenantSlug: slug,
    } as any)
    .onConflictDoNothing();

  await db().insert(ordenesTrabajo).values({
    id: ordenId,
    vehicleId: vehiculoId,
    clientId: clienteId,
    status: "Listo",
    totalCost: String(costo),
    tenantSlug: slug,
  } as any);

  ordenIds.push(ordenId);
}

/** Inserta una factura directamente (evita el flujo de emisión y su email). */
async function crearFactura(
  facturaId: string,
  ordenId: string,
  slug: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await db()
    .insert(facturas)
    .values({
      id: facturaId,
      tenantSlug: slug,
      ordenId,
      tipo: "MANUAL",
      numeroFacturaManual: `001-001-${facturaId.slice(-8).toUpperCase()}`,
      sifenCdc: null,
      sifenStatus: "MANUAL_CONVERT_QUEUE",
      total: "100000",
      estadoPago: "PENDIENTE",
      saldoPendiente: "100000",
      ...extra,
    } as any);
}

/**
 * El plan de cuentas es un catálogo global y una instalación limpia lo tiene
 * vacío, así que el test siembra sus propias cuentas (una de cargo y otra de
 * dato) y las borra al terminar. Usar cuentas reales, no filas falsas, importa:
 * el reverso se genera copiando las líneas del asiento original.
 */
let cuentasTest: string[] = [];
let cuentaDebeId: string | null = null;
let cuentaHaberId: string | null = null;

async function sembrarCuentas(): Promise<void> {
  const sql = getDb() as any;
  for (const [i, [codigo, nombre, tipo]] of [
    ["9.9.01", "Cuenta de cargo T-45", "ACTIVO"],
    ["9.9.02", "Cuenta de dato T-45", "ACTIVO"],
  ].entries()) {
    const [row] = await sql`
      INSERT INTO public.plan_cuentas (codigo, nombre, tipo, acepta_movimientos)
      VALUES (${codigo}, ${nombre}, ${tipo}, true)
      ON CONFLICT (codigo) DO UPDATE SET nombre = ${nombre}
      RETURNING id`;
    cuentasTest.push(row.id);
    if (i === 0) cuentaDebeId = row.id;
    else cuentaHaberId = row.id;
  }
}

/** Crea un asiento de venta CONTABILIZADO con el documentoRef de la factura. */
async function crearAsientoVenta(
  facturaId: string,
  debe = 100000,
): Promise<{ asientoId: string; cuentaDebe: string; cuentaHaber: string }> {
  const sql = getDb() as any;
  const cuentaDebe = cuentaDebeId;
  const cuentaHaber = cuentaHaberId;
  if (!cuentaDebe || !cuentaHaber) {
    throw new Error("El test necesita las dos cuentas sembradas");
  }

  const [asiento] = await sql`
    INSERT INTO public.asientos_contables
      (numero, fecha, concepto, documento_ref, modulo_origen, estado, total_debe, total_haber)
    VALUES (900, NOW(), 'Venta test', ${`factura:${facturaId}`}, 'VENTA', 'CONTABILIZADO', ${debe}, ${debe})
    RETURNING id`;

  await sql`
    INSERT INTO public.asientos_detalle (asiento_id, cuenta_id, numero_linea, debe, haber)
    VALUES
      (${asiento.id}, ${cuentaDebe}, 1, ${debe}, NULL),
      (${asiento.id}, ${cuentaHaber}, 2, NULL, ${debe})`;

  await db().update(facturas).set({ asientoId: asiento.id }).where(eq(facturas.id, facturaId));

  return { asientoId: asiento.id, cuentaDebe, cuentaHaber };
}

/**
 * UUID válido y único por test. El último grupo debe tener exactamente 12
 * dígitos hexadecimales: se deriva del contador de test, no de Math.random(),
 * para que un reintento no genere colisiones ni UUIDs mal formados.
 */
let seq = 0;
function nuevoId(): string {
  seq += 1;
  return `00000000-0000-0000-0000-${seq.toString(16).padStart(12, "0")}`;
}

/**
 * `mechanic_profiles.profile_id` es UNIQUE: un empleado tiene un solo perfil.
 * Estos pools dan a cada test un mecánico distinto, para que un segundo insert
 * del archivo no reviente la restricción y el fallo no parezca un bug de ruta.
 */
const poolLocal: string[] = [];
const poolAjeno: string[] = [];
let cursorLocal = 0;
let cursorAjeno = 0;

/**
 * Siguiente mecánico libre del tenant del test. `profile_id` es único, así que
 * una corrida anterior que falló en el teardown pudo dejar perfiles puestos:
 * en ese caso se salta al siguiente en vez de reventar la restricción.
 */
async function mecanicoDePool(): Promise<string> {
  while (cursorLocal < poolLocal.length) {
    const id = poolLocal[cursorLocal++];
    if (!(await tienePerfil(id))) return id;
  }
  throw new Error("Se agotó el pool de mecánicos locales");
}

/** Igual que `mecanicoDePool`, pero en el tenant vecino. */
async function mecanicoAjenoDePool(): Promise<string> {
  while (cursorAjeno < poolAjeno.length) {
    const id = poolAjeno[cursorAjeno++];
    if (!(await tienePerfil(id))) return id;
  }
  throw new Error("Se agotó el pool de mecánicos ajenos");
}

async function tienePerfil(profileId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: mechanicProfiles.id })
    .from(mechanicProfiles)
    .where(eq(mechanicProfiles.profileId, profileId))
    .limit(1);
  return Boolean(row);
}

async function sembrarPoolDeMecanicos(): Promise<void> {
  const sql = getDb() as any;
  for (let i = 0; i < 24; i += 1) {
    const idLocal = `00000000-0000-0000-0000-00000046${String(i).padStart(4, "0")}`;
    const idAjeno = `00000000-0000-0000-0000-00000047${String(i).padStart(4, "0")}`;
    const emailL = emailDe(idLocal, T);
    const emailA = emailDe(idAjeno, OTRO);
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${idLocal}, ${T_ID}, ${emailL}, ${idLocal}, 'mechanic', true)
      ON CONFLICT (tenant_id, email) DO NOTHING`;
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${idAjeno}, ${OTRO_ID}, ${emailA}, ${idAjeno}, 'mechanic', true)
      ON CONFLICT (tenant_id, email) DO NOTHING`;
    poolLocal.push(idLocal);
    poolAjeno.push(idAjeno);
  }
}

beforeAll(async () => {
  await crearTenant(T_ID, T);
  await crearTenant(OTRO_ID, OTRO);

  const sql = getDb() as any;
  for (const [id, tenantId, slug, role] of [
    [ADMIN, T_ID, T, "admin"],
    [MANAGER, T_ID, T, "manager"],
    [MECANICO, T_ID, T, "mechanic"],
  ] as const) {
    const email = emailDe(id, slug);
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${id}, ${tenantId}, ${email}, ${id}, ${role}, true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET role = ${role}, is_active = true`;
  }
  await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
    VALUES (${OTRO_MECANICO}, ${OTRO_ID}, ${emailDe(OTRO_MECANICO, OTRO)}, 'Otro', 'mechanic', true)
    ON CONFLICT (tenant_id, email) DO NOTHING`;

  await sembrarPoolDeMecanicos();
  await sembrarCuentas();

  app = await buildApp();
  await app.ready();
}, 120_000);

afterAll(async () => {
  if (app) await app.close();
  const sql = getDb() as any;

  if (creadoIds.length) {
    await db().delete(mechanicProfiles).where(inArray(mechanicProfiles.id, creadoIds));
  }
  if (resumenIds.length) {
    await db().delete(payrollSummary).where(inArray(payrollSummary.id, resumenIds));
  }

  // Las facturas referencian su asiento (`facturas.asiento_id`), así que se
  // borran primero; si se invierte, la FK bloquea el borrado de los asientos.
  if (ordenIds.length) {
    await db().delete(facturas).where(inArray(facturas.ordenId, ordenIds));
  }
  // `like()` de Drizzle en vez de un fragmento `sql` crudo: el tagged template
  // de postgres.js no es intercambiable con el executor de drizzle.
  const esDeTest = or(
    like(asientosContables.documentoRef, "factura:%"),
    like(asientosContables.documentoRef, "reversal:%"),
  );
  await db()
    .delete(asientosDetalle)
    .where(
      inArray(
        asientosDetalle.asientoId,
        db().select({ id: asientosContables.id }).from(asientosContables).where(esDeTest),
      ),
    );
  await db().delete(asientosContables).where(esDeTest);

  if (ordenIds.length) {
    await db().delete(ordenesTrabajo).where(inArray(ordenesTrabajo.id, ordenIds));
    await db().delete(vehiculos).where(inArray(vehiculos.id, [VEHICULO, OTRO_VEHICULO]));
    await db().delete(clients).where(inArray(clients.id, [CLIENTE, OTRO_CLIENTE]));
  }
  if (cuentasTest.length) {
    await db()
      .delete(asientosDetalle)
      .where(inArray(asientosDetalle.cuentaId, cuentasTest));
    await db()
      .delete(planCuentas)
      .where(inArray(planCuentas.id, cuentasTest));
  }
  await sql`DELETE FROM public.audit_log WHERE tenant_slug = ANY(${[T, OTRO]})`;
  await sql`DELETE FROM public.profiles WHERE tenant_id = ANY(${[T_ID, OTRO_ID]})`;
  await sql`DELETE FROM public.tenants WHERE id = ANY(${[T_ID, OTRO_ID]})`;
}, 120_000);

// ═══════════════════════════════════════════════════════════════════
//  FIN-04 · Anulación de factura
// ═══════════════════════════════════════════════════════════════════

describe("T-45 · FIN-04 anulación de factura", () => {
  it("anula una factura MANUAL y genera el asiento de reverso (Debe↔Haber)", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T);
    const { asientoId, cuentaDebe, cuentaHaber } = await crearAsientoVenta(facturaId);

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "Error de tipeo en el importe" },
    });

    expect(res.statusCode, res.body).toBe(200);
    const { data } = res.json();
    expect(data.estadoPago).toBe("ANULADA");
    expect(data.reversoGenerado).toBe(true);
    expect(data.reversalAsientoId).toBeTruthy();

    // El original queda ANULADO
    const [original] = await db()
      .select({ estado: asientosContables.estado })
      .from(asientosContables)
      .where(eq(asientosContables.id, asientoId));
    expect(original.estado).toBe("ANULADO");

    // El reverso invierte las líneas del original
    const detalle = await db()
      .select({
        cuentaId: asientosDetalle.cuentaId,
        debe: asientosDetalle.debe,
        haber: asientosDetalle.haber,
      })
      .from(asientosDetalle)
      .where(eq(asientosDetalle.asientoId, data.reversalAsientoId!));

    expect(detalle).toHaveLength(2);
    const revDebe = detalle.find((l) => l.cuentaId === cuentaDebe);
    const revHaber = detalle.find((l) => l.cuentaId === cuentaHaber);
    // El Debe original pasó al Haber del reverso y viceversa.
    expect(Number(revDebe!.haber)).toBe(100000);
    expect(Number(revHaber!.debe)).toBe(100000);

    // Y la factura queda con saldo 0
    const [f] = await db()
      .select({ estadoPago: facturas.estadoPago, saldo: facturas.saldoPendiente })
      .from(facturas)
      .where(eq(facturas.id, facturaId));
    expect(f.estadoPago).toBe("ANULADA");
    expect(Number(f.saldo)).toBe(0);
  }, 60_000);

  it("anula una factura sin asiento: deja constancia del reverso omitido", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T);

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "Anulación sin contabilidad" },
    });

    expect(res.statusCode, res.body).toBe(200);
    const { data } = res.json();
    expect(data.estadoPago).toBe("ANULADA");
    expect(data.reversoGenerado).toBe(false);
    expect(data.reversoOmitido).toBeTruthy();
  }, 60_000);

  it("anular dos veces la misma factura → 409 (idempotencia)", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T);

    const head = auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T));
    const first = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: head,
      payload: { motivo: "Primera" },
    });
    expect(first.statusCode, first.body).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: head,
      payload: { motivo: "Segunda" },
    });
    expect(second.statusCode, second.body).toBe(409);
    expect(second.json().error).toBe("ConflictError");
  }, 60_000);

  it("rechaza anular una factura PAGA (409): el cobro necesita reverso previo", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T, {
      estadoPago: "PAGA",
      saldoPendiente: "0",
    });

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "Intento sobre factura cobrada" },
    });

    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().message).toMatch(/PAGA/);

    // No se anuló
    const [f] = await db()
      .select({ estadoPago: facturas.estadoPago })
      .from(facturas)
      .where(eq(facturas.id, facturaId));
    expect(f.estadoPago).toBe("PAGA");
  }, 60_000);

  it("rechaza anular una factura con pago PARCIAL (409)", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T, {
      estadoPago: "PARCIAL",
      saldoPendiente: "40000",
    });

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "Intento sobre factura con pago parcial" },
    });

    expect(res.statusCode, res.body).toBe(409);
  }, 60_000);

  it("rechaza anular en el sistema un DTE con CDC sin confirmación SIFEN (409)", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T, {
      tipo: "ELECTRONICA",
      sifenCdc: "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
      sifenStatus: "APROBADO_DNIT",
    });

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "Anulación directa de DTE" },
    });

    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().message).toMatch(/DNIT|SIFEN/);

    // Sigue vigente: la DNIT es la autoridad sobre el DTE.
    const [f] = await db()
      .select({ estadoPago: facturas.estadoPago })
      .from(facturas)
      .where(eq(facturas.id, facturaId));
    expect(f.estadoPago).toBe("PENDIENTE");
  }, 60_000);

  it("anula un DTE con CDC si se confirma que SIFEN ya lo anuló", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T, {
      tipo: "ELECTRONICA",
      sifenCdc: "ABCDEF0123456789ABCDEF0123456789ABCDEF02",
      sifenStatus: "APROBADO_DNIT",
    });

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "DTE anulado ante SIFEN sif-03", sifenAnulado: true },
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().data.estadoPago).toBe("ANULADA");
  }, 60_000);

  it("motivo obligatorio → 422", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T);

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "   " },
    });

    expect(res.statusCode, res.body).toBe(422);
  }, 60_000);

  it("factura de otro tenant → 404 (no revela existencia)", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, OTRO_CLIENTE, OTRO_VEHICULO, OTRO, 100000);
    await crearFactura(facturaId, ordenId, OTRO);

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "Intento cross-tenant" },
    });

    expect(res.statusCode, res.body).toBe(404);
  }, 60_000);

  it("exige manager+ (mecánico → 403)", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T);

    const res = await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(MECANICO, emailDe(MECANICO, T), "mechanic", T_ID, T)),
      payload: { motivo: "Intento sin permisos" },
    });

    expect(res.statusCode, res.body).toBe(403);
  }, 60_000);

  it("deja asiento de auditoría de la anulación", async () => {
    const ordenId = nuevoId();
    const facturaId = nuevoId();
    await crearOT(ordenId, CLIENTE, VEHICULO, T, 100000);
    await crearFactura(facturaId, ordenId, T);

    await app.inject({
      method: "POST",
      url: `/finance/invoices/${facturaId}/void`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { motivo: "Anulación auditada" },
    });

    const entradas = await db()
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tenantSlug, T),
          eq(auditLog.entidad, "facturas"),
          eq(auditLog.entidadId, facturaId),
          eq(auditLog.accion, "ANULAR"),
        ),
      );

    expect(entradas).toHaveLength(1);
    expect(entradas[0].descripcion).toMatch(/Anulación de factura/);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
//  FIN-07a · mechanic-profiles (aislamiento por profile_id)
// ═══════════════════════════════════════════════════════════════════

describe("T-45 · FIN-07a CRUD de perfiles de mecánico", () => {
  /** Inserta el perfil de un mecánico y devuelve su id. */
  async function perfilDe(
    profileId: string,
    baseSalary: number,
    category = "OFICIAL",
  ): Promise<string> {
    const [row] = await db()
      .insert(mechanicProfiles)
      .values({
        profileId,
        category: category as any,
        baseSalary,
        commissionRate: "5.00",
      })
      .returning();
    creadoIds.push(row.id);
    return row.id;
  }

  it("POST crea el perfil con validación de categoría y comisión", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {
        profileId: await mecanicoDePool(),
        category: "OFICIAL",
        baseSalary: 2_500_000,
        commissionRate: 7.5,
      },
    });

    expect(res.statusCode, res.body).toBe(201);
    const row = res.json();
    expect(row.category).toBe("OFICIAL");
    expect(row.baseSalary).toBe(2_500_000);
    expect(Number(row.commissionRate)).toBe(7.5);
    expect(row.activo).toBe(true);
    creadoIds.push(row.id);
  }, 60_000);

  it("POST con categoría inválida → 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {
        profileId: await mecanicoDePool(),
        category: "ASTROLOGO",
        baseSalary: 1,
        commissionRate: 1,
      },
    });

    expect(res.statusCode, res.body).toBe(422);
    expect(res.json().message).toMatch(/Categoría inválida/);
  }, 60_000);

  it("POST con comisión > 100% → 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {
        profileId: await mecanicoDePool(),
        category: "OFICIAL",
        baseSalary: 1,
        commissionRate: 150,
      },
    });

    expect(res.statusCode, res.body).toBe(422);
    expect(res.json().message).toMatch(/100/);
  }, 60_000);

  it("POST con profileId de otro tenant → 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {
        profileId: await mecanicoAjenoDePool(),
        category: "OFICIAL",
        baseSalary: 1,
        commissionRate: 1,
      },
    });

    expect(res.statusCode, res.body).toBe(404);
  }, 60_000);

  it("POST duplicado para la misma persona → 409", async () => {
    const dup = await mecanicoDePool();

    const first = await app.inject({
      method: "POST",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {
        profileId: dup,
        category: "OFICIAL",
        baseSalary: 1,
        commissionRate: 1,
      },
    });
    expect(first.statusCode, first.body).toBe(201);
    creadoIds.push(first.json().id);

    const second = await app.inject({
      method: "POST",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {
        profileId: dup,
        category: "OFICIAL",
        baseSalary: 1,
        commissionRate: 1,
      },
    });

    expect(second.statusCode, second.body).toBe(409);
  }, 60_000);

  it("GET lista solo los perfiles del tenant propio", async () => {
    await perfilDe(await mecanicoDePool(), 1_800_000);
    // Salario sentinela del taller vecino: no debe aparecer nunca.
    await perfilDe(await mecanicoAjenoDePool(), 9_999_999);

    const res = await app.inject({
      method: "GET",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(200);
    const rows = res.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r: any) => r.baseSalary === 9_999_999)).toBe(false);
    expect(rows.every((r: any) => r.email.endsWith(`@${T}.test`))).toBe(true);
  }, 60_000);

  it("GET por id es tenant-scoped (otro tenant → 404)", async () => {
    const ajeno = await perfilDe(await mecanicoAjenoDePool(), 5_555_555);

    const res = await app.inject({
      method: "GET",
      url: `/workshop/mechanic-profiles/${ajeno}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(404);
  }, 60_000);

  it("PATCH actualiza y es tenant-scoped", async () => {
    const id = await perfilDe(await mecanicoDePool(), 1_000_000);

    const ok = await app.inject({
      method: "PATCH",
      url: `/workshop/mechanic-profiles/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { baseSalary: 1_200_000, commissionRate: 8.25 },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().baseSalary).toBe(1_200_000);
    expect(Number(ok.json().commissionRate)).toBe(8.25);

    // Otro tenant no puede tocarlo...
    const ajeno = await perfilDe(await mecanicoAjenoDePool(), 4_444_444);
    const intruso = await app.inject({
      method: "PATCH",
      url: `/workshop/mechanic-profiles/${ajeno}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { baseSalary: 1 },
    });
    expect(intruso.statusCode, intruso.body).toBe(404);

    // ...y el salario ajeno quedó intacto
    const [check] = await db()
      .select({ baseSalary: mechanicProfiles.baseSalary })
      .from(mechanicProfiles)
      .where(eq(mechanicProfiles.id, ajeno));
    expect(check.baseSalary).toBe(4_444_444);
  }, 60_000);

  it("PATCH de un id inexistente → 404 (antes devolvía 200 con null)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/mechanic-profiles/${nuevoId()}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { baseSalary: 1 },
    });

    expect(res.statusCode, res.body).toBe(404);
  }, 60_000);

  it("PATCH sin campos → 422", async () => {
    const id = await perfilDe(await mecanicoDePool(), 900_000);
    const res = await app.inject({
      method: "PATCH",
      url: `/workshop/mechanic-profiles/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {},
    });

    expect(res.statusCode, res.body).toBe(422);
  }, 60_000);

  it("PATCH de otro tenant también por DELETE → 404 (salario intacto)", async () => {
    const ajeno = await perfilDe(await mecanicoAjenoDePool(), 6_666_666);

    const res = await app.inject({
      method: "DELETE",
      url: `/workshop/mechanic-profiles/${ajeno}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });
    expect(res.statusCode, res.body).toBe(404);

    const [check] = await db()
      .select({ activo: mechanicProfiles.activo })
      .from(mechanicProfiles)
      .where(eq(mechanicProfiles.id, ajeno));
    expect(check.activo).toBe(true);
  }, 60_000);

  it("POST/PATCH/DELETE exigen manager+ (mecánico → 403)", async () => {
    const head = auth(token(MECANICO, emailDe(MECANICO, T), "mechanic", T_ID, T));
    const id = await perfilDe(await mecanicoDePool(), 800_000);

    const post = await app.inject({
      method: "POST",
      url: "/workshop/mechanic-profiles",
      headers: head,
      payload: {
        profileId: await mecanicoDePool(),
        category: "OFICIAL",
        baseSalary: 1,
        commissionRate: 1,
      },
    });
    expect(post.statusCode, post.body).toBe(403);

    const patch = await app.inject({
      method: "PATCH",
      url: `/workshop/mechanic-profiles/${id}`,
      headers: head,
      payload: { baseSalary: 1 },
    });
    expect(patch.statusCode, patch.body).toBe(403);

    const del = await app.inject({
      method: "DELETE",
      url: `/workshop/mechanic-profiles/${id}`,
      headers: head,
    });
    expect(del.statusCode, del.body).toBe(403);

    // Ninguna mutación se aplicó
    const [row] = await db()
      .select({ baseSalary: mechanicProfiles.baseSalary, activo: mechanicProfiles.activo })
      .from(mechanicProfiles)
      .where(eq(mechanicProfiles.id, id));
    expect(row.baseSalary).toBe(800_000);
    expect(row.activo).toBe(true);
  }, 60_000);

  it("DELETE da de baja lógicamente y el GET ya no lo lista", async () => {
    const id = await perfilDe(await mecanicoDePool(), 700_000, "AYUDANTE");

    const del = await app.inject({
      method: "DELETE",
      url: `/workshop/mechanic-profiles/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });
    expect(del.statusCode, del.body).toBe(200);
    expect(del.json().deleted).toBe(true);

    // Sigue existiendo (baja lógica: se conserva el histórico de comisiones)
    const [row] = await db()
      .select({ activo: mechanicProfiles.activo })
      .from(mechanicProfiles)
      .where(eq(mechanicProfiles.id, id));
    expect(row.activo).toBe(false);

    // Pero no aparece en el listado
    const list = await app.inject({
      method: "GET",
      url: "/workshop/mechanic-profiles",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });
    expect(list.json().some((r: any) => r.id === id)).toBe(false);
  }, 60_000);

});

// ═══════════════════════════════════════════════════════════════════
//  FIN-07b · payroll-summary
// ═══════════════════════════════════════════════════════════════════

describe("T-45 · FIN-07b payroll-summary", () => {
  async function crearResumen(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<string> {
    const [row] = await db()
      .insert(payrollSummary)
      .values({
        tenantId,
        month,
        year,
        fixedExpensesTotal: 3_000_000,
        payrollBaseTotal: 2_000_000,
        netLaborRevenue: 1_000_000,
        breakevenThreshold: 5_000_000,
        breakevenHit: false,
        breakevenPercentage: "20.00",
      })
      .returning();
    resumenIds.push(row.id);
    return row.id;
  }

  it("GET /history devuelve solo el tenant propio", async () => {
    await crearResumen(T_ID, 2026, 3);
    await crearResumen(OTRO_ID, 2026, 3);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/finance/payroll/history",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(200);
    const rows = res.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => r.tenantId === T_ID)).toBe(true);
  }, 60_000);

  it("GET /history?year= filtra por año", async () => {
    await crearResumen(T_ID, 2025, 7);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/finance/payroll/history?year=2025",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().every((r: any) => r.year === 2025)).toBe(true);
  }, 60_000);

  it("GET /commissions devuelve solo el tenant propio", async () => {
    const sql = getDb() as any;
    // commission_records.mechanic_profile_id referencia mechanic_profiles.id,
    // así que se necesitan perfiles reales de cada taller.
    const propio = await db()
      .insert(mechanicProfiles)
      .values({
        profileId: await mecanicoDePool(),
        category: "OFICIAL" as any,
        baseSalary: 1_000_000,
        commissionRate: "5.00",
      })
      .returning();
    const ajeno = await db()
      .insert(mechanicProfiles)
      .values({
        profileId: await mecanicoAjenoDePool(),
        category: "OFICIAL" as any,
        baseSalary: 1_000_000,
        commissionRate: "5.00",
      })
      .returning();
    creadoIds.push(propio[0].id, ajeno[0].id);

    await sql`
      INSERT INTO public.commission_records
        (tenant_id, mechanic_profile_id, month, year, labor_amount, commission_rate, commission_amount, status)
      VALUES
        (${T_ID}, ${propio[0].id}, 3, 2026, 1000, 5.00, 100, 'LIBERADO'),
        (${OTRO_ID}, ${ajeno[0].id}, 3, 2026, 7777, 5.00, 777, 'LIBERADO')`;

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/finance/payroll/commissions?month=3&year=2026",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(200);
    const rows = res.json();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: any) => r.tenantId === T_ID)).toBe(true);
    // El monto del taller vecino (7777) no debe aparecer.
    expect(rows.some((r: any) => Number(r.laborAmount) === 7777)).toBe(false);

    await sql`DELETE FROM public.commission_records
      WHERE tenant_id = ANY(${[T_ID, OTRO_ID]}) AND month = 3 AND year = 2026`;
  }, 60_000);

  it("GET /summary de un período inexistente → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/finance/payroll/summary?month=11&year=2024",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(404);
  }, 60_000);

  it("GET /summary con período inválido → 422", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/finance/payroll/summary?month=13&year=2026",
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(422);
  }, 60_000);

  it("PATCH corrige importes y recalcula el equilibrio", async () => {
    const id = await crearResumen(T_ID, 2026, 4);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { netLaborRevenue: 6_000_000 },
    });

    expect(res.statusCode, res.body).toBe(200);
    const row = res.json();
    expect(row.netLaborRevenue).toBe(6_000_000);
    // 6.000.000 >= 5.000.000 → equilibrio alcanzado
    expect(row.breakevenHit).toBe(true);
    expect(Number(row.breakevenPercentage)).toBe(120);
  }, 60_000);

  it("PATCH recompone el umbral si ajusta gastos fijos o nómina base", async () => {
    const id = await crearResumen(T_ID, 2026, 5);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { fixedExpensesTotal: 1_000_000 },
    });

    expect(res.statusCode, res.body).toBe(200);
    const row = res.json();
    // 1.000.000 (fijos) + 2.000.000 (nómina base) = 3.000.000
    expect(row.breakevenThreshold).toBe(3_000_000);
    // 1.000.000 de ingreso neto < 3.000.000 → no alcanza
    expect(row.breakevenHit).toBe(false);
    expect(Number(row.breakevenPercentage)).toBeCloseTo(33.33, 1);
  }, 60_000);

  it("PATCH de otro tenant → 404", async () => {
    const id = await crearResumen(OTRO_ID, 2026, 6);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { netLaborRevenue: 1 },
    });

    expect(res.statusCode, res.body).toBe(404);
  }, 60_000);

  it("PATCH sin campos → 422", async () => {
    const id = await crearResumen(T_ID, 2026, 8);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: {},
    });

    expect(res.statusCode, res.body).toBe(422);
  }, 60_000);

  it("PATCH con importe negativo → 422", async () => {
    const id = await crearResumen(T_ID, 2026, 9);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
      payload: { netLaborRevenue: -5 },
    });

    expect(res.statusCode, res.body).toBe(422);
  }, 60_000);

  it("DELETE descarta el resumen y es tenant-scoped", async () => {
    const id = await crearResumen(T_ID, 2026, 10);
    const otroId = await crearResumen(OTRO_ID, 2026, 11);

    const intruso = await app.inject({
      method: "DELETE",
      url: `/api/v1/finance/payroll/summary/${otroId}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });
    expect(intruso.statusCode, intruso.body).toBe(404);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().deleted).toBe(true);

    const rows = await db()
      .select()
      .from(payrollSummary)
      .where(eq(payrollSummary.id, id));
    expect(rows).toHaveLength(0);
  }, 60_000);

  it("DELETE rechaza un período con asiento de nómina contabilizado (409)", async () => {
    const id = await crearResumen(T_ID, 2026, 12);
    const sql = getDb() as any;
    await sql`
      INSERT INTO public.asientos_contables
        (numero, fecha, concepto, documento_ref, modulo_origen, estado, total_debe, total_haber)
      VALUES (901, NOW(), 'Nómina', 'nomina_mensual:payroll_2026_12', 'NOMINA', 'CONTABILIZADO', 100, 100)
      ON CONFLICT DO NOTHING`;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T)),
    });

    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().message).toMatch(/asiento de nómina/);

    await sql`DELETE FROM public.asientos_contables WHERE documento_ref = 'nomina_mensual:payroll_2026_12'`;
  }, 60_000);

  it("PATCH/DELETE exigen manager+ (mecánico → 403)", async () => {
    const id = await crearResumen(T_ID, 2026, 2);
    const head = auth(token(MECANICO, emailDe(MECANICO, T), "mechanic", T_ID, T));

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: head,
      payload: { netLaborRevenue: 1 },
    });
    expect(patch.statusCode, patch.body).toBe(403);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/v1/finance/payroll/summary/${id}`,
      headers: head,
    });
    expect(del.statusCode, del.body).toBe(403);
  }, 60_000);
});
