/**
 * Libro de Inventario Service — Inventory & Balance Book.
 *
 * Generates the Libro de Inventario (Inventory Book), a mandatory
 * accounting book per Ley 1034/83 Art. 22, required for IRE General
 * regime taxpayers.
 *
 * Contains:
 *   1. Inventory detail — repuestos (spare parts) with PPP valuation
 *   2. Accounts Receivable — client balances
 *   3. Accounts Payable — supplier balances
 *   4. Fixed Assets — bienes de uso con depreciación acumulada
 *
 * Output formats: JSON, CSV
 *
 * @module finance/services/accounting/libro-inventario.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  asientosContables,
  asientosDetalle,
  planCuentas,
  activosFijos,
} from "../../schema/index.js";
import { repuestos } from "../../../inventory/schema/repuestos.js";
import { eq, and, gte, lte, asc, sql } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface ItemInventario {
  codigo: string;
  nombre: string;
  tipo: "REPUESTO" | "HERRAMIENTA" | "ACTIVO_FIJO";
  cantidad: number;
  costoUnitario: string;
  costoTotal: string;
  notas?: string;
}

export interface SaldoCuenta {
  codigo: string;
  nombre: string;
  saldo: string;
}

export interface LibroInventarioReport {
  periodo: { anho: number; mes: number };
  /** Detalle de inventario (repuestos, herramientas, activos fijos) */
  inventario: {
    totalItems: number;
    valorTotal: string;
    items: ItemInventario[];
  };
  /** Cuentas por Cobrar (clientes) */
  cuentasPorCobrar: {
    total: string;
    cuentas: SaldoCuenta[];
  };
  /** Cuentas por Pagar (proveedores) */
  cuentasPorPagar: {
    total: string;
    cuentas: SaldoCuenta[];
  };
  /** Activos Fijos (bienes de uso) */
  bienesDeUso: {
    totalOriginal: string;
    totalDepreciacion: string;
    totalNeto: string;
    items: ItemInventario[];
  };
}

// ─── Service ────────────────────────────────────

/**
 * Genera el Libro de Inventario al cierre de un período.
 *
 * Obtiene los saldos contables de las cuentas de inventario,
 * cuentas por cobrar/pagar y bienes de uso desde el plan de cuentas
 * y los asientos contables.
 *
 * @param anho - Año fiscal (2020-2100)
 * @param mes  - Mes de cierre (1-12)
 * @param tenantSlug - Tenant slug para filtrar inventario
 * @throws {ValidationError} Si el período es inválido
 */
