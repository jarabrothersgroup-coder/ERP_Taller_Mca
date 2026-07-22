/**
 * Auto-Configure Accounting Service
 *
 * Seeds default configuradores (module registrations) and cuenta_mapping
 * entries for all 6 accounting modules when a new tenant is created.
 *
 * This is called by the onboarding flow: POST /api/onboarding/setup
 *
 * @module finance/services/accounting/auto-configure.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  configuradorModulo,
  cuentaMapping,
  planCuentas,
} from "../../schema/accounting.js";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Module definitions with metadata for configurador_modulo.
 */
const MODULOS_CONFIG = [
  {
    modulo: "COMPRAS",
    nombre: "Compras y Proveedores",
    descripcion:
      "Facturas de compra, pagos a proveedores, notas de crédito",
    version: "2.0.0",
  },
  {
    modulo: "SIFEN",
    nombre: "Facturación Electrónica (SIFEN)",
    descripcion:
      "DTE, facturas electrónicas, notas de crédito/débito",
    version: "2.0.0",
  },
  {
    modulo: "TESORERIA",
    nombre: "Tesorería (Caja y Bancos)",
    descripcion:
      "Movimientos de caja/bancos, cobros, pagos, conciliaciones",
    version: "2.0.0",
  },
  {
    modulo: "NOMINA",
    nombre: "Nómina y Planilla Salarial",
    descripcion: "Salarios, cargas sociales, provisiones",
    version: "1.0.0",
  },
  {
    modulo: "INVENTARIO",
    nombre: "Inventario y Almacén",
    descripcion:
      "Entradas, salidas, ajustes de stock, transferencias",
    version: "1.0.0",
  },
  {
    modulo: "WORKSHOP",
    nombre: "Taller (Órdenes de Trabajo)",
    descripcion:
      "Reconocimiento de ingresos por servicios, mano de obra",
    version: "1.0.0",
  },
] as const;

/**
 * Default account mappings by module.
 * Each mapping references plan_cuentas codes resolved at insert time.
 */
const MAPPINGS_BY_MODULO: Record<
  string,
  Array<{
    tipoEvento: string;
    subTipo: string | null;
    codigoDebe: string;
    codigoHaber: string;
    descripcion: string;
  }>
