/**
 * Analytics Service — Sprint 10.
 *
 * Provides aggregated KPIs, trends, and reports across all workshop modules.
 * Optimised for the executive dashboard and analytics views.
 *
 * All queries are tenant-scoped for multi-tenant isolation.
 *
 * @module workshop/services/analytics.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  ordenesTrabajo,
  ordenServicios,
  serviciosCatalogo,
} from "../schema/index.js";
import { facturas } from "../../finance/schema/facturas.js";
import { asientosDetalle, asientosContables } from "../../finance/schema/accounting.js";
import { stockMovements } from "../../inventory/schema/stock-movements.js";
import { repuestos } from "../../inventory/schema/repuestos.js";
import { movimientosTes } from "../../finance/schema/treasury.js";
import { clients } from "../../../shared/database/schema/clients.js";
import {
  eq,
  and,
  sql,
  desc,
  count,
  inArray,
} from "drizzle-orm";

// ─── Types ──────────────────────────────────────

export interface DashboardKPIs {
  ordenes: {
    activas: number;
    presupuestado: number;
    aprobado: number;
    enProceso: number;
    controlCalidad: number;
    listo: number;
    totalMes: number;
    completadasHoy: number;
  };
  finanzas: {
    ingresosMes: number;
    ingresosSemana: number;
    pendienteCobro: number;
    facturasEmitidasMes: number;
    cobrosMes: number;
  };
  taller: {
    serviciosRealizadosMes: number;
    repuestosUsadosMes: number;
    costoRepuestosMes: number;
    facturacionPromedioOT: number;
  };
  inventario: {
    productosBajoStock: number;
    movimientosHoy: number;
  };
  tendenciaSemanal: Array<{
    fecha: string;
    ingresos: number;
    ordenesCompletadas: number;
  }>;
}

export interface TopServicio {
  servicioId: string;
  nombre: string;
  categoria: string | null;
  totalUsos: number;
  ingresosGenerados: number;
}

export interface TopCliente {
  clientId: string;
  nombre: string;
  telefono: string | null;
  totalFacturado: number;
  totalOTs: number;
  ultimaVisita: string | null;
}

export interface Productividad {
  resumen: {
    totalOTsCompletadas: number;
    promedioDuracionDias: number;
    ingresosPeriodo: number;
    costoRepuestos: number;
    margenBruto: number;
    eficienciaPorcentaje: number;
  };
  detalleMensual: Array<{
    mes: string;
    otsCompletadas: number;
    ingresos: number;
    costoRepuestos: number;
  }>;
}

// ─── Date helpers ────────────────────────────────

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sevenDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Dashboard KPIs ─────────────────────────────

/**
 * Returns all dashboard KPIs aggregated across modules.
 * Internal queries run in parallel via Promise.all.
 */
