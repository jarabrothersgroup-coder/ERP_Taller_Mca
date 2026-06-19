/**
 * Seed script: Plan de Cuentas (Sprint 33).
 *
 * Seeds the standard Paraguayan PUC (Plan Único de Cuentas)
 * for a given tenant. Hierarchical: Level 1 → 2 → 3 → 4.
 *
 * Usage: npx tsx scripts/seed-accounting.ts <tenant_slug>
 *
 * @module scripts/seed-accounting
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import { planCuentas } from "../src/shared/database/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-accounting.ts <tenant_slug>");
  process.exit(1);
}

interface CuentaDef {
  codigo: string;
  nombre: string;
  tipo: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO" | "COSTO";
  nivel: number;
  aceptaMovimientos: boolean;
  children?: CuentaDef[];
}

const PU_CUENTAS: CuentaDef[] = [
  {
    codigo: "1", nombre: "ACTIVO", tipo: "ACTIVO", nivel: 1, aceptaMovimientos: false,
    children: [
      {
        codigo: "1.1", nombre: "ACTIVO CORRIENTE", tipo: "ACTIVO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "1.1.01", nombre: "CAJA Y BANCOS", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "1.1.01.001", nombre: "CAJA CHICA", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "1.1.01.002", nombre: "BANCO CONTINENTAL", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "1.1.01.003", nombre: "BANCO ATLAS", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
            ],
          },
          {
            codigo: "1.1.02", nombre: "CUENTAS POR COBRAR", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "1.1.02.001", nombre: "CLIENTES NACIONALES", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
            ],
          },
          {
            codigo: "1.1.03", nombre: "INVENTARIOS", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "1.1.03.001", nombre: "REPUESTOS EN EXISTENCIA", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "1.1.03.002", nombre: "ACEITES Y LUBRICANTES", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
      {
        codigo: "1.2", nombre: "ACTIVO NO CORRIENTE", tipo: "ACTIVO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "1.2.01", nombre: "ACTIVOS FIJOS", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "1.2.01.001", nombre: "MUEBLES Y ÚTILES", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "1.2.01.002", nombre: "HERRAMIENTAS", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "1.2.01.003", nombre: "EQUIPOS DE DIAGNÓSTICO", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "1.2.01.004", nombre: "VEHÍCULOS DE SERVICIO", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "2", nombre: "PASIVO", tipo: "PASIVO", nivel: 1, aceptaMovimientos: false,
    children: [
      {
        codigo: "2.1", nombre: "PASIVO CORRIENTE", tipo: "PASIVO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "2.1.01", nombre: "CUENTAS POR PAGAR", tipo: "PASIVO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "2.1.01.001", nombre: "PROVEEDORES NACIONALES", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true },
            ],
          },
          {
            codigo: "2.1.02", nombre: "OBLIGACIONES FISCALES", tipo: "PASIVO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "2.1.02.001", nombre: "IVA A CREDITO", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "2.1.02.002", nombre: "IVA RETENIDO", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true },
              { codigo: "2.1.02.003", nombre: "LAND PATRIMONIAL", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
      {
        codigo: "2.2", nombre: "PASIVO NO CORRIENTE", tipo: "PASIVO", nivel: 2, aceptaMovimientos: false,
        children: [],
      },
    ],
  },
  {
    codigo: "3", nombre: "PATRIMONIO", tipo: "PATRIMONIO", nivel: 1, aceptaMovimientos: false,
    children: [
      {
        codigo: "3.1", nombre: "PATRIMONIO", tipo: "PATRIMONIO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "3.1.01", nombre: "CAPITAL", tipo: "PATRIMONIO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "3.1.01.001", nombre: "CAPITAL SOCIAL", tipo: "PATRIMONIO", nivel: 4, aceptaMovimientos: true },
            ],
          },
          {
            codigo: "3.1.02", nombre: "RESULTADOS", tipo: "PATRIMONIO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "3.1.02.001", nombre: "RESULTADOS ACUMULADOS", tipo: "PATRIMONIO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "4", nombre: "INGRESOS", tipo: "INGRESO", nivel: 1, aceptaMovimientos: false,
    children: [
      {
        codigo: "4.1", nombre: "INGRESOS OPERACIONALES", tipo: "INGRESO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "4.1.01", nombre: "VENTAS", tipo: "INGRESO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "4.1.01.001", nombre: "VENTA DE SERVICIOS", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true },
              { codigo: "4.1.01.002", nombre: "VENTA DE REPUESTOS", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
      {
        codigo: "4.2", nombre: "INGRESOS NO OPERACIONALES", tipo: "INGRESO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "4.2.01", nombre: "OTROS INGRESOS", tipo: "INGRESO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "4.2.01.001", nombre: "INTERESES GANADOS", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
    ],
  },
  {
    codigo: "5", nombre: "GASTOS", tipo: "GASTO", nivel: 1, aceptaMovimientos: false,
    children: [
      {
        codigo: "5.1", nombre: "GASTOS OPERACIONALES", tipo: "GASTO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "5.1.01", nombre: "GASTOS DE PERSONAL", tipo: "GASTO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "5.1.01.001", nombre: "SUELDOS Y SALARIOS", tipo: "GASTO", nivel: 4, aceptaMovimientos: true },
              { codigo: "5.1.01.002", nombre: "CARGAS SOCIALES", tipo: "GASTO", nivel: 4, aceptaMovimientos: true },
              { codigo: "5.1.01.003", nombre: "AGUINALDO", tipo: "GASTO", nivel: 4, aceptaMovimientos: true },
            ],
          },
          {
            codigo: "5.1.02", nombre: "GASTOS GENERALES", tipo: "GASTO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "5.1.02.001", nombre: "ALQUILERES", tipo: "GASTO", nivel: 4, aceptaMovimientos: true },
              { codigo: "5.1.02.002", nombre: "SERVICIOS BÁSICOS", tipo: "GASTO", nivel: 4, aceptaMovimientos: true },
              { codigo: "5.1.02.003", nombre: "SEGUROS", tipo: "GASTO", nivel: 4, aceptaMovimientos: true },
              { codigo: "5.1.02.004", nombre: "ÚTILES Y SUPLEMENTOS", tipo: "GASTO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
      {
        codigo: "5.2", nombre: "GASTOS ADMINISTRATIVOS", tipo: "GASTO", nivel: 2, aceptaMovimientos: false,
        children: [],
      },
    ],
  },
  {
    codigo: "6", nombre: "COSTOS", tipo: "COSTO", nivel: 1, aceptaMovimientos: false,
    children: [
      {
        codigo: "6.1", nombre: "COSTO DE VENTAS", tipo: "COSTO", nivel: 2, aceptaMovimientos: false,
        children: [
          {
            codigo: "6.1.01", nombre: "COSTOS DIRECTOS", tipo: "COSTO", nivel: 3, aceptaMovimientos: false,
            children: [
              { codigo: "6.1.01.001", nombre: "COSTO DE REPUESTOS VENDIDOS", tipo: "COSTO", nivel: 4, aceptaMovimientos: true },
              { codigo: "6.1.01.002", nombre: "COSTO DE MANO DE OBRA", tipo: "COSTO", nivel: 4, aceptaMovimientos: true },
            ],
          },
        ],
      },
    ],
  },
];

async function insertCuenta(
  def: CuentaDef,
  parentRow: any | null,
): Promise<void> {
  // Check if exists
  const existing = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(eq(planCuentas.codigo, def.codigo))
    .limit(1);

  if (existing.length > 0) {
    // Already exists — just recurse children with this as parent
    if (def.children?.length) {
      for (const child of def.children) {
        await insertCuenta(child, { id: existing[0]!.id });
      }
    }
    return;
  }

  const [inserted] = await db()
    .insert(planCuentas)
    .values({
      codigo: def.codigo,
      nombre: def.nombre,
      tipo: def.tipo,
      cuentaPadreId: parentRow?.id ?? null,
      nivel: def.nivel,
      aceptaMovimientos: def.aceptaMovimientos,
      saldoInicial: "0",
      moneda: "PYG",
      activo: true,
      tenantSlug: TENANT_SLUG,
    })
    .returning();

  console.log(`   + ${def.codigo} — ${def.nombre}`);

  if (def.children?.length) {
    for (const child of def.children) {
      await insertCuenta(child, inserted);
    }
  }
}

async function main() {
  console.log(`🌱 Seeding Plan de Cuentas for tenant: ${TENANT_SLUG}\n`);

  let count = 0;
  for (const root of PU_CUENTAS) {
    await insertCuenta(root, null);
    count++;
  }

  // Count total
  const result = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(planCuentas)
    .where(eq(planCuentas.tenantSlug, TENANT_SLUG));

  console.log(`\n   ✅  Plan de Cuentas: ${result[0]?.count ?? 0} total accounts for ${TENANT_SLUG}`);
  console.log("\n🌱 Plan de Cuentas seeding complete!");
}

// Need sql import
import { sql } from "drizzle-orm";

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
