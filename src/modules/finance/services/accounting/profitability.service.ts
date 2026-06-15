/**
 * Profitability Service — CAPA 5.
 *
 * Análisis de rentabilidad a múltiples niveles:
 *   - Por Orden de Trabajo (margen bruto por OT)
 *   - Por Cliente (rentabilidad agregada)
 *   - Por Mecánico (eficiencia y margen generado)
 *   - Dashboard general del período
 *
 * Fuentes de datos:
 *   - Ingresos: facturas vinculadas a OT
 *   - Costos directos: repuestos (stock_movements), terceros (trabajos_terceros),
 *     comisiones (commission_records)
 *
 * @module finance/services/accounting/profitability.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { ordenesTrabajo } from "../../../workshop/schema/ordenes-trabajo.js";
import { trabajosTerceros } from "../../../workshop/schema/trabajos-terceros.js";
import { facturas } from "../../schema/facturas.js";
import { stockMovements } from "../../../inventory/schema/stock-movements.js";
import { commissionRecords } from "../../schema/commission-records.js";
import { clients } from "../../../../shared/database/schema/clients.js";
import { vehiculos } from "../../../workshop/schema/vehiculos.js";
import { mechanicProfiles } from "../../schema/mechanic-profiles.js";
import { profiles } from "../../../../shared/database/schema/profiles.js";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface OTProfitability {
  ordenId: string;
  numero?: string;
  clientId: string;
  clientName: string;
  vehicleInfo: string;
  status: string;
  fechaCreacion: string;

  // Revenue
  ingresos: {
    totalFacturado: number;
    facturaCount: number;
  };

  // Costs
  costos: {
    repuestos: number;
    trabajosTerceros: number;
    comisiones: number;
    totalDirectos: number;
  };

  // Margins
  margenBruto: number;
  margenPorcentaje: number;
}

export interface ClientProfitability {
  clientId: string;
  clientName: string;
  ruc?: string;
  totalOTs: number;
  totalFacturado: number;
  totalCostosDirectos: number;
  margenBruto: number;
  margenPorcentaje: number;
  ultimaOT: string | null;
}

export interface MechanicProfitability {
  mechanicProfileId: string;
  mechanicName: string;
  category: string;
  totalComisiones: number;
  totalOTs: number;
  totalLaborGenerado: number;
  comisionPromedio: number;
}

export interface PeriodoProfitability {
  tenantSlug: string;
  anho: number;
  mes: number;
  resumen: {
    totalOTs: number;
    totalFacturado: number;
    totalCostos: number;
    margenBruto: number;
    margenPorcentaje: number;
    totalComisiones: number;
    totalRepuestos: number;
    totalTerceros: number;
  };
  topOTs: OTProfitability[];
  topMecanicos: MechanicProfitability[];
}

// ─── OT Profitability ─────────────────────────

/**
 * Calcula la rentabilidad de una Orden de Trabajo específica.
 */