> = {
  COMPRAS: [
    {
      tipoEvento: "CREADA",
      subTipo: "CREDITO",
      codigoDebe: "1.1.3.01",
      codigoHaber: "2.1.1.01",
      descripcion: "Compra a crédito — inventario vs proveedor",
    },
    {
      tipoEvento: "CREADA",
      subTipo: "CONTADO",
      codigoDebe: "1.1.3.01",
      codigoHaber: "1.1.1.01",
      descripcion: "Compra al contado — inventario vs caja",
    },
    {
      tipoEvento: "PAGADA",
      subTipo: null,
      codigoDebe: "2.1.1.01",
      codigoHaber: "1.1.1.03",
      descripcion: "Pago a proveedor — cancela cuenta por pagar",
    },
    {
      tipoEvento: "ANULADA",
      subTipo: null,
      codigoDebe: "2.1.1.01",
      codigoHaber: "5.1.1.01",
      descripcion: "Anulación de compra — reversión de costo",
    },
  ],
  SIFEN: [
    {
      tipoEvento: "EMITIDA",
      subTipo: "GRAVADA",
      codigoDebe: "1.1.2.01",
      codigoHaber: "4.1.1.01",
      descripcion: "Factura gravada — cliente vs ingreso por MO",
    },
    {
      tipoEvento: "EMITIDA",
      subTipo: "EXENTA",
      codigoDebe: "1.1.2.01",
      codigoHaber: "4.1.1.01",
      descripcion: "Factura exenta — cliente vs ingreso por MO",
    },
    {
      tipoEvento: "EMITIDA",
      subTipo: "VENTA_REPUESTOS",
      codigoDebe: "1.1.2.01",
      codigoHaber: "4.1.2.01",
      descripcion: "Factura con repuestos — cliente vs ingreso por venta",
    },
    {
      tipoEvento: "ANULADA",
      subTipo: null,
      codigoDebe: "4.1.1.01",
      codigoHaber: "1.1.2.01",
      descripcion: "Anulación de factura — reversión de ingreso",
    },
  ],
  TESORERIA: [
    {
      tipoEvento: "MOVIMIENTO_INGRESO",
      subTipo: null,
      codigoDebe: "1.1.1.01",
      codigoHaber: "1.1.2.01",
      descripcion: "Ingreso de caja — efectivo recibido de clientes",
    },
    {
      tipoEvento: "MOVIMIENTO_EGRESO",
      subTipo: null,
      codigoDebe: "6.1.1.03",
      codigoHaber: "1.1.1.01",
      descripcion: "Egreso de caja — pago realizado",
    },
    {
      tipoEvento: "PAGO_PROVEEDOR",
      subTipo: null,
      codigoDebe: "2.1.1.01",
      codigoHaber: "1.1.1.03",
      descripcion: "Pago a proveedor — débito bancario",
    },
    {
      tipoEvento: "COBRO_CLIENTE",
      subTipo: null,
      codigoDebe: "1.1.1.03",
      codigoHaber: "1.1.2.01",
      descripcion: "Cobro de cliente — acreditación bancaria",
    },
    {
      tipoEvento: "TRANSFERENCIA",
      subTipo: null,
      codigoDebe: "1.1.1.03",
      codigoHaber: "1.1.1.03",
      descripcion: "Transferencia entre cuentas bancarias",
    },
  ],
  NOMINA: [
    {
      tipoEvento: "DEVENGADA",
      subTipo: null,
      codigoDebe: "5.1.2.01",
      codigoHaber: "2.1.3.01",
      descripcion: "Devengamiento de salarios — costo MO vs sueldos a pagar",
    },
    {
      tipoEvento: "CARGAS_SOCIALES",
      subTipo: null,
      codigoDebe: "6.1.1.07",
      codigoHaber: "2.1.3.03",
      descripcion: "Cargas sociales patronales — gasto vs IPS a pagar",
    },
  ],
  INVENTARIO: [
    {
      tipoEvento: "ENTRADA",
      subTipo: null,
      codigoDebe: "1.1.3.01",
      codigoHaber: "5.1.1.01",
      descripcion: "Entrada de stock — inventario vs costo de reposición",
    },
    {
      tipoEvento: "SALIDA",
      subTipo: null,
      codigoDebe: "5.1.1.01",
      codigoHaber: "1.1.3.01",
      descripcion: "Salida de stock — costo vs inventario",
    },
    {
      tipoEvento: "AJUSTE",
      subTipo: "POSITIVO",
      codigoDebe: "1.1.3.01",
      codigoHaber: "5.1.1.01",
      descripcion: "Ajuste positivo de inventario — incremento de existencias",
    },
    {
      tipoEvento: "AJUSTE",
      subTipo: "NEGATIVO",
      codigoDebe: "6.1.1.05",
      codigoHaber: "1.1.3.01",
      descripcion: "Ajuste negativo de inventario — pérdida de existencias",
    },
    {
      tipoEvento: "TRANSFERENCIA",
      subTipo: null,
      codigoDebe: "1.1.3.01",
      codigoHaber: "1.1.3.01",
      descripcion: "Transferencia entre almacenes — misma cuenta",
    },
  ],
  WORKSHOP: [
    {
      tipoEvento: "OT_COMPLETADA",
      subTipo: null,
      codigoDebe: "1.1.2.01",
      codigoHaber: "4.1.1.01",
      descripcion: "OT completada — reconocimiento de ingreso por MO",
    },
    {
      tipoEvento: "OT_CANCELADA",
      subTipo: null,
      codigoDebe: "4.1.1.01",
      codigoHaber: "1.1.2.01",
      descripcion: "OT cancelada — reversión de ingreso reconocido",
    },
  ],
};

