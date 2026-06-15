/**
 * Centralization Service — Centralización Contable.
 *
 * Consolida los movimientos de los submódulos (ventas, compras,
 * inventario, nómina) en asientos contables de centralización
 * al cierre de cada período.
 *
 * La centralización toma los totales agregados de cada submódulo
 * y genera un asiento resumen por tipo de operación, permitiendo
 * la trazabilidad desde el Libro Mayor hasta el detalle.
 *
 * @module finance/services/accounting/centralization.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { getDb } from "../../../../shared/database/connection.js";
import {
  planCuentas,
  asientosContables,
  asientosDetalle,
  facturas,
} from "../../schema/index.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";

// ─── Interfaces ────────────────────────────────

export interface CentralizationResult {
  module: string;
  success: boolean;
  asientoId: string | null;
  asientoNumero: number | null;
  montoTotal: number;
  registrosCentralizados: number;
  message: string;
}

export interface MonthEndResult {
  periodo: string;
  ventas: CentralizationResult;
  compras: CentralizationResult;
  inventario: CentralizationResult;
  nomina: CentralizationResult;
  consolidado: boolean;
}

// ─── Helpers ───────────────────────────────────

async function resolveCuenta(codigo: string): Promise<string> {
  const [c] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(eq(planCuentas.codigo, codigo), eq(planCuentas.activo, true)))
    .limit(1);
  if (!c) throw new Error(`Cuenta ${codigo} no encontrada`);
  return c.id;
}

async function nextNumero(fecha: Date): Promise<number> {
  const start = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const end = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);
  const [max] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(and(gte(asientosContables.fecha, start), lte(asientosContables.fecha, end)));
  return (max?.max ?? 0) + 1;
}

// ─── Centralización de Ventas ──────────────────

/**
 * Centraliza las ventas del período.
 *
 * Agrega todas las facturas (MANUAL + ELECTRÓNICA) del mes y genera:
 *   Débito: Caja / Bancos / Cuentas por Cobrar
 *   Crédito: Ingresos por Servicios
 */
export async function centralizeSales(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<CentralizationResult> {
  const start = new Date(anho, mes - 1, 1);
  const end = new Date(anho, mes, 0, 23, 59, 59);
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;

  // Sumar facturas del período vía PostgreSQL
  const [aggregate] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(${facturas.total}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.tenantSlug, tenantSlug),
        gte(facturas.createdAt, start),
        lte(facturas.createdAt, end),
      ),
    );

  const total = Number(aggregate?.total ?? 0);
  const count = Number(aggregate?.count ?? 0);

  if (total === 0) {
    return { module: "VENTAS", success: true, asientoId: null, asientoNumero: null, montoTotal: 0, registrosCentralizados: 0, message: "No hay ventas en el período" };
  }

  const fecha = end;
  const num = await nextNumero(fecha);

  // Cuentas contables
  const cuentaCaja = await resolveCuenta("1.1.01.001").catch(() => resolveCuenta("1.1.01"));
  const cuentaIngresos = await resolveCuenta("4.1.01");

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha,
      concepto: `Centralización de Ventas - ${periodo} (${count} facturas, Total: ₲${total.toFixed(2)})`,
      estado: "CONTABILIZADO",
      totalDebe: total.toFixed(2),
      totalHaber: total.toFixed(2),
      diferencia: "0",
      moduloOrigen: "CENTRALIZACION_VENTAS",
      documentoRef: `CEN-VENTAS-${periodo}`,
    })
    .returning();

  await db().insert(asientosDetalle).values([
    { asientoId: asiento.id, cuentaId: cuentaCaja, numeroLinea: 1, debe: total.toFixed(2), descripcion: `Ventas ${periodo}` },
    { asientoId: asiento.id, cuentaId: cuentaIngresos, numeroLinea: 2, haber: total.toFixed(2), descripcion: `Ventas ${periodo}` },
  ]);

  return {
    module: "VENTAS", success: true,
    asientoId: asiento.id, asientoNumero: asiento.numero,
    montoTotal: total, registrosCentralizados: count,
    message: `Ventas centralizadas: ₲${total.toFixed(2)} (${count} facturas)`,
  };
}

// ─── Centralización de Compras ─────────────────

/**
 * Centraliza las compras del período.
 *
 * Agrega todas las compras registradas y genera:
 *   Débito: Costo / Inventario / Gastos
 *   Crédito: Proveedores / Cuentas por Pagar
 *
 * (Requiere tabla `compras` — placeholder con facturas de compras)
 */