export async function getOTProfitability(
  ordenId: string,
): Promise<OTProfitability> {
  const [ot] = await db()
    .select({
      id: ordenesTrabajo.id,
      status: ordenesTrabajo.status,
      createdAt: ordenesTrabajo.createdAt,
      clientId: ordenesTrabajo.clientId,
      clientName: clients.name,
      vehicleBrand: vehiculos.brand,
      vehicleModel: vehiculos.model,
      vehiclePlate: vehiculos.plate,
    })
    .from(ordenesTrabajo)
    .innerJoin(clients, eq(ordenesTrabajo.clientId, clients.id))
    .innerJoin(vehiculos, eq(ordenesTrabajo.vehicleId, vehiculos.id))
    .where(eq(ordenesTrabajo.id, ordenId))
    .limit(1);

  if (!ot) {
    throw new ValidationError(`Orden de trabajo ${ordenId} no encontrada`);
  }

  const vehicleInfo = `${ot.vehicleBrand} ${ot.vehicleModel} (${ot.vehiclePlate ?? "sin chapa"})`;

  // Revenue from invoices
  const [ingresosResult] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${facturas.total}::numeric, 0)), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(facturas)
    .where(eq(facturas.ordenId, ordenId));

  const totalFacturado = Number(ingresosResult?.total ?? 0);
  const facturaCount = Number(ingresosResult?.count ?? 0);

  // Parts cost (SALIDAS)
  const [repuestosResult] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${stockMovements.costoTotal}::numeric, 0)), 0)`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.ordenTrabajoId, ordenId),
        eq(stockMovements.tipo, "SALIDA"),
      ),
    );

  const costosRepuestos = Number(repuestosResult?.total ?? 0);

  // Third-party costs
  const [tercerosResult] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${trabajosTerceros.costo}::numeric, 0)), 0)`,
    })
    .from(trabajosTerceros)
    .where(eq(trabajosTerceros.ordenTrabajoId, ordenId));

  const costosTerceros = Number(tercerosResult?.total ?? 0);

  // Commissions
  const [comisionesResult] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${commissionRecords.commissionAmount}::numeric, 0)), 0)`,
    })
    .from(commissionRecords)
    .where(eq(commissionRecords.orderId, ordenId));

  const costosComisiones = Number(comisionesResult?.total ?? 0);

  // Margins
  const totalCostosDirectos = costosRepuestos + costosTerceros + costosComisiones;
  const margenBruto = totalFacturado - totalCostosDirectos;
  const margenPorcentaje = totalFacturado > 0
    ? Math.round((margenBruto / totalFacturado) * 10000) / 100
    : 0;

  return {
    ordenId: ot.id,
    clientId: ot.clientId,
    clientName: ot.clientName,
    vehicleInfo,
    status: ot.status,
    fechaCreacion: ot.createdAt.toISOString(),
    ingresos: { totalFacturado, facturaCount },
    costos: {
      repuestos: costosRepuestos,
      trabajosTerceros: costosTerceros,
      comisiones: costosComisiones,
      totalDirectos: totalCostosDirectos,
    },
    margenBruto,
    margenPorcentaje,
  };
}

// ─── Client Profitability ─────────────────────

/**
 * Calcula la rentabilidad agregada de un cliente.
 */
export async function getClientProfitability(
  clientId: string,
): Promise<ClientProfitability> {
  const [client] = await db()
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    throw new ValidationError(`Cliente ${clientId} no encontrado`);
  }

  // Get all OTs for this client
  const ots = await db()
    .select({ id: ordenesTrabajo.id, createdAt: ordenesTrabajo.createdAt })
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.clientId, clientId))
    .orderBy(desc(ordenesTrabajo.createdAt));

  if (ots.length === 0) {
    return {
      clientId,
      clientName: client.name,
      ruc: client.ruc ?? undefined,
      totalOTs: 0,
      totalFacturado: 0,
      totalCostosDirectos: 0,
      margenBruto: 0,
      margenPorcentaje: 0,
      ultimaOT: null,
    };
  }

  const otIds = ots.map((o) => o.id);

  // Aggregate invoices
  const [ingresosTotal] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${facturas.total}::numeric, 0)), 0)`,
    })
    .from(facturas)
    .where(inArray(facturas.ordenId, otIds));

  const totalFacturado = Number(ingresosTotal?.total ?? 0);

  // Aggregate parts cost
  const [repuestosTotal] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${stockMovements.costoTotal}::numeric, 0)), 0)`,
    })
    .from(stockMovements)
    .where(
      and(
        inArray(stockMovements.ordenTrabajoId, otIds),
        eq(stockMovements.tipo, "SALIDA"),
      ),
    );

  const costosRepuestos = Number(repuestosTotal?.total ?? 0);

  // Aggregate third-party cost
  const [tercerosTotal] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${trabajosTerceros.costo}::numeric, 0)), 0)`,
    })
    .from(trabajosTerceros)
    .where(inArray(trabajosTerceros.ordenTrabajoId, otIds));

  const costosTerceros = Number(tercerosTotal?.total ?? 0);

  // Aggregate commissions
  const [comisionesTotal] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${commissionRecords.commissionAmount}::numeric, 0)), 0)`,
    })
    .from(commissionRecords)
    .where(inArray(commissionRecords.orderId, otIds));

  const costosComisiones = Number(comisionesTotal?.total ?? 0);

  const totalCostos = costosRepuestos + costosTerceros + costosComisiones;
  const margenBruto = totalFacturado - totalCostos;
  const margenPorcentaje = totalFacturado > 0
    ? Math.round((margenBruto / totalFacturado) * 10000) / 100
    : 0;

  return {
    clientId,
    clientName: client.name,
    ruc: client.ruc ?? undefined,
    totalOTs: ots.length,
    totalFacturado,
    totalCostosDirectos: totalCostos,
    margenBruto,
    margenPorcentaje,
    ultimaOT: ots[0]?.createdAt.toISOString() ?? null,
  };
}

// ─── Mechanic Profitability ────────────────────

/**
 * Calcula la rentabilidad generada por un mecánico.
 */
export async function getMechanicProfitability(
  mechanicProfileId: string,
): Promise<MechanicProfitability> {
  const [mech] = await db()
    .select({
      id: mechanicProfiles.id,
      profileId: mechanicProfiles.profileId,
      category: mechanicProfiles.category,
    })
    .from(mechanicProfiles)
    .where(eq(mechanicProfiles.id, mechanicProfileId))
    .limit(1);

  if (!mech) {
    throw new ValidationError(`Perfil de mecánico ${mechanicProfileId} no encontrado`);
  }

  const [profile] = await db()
    .select({ fullName: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.id, mech.profileId))
    .limit(1);

  const mechanicName = profile?.fullName ?? "Desconocido";

  const [comisiones] = await db()
    .select({
      totalComisiones: sql<number>`COALESCE(SUM(COALESCE(${commissionRecords.commissionAmount}::numeric, 0)), 0)`,
      totalLabor: sql<number>`COALESCE(SUM(COALESCE(${commissionRecords.laborAmount}::numeric, 0)), 0)`,
      totalOTs: sql<number>`COUNT(DISTINCT ${commissionRecords.orderId})`,
      comisionPromedio: sql<number>`CASE WHEN COUNT(*) > 0 THEN COALESCE(AVG(COALESCE(${commissionRecords.commissionAmount}::numeric, 0)), 0) ELSE 0 END`,
    })
    .from(commissionRecords)
    .where(eq(commissionRecords.mechanicProfileId, mechanicProfileId));

  return {
    mechanicProfileId,
    mechanicName,
    category: mech.category,
    totalComisiones: Number(comisiones?.totalComisiones ?? 0),
    totalOTs: Number(comisiones?.totalOTs ?? 0),
    totalLaborGenerado: Number(comisiones?.totalLabor ?? 0),
    comisionPromedio: Number(comisiones?.comisionPromedio ?? 0),
  };
}

// ─── Period Dashboard ─────────────────────────

/**
 * Genera el dashboard de rentabilidad para un período.
 *
 * @param tenantSlug - Tenant slug
 * @param anho - Año fiscal
 * @param mes - Mes (1-12)
 */
export async function getDashboardProfitability(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<PeriodoProfitability> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // OTs del período
  const ots = await db()
    .select({ id: ordenesTrabajo.id })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        sql`${ordenesTrabajo.createdAt} >= ${desde} AND ${ordenesTrabajo.createdAt} <= ${hasta}`,
      ),
    );

  const otIds = ots.map((o) => o.id);
  const totalOTs = otIds.length;

  if (totalOTs === 0) {
    return {
      tenantSlug,
      anho,
      mes,
      resumen: {
        totalOTs: 0,
        totalFacturado: 0,
        totalCostos: 0,
        margenBruto: 0,
        margenPorcentaje: 0,
        totalComisiones: 0,
        totalRepuestos: 0,
        totalTerceros: 0,
      },
      topOTs: [],
      topMecanicos: [],
    };
  }

  // Revenue
  const [revenue] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${facturas.total}::numeric, 0)), 0)`,
    })
    .from(facturas)
    .where(inArray(facturas.ordenId, otIds));

  const totalFacturado = Number(revenue?.total ?? 0);

  // Parts cost
  const [repuestos] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${stockMovements.costoTotal}::numeric, 0)), 0)`,
    })
    .from(stockMovements)
    .where(
      and(
        inArray(stockMovements.ordenTrabajoId, otIds),
        eq(stockMovements.tipo, "SALIDA"),
      ),
    );

  const totalRepuestos = Number(repuestos?.total ?? 0);

  // Third-party cost
  const [terceros] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${trabajosTerceros.costo}::numeric, 0)), 0)`,
    })
    .from(trabajosTerceros)
    .where(inArray(trabajosTerceros.ordenTrabajoId, otIds));

  const totalTerceros = Number(terceros?.total ?? 0);

  // Commissions
  const [comisiones] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${commissionRecords.commissionAmount}::numeric, 0)), 0)`,
    })
    .from(commissionRecords)
    .where(
      and(
        inArray(commissionRecords.orderId, otIds),
        eq(commissionRecords.year, anho),
        eq(commissionRecords.month, mes),
      ),
    );

  const totalComisiones = Number(comisiones?.total ?? 0);

  const totalCostos = totalRepuestos + totalTerceros + totalComisiones;
  const margenBruto = totalFacturado - totalCostos;
  const margenPorcentaje = totalFacturado > 0
    ? Math.round((margenBruto / totalFacturado) * 10000) / 100
    : 0;

  // Top OTs by margin (limit to first 20 to avoid heavy processing)
  const topOtIds = otIds.slice(0, 20);
  const topOTsResults = await Promise.allSettled(
    topOtIds.map((id) => getOTProfitability(id)),
  );

  const topOTsFiltered = topOTsResults
    .filter((r): r is PromiseFulfilledResult<OTProfitability> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => b.margenBruto - a.margenBruto)
    .slice(0, 10);

  // Top mechanics — get all with commissions in period
  const mechData = await db()
    .select({
      id: mechanicProfiles.id,
      profileId: mechanicProfiles.profileId,
      category: mechanicProfiles.category,
      totalComisiones: sql<number>`COALESCE(SUM(COALESCE(${commissionRecords.commissionAmount}::numeric, 0)), 0)`,
      totalOTs: sql<number>`COUNT(DISTINCT ${commissionRecords.orderId})`,
      totalLabor: sql<number>`COALESCE(SUM(COALESCE(${commissionRecords.laborAmount}::numeric, 0)), 0)`,
      avgComision: sql<number>`COALESCE(AVG(COALESCE(${commissionRecords.commissionAmount}::numeric, 0)), 0)`,
    })
    .from(mechanicProfiles)
    .innerJoin(
      commissionRecords,
      eq(commissionRecords.mechanicProfileId, mechanicProfiles.id),
    )
    .where(
      and(
        inArray(commissionRecords.orderId, otIds),
        eq(commissionRecords.year, anho),
        eq(commissionRecords.month, mes),
      ),
    )
    .groupBy(mechanicProfiles.id, mechanicProfiles.profileId, mechanicProfiles.category)
    .orderBy(desc(sql`SUM(COALESCE(${commissionRecords.commissionAmount}::numeric, 0))`))
    .limit(10);

  // Resolve mechanic names
  const topMecanicos: MechanicProfitability[] = await Promise.all(
    mechData.map(async (m) => {
      const [p] = await db()
        .select({ fullName: profiles.fullName })
        .from(profiles)
        .where(eq(profiles.id, m.profileId))
        .limit(1);
      return {
        mechanicProfileId: m.id,
        mechanicName: p?.fullName ?? "Desconocido",
        category: m.category,
        totalComisiones: Number(m.totalComisiones),
        totalOTs: Number(m.totalOTs),
        totalLaborGenerado: Number(m.totalLabor),
        comisionPromedio: Number(m.avgComision),
      };
    }),
  );

  return {
    tenantSlug,
    anho,
    mes,
    resumen: {
      totalOTs,
      totalFacturado,
      totalCostos,
      margenBruto,
      margenPorcentaje,
      totalComisiones,
      totalRepuestos,
      totalTerceros,
    },
    topOTs: topOTsFiltered,
    topMecanicos,
  };
}
