/**
 * Seed script: dataset determinista para la suite E2E de Playwright (T-62).
 *
 * A diferencia de `seed-demo-all.sh` (datos realistas, para un taller real) y de
 * `seed-test.sql` (fixtures planos del backend vitest), este seed existe para que
 * los asserts de datos de `web/e2e/*.spec.ts` tengan un valor **exacto** contra el
 * que comparar: si la UI muestra ₲ 500.000 en Ingresos, es porque la BD tiene
 * 100.000 + 250.000 + 150.000, no porque la página se\limite a pintar un `—`.
 *
 * Por eso los importes son redondos y los conteos cerrados. Cualquier cambio en
 * estos números rompe los tests a propósito: ese es el punto de T-62.
 *
 * Idempotente: borra y recrea únicamente los datos de este seed, identificados por
 * el prefijo `e2e-` en los campos de texto. Nunca toca datos de otros tenants.
 *
 * Uso:
 *   npx tsx scripts/seed-e2e.ts
 *
 * Variables de entorno:
 *   E2E_TENANT_SLUG        — slug del tenant (default: demo, el que espera
 *                            web/e2e/auth.setup.ts)
 *   E2E_ADMIN_PASSWORD     — password de admin@demo.com (default: password123,
 *                            el mismo fallback que auth.setup.ts)
 *   E2E_ADMIN_EMAIL        — (default: admin@demo.com)
 *
 * @module scripts/seed-e2e
 */

import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "../src/shared/database/drizzle.js";
import { closeDb } from "../src/shared/database/connection.js";
import {
  tenants,
  profiles,
  clients,
  vehiculos,
  ordenesTrabajo,
} from "../src/shared/database/schema/index.js";
import { agendamientos } from "../src/modules/scheduling/schema/agendamientos.js";
import { payrollSummary } from "../src/modules/finance/schema/payroll-summary.js";
import { hashPassword } from "../src/modules/config/services/auth-utils.js";

const TENANT_SLUG = process.env["E2E_TENANT_SLUG"] || "demo";
const TENANT_NAME = "Taller E2E";
const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"] || "admin@demo.com";
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"] || "password123";

/** Marca todo lo que crea este seed para poder limpiarlo y recrearlo. */
const MARK = "e2e-";

/**
 * Valores esperados por los asserts E2E. Se exportan como constantes para que
 * los specs no repitan números mágicos: si cambia el seed, cambia el test.
 */
export const E2E_EXPECTED = {
  /** Suma de total_cost de las OTs dentro del rango por defecto (30 días). */
  revenue: 500_000,
  /** Cantidad de OTs en el rango. */
  orderCount: 3,
  /** round(500000 / 3) — el backend redondea el ticket promedio a entero. */
  avgOrderValue: 166_667,
  /** 2 OTs "Listo" de 3 → 66.666… El backend redondea a un decimal: 66.7. */
  completionRate: 66.7,
  /** payroll_summary del mes en curso. */
  payroll: {
    netLaborRevenue: 30_000_000,
    breakevenThreshold: 50_000_000,
    breakevenPercentage: 60,
  },
  /** Turnos sembrados en `agendamientos`. */
  appointments: 3,
} as const;

const CLIENTS = [
  { name: `${MARK}Cliente Uno`, email: `${MARK}uno@example.test`, phone: "+595981000001" },
  { name: `${MARK}Cliente Dos`, email: `${MARK}dos@example.test`, phone: "+595981000002" },
];

const VEHICLES = [
  { plate: `${MARK}A123`, brand: "Toyota", model: "Corolla" },
  { plate: `${MARK}B456`, brand: "Hyundai", model: "Tucson" },
];

/**
 * OTs dentro de la ventana de 30 días que usa `/analytics/kpis` por defecto.
 * `Listo` es el estado que el backend cuenta como completada
 * (getCompletionRateKPI), de ahí la proporción 2/3.
 */
const WORK_ORDERS = [
  { totalCost: 100_000, status: "Listo" as const },
  { totalCost: 250_000, status: "Listo" as const },
  { totalCost: 150_000, status: "En_Proceso" as const },
];