export async function centralizePurchases(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<CentralizationResult> {
  const start = new Date(anho, mes - 1, 1);
  const end = new Date(anho, mes, 0, 23, 59, 59);
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;

  // Buscar compras desde facturas con tipo "COMPRA" o en stock_movements
  const purchases = await getDb()<Array<{ total: string }>>`
    SELECT COALESCE(SUM(sm.cantidad * COALESCE(sm.costo_unitario, 0)::numeric), 0)::text as total
    FROM stock_movements sm
    WHERE sm.tenant_slug = ${tenantSlug}
      AND sm.tipo = 'INGRESO'
      AND sm.created_at >= ${start}
      AND sm.created_at <= ${end}
  `;

  const total = parseFloat(purchases[0]?.total ?? "0");
  if (total === 0) {
    return { module: "COMPRAS", success: true, asientoId: null, asientoNumero: null, montoTotal: 0, registrosCentralizados: 0, message: "No hay compras en el período" };
  }

  const fecha = end;
  const num = await nextNumero(fecha);
  const cuentaInventario = await resolveCuenta("1.1.03.001").catch(() => resolveCuenta("1.1.03"));
  const cuentaProveedores = await resolveCuenta("2.1.01.001").catch(() => resolveCuenta("2.1.01"));

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha,
      concepto: `Centralización de Compras - ${periodo} (Total: ₲${total.toFixed(2)})`,
      estado: "CONTABILIZADO",
      totalDebe: total.toFixed(2),
      totalHaber: total.toFixed(2),
      diferencia: "0",
      moduloOrigen: "CENTRALIZACION_COMPRAS",
      documentoRef: `CEN-COMPRAS-${periodo}`,
    })
    .returning();

  await db().insert(asientosDetalle).values([
    { asientoId: asiento.id, cuentaId: cuentaInventario, numeroLinea: 1, debe: total.toFixed(2), descripcion: `Compras ${periodo}` },
    { asientoId: asiento.id, cuentaId: cuentaProveedores, numeroLinea: 2, haber: total.toFixed(2), descripcion: `Compras ${periodo}` },
  ]);

  return {
    module: "COMPRAS", success: true,
    asientoId: asiento.id, asientoNumero: asiento.numero,
    montoTotal: total, registrosCentralizados: 1,
    message: `Compras centralizadas: ₲${total.toFixed(2)}`,
  };
}

// ─── Centralización de Inventario ──────────────

/**
 * Centraliza los movimientos de inventario del período.
 *
 * Agrega los movimientos de stock del módulo inventario y
 * genera un asiento de ajuste de inventario.
 */
export async function centralizeInventory(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<CentralizationResult> {
  const start = new Date(anho, mes - 1, 1);
  const end = new Date(anho, mes, 0, 23, 59, 59);
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;

  // Neto de movimientos: entradas - salidas
  const neto = await getDb()<Array<{ neto: string }>>`
    SELECT COALESCE(
      SUM(CASE WHEN tipo = 'INGRESO' THEN cantidad ELSE 0 END) -
      SUM(CASE WHEN tipo = 'EGRESO' THEN cantidad ELSE 0 END), 0
    )::text as neto
    FROM stock_movements
    WHERE tenant_slug = ${tenantSlug}
      AND created_at >= ${start}
      AND created_at <= ${end}
  `;

  const netoValue = parseFloat(neto[0]?.neto ?? "0");
  if (Math.abs(netoValue) < 0.01) {
    return { module: "INVENTARIO", success: true, asientoId: null, asientoNumero: null, montoTotal: 0, registrosCentralizados: 0, message: "No hay movimientos significativos de inventario" };
  }

  const fecha = end;
  const num = await nextNumero(fecha);
  const cuentaInventario = await resolveCuenta("1.1.03.001").catch(() => resolveCuenta("1.1.03"));
  const cuentaCostoVenta = await resolveCuenta("6.1.01.001").catch(() => resolveCuenta("6.1.01"));

  const lineas: Array<typeof asientosDetalle.$inferInsert> = [];
  if (netoValue > 0) {
    // Más entradas que salidas: aumenta inventario, disminuye costo
    lineas.push(
      { asientoId: "", cuentaId: cuentaInventario, numeroLinea: 1, debe: netoValue.toFixed(2), descripcion: `Ajuste inventario ${periodo}` },
      { asientoId: "", cuentaId: cuentaCostoVenta, numeroLinea: 2, haber: netoValue.toFixed(2), descripcion: `Ajuste inventario ${periodo}` },
    );
  } else {
    // Más salidas: disminuye inventario, aumenta costo
    const abs = Math.abs(netoValue);
    lineas.push(
      { asientoId: "", cuentaId: cuentaCostoVenta, numeroLinea: 1, debe: abs.toFixed(2), descripcion: `Ajuste inventario ${periodo}` },
      { asientoId: "", cuentaId: cuentaInventario, numeroLinea: 2, haber: abs.toFixed(2), descripcion: `Ajuste inventario ${periodo}` },
    );
  }

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha,
      concepto: `Centralización de Inventario - ${periodo} (Neto: ${netoValue > 0 ? "+" : ""}${netoValue.toFixed(2)})`,
      estado: "CONTABILIZADO",
      totalDebe: Math.abs(netoValue).toFixed(2),
      totalHaber: Math.abs(netoValue).toFixed(2),
      diferencia: "0",
      moduloOrigen: "CENTRALIZACION_INVENTARIO",
      documentoRef: `CEN-INV-${periodo}`,
    })
    .returning();

  // Attach asientoId to lines
  for (const l of lineas) {
    await db().insert(asientosDetalle).values({ ...l, asientoId: asiento.id });
  }

  return {
    module: "INVENTARIO", success: true,
    asientoId: asiento.id, asientoNumero: asiento.numero,
    montoTotal: Math.abs(netoValue), registrosCentralizados: 1,
    message: `Inventario centralizado: ${netoValue > 0 ? "+" : ""}${netoValue.toFixed(2)}`,
  };
}

