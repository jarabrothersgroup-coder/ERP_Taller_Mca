/**
 * Multi-Taller Dashboard Service — centralized management.
 *
 * Provides cross-branch analytics, inventory transfers,
 * and consolidated reporting for multi-location workshops.
 *
 * @module config/services/multi-branch-dashboard.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql, eq } from "drizzle-orm";
import { sucursales } from "../schema/sucursales.js";

// ─── Types ────────────────────────────────────

export interface BranchKPI {
  sucursalId: string;
  sucursalNombre: string;
  otActivas: number;
  otCompletadasMes: number;
  ingresoMes: number;
  eficienciaMecanicos: number;
  stockBajo: number;
}

export interface ConsolidatedKPI {
  totalSucursales: number;
  totalOTActivas: number;
  totalOTCompletadasMes: number;
  totalIngresoMes: number;
  eficienciaPromedio: number;
  sucursales: BranchKPI[];
}

// ─── Dashboard Functions ──────────────────────

/**
 * Gets consolidated KPIs across all branches.
 *
 * @param tenantSlug - Tenant identifier
 * @returns Consolidated KPI data
 */
export async function getConsolidatedKPIs(
  tenantSlug: string,
): Promise<ConsolidatedKPI> {
  // Get all active branches
  const branches = await db()
    .select()
    .from(sucursales)
    .where(
      sql`${sucursales.tenantSlug} = ${tenantSlug} AND ${sucursales.activa} = true`
    );

  const branchKPIs: BranchKPI[] = [];

  for (const branch of branches) {
    // Get OT stats for this branch (placeholder — would need sucursal_id on OTs)
    const kpi: BranchKPI = {
      sucursalId: branch.id,
      sucursalNombre: branch.nombre,
      otActivas: 0,
      otCompletadasMes: 0,
      ingresoMes: 0,
      eficienciaMecanicos: 0,
      stockBajo: 0,
    };
    branchKPIs.push(kpi);
  }

  return {
    totalSucursales: branches.length,
    totalOTActivas: branchKPIs.reduce((sum, k) => sum + k.otActivas, 0),
    totalOTCompletadasMes: branchKPIs.reduce((sum, k) => sum + k.otCompletadasMes, 0),
    totalIngresoMes: branchKPIs.reduce((sum, k) => sum + k.ingresoMes, 0),
    eficienciaPromedio: 0,
    sucursales: branchKPIs,
  };
}
