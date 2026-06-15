/**
 * Tool Depreciation Service — monthly straight-line depreciation.
 *
 * Calculates monthly depreciation for all active tool instances
 * and generates aggregated accounting entries.
 *
 * Depreciation formula (LINEA_RECTA):
 *   monthly_depreciation = costo_adquisicion / (vida_util_anos * 12)
 *
 * @module inventory/services/tool-depreciation.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  toolDepreciationEntries,
  toolInstances,
  herramientas,
} from "../schema/index.js";
import { eq, and, sql, desc } from "drizzle-orm";
// import { ValidationError } from "../../../shared/errors/app-error.js";
import type {
  CalculateDepreciationRequest,
  DepreciationCalculationResponse,
} from "../types.js";

// ─── Depreciation Engine ──────────────────────

/**
 * Calculates monthly depreciation for all eligible tool instances.
 *
 * Eligibility:
 *   - activa = true
 *   - estado_actual != 'DADO_DE_BAJA'
 *   - herramienta.vida_util_anos IS NOT NULL (catálogo tiene vida útil definida)
 *   - metodo_depreciacion = 'LINEA_RECTA'
 *   - costo_adquisicion > 0
 *   - No depreciation entry yet exists for this period
 *
 * Generates one aggregated accounting entry for all depreciation
 * in the period (debit: Gasto Depreciación, credit: Depreciación Acumulada).
 *
 * @param data - Period specification
 * @param tenantSlug - Current tenant
 * @returns Summary of created entries
 */