/** Turnos de calendario: mañana, en 2 días y en 3 días. */
const APPOINTMENT_OFFSETS = [1, 2, 3];
const APPOINTMENT_HOURS = ["09:00", "11:30", "15:00"];

function fechaTurno(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Ordenes creadas hace 5 días — dentro de la ventana de 30 días por defecto. */
function createdAtHace5Dias(): Date {
  return new Date(Date.now() - 5 * 86_400_000);
}

async function upsertTenant() {
  const existing = await db()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [created] = await db()
    .insert(tenants)
    .values({ name: TENANT_NAME, slug: TENANT_SLUG, schemaName: TENANT_SLUG, isActive: true })
    .returning({ id: tenants.id });

  return created.id;
}

/**
 * El admin se resetea siempre (password incluido) para que el login de
 * `loginAsAdmin` sea determinista sin depender del orden de las corridas.
 */
async function upsertAdmin(tenantId: string) {
  const passwordHash = hashPassword(ADMIN_PASSWORD);
  const existing = await db()
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`${profiles.tenantId} = ${tenantId} AND ${profiles.email} = ${ADMIN_EMAIL}`)
    .limit(1);

  if (existing.length > 0) {
    await db()
      .update(profiles)
      .set({ passwordHash, isActive: true, role: "admin" })
      .where(eq(profiles.id, existing[0].id));
    return existing[0].id;
  }

  const [created] = await db()
    .insert(profiles)
    .values({
      tenantId,
      email: ADMIN_EMAIL,
      fullName: "Admin E2E",
      role: "admin",
      passwordHash,
      isActive: true,
    })
    .returning({ id: profiles.id });

  return created.id;
}

/** Borra solo las filas creadas por este seed (marcadas con E2E-*). */
async function limpiar(_tenantId: string, _clientIds: string[], _vehicleIds: string[]) {
  // Ordenes de trabajo asociadas a vehículos con chapa E2E-*
  await db()
    .delete(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, TENANT_SLUG),
        exists(
          db()
            .select({ id: vehiculos.id })
            .from(vehiculos)
            .where(
              and(
                eq(vehiculos.id, ordenesTrabajo.vehiculoId),
                like(vehiculos.chapa, `${MARK}%`),
              ),
            ),
        ),
      ),
    );

  // Vehículos con chapa E2E-*
  await db()
    .delete(vehiculos)
    .where(and(eq(vehiculos.tenantSlug, TENANT_SLUG), like(vehiculos.chapa, `${MARK}%`)));

  // Clientes con emails de este seed
  const clientEmails = CLIENTS.map((c) => c.email);
  if (clientEmails.length > 0) {
    await db()
      .delete(clients)
      .where(and(eq(clients.tenantSlug, TENANT_SLUG), inArray(clients.email, clientEmails)));
  }

  await db()
    .delete(agendamientos)
    .where(
      and(
        eq(agendamientos.tenantSlug, TENANT_SLUG),
        like(agendamientos.vehiculoChapa, `${MARK}%`),
      ),
    );
  await db()
    .delete(payrollSummary)
    .where(
      and(
        eq(payrollSummary.tenantId, _tenantId),
        eq(payrollSummary.month, new Date().getMonth() + 1),
        eq(payrollSummary.year, new Date().getFullYear()),
      ),
    );
}