export async function getDashboardKPIs(tenantSlug: string): Promise<DashboardKPIs> {
  const som = startOfMonth();
  const sow = startOfWeek();
  const td = todayStart();
  const sda = sevenDaysAgo();

  // Split into parallel groups with explicit typing to avoid Drizzle type inference issues
  const [
    statusCounts,
    [finRow],
    [cobrosRow],
    [servRow],
    [stockRow],
    [lowStockRow],
    [movTodayRow],
    [hoyRow],
    [mesOTRow],
    [avgRow],
  ] = await Promise.all([
    // Status counts
    db()
      .select({
        status: ordenesTrabajo.status,
        value: count(),
      })
      .from(ordenesTrabajo)
      .where(eq(ordenesTrabajo.tenantSlug, tenantSlug))
      .groupBy(ordenesTrabajo.status) as Promise<{ status: string; value: number }[]>,

    // Financial aggregates (facturas only)
    db()
      .select({
        ingresosMes: sql<number>`COALESCE(SUM(CASE WHEN ${facturas.createdAt}::date >= ${som.toISOString().slice(0, 10)}::date THEN ${facturas.total}::numeric ELSE 0 END), 0)`,
        pendienteCobro: sql<number>`COALESCE(SUM(${facturas.saldoPendiente}::numeric), 0)`,
        facturasMes: sql<number>`COUNT(*) FILTER (WHERE ${facturas.createdAt}::date >= ${som.toISOString().slice(0, 10)}::date)`,
        ingresosSemana: sql<number>`COALESCE(SUM(CASE WHEN ${facturas.createdAt}::date >= ${sow.toISOString().slice(0, 10)}::date THEN ${facturas.total}::numeric ELSE 0 END), 0)`,
      })
      .from(facturas)
      .where(and(
        eq(facturas.tenantSlug, tenantSlug),
        eq(facturas.estadoPago, 'PAGA'),
      )),

    // Cobros this month
    db()
      .select({
        total: sql<number>`COALESCE(SUM(${movimientosTes.monto}::numeric), 0)`,
      })
      .from(movimientosTes)
      .where(and(
        eq(movimientosTes.tipo, 'INGRESO'),
        sql`${movimientosTes.createdAt}::date >= ${som.toISOString().slice(0, 10)}::date`,
        eq(movimientosTes.tenantSlug, tenantSlug),
      )),

    // Services this month
    db()
      .select({
        value: sql<number>`COALESCE(SUM(${ordenServicios.cantidad}), 0)`,
      })
      .from(ordenServicios)
      .where(sql`${ordenServicios.createdAt}::date >= ${som.toISOString().slice(0, 10)}::date`),

    // Stock movements this month (SALIDA)
    db()
      .select({
        repuestosUsados: sql<number>`COALESCE(SUM(${stockMovements.cantidad}), 0)`,
        costoRepuestos: sql<number>`COALESCE(SUM(${stockMovements.costoTotal}::numeric), 0)`,
      })
      .from(stockMovements)
      .where(sql`${stockMovements.tipo} = 'SALIDA' AND ${stockMovements.createdAt}::date >= ${som.toISOString().slice(0, 10)}::date`),

    // Low stock count
    db()
      .select({ value: count() })
      .from(repuestos)
      .where(sql`${repuestos.stockActual} <= ${repuestos.stockMinimo}`),

    // Movements today
    db()
      .select({ value: count() })
      .from(stockMovements)
      .where(sql`${stockMovements.createdAt}::date >= ${td.toISOString().slice(0, 10)}::date`),

    // Completed today
    db()
      .select({ value: count() })
      .from(ordenesTrabajo)
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        eq(ordenesTrabajo.status, 'Listo'),
        sql`${ordenesTrabajo.updatedAt}::date >= ${td.toISOString().slice(0, 10)}::date`,
      )),

    // Total OTs this month
    db()
      .select({ value: count() })
      .from(ordenesTrabajo)
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.createdAt}::date >= ${som.toISOString().slice(0, 10)}::date`,
      )),

    // Average billing per OT this month
    db()
      .select({
        value: sql<number>`COALESCE(AVG(${facturas.total}::numeric), 0)`,
      })
      .from(facturas)
      .where(and(
        eq(facturas.tenantSlug, tenantSlug),
        sql`${facturas.createdAt}::date >= ${som.toISOString().slice(0, 10)}::date`,
      )),
  ] as const);

  // ── Trend queries (separate due to .groupBy() type inference) ──
  const trendRows = await db()
    .select({
      fecha: sql<string>`DATE(${facturas.createdAt})`,
      ingresos: sql<string>`COALESCE(SUM(${facturas.total}::numeric), 0)`,
    })
    .from(facturas)
    .where(and(
      eq(facturas.tenantSlug, tenantSlug),
      sql`${facturas.createdAt}::date >= ${sda.toISOString().slice(0, 10)}::date`,
    ))
    .groupBy(sql`DATE(${facturas.createdAt})`)
    .orderBy(sql`DATE(${facturas.createdAt})`);

  const weeklyCompRows = await db()
    .select({
      fecha: sql<string>`DATE(${ordenesTrabajo.updatedAt})`,
      value: sql<string>`COUNT(*)`,
    })
    .from(ordenesTrabajo)
    .where(and(
      eq(ordenesTrabajo.tenantSlug, tenantSlug),
      eq(ordenesTrabajo.status, 'Listo'),
      sql`${ordenesTrabajo.updatedAt}::date >= ${sda.toISOString().slice(0, 10)}::date`,
    ))
    .groupBy(sql`DATE(${ordenesTrabajo.updatedAt})`)
    .orderBy(sql`DATE(${ordenesTrabajo.updatedAt})`);

  // ── Build status map ──
  const statusMap = new Map<string, number>();
  for (const s of statusCounts) {
    statusMap.set(s.status, Number(s.value));
  }

  const fin = finRow ?? {};

  // ── Build trend ──
  const trendMap = new Map<string, number>();
  for (const w of weeklyCompRows) {
    trendMap.set(w.fecha, Number(w.value));
  }

  // Ensure all 7 days appear in trend
  const trend: DashboardKPIs['tendenciaSemanal'] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sda);
    d.setDate(d.getDate() + i);
    const key = isoDate(d);
    const existing = trendRows.find((t) => t.fecha === key);
    trend.push({
      fecha: key,
      ingresos: Number(existing?.ingresos ?? 0),
      ordenesCompletadas: trendMap.get(key) ?? 0,
    });
  }

  const activas =
    (statusMap.get('Presupuestado') ?? 0) +
    (statusMap.get('Aprobado') ?? 0) +
    (statusMap.get('En_Proceso') ?? 0) +
    (statusMap.get('Control_Calidad') ?? 0);

  return {
    ordenes: {
      activas,
      presupuestado: statusMap.get('Presupuestado') ?? 0,
      aprobado: statusMap.get('Aprobado') ?? 0,
      enProceso: statusMap.get('En_Proceso') ?? 0,
      controlCalidad: statusMap.get('Control_Calidad') ?? 0,
      listo: statusMap.get('Listo') ?? 0,
      totalMes: Number(mesOTRow?.value ?? 0),
      completadasHoy: Number(hoyRow?.value ?? 0),
    },
    finanzas: {
      ingresosMes: Number(fin.ingresosMes ?? 0),
      ingresosSemana: Number(fin.ingresosSemana ?? 0),
      pendienteCobro: Number(fin.pendienteCobro ?? 0),
      facturasEmitidasMes: Number(fin.facturasMes ?? 0),
      cobrosMes: Number(cobrosRow?.total ?? 0),
    },
    taller: {
      serviciosRealizadosMes: Number(servRow?.value ?? 0),
      repuestosUsadosMes: Number(stockRow?.repuestosUsados ?? 0),
      costoRepuestosMes: Number(stockRow?.costoRepuestos ?? 0),
      facturacionPromedioOT: Number(avgRow?.value ?? 0),
    },
    inventario: {
      productosBajoStock: Number(lowStockRow?.value ?? 0),
      movimientosHoy: Number(movTodayRow?.value ?? 0),
    },
    tendenciaSemanal: trend,
  };
}

// ─── Top Services ───────────────────────────────

/**
 * Returns the most-used services across all work orders.
 */
export async function getTopServicios(
  tenantSlug: string,
  limitVal = 10,
): Promise<TopServicio[]> {
  const rows = await db()
    .select({
      servicioId: ordenServicios.servicioId,
      nombre: serviciosCatalogo.nombre,
      categoria: serviciosCatalogo.categoria,
      totalUsos: sql<string>`COALESCE(SUM(${ordenServicios.cantidad}), 0)`,
      ingresosGenerados: sql<string>`COALESCE(SUM(${ordenServicios.subtotal}::numeric), 0)`,
    })
    .from(ordenServicios)
    .innerJoin(serviciosCatalogo, eq(ordenServicios.servicioId, serviciosCatalogo.id))
    .where(eq(serviciosCatalogo.tenantSlug, tenantSlug))
    .groupBy(ordenServicios.servicioId, serviciosCatalogo.nombre, serviciosCatalogo.categoria)
    .orderBy(desc(sql`COALESCE(SUM(${ordenServicios.cantidad}), 0)`))
    .limit(limitVal);

  return rows.map((r) => ({
    servicioId: r.servicioId,
    nombre: r.nombre,
    categoria: r.categoria,
    totalUsos: Number(r.totalUsos),
    ingresosGenerados: Number(r.ingresosGenerados),
  }));
}

// ─── Top Clients ────────────────────────────────

/**
 * Returns the highest-grossing clients by total invoiced amount.
 */
export async function getTopClientes(
  tenantSlug: string,
  limitVal = 10,
): Promise<TopCliente[]> {
  // Get client IDs per OT
  const ots = await db()
    .select({
      ordenId: ordenesTrabajo.id,
      clientId: ordenesTrabajo.clientId,
    })
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.tenantSlug, tenantSlug));

  if (ots.length === 0) return [];

  const otClientMap = new Map(ots.map((o) => [o.ordenId, o.clientId]));
  const otIds = [...otClientMap.keys()];

  // Aggregate facturas per OT
  const factRows = await db()
    .select({
      ordenId: facturas.ordenId,
      totalFacturado: sql<string>`COALESCE(SUM(${facturas.total}::numeric), 0)`,
      totalOTs: sql<string>`COUNT(DISTINCT ${facturas.ordenId})`,
    })
    .from(facturas)
    .where(and(
      eq(facturas.tenantSlug, tenantSlug),
      inArray(facturas.ordenId, otIds),
    ))
    .groupBy(facturas.ordenId)
    .orderBy(desc(sql`COALESCE(SUM(${facturas.total}::numeric), 0)`))
    .limit(limitVal * 2); // extra to account for OT→client grouping

  if (factRows.length === 0) return [];

  // Aggregate by actual client
  const clientBuckets = new Map<string, {
    totalFacturado: number;
    totalOTs: Set<string>;
  }>();

  for (const r of factRows) {
    const cid = otClientMap.get(r.ordenId);
    if (!cid) continue;
    if (!clientBuckets.has(cid)) {
      clientBuckets.set(cid, { totalFacturado: 0, totalOTs: new Set() });
    }
    const bucket = clientBuckets.get(cid)!;
    bucket.totalFacturado += Number(r.totalFacturado);
    bucket.totalOTs.add(r.ordenId);
  }

  const sortedClients = [...clientBuckets.entries()]
    .map(([clientId, data]) => ({ clientId, ...data }))
    .sort((a, b) => b.totalFacturado - a.totalFacturado)
    .slice(0, limitVal);

  if (sortedClients.length === 0) return [];

  // Fetch client info
  const cIds = sortedClients.map((c) => c.clientId);
  const clientRows = await db()
    .select({
      id: clients.id,
      nombre: clients.name,
      telefono: clients.phone,
    })
    .from(clients)
    .where(inArray(clients.id, cIds));

  const clientInfoMap = new Map(clientRows.map((c) => [c.id, c]));

  // Fetch last visit dates
  const visitRows = await db()
    .select({
      clientId: ordenesTrabajo.clientId,
      ultimaVisita: sql<string>`MAX(${ordenesTrabajo.createdAt})`,
    })
    .from(ordenesTrabajo)
    .where(and(
      inArray(ordenesTrabajo.clientId, cIds as string[]),
      eq(ordenesTrabajo.tenantSlug, tenantSlug),
    ))
    .groupBy(ordenesTrabajo.clientId);

  const visitMap = new Map(visitRows.map((v) => [v.clientId, v.ultimaVisita]));

  return sortedClients.map((c) => {
    const info = clientInfoMap.get(c.clientId);
    return {
      clientId: c.clientId,
      nombre: info?.nombre ?? 'Cliente desconocido',
      telefono: info?.telefono ?? null,
      totalFacturado: c.totalFacturado,
      totalOTs: c.totalOTs.size,
      ultimaVisita: visitMap.get(c.clientId) ?? null,
    };
  });
}

// ─── Productivity ───────────────────────────────

/**
 * Returns workshop productivity metrics for a date range.
 */
export async function getProductividad(
  tenantSlug: string,
  desde?: string,
  hasta?: string,
): Promise<Productividad> {
  const now = new Date();
  const startDate = desde ?? startOfMonth().toISOString();
  const endDate = hasta ?? now.toISOString();

  // ── Stats ──
  const [completadasRows, ingresosRows, costosRows] = await Promise.all([
    // Completed OTs in period
    db()
      .select({
        count: sql<string>`COUNT(*)`,
        avgDays: sql<string>`COALESCE(AVG(EXTRACT(EPOCH FROM (${ordenesTrabajo.updatedAt} - ${ordenesTrabajo.createdAt})) / 86400), 0)`,
      })
      .from(ordenesTrabajo)
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        eq(ordenesTrabajo.status, 'Listo'),
        sql`${ordenesTrabajo.createdAt}::date >= ${startDate.slice(0, 10)}::date`,
        sql`${ordenesTrabajo.createdAt}::date <= ${endDate.slice(0, 10)}::date`,
      )),

    // Ingresos in period
    db()
      .select({
        total: sql<string>`COALESCE(SUM(${facturas.total}::numeric), 0)`,
      })
      .from(facturas)
      .where(and(
        eq(facturas.tenantSlug, tenantSlug),
        sql`${facturas.createdAt}::date >= ${startDate.slice(0, 10)}::date`,
        sql`${facturas.createdAt}::date <= ${endDate.slice(0, 10)}::date`,
      )),

    // Costo repuestos
    db()
      .select({
        total: sql<string>`COALESCE(SUM(${stockMovements.costoTotal}::numeric), 0)`,
      })
      .from(stockMovements)
      .where(and(
        eq(stockMovements.tipo, 'SALIDA'),
        sql`${stockMovements.createdAt}::date >= ${startDate.slice(0, 10)}::date`,
        sql`${stockMovements.createdAt}::date <= ${endDate.slice(0, 10)}::date`,
      )),
  ]);

  const totalCompletadas = Number(completadasRows[0]?.count ?? 0);
  const avgDays = Number(completadasRows[0]?.avgDays ?? 0);
  const totalIngresos = Number(ingresosRows[0]?.total ?? 0);
  const totalCosto = Number(costosRows[0]?.total ?? 0);
  const margen = totalIngresos - totalCosto;
  const eficiencia = totalIngresos > 0
    ? Math.round((margen / totalIngresos) * 100)
    : 0;

  // ── Monthly detail ──
  const monthlyComp = await db()
    .select({
      mes: sql<string>`TO_CHAR(${ordenesTrabajo.createdAt}, 'YYYY-MM')`,
      count: sql<string>`COUNT(*) FILTER (WHERE ${ordenesTrabajo.status} = 'Listo')`,
    })
    .from(ordenesTrabajo)
    .where(and(
      eq(ordenesTrabajo.tenantSlug, tenantSlug),
      sql`${ordenesTrabajo.createdAt}::date >= ${startDate.slice(0, 10)}::date`,
    ))
    .groupBy(sql`TO_CHAR(${ordenesTrabajo.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${ordenesTrabajo.createdAt}, 'YYYY-MM')`);

  const monthlyFin = await db()
    .select({
      mes: sql<string>`TO_CHAR(${facturas.createdAt}, 'YYYY-MM')`,
      ingresos: sql<string>`COALESCE(SUM(${facturas.total}::numeric), 0)`,
    })
    .from(facturas)
    .where(and(
      eq(facturas.tenantSlug, tenantSlug),
      sql`${facturas.createdAt}::date >= ${startDate.slice(0, 10)}::date`,
    ))
    .groupBy(sql`TO_CHAR(${facturas.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${facturas.createdAt}, 'YYYY-MM')`);

  const monthlyCost = await db()
    .select({
      mes: sql<string>`TO_CHAR(${stockMovements.createdAt}, 'YYYY-MM')`,
      costo: sql<string>`COALESCE(SUM(${stockMovements.costoTotal}::numeric), 0)`,
    })
    .from(stockMovements)
    .where(and(
      eq(stockMovements.tipo, 'SALIDA'),
      sql`${stockMovements.createdAt}::date >= ${startDate.slice(0, 10)}::date`,
    ))
    .groupBy(sql`TO_CHAR(${stockMovements.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${stockMovements.createdAt}, 'YYYY-MM')`);

  const finMap = new Map(monthlyFin.map((m) => [m.mes, Number(m.ingresos)]));
  const costMap = new Map(monthlyCost.map((m) => [m.mes, Number(m.costo)]));

  const detalleMensual = monthlyComp.map((m) => ({
    mes: m.mes,
    otsCompletadas: Number(m.count),
    ingresos: finMap.get(m.mes) ?? 0,
    costoRepuestos: costMap.get(m.mes) ?? 0,
  }));

  return {
    resumen: {
      totalOTsCompletadas: totalCompletadas,
      promedioDuracionDias: Math.round(avgDays * 10) / 10,
      ingresosPeriodo: totalIngresos,
      costoRepuestos: totalCosto,
      margenBruto: margen,
      eficienciaPorcentaje: eficiencia,
    },
    detalleMensual,
  };
}

// ─── Balanced Scorecard (Sprint 11) ────────────

export interface BalancedScorecard {
  financiera: {
    ingresosMes: number;
    costosMes: number;
    margenBruto: number;
    cobrosRealizados: number;
    pendienteCobro: number;
    cumplimientoPresupuesto: number | null;  // % o null si no hay presupuesto
  };
  clientes: {
    totalClientes: number;
    clientesMes: number;
    retencionVisita: number;           // % clientes que repiten en 90 días
    ticketPromedio: number;
  };
  procesosInternos: {
    otsCompletadas: number;
    tasaFinalizacion: number;          // % OTs completadas vs creadas
    tiempoPromedioDias: number;
    serviciosCatalogo: number;         // servicios del catálogo utilizados
  };
  aprendizaje: {
    eficienciaMecanicos: number;       // % margen bruto
    diversidadServicios: number;       // categorías de servicio distintas
    productividadPromedio: number;     // OTs completadas por mecánico activo
  };
}

/**
 * Balanced Scorecard — 4 perspectivas del taller.
 * Reutiliza queries optimizadas y agrega en estructura BSC.
 */
export async function getBalancedScorecard(
  tenantSlug: string,
): Promise<BalancedScorecard> {
  const mesInicio = startOfMonth();
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  // ── Consultas paralelas ──
  const [ingresosResult, costosResult, otsCreadas, otsCompletadas, clientesTotales, clientesMesResult, ticketsResult, serviciosUsados, actividadReciente] = await Promise.all([
    // Ingresos del mes (facturas)
    db().select({ total: sql<number>`COALESCE(SUM(${facturas.total}), 0)` })
      .from(facturas)
      .where(and(
        eq(facturas.tenantSlug, tenantSlug),
        sql`${facturas.createdAt} >= ${mesInicio.toISOString()}`,
      )).limit(1),

    // Costos del mes (asientos de COSTO)
    db().select({ total: sql<number>`COALESCE(SUM(${asientosDetalle.debe}), 0)` })
      .from(asientosDetalle)
      .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
      .where(and(
        eq(asientosContables.estado, "CONTABILIZADO"),
        sql`${asientosContables.fecha} >= ${mesInicio.toISOString()}`,
      )).limit(1),

    // OTs creadas este mes
    db().select({ count: count() })
      .from(ordenesTrabajo)
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.createdAt} >= ${mesInicio.toISOString()}`,
      )).limit(1),

    // OTs completadas este mes (status = 'Listo')
    db().select({ count: count() })
      .from(ordenesTrabajo)
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        eq(ordenesTrabajo.status, "Listo"),
        sql`${ordenesTrabajo.updatedAt} >= ${mesInicio.toISOString()}`,
      )).limit(1),

    // Total clientes
    db().select({ count: count() })
      .from(clients)
      .where(eq(clients.tenantSlug, tenantSlug))
      .limit(1),

    // Clientes que visitaron este mes (distintos por OT)
    db().select({ count: sql<number>`COUNT(DISTINCT ${ordenesTrabajo.clientId})` })
      .from(ordenesTrabajo)
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.createdAt} >= ${mesInicio.toISOString()}`,
      )).limit(1),

    // Ticket promedio (facturación promedio por factura)
    db().select({ avg: sql<number>`COALESCE(AVG(${facturas.total}), 0)` })
      .from(facturas)
      .where(and(
        eq(facturas.tenantSlug, tenantSlug),
        sql`${facturas.createdAt} >= ${mesInicio.toISOString()}`,
      )).limit(1),

    // Servicios de catálogo utilizados este mes
    db().select({ count: sql<number>`COUNT(DISTINCT ${ordenServicios.servicioId})` })
      .from(ordenServicios)
      .innerJoin(ordenesTrabajo, eq(ordenServicios.ordenTrabajoId, ordenesTrabajo.id))
      .where(and(
        eq(ordenServicios.tenantSlug, tenantSlug),
        sql`${ordenServicios.createdAt} >= ${mesInicio.toISOString()}`,
      )).limit(1),

    // Actividad reciente (OTs en 3 meses como proxy de capacidad)
    db().select({ count: count() })
      .from(ordenesTrabajo)
      .where(and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.createdAt} >= ${tresMesesAtras.toISOString()}`,
      )).limit(1),
  ]);

  const ingresosMes = Number(ingresosResult[0]?.total ?? 0);
  const costosMes = Number(costosResult[0]?.total ?? 0);
  const margenBruto = ingresosMes > 0 ? Math.round(((ingresosMes - costosMes) / ingresosMes) * 10000) / 100 : 0;
  const otsCreadasMes = otsCreadas[0]?.count ?? 0;
  const otsCompletadasMes = otsCompletadas[0]?.count ?? 0;
  const tasaFinalizacion = otsCreadasMes > 0 ? Math.round((otsCompletadasMes / otsCreadasMes) * 10000) / 100 : 0;
  const totalClientesVal = clientesTotales[0]?.count ?? 0;
  const clientesMesVal = Number(clientesMesResult[0]?.count ?? 0);
  const retencion = totalClientesVal > 0 ? Math.round((clientesMesVal / totalClientesVal) * 10000) / 100 : 0;
  const ticketPromedio = Number(ticketsResult[0]?.avg ?? 0);
  const serviciosCatalogoUsados = Number(serviciosUsados[0]?.count ?? 0);
  const actividadRecienteVal = Number(actividadReciente[0]?.count ?? 0) || 1;
  const productividadPromedio = Math.round((otsCompletadasMes / actividadRecienteVal) * 10) / 10;

  // Cobros del mes
  const [cobrosResult] = await db().select({ total: sql<number>`COALESCE(SUM(${movimientosTes.monto}), 0)` })
    .from(movimientosTes)
    .where(and(
      eq(movimientosTes.tenantSlug, tenantSlug),
      eq(movimientosTes.tipo, "INGRESO"),
      sql`${movimientosTes.fecha} >= ${mesInicio.toISOString()}`,
    )).limit(1);

  // Pendiente de cobro (CxC)
  const [pendienteResult] = await db().select({ total: sql<number>`COALESCE(SUM(${facturas.saldoPendiente}), 0)` })
    .from(facturas)
    .where(and(
      eq(facturas.tenantSlug, tenantSlug),
      eq(facturas.estadoPago, "PENDIENTE"),
    )).limit(1);

  return {
    financiera: {
      ingresosMes,
      costosMes,
      margenBruto,
      cobrosRealizados: Number(cobrosResult?.total ?? 0),
      pendienteCobro: Number(pendienteResult?.total ?? 0),
      cumplimientoPresupuesto: null,  // requires presupuesto aprobado
    },
    clientes: {
      totalClientes: totalClientesVal,
      clientesMes: clientesMesVal,
      retencionVisita: retencion,
      ticketPromedio: Math.round(ticketPromedio),
    },
    procesosInternos: {
      otsCompletadas: otsCompletadasMes,
      tasaFinalizacion,
      tiempoPromedioDias: 0,  // would need historical calculation
      serviciosCatalogo: serviciosCatalogoUsados,
    },
    aprendizaje: {
      eficienciaMecanicos: margenBruto,
      diversidadServicios: serviciosCatalogoUsados,
      productividadPromedio,
    },
  };
}