export async function generarLibroInventario(
  anho: number,
  mes: number,
  tenantSlug: string,
): Promise<LibroInventarioReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const inicioEjercicio = new Date(anho, 0, 1);
  const cierrePeriodo = new Date(anho, mes, 0, 23, 59, 59);

  // ── 1. Inventario: repuestos reales con PPP y stock ──
  const todosRepuestos = await db()
    .select({
      codigo: repuestos.codigo,
      descripcion: repuestos.descripcion,
      stockActual: repuestos.stockActual,
      costoPromedio: repuestos.costoPromedio,
      precioCosto: repuestos.precioCosto,
      proveedor: repuestos.proveedor,
    })
    .from(repuestos)
    .where(eq(repuestos.activo, true))
    .orderBy(asc(repuestos.codigo));

  const itemsInventario = todosRepuestos.map((r) => {
    const costoPPP = Number(r.costoPromedio ?? r.precioCosto ?? 0);
    const cantidad = r.stockActual ?? 0;
    return {
      codigo: r.codigo,
      nombre: r.descripcion,
      tipo: "REPUESTO" as const,
      cantidad,
      costoUnitario: costoPPP.toFixed(2),
      costoTotal: (costoPPP * cantidad).toFixed(2),
      notas: r.proveedor ? `Proveedor: ${r.proveedor}` : undefined,
    };
  });

  const valorInventario = itemsInventario.reduce((s, i) => s + Number(i.costoTotal), 0);

  // ── 2. Cuentas por Cobrar: cuentas 1.1.02.x (Deudores / Clientes) ──
  const ctasCobrar = await db()
    .select({ id: planCuentas.id, codigo: planCuentas.codigo, nombre: planCuentas.nombre })
    .from(planCuentas)
    .where(
      and(
        sql`${planCuentas.codigo} LIKE '1.1.02%'`,
        eq(planCuentas.activo, true),
        eq(planCuentas.aceptaMovimientos, true),
      ),
    )
    .orderBy(asc(planCuentas.codigo));

  const cuentasCobrar = await Promise.all(
    ctasCobrar.map(async (cta) => {
      const saldo = await calcularSaldoCuenta(cta.id, inicioEjercicio, cierrePeriodo);
      return { codigo: cta.codigo, nombre: cta.nombre, saldo: saldo.toFixed(2) };
    }),
  );
  const totalCobrar = cuentasCobrar.reduce((s, c) => s + Number(c.saldo), 0);

  // ── 3. Cuentas por Pagar: cuentas 2.1.01.x (Proveedores) ──
  const ctasPagar = await db()
    .select({ id: planCuentas.id, codigo: planCuentas.codigo, nombre: planCuentas.nombre })
    .from(planCuentas)
    .where(
      and(
        sql`${planCuentas.codigo} LIKE '2.1.01%'`,
        eq(planCuentas.activo, true),
        eq(planCuentas.aceptaMovimientos, true),
      ),
    )
    .orderBy(asc(planCuentas.codigo));

  const cuentasPagar = await Promise.all(
    ctasPagar.map(async (cta) => {
      const saldo = await calcularSaldoCuenta(cta.id, inicioEjercicio, cierrePeriodo);
      return { codigo: cta.codigo, nombre: cta.nombre, saldo: saldo.toFixed(2) };
    }),
  );
  const totalPagar = cuentasPagar.reduce((s, c) => s + Number(c.saldo), 0);

  // ── 4. Bienes de Uso (Activos Fijos): desde tabla activos_fijos ──
  const todosActivos = await db()
    .select({
      codigo: activosFijos.codigo,
      nombre: activosFijos.nombre,
      tipo: activosFijos.tipo,
      costoAdquisicion: activosFijos.costoAdquisicion,
      depreciacionAcumulada: activosFijos.depreciacionAcumulada,
      valorActualLibros: activosFijos.valorActualLibros,
      estado: activosFijos.estado,
    })
    .from(activosFijos)
    .where(and(eq(activosFijos.activo, true), eq(activosFijos.tenantSlug, tenantSlug)))
    .orderBy(asc(activosFijos.codigo));

  const bienesDeUso = todosActivos.map((a) => {
    const original = Number(a.costoAdquisicion ?? 0);
    const depAcum = Number(a.depreciacionAcumulada ?? 0);
    const neto = Number(a.valorActualLibros ?? 0);
    return {
      codigo: a.codigo,
      nombre: `${a.nombre} (${a.estado})`,
      tipo: "ACTIVO_FIJO" as const,
      cantidad: 1,
      costoUnitario: original.toFixed(2),
      costoTotal: neto.toFixed(2),
      notas: `Dep. Acum.: ₲${depAcum.toFixed(2)}`,
    };
  });

  const valorOriginalBienes = todosActivos.reduce((s, a) => s + Number(a.costoAdquisicion ?? 0), 0);
  const totalDepreciacion = todosActivos.reduce((s, a) => s + Number(a.depreciacionAcumulada ?? 0), 0);
  const valorNetoBienes = todosActivos.reduce((s, a) => s + Number(a.valorActualLibros ?? 0), 0);

  return {
    periodo: { anho, mes },
    inventario: {
      totalItems: itemsInventario.length,
      valorTotal: valorInventario.toFixed(2),
      items: itemsInventario,
    },
    cuentasPorCobrar: {
      total: totalCobrar.toFixed(2),
      cuentas: cuentasCobrar,
    },
    cuentasPorPagar: {
      total: totalPagar.toFixed(2),
      cuentas: cuentasPagar,
    },
    bienesDeUso: {
      totalOriginal: valorOriginalBienes.toFixed(2),
      totalDepreciacion: totalDepreciacion.toFixed(2),
      totalNeto: valorNetoBienes.toFixed(2),
      items: bienesDeUso,
    },
  };
}

// ─── Helpers ────────────────────────────────────

/** Calcula el saldo de una cuenta contable en un rango de fechas. */
async function calcularSaldoCuenta(
  cuentaId: string,
  desde: Date,
  hasta: Date,
): Promise<number> {
  const [res] = await db()
    .select({
      debe: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.debe}::numeric, 0)), 0)`,
      haber: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.haber}::numeric, 0)), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .where(
      and(
        eq(asientosDetalle.cuentaId, cuentaId),
        eq(asientosContables.estado, "CONTABILIZADO"),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
      ),
    );

  const debe = Number(res?.debe ?? 0);
  const haber = Number(res?.haber ?? 0);

  // Obtener el tipo de cuenta para determinar naturaleza del saldo
  const [cta] = await db()
    .select({ tipo: planCuentas.tipo })
    .from(planCuentas)
    .where(eq(planCuentas.id, cuentaId))
    .limit(1);

  if (!cta) return 0;

  // ACTIVO, COSTO, GASTO → saldo = debe - haber; otros → haber - debe
  if (cta.tipo === "ACTIVO" || cta.tipo === "COSTO" || cta.tipo === "GASTO") {
    return debe - haber;
  }
  return haber - debe;
}