// ─── Centralización de Nómina ──────────────────

/**
 * Centraliza la nómina del período.
 *
 * Placeholder — requiere tabla de nómina implementada.
 * Débito: Gasto Sueldos (6.2.x)
 * Crédito: Sueldos a Pagar (2.1.02.x)
 */
export async function centralizePayroll(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<CentralizationResult> {
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;

  // Buscar payroll_summary del período
  const [summary] = await getDb()<Array<{ total_salaries: string }> | []>`
    SELECT COALESCE(SUM(total_salaries::numeric), 0)::text as total_salaries
    FROM payroll_summary
    WHERE tenant_slug = ${tenantSlug}
      AND EXTRACT(YEAR FROM period_date) = ${anho}
      AND EXTRACT(MONTH FROM period_date) = ${mes}
  `;

  const total = parseFloat(summary?.total_salaries ?? "0");
  if (total === 0) {
    return { module: "NOMINA", success: true, asientoId: null, asientoNumero: null, montoTotal: 0, registrosCentralizados: 0, message: "No hay nómina en el período (pendiente de implementación)" };
  }

  const fecha = new Date(anho, mes, 0);
  const num = await nextNumero(fecha);
  const cuentaGasto = await resolveCuenta("6.2.01").catch(() => resolveCuenta("6.2"));
  const cuentaPagar = await resolveCuenta("2.1.02");

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha,
      concepto: `Centralización de Nómina - ${periodo} (Total: ₲${total.toFixed(2)})`,
      estado: "CONTABILIZADO",
      totalDebe: total.toFixed(2),
      totalHaber: total.toFixed(2),
      diferencia: "0",
      moduloOrigen: "CENTRALIZACION_NOMINA",
    })
    .returning();

  await db().insert(asientosDetalle).values([
    { asientoId: asiento.id, cuentaId: cuentaGasto, numeroLinea: 1, debe: total.toFixed(2), descripcion: `Sueldos ${periodo}` },
    { asientoId: asiento.id, cuentaId: cuentaPagar, numeroLinea: 2, haber: total.toFixed(2), descripcion: `Sueldos a pagar ${periodo}` },
  ]);

  return {
    module: "NOMINA", success: true,
    asientoId: asiento.id, asientoNumero: asiento.numero,
    montoTotal: total, registrosCentralizados: 1,
    message: `Nómina centralizada: ₲${total.toFixed(2)}`,
  };
}

// ─── Cierre de Mes Completo ────────────────────

/**
 * Ejecuta todas las centralizaciones del período en secuencia.
 */
export async function runMonthEndCentralization(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<MonthEndResult> {
  const [ventas, compras, inventario, nomina] = await Promise.all([
    centralizeSales(tenantSlug, anho, mes),
    centralizePurchases(tenantSlug, anho, mes),
    centralizeInventory(tenantSlug, anho, mes),
    centralizePayroll(tenantSlug, anho, mes),
  ]);

  return {
    periodo: `${anho}-${String(mes).padStart(2, "0")}`,
    ventas,
    compras,
    inventario,
    nomina,
    consolidado: ventas.success && compras.success && inventario.success && nomina.success,
  };
}