/**
 * Seeds all 6 configurador_modulo entries.
 * Uses ON CONFLICT DO NOTHING to be idempotent.
 */
async function seedConfiguradores(): Promise<string[]> {
  const insertedIds: string[] = [];

  for (const mod of MODULOS_CONFIG) {
    const [existing] = await db()
      .select({ id: configuradorModulo.id })
      .from(configuradorModulo)
      .where(eq(configuradorModulo.modulo, mod.modulo))
      .limit(1);

    if (existing) {
      insertedIds.push(existing.id);
      continue;
    }

    const [inserted] = await db()
      .insert(configuradorModulo)
      .values({
        modulo: mod.modulo,
        nombre: mod.nombre,
        descripcion: mod.descripcion,
        activo: true,
        version: mod.version,
      })
      .returning({ id: configuradorModulo.id });

    if (inserted) insertedIds.push(inserted.id);
  }

  return insertedIds;
}

/**
 * Seeds default cuenta_mapping entries for all 6 modules.
 * Resolves cuenta IDs from plan_cuentas by codigo.
 * Tenant-slug is NULL (global mappings shared by all tenants).
 */
async function seedMappings(): Promise<number> {
  let totalInserted = 0;

  for (const [modulo, mappings] of Object.entries(MAPPINGS_BY_MODULO)) {
    for (const map of mappings) {
      // Resolve Debe account
      const [debeCuenta] = await db()
        .select({ id: planCuentas.id })
        .from(planCuentas)
        .where(
          and(
            eq(planCuentas.codigo, map.codigoDebe),
            eq(planCuentas.activo, true),
          ),
        )
        .limit(1);

      if (!debeCuenta) {
        console.warn(
          `[auto-configure] SKIP ${modulo}/${map.tipoEvento}: cuenta debe ${map.codigoDebe} no encontrada`,
        );
        continue;
      }

      // Resolve Haber account
      const [haberCuenta] = await db()
        .select({ id: planCuentas.id })
        .from(planCuentas)
        .where(
          and(
            eq(planCuentas.codigo, map.codigoHaber),
            eq(planCuentas.activo, true),
          ),
        )
        .limit(1);

      if (!haberCuenta) {
        console.warn(
          `[auto-configure] SKIP ${modulo}/${map.tipoEvento}: cuenta haber ${map.codigoHaber} no encontrada`,
        );
        continue;
      }

      // Check if mapping already exists (by modulo + tipoEvento + subTipo)
      const conditions = [
        eq(cuentaMapping.modulo, modulo),
        eq(cuentaMapping.tipoEvento, map.tipoEvento),
      ];
      if (map.subTipo === null) {
        conditions.push(isNull(cuentaMapping.subTipo));
      } else {
        conditions.push(eq(cuentaMapping.subTipo, map.subTipo));
      }

      const [existing] = await db()
        .select({ id: cuentaMapping.id })
        .from(cuentaMapping)
        .where(and(...conditions))
        .limit(1);

      if (existing) continue; // Already exists — skip

      await db().insert(cuentaMapping).values({
        tenantSlug: null, // Global mapping (all tenants)
        modulo,
        tipoEvento: map.tipoEvento,
        subTipo: map.subTipo,
        cuentaDebeId: debeCuenta.id,
        cuentaHaberId: haberCuenta.id,
        descripcion: map.descripcion,
        activo: true,
        prioridad: 0,
      });

      totalInserted++;
    }
  }

  return totalInserted;
}

/**
 * Auto-configure all accounting module registrations and default mappings.
 *
 * Designed to be called during tenant onboarding (POST /api/onboarding/setup).
 * Idempotent: safe to call multiple times.
 *
 * @returns Summary of what was configured.
 */
export async function autoConfigureAccounting(): Promise<{
  configuradores: number;
  mappings: number;
}> {
  const configuradores = await seedConfiguradores();
  const mappings = await seedMappings();

  return {
    configuradores: configuradores.length,
    mappings,
  };
}