async function main() {
  console.log(`🌱 Seed E2E · tenant=${TENANT_SLUG} · admin=${ADMIN_EMAIL}\n`);

  const tenantId = await upsertTenant();
  await upsertAdmin(tenantId);
  console.log(`   ✅ Tenant + admin listos (${tenantId})`);

  // ── Limpieza selectiva ────────────────────────────────────────
  const prevClients = await db()
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.tenantSlug, TENANT_SLUG));
  const prevVehicles = await db()
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(eq(vehiculos.tenantSlug, TENANT_SLUG));
  await limpiar(
    tenantId,
    prevClients.map((c) => c.id),
    prevVehicles.map((v) => v.id),
  );

  // ── Clientes ──────────────────────────────────────────────────
  const clientIds: string[] = [];
  for (const c of CLIENTS) {
    const [row] = await db()
      .insert(clients)
      .values({
        tenantSlug: TENANT_SLUG,
        name: c.name,
        email: c.email,
        phone: c.phone,
      })
      .returning({ id: clients.id });
    clientIds.push(row.id);
  }
  console.log(`   ✅ ${clientIds.length} clientes`);

  // ── Vehículos ─────────────────────────────────────────────────
  const vehicleIds: string[] = [];
  for (let i = 0; i < VEHICLES.length; i++) {
    const v = VEHICLES[i];
    const [row] = await db()
      .insert(vehiculos)
      .values({
        tenantSlug: TENANT_SLUG,
        clientId: clientIds[i],
        plate: v.plate,
        brand: v.brand,
        model: v.model,
      })
      .returning({ id: vehiculos.id });
    vehicleIds.push(row.id);
  }
  console.log(`   ✅ ${vehicleIds.length} vehículos`);

  // ── Órdenes de trabajo (base de los KPIs de analytics) ────────
  const createdAt = createdAtHace5Dias();
  for (let i = 0; i < WORK_ORDERS.length; i++) {
    const wo = WORK_ORDERS[i];
    await db().insert(ordenesTrabajo).values({
      tenantSlug: TENANT_SLUG,
      clientId: clientIds[i % clientIds.length],
      vehicleId: vehicleIds[i % vehicleIds.length],
      status: wo.status,
      description: `${MARK}OT ${i + 1}`,
      totalCost: String(wo.totalCost),
      createdAt,
    });
  }
  console.log(
    `   ✅ ${WORK_ORDERS.length} OTs · revenue=${E2E_EXPECTED.revenue} · completion=${E2E_EXPECTED.completionRate}%`,
  );

  // ── Turnos (calendario) ───────────────────────────────────────
  for (let i = 0; i < APPOINTMENT_OFFSETS.length; i++) {
    await db().insert(agendamientos).values({
      tenantSlug: TENANT_SLUG,
      clienteNombre: CLIENTS[i % CLIENTS.length].name,
      clientePhone: CLIENTS[i % CLIENTS.length].phone,
      clienteEmail: CLIENTS[i % CLIENTS.length].email,
      vehiculoChapa: VEHICLES[i % VEHICLES.length].plate,
      vehiculoMarca: VEHICLES[i % VEHICLES.length].brand,
      vehiculoModelo: VEHICLES[i % VEHICLES.length].model,
      fechaTurno: fechaTurno(APPOINTMENT_OFFSETS[i]),
      horaTurno: APPOINTMENT_HOURS[i],
      tipoServicio: i === 1 ? "PESADO" : "RAPIDO",
      estado: i === 0 ? "CONFIRMADO" : "RESERVADO",
      createdBy: ADMIN_EMAIL,
    });
  }
  console.log(`   ✅ ${E2E_EXPECTED.appointments} turnos`);

  // ── payroll_summary del mes en curso (break-even de Nómina) ───
  const now = new Date();
  const { netLaborRevenue, breakevenThreshold, breakevenPercentage } = E2E_EXPECTED.payroll;
  await db().insert(payrollSummary).values({
    tenantId,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    fixedExpensesTotal: 20_000_000,
    payrollBaseTotal: 8_000_000,
    netLaborRevenue,
    breakevenThreshold,
    breakevenHit: false,
    breakevenPercentage: String(breakevenPercentage),
  });
  console.log(
    `   ✅ payroll_summary ${now.getMonth() + 1}/${now.getFullYear()} · ${breakevenPercentage}% de ${breakevenThreshold}`,
  );

  console.log(`\n🌱 Seed E2E completo. Valores esperados por los asserts:`);
  console.log(`   revenue=${E2E_EXPECTED.revenue} · orderCount=${E2E_EXPECTED.orderCount}`);
  console.log(`   avgOrderValue=${E2E_EXPECTED.avgOrderValue} · completion=${E2E_EXPECTED.completionRate}%`);
  console.log(`   payroll: ${breakevenPercentage}% / ₲${breakevenThreshold}`);
}

main()
  .catch((err) => {
    console.error("Seed E2E falló:", err);
    process.exit(1);
  })
  .finally(() => closeDb());