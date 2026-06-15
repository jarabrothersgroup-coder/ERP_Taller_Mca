/**
 * Seed script: Treasury test data (Sprint 7).
 *
 * Poblates cuentas_bancarias, movimientos_tesoreria, facturas_proveedor
 * con datos de prueba realistas para un taller automotriz paraguayo.
 *
 * Usage:
 *   npx tsx scripts/seed-treasury.ts <tenant_slug>
 *
 * @module scripts/seed-treasury
 */

import { db } from "../src/shared/database/drizzle.js";
import { getDb, closeDb } from "../src/shared/database/connection.js";
import {
  cuentasBancarias,
  movimientosTes,
  facturasProveedor,
} from "../src/shared/database/schema/index.js";
import { sql } from "drizzle-orm";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-treasury.ts <tenant_slug>");
  process.exit(1);
}

async function main() {
  console.log(`🌱 Seeding treasury data for tenant: ${TENANT_SLUG}\n`);

  // ── 1. Cuentas Bancarias ──────────────────────
  console.log("   Creating bank accounts...");

  const existingCuentas = await db()
    .select()
    .from(cuentasBancarias)
    .where(sql`${cuentasBancarias.tenantSlug} = ${TENANT_SLUG}`);

  let cuentas: (typeof cuentasBancarias.$inferSelect)[] = existingCuentas;

  if (existingCuentas.length === 0) {
    const newCuentas = [
      {
        codigo: "CAJA-001",
        nombre: "Caja Chica Taller",
        tipo: "CAJA_FISICA",
        moneda: "PYG",
        saldoInicial: "5000000",
        saldoActual: "5000000",
        tenantSlug: TENANT_SLUG,
      },
      {
        codigo: "BCO-001",
        nombre: "Banco Continental — Cta. Cte.",
        tipo: "CTA_CTE",
        moneda: "PYG",
        saldoInicial: "25000000",
        saldoActual: "25000000",
        numeroCuenta: "123456789/1",
        banco: "Banco Continental",
        tenantSlug: TENANT_SLUG,
      },
      {
        codigo: "BLL-001",
        nombre: "Billetera Digital — Paypy",
        tipo: "BILLETERA_DIGITAL",
        moneda: "PYG",
        saldoInicial: "3000000",
        saldoActual: "3000000",
        banco: "Paypy",
        tenantSlug: TENANT_SLUG,
      },
    ];

    for (const c of newCuentas) {
      const [inserted] = await db().insert(cuentasBancarias).values(c).returning();
      cuentas.push(inserted!);
    }
  }

  console.log(`   ✅  ${cuentas.length} cuentas bancarias listas`);
  cuentas.forEach((c) => console.log(`       ${c!.codigo} — ${c!.nombre} (${c!.saldoActual} Gs.)`));

  // ── 2. Movimientos de prueba ──────────────────
  console.log("\n   Creating sample movements...");

  const hoy = new Date();
  const semanaPasada = new Date(hoy.getTime() - 7 * 86400000);
  const mesPasado = new Date(hoy.getTime() - 30 * 86400000);

  const movimientos = [
    {
      tipo: "INGRESO" as const,
      medioPago: "EFECTIVO" as const,
      cuentaId: cuentas[0]!.id,
      monto: "1500000",
      moneda: "PYG",
      fecha: semanaPasada,
      concepto: "Venta de servicio — Cambio de aceite",
      referenciaTipo: "factura",
      referenciaId: "seed-fact-001",
      tenantSlug: TENANT_SLUG,
    },
    {
      tipo: "INGRESO" as const,
      medioPago: "TRANSFERENCIA" as const,
      cuentaId: cuentas[1]!.id,
      monto: "4500000",
      moneda: "PYG",
      fecha: semanaPasada,
      concepto: "Venta de servicio — Reparación general",
      referenciaTipo: "factura",
      referenciaId: "seed-fact-002",
      tenantSlug: TENANT_SLUG,
    },
    {
      tipo: "EGRESO" as const,
      medioPago: "EFECTIVO" as const,
      cuentaId: cuentas[0]!.id,
      monto: "350000",
      moneda: "PYG",
      fecha: mesPasado,
      concepto: "Compra de insumos — Ferretería",
      referenciatipo: "compra",
      referenciaId: "seed-comp-001",
      tenantSlug: TENANT_SLUG,
    },
  ];

  const existingMovs = await db()
    .select({ concepto: movimientosTes.concepto })
    .from(movimientosTes)
    .where(sql`${movimientosTes.tenantSlug} = ${TENANT_SLUG}`);

  const existingConcepts = new Set(existingMovs.map((m: any) => m.concepto));

  for (const m of movimientos) {
    if (!existingConcepts.has(m.concepto)) {
      await db().insert(movimientosTes).values(m as any);
    }
  }

  console.log("   ✅  Movimientos de prueba creados");

  // ── 3. Facturas Proveedor ─────────────────────
  console.log("\n   Creating supplier invoices...");

  const proxSemana = new Date(hoy.getTime() + 7 * 86400000);
  const proxMes = new Date(hoy.getTime() + 25 * 86400000);

  const facturasProv = [
    {
      proveedorId: "00000000-0000-0000-0000-000000000001",
      nroFactura: "FAC-001-001-0004501",
      total: "2850000",
      saldoPendiente: "2850000",
      ivaMonto: "435000",
      baseImponible: "2415000",
      fechaEmision: new Date(hoy.getTime() - 15 * 86400000),
      fechaVencimiento: proxSemana,
      estadoPago: "PENDIENTE",
      concepto: "Pastillas de freno x4 juegos",
      tenantSlug: TENANT_SLUG,
    },
    {
      proveedorId: "00000000-0000-0000-0000-000000000002",
      nroFactura: "FAC-001-002-0008712",
      total: "1200000",
      saldoPendiente: "600000",
      ivaMonto: "183051",
      baseImponible: "1016949",
      fechaEmision: new Date(hoy.getTime() - 20 * 86400000),
      fechaVencimiento: proxMes,
      estadoPago: "PARCIAL",
      concepto: "Aceite 20W50 x20 litros",
      tenantSlug: TENANT_SLUG,
    },
    {
      proveedorId: "00000000-0000-0000-0000-000000000003",
      nroFactura: "FAC-001-003-0001234",
      total: "950000",
      saldoPendiente: "950000",
      ivaMonto: "144915",
      baseImponible: "805085",
      fechaEmision: new Date(hoy.getTime() - 10 * 86400000),
      fechaVencimiento: proxSemana,
      estadoPago: "PENDIENTE",
      concepto: "Reparación alternador",
      tenantSlug: TENANT_SLUG,
    },
  ];

  const existingProv = await db()
    .select({ nroFactura: facturasProveedor.nroFactura })
    .from(facturasProveedor)
    .where(sql`${facturasProveedor.tenantSlug} = ${TENANT_SLUG}`);

  const existingProvNros = new Set(existingProv.map((f: any) => f.nroFactura));

  for (const f of facturasProv) {
    if (!existingProvNros.has(f.nroFactura)) {
      await db().insert(facturasProveedor).values(f as any);
    }
  }

  console.log("   ✅  Facturas de proveedor creadas");
  console.log("\n🌱 Treasury seed complete!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