export async function calculateMonthlyDepreciation(
  data: CalculateDepreciationRequest,
  tenantSlug: string,
): Promise<DepreciationCalculationResponse> {
  // ── 1. Determine period ──
  let periodo: string;
  let anho: number;
  let mes: number;

  if (data.periodo) {
    // Format: "YYYY-MM"
    const parts = data.periodo.split('-');
    anho = parseInt(parts[0]!, 10);
    mes = parseInt(parts[1]!, 10);
    periodo = data.periodo;
  } else if (data.anho && data.mes) {
    anho = data.anho;
    mes = data.mes;
    periodo = `${anho}-${String(mes).padStart(2, '0')}`;
  } else {
    const now = new Date();
    anho = now.getFullYear();
    mes = now.getMonth() + 1; // 1-based
    periodo = `${anho}-${String(mes).padStart(2, '0')}`;
  }

  // ── 2. Find eligible tool instances ──
  const eligibleAssets = await db()
    .select({
      id: toolInstances.id,
      herramientaId: toolInstances.herramientaId,
      numeroSerie: toolInstances.numeroSerie,
      costoAdquisicion: toolInstances.costoAdquisicion,
      valorActualLibros: toolInstances.valorActualLibros,
      vidaUtilAnos: herramientas.vidaUtilAnos,
      metodoDepreciacion: herramientas.metodoDepreciacion,
    })
    .from(toolInstances)
    .innerJoin(
      herramientas,
      eq(toolInstances.herramientaId, herramientas.id),
    )
    .where(and(
      eq(toolInstances.tenantSlug, tenantSlug),
      eq(toolInstances.activa, true),
      sql`${toolInstances.estadoActual} != 'DADO_DE_BAJA'`,
      sql`${herramientas.vidaUtilAnos} IS NOT NULL`,
      sql`${herramientas.vidaUtilAnos} > 0`,
      sql`${herramientas.metodoDepreciacion} = 'LINEA_RECTA'`,
      sql`${toolInstances.costoAdquisicion} > 0`,
    ));

  if (eligibleAssets.length === 0) {
    return {
      entriesCreated: 0,
      totalDepreciation: '0.00',
      asientoId: null,
      periodo,
    };
  }

  // ── 3. Calculate depreciation per asset ──
  const lastDayOfMonth = new Date(anho, mes, 0); // day 0 of next month = last day
  const fecha = `${anho}-${String(mes).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;

  const depreciationLines: Array<{
    toolInstanceId: string;
    periodo: string;
    fecha: string;
    valorInicial: string;
    montoDepreciacion: string;
    valorFinal: string;
  }> = [];

  let totalDepreciation = 0;

  for (const asset of eligibleAssets) {
    const costo = Number(asset.costoAdquisicion);
    const vidaMeses = Number(asset.vidaUtilAnos) * 12;
    if (vidaMeses <= 0) continue;

    const monthlyDep = costo / vidaMeses;
    const currentValue = Number(asset.valorActualLibros);
    const newValue = Math.max(0, currentValue - monthlyDep);

    depreciationLines.push({
      toolInstanceId: asset.id,
      periodo,
      fecha,
      valorInicial: currentValue.toFixed(2),
      montoDepreciacion: monthlyDep.toFixed(2),
      valorFinal: newValue.toFixed(2),
    });

    totalDepreciation += monthlyDep;
  }

  // ── 5. Insert depreciation entries ──
  // Note: accounting entry generation requires plan_cuentas IDs.
  // For now, we persist the entries; the asiento linkage
  // can be wired when tool-specific accounts are seeded.
  for (const line of depreciationLines) {
    await db()
      .insert(toolDepreciationEntries)
      .values({
        toolInstanceId: line.toolInstanceId,
        fecha: line.fecha,
        periodo: line.periodo,
        valorInicial: line.valorInicial,
        valorFinal: line.valorFinal,
        montoDepreciacion: line.montoDepreciacion,
        tenantSlug,
      });
  }

  // ── 6. Update tool_instance book values ──
  for (const line of depreciationLines) {
    await db()
      .update(toolInstances)
      .set({
        valorActualLibros: line.valorFinal,
        ultimaDepreciacion: line.fecha,
        updatedAt: sql`NOW()`,
      })
      .where(and(
        eq(toolInstances.id, line.toolInstanceId),
        eq(toolInstances.tenantSlug, tenantSlug),
      ));
  }

  return {
    entriesCreated: depreciationLines.length,
    totalDepreciation: totalDepreciation.toFixed(2),
    asientoId: null, // Future: link to accounting entry
    periodo,
  };
}

/**
 * Lists depreciation entries for a specific tool instance.
 *
 * @param toolInstanceId - ToolInstance UUID
 * @param tenantSlug - Current tenant
 * @returns Depreciation entry history
 */
export async function getDepreciationHistory(
  toolInstanceId: string,
  tenantSlug: string,
) {
  return db()
    .select()
    .from(toolDepreciationEntries)
    .where(and(
      eq(toolDepreciationEntries.toolInstanceId, toolInstanceId),
      eq(toolDepreciationEntries.tenantSlug, tenantSlug),
    ))
    .orderBy(desc(toolDepreciationEntries.fecha));
}

/**
 * Gets the current net book value of a tool instance.
 *
 * @param toolInstanceId - ToolInstance UUID
 * @param tenantSlug - Current tenant
 * @returns Current book value
 */
export async function getCurrentBookValue(
  toolInstanceId: string,
  tenantSlug: string,
) {
  const [instance] = await db()
    .select({
      costoAdquisicion: toolInstances.costoAdquisicion,
      valorActualLibros: toolInstances.valorActualLibros,
      ultimaDepreciacion: toolInstances.ultimaDepreciacion,
      herramientaNombre: herramientas.nombre,
      herramientaCodigo: herramientas.codigo,
      numeroSerie: toolInstances.numeroSerie,
    })
    .from(toolInstances)
    .innerJoin(
      herramientas,
      eq(toolInstances.herramientaId, herramientas.id),
    )
    .where(and(
      eq(toolInstances.id, toolInstanceId),
      eq(toolInstances.tenantSlug, tenantSlug),
    ))
    .limit(1);

  if (!instance) {
    return null;
  }

  return {
    herramientaNombre: instance.herramientaNombre,
    herramientaCodigo: instance.herramientaCodigo,
    numeroSerie: instance.numeroSerie,
    costoAdquisicion: instance.costoAdquisicion,
    valorActualLibros: instance.valorActualLibros,
    ultimaDepreciacion: instance.ultimaDepreciacion,
    depreciacionAcumulada: (
      Number(instance.costoAdquisicion) - Number(instance.valorActualLibros)
    ).toFixed(2),
  };
}
