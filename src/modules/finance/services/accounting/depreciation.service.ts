/**
 * Depreciation Service — Depreciación de Activos Fijos.
 *
 * Centraliza el cálculo de depreciación mensual de TODOS los activos
 * del taller (tanto tool_instances del módulo inventory como activos_fijos
 * del módulo finance) y genera los asientos contables correspondientes.
 *
 * Débito: Gasto Depreciación (6.3.x)
 * Crédito: Depreciación Acumulada (1.2.x)
 *
 * Método soportado: LINEA_RECTA (Ley 1034/83, NIC 16)
 *   depreciación_mensual = (costo_adquisición - valor_residual) / (vida_util_años × 12)
 *
 * @module finance/services/accounting/depreciation.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas, asientosContables, asientosDetalle, activosFijos, depreciacionActivos } from "../../schema/index.js";
import { toolInstances, herramientas, toolDepreciationEntries } from "../../../inventory/schema/index.js";
import { eq, and, sql, gte, lte } from "drizzle-orm";

// ─── Interfaces ────────────────────────────────

export interface DepreciationResult {
  success: boolean;
  totalDepreciacion: number;
  toolAssetsCount: number;
  fixedAssetsCount: number;
  asientoId: string | null;
  asientoNumero: number | null;
  periodo: string;
}

export interface CreateFixedAssetRequest {
  codigo: string;
  nombre: string;
  tipo: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  fechaAdquisicion: string;
  costoAdquisicion: number;
  valorResidual?: number;
  vidaUtilAnos: number;
  metodoDepreciacion?: "LINEA_RECTA" | "DIGITO_CRECIENTE" | "DIGITO_DECRECIENTE";
  notas?: string;
}

// ─── Cuentas por defecto según tipo de activo ──

const CUENTAS_POR_TIPO: Record<string, { gasto: string; acumulada: string }> = {
  EQUIPO_DIAGNOSTICO:    { gasto: "6.3.01.001", acumulada: "1.2.04.001" },
  HERRAMIENTA_ESPECIAL:  { gasto: "6.3.01.002", acumulada: "1.2.04.001" },
  VEHICULO_SERVICIO:     { gasto: "6.3.02.001", acumulada: "1.2.02.001" },
  MAQUINARIA_TALLER:     { gasto: "6.3.03.001", acumulada: "1.2.03.001" },
  MUEBLE_ENSAYRE:        { gasto: "6.3.04.001", acumulada: "1.2.05.001" },
  INFORMATICA:           { gasto: "6.3.05.001", acumulada: "1.2.06.001" },
  INMUEBLE:              { gasto: "6.3.06.001", acumulada: "1.2.01.001" },
};

// ─── Helpers ───────────────────────────────────

/** Resuelve ID de cuenta por código. */
async function resolveCuenta(codigo: string): Promise<string> {
  const [c] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(eq(planCuentas.codigo, codigo), eq(planCuentas.activo, true)))
    .limit(1);
  if (!c) throw new Error(`Cuenta contable ${codigo} no encontrada. Siembre las cuentas de depreciación.`);
  return c.id;
}

/** Obtiene próximo número de asiento */
async function nextNumero(fecha: Date): Promise<number> {
  const start = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const end = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);
  const [max] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(and(gte(asientosContables.fecha, start), lte(asientosContables.fecha, end)));
  return (max?.max ?? 0) + 1;
}

/** Depreciación mensual línea recta */
function lineaRectaMensual(costo: number, residual: number, vidaAnos: number): number {
  if (vidaAnos <= 0) return 0;
  const depreciable = Math.max(0, costo - residual);
  return depreciable / (vidaAnos * 12);
}

/** Depreciación mensual dígitos decrecientes */
function digitoDecrecienteMensual(costo: number, residual: number, vidaAnos: number, mesActual: number): number {
  const depreciable = Math.max(0, costo - residual);
  const sumaDigitos = (vidaAnos * (vidaAnos + 1)) / 2;
  const mesesVida = vidaAnos * 12;
  const mesesRestantes = mesesVida - (mesActual - 1);
  const digito = Math.ceil(mesesRestantes / 12); // dígito del año actual
  return (depreciable * digito) / (sumaDigitos * 12);
}

// ─── Depreciación de Tool Instances ────────────

/**
 * Genera depreciación para tool_instances del inventario y
 * crea el asiento contable consolidado.
 */
export async function generateToolDepreciation(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<{ assets: number; totalDepreciation: number; entries: Array<{ id: string; monto: string }> }> {
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;
  const lastDay = new Date(anho, mes, 0);
  const fechaStr = `${anho}-${String(mes).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  // Buscar tool_instances activas sin depreciación para este período
  const assets = await db()
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
    .innerJoin(herramientas, eq(toolInstances.herramientaId, herramientas.id))
    .where(
      and(
        eq(toolInstances.tenantSlug, tenantSlug),
        eq(toolInstances.activa, true),
        sql`${toolInstances.estadoActual} != 'DADO_DE_BAJA'`,
        sql`${herramientas.vidaUtilAnos} IS NOT NULL`,
        sql`${herramientas.vidaUtilAnos} > 0`,
        sql`${herramientas.metodoDepreciacion} = 'LINEA_RECTA'`,
        sql`${toolInstances.costoAdquisicion} > 0`,
        sql`NOT EXISTS (SELECT 1 FROM tool_depreciation_entries tde WHERE tde.tool_instance_id = ${toolInstances.id} AND tde.periodo = ${periodo})`,
      ),
    );

  if (assets.length === 0) {
    return { assets: 0, totalDepreciation: 0, entries: [] };
  }

  const entries: Array<{ id: string; monto: string }> = [];
  let totalDep = 0;

  for (const a of assets) {
    const costo = Number(a.costoAdquisicion);
    const vidaMeses = Number(a.vidaUtilAnos) * 12;
    if (vidaMeses <= 0) continue;

    const monthlyDep = costo / vidaMeses;
    const newValue = Math.max(0, Number(a.valorActualLibros) - monthlyDep);

    // Persist entry
    const [entry] = await db().insert(toolDepreciationEntries).values({
      toolInstanceId: a.id,
      fecha: fechaStr,
      periodo,
      valorInicial: Number(a.valorActualLibros).toFixed(2),
      valorFinal: newValue.toFixed(2),
      montoDepreciacion: monthlyDep.toFixed(2),
      tenantSlug,
    }).returning();

    // Update book value
    await db().update(toolInstances).set({
      valorActualLibros: newValue.toFixed(2),
      ultimaDepreciacion: fechaStr,
      updatedAt: sql`NOW()`,
    }).where(eq(toolInstances.id, a.id));

    entries.push({ id: entry.id, monto: monthlyDep.toFixed(2) });
    totalDep += monthlyDep;
  }

  return { assets: assets.length, totalDepreciation: totalDep, entries };
}

// ─── Depreciación de Activos Fijos ─────────────

/**
 * Calcula y registra la depreciación mensual de activos_fijos.
 */
export async function generateFixedAssetDepreciation(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<{ assets: number; totalDepreciation: number; entries: Array<{ activoId: string; monto: string }> }> {
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;

  // Activos elegibles: ACTIVOS, no depreciados aún este período, con costo > 0
  const activos = await db()
    .select()
    .from(activosFijos)
    .where(
      and(
        eq(activosFijos.tenantSlug, tenantSlug),
        eq(activosFijos.activo, true),
        eq(activosFijos.estado, "ACTIVO"),
        sql`${activosFijos.costoAdquisicion} > 0`,
        sql`${activosFijos.valorActualLibros} > 0`,
        sql`NOT EXISTS (SELECT 1 FROM depreciacion_activos da WHERE da.activo_fijo_id = ${activosFijos.id} AND da.periodo = ${periodo})`,
      ),
    );

  if (activos.length === 0) {
    return { assets: 0, totalDepreciation: 0, entries: [] };
  }

  const entries: Array<{ activoId: string; monto: string }> = [];
  let totalDep = 0;

  for (const a of activos) {
    const costo = Number(a.costoAdquisicion);
    const residual = Number(a.valorResidual);
    const vida = a.vidaUtilAnos;
    const valorActual = Number(a.valorActualLibros);
    const depAcumulada = Number(a.depreciacionAcumulada);

    let monthlyDep: number;
    switch (a.metodoDepreciacion) {
      case "DIGITO_DECRECIENTE": {
        const mesesTranscurridos = Math.floor(depAcumulada / lineaRectaMensual(costo, residual, vida) || 0);
        monthlyDep = digitoDecrecienteMensual(costo, residual, vida, mesesTranscurridos + 1);
        break;
      }
      case "LINEA_RECTA":
      default:
        monthlyDep = lineaRectaMensual(costo, residual, vida);
        break;
    }
    monthlyDep = Math.round(monthlyDep * 100) / 100; // Redondear a 2 decimales

    const newBookValue = Math.max(0, valorActual - monthlyDep);
    const newAccumulated = depAcumulada + monthlyDep;
    const lastDay = new Date(anho, mes, 0);

    // Insert history
    await db().insert(depreciacionActivos).values({
      activoFijoId: a.id,
      periodo,
      fecha: lastDay,
      valorInicial: valorActual.toFixed(2),
      montoDepreciacion: monthlyDep.toFixed(2),
      valorFinal: newBookValue.toFixed(2),
      depreciacionAcumulada: newAccumulated.toFixed(2),
      tenantSlug,
    });

    // Update activo
    await db()
      .update(activosFijos)
      .set({
        valorActualLibros: newBookValue.toFixed(2),
        depreciacionAcumulada: newAccumulated.toFixed(2),
        ultimaDepreciacion: lastDay,
        updatedAt: sql`NOW()`,
      })
      .where(eq(activosFijos.id, a.id));

    entries.push({ activoId: a.id, monto: monthlyDep.toFixed(2) });
    totalDep += monthlyDep;
  }

  return { assets: activos.length, totalDepreciation: totalDep, entries };
}

// ─── Asiento Contable Consolidado ──────────────

/**
 * Genera un asiento contable consolidado con toda la depreciación
 * del período (tool_instances + activos_fijos).
 *
 * Débito: Gasto Depreciación (6.3.x)
 * Crédito: Depreciación Acumulada (1.2.x)
 */
export async function createDepreciationAsiento(
  tenantSlug: string,
  anho: number,
  mes: number,
  toolDepTotal: number = 0,
  fixedDepTotal: number = 0,
): Promise<{ asientoId: string; asientoNumero: number } | null> {
  const total = toolDepTotal + fixedDepTotal;
  if (total <= 0) return null;

  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;
  const lastDay = new Date(anho, mes, 0);

  // Resolver cuentas contables
  const cuentaGasto = await resolveCuenta("6.3.01");       // Gasto Depreciación (genérica)
  const cuentaAcumulada = await resolveCuenta("1.2.99");   // Depreciación Acumulada (auxiliar)

  const num = await nextNumero(lastDay);

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha: lastDay,
      concepto: `Depreciación del Período - ${periodo} (Herramientas: ₲${toolDepTotal.toFixed(2)}, Activos Fijos: ₲${fixedDepTotal.toFixed(2)})`,
      estado: "CONTABILIZADO",
      totalDebe: total.toFixed(2),
      totalHaber: total.toFixed(2),
      diferencia: "0",
      moduloOrigen: "DEPRECIACION",
    })
    .returning();

  // Líneas del asiento
  await db().insert(asientosDetalle).values([
    {
      asientoId: asiento.id,
      cuentaId: cuentaGasto,
      numeroLinea: 1,
      debe: total.toFixed(2),
      haber: null,
      descripcion: `Depreciación ${periodo}`,
    },
    {
      asientoId: asiento.id,
      cuentaId: cuentaAcumulada,
      numeroLinea: 2,
      debe: null,
      haber: total.toFixed(2),
      descripcion: `Depreciación Acumulada ${periodo}`,
    },
  ]);

  // Vincular asiento a las entradas de depreciación de activos fijos
  await db()
    .update(depreciacionActivos)
    .set({ asientoId: asiento.id })
    .where(and(
      eq(depreciacionActivos.tenantSlug, tenantSlug),
      eq(depreciacionActivos.periodo, periodo),
      sql`${depreciacionActivos.asientoId} IS NULL`,
    ));

  return { asientoId: asiento.id, asientoNumero: asiento.numero };
}

// ─── Depreciación Completa del Período ─────────

/**
 * Ejecuta el proceso completo de depreciación mensual:
 * 1. Depreciar tool_instances (inventario)
 * 2. Depreciar activos_fijos (finance)
 * 3. Generar asiento contable consolidado
 */
export async function runMonthlyDepreciation(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<DepreciationResult> {
  // 1. Tool depreciation
  const toolResult = await generateToolDepreciation(tenantSlug, anho, mes);

  // 2. Fixed asset depreciation
  const fixedResult = await generateFixedAssetDepreciation(tenantSlug, anho, mes);

  // 3. Create consolidated entry
  const total = toolResult.totalDepreciation + fixedResult.totalDepreciation;
  if (total <= 0) {
    return {
      success: true,
      totalDepreciacion: 0,
      toolAssetsCount: 0,
      fixedAssetsCount: 0,
      asientoId: null,
      asientoNumero: null,
      periodo: `${anho}-${String(mes).padStart(2, "0")}`,
    };
  }

  const asiento = await createDepreciationAsiento(
    tenantSlug, anho, mes,
    toolResult.totalDepreciation,
    fixedResult.totalDepreciation,
  );

  return {
    success: true,
    totalDepreciacion: total,
    toolAssetsCount: toolResult.assets,
    fixedAssetsCount: fixedResult.assets,
    asientoId: asiento?.asientoId ?? null,
    asientoNumero: asiento?.asientoNumero ?? null,
    periodo: `${anho}-${String(mes).padStart(2, "0")}`,
  };
}

// ─── CRUD Activos Fijos ────────────────────────

export async function createFixedAsset(
  tenantSlug: string,
  data: CreateFixedAssetRequest,
) {
  const costo = data.costoAdquisicion;
  const residual = data.valorResidual ?? 0;

  const [asset] = await db()
    .insert(activosFijos)
    .values({
      tenantSlug,
      codigo: data.codigo,
      nombre: data.nombre,
      tipo: data.tipo as any,
      marca: data.marca ?? null,
      modelo: data.modelo ?? null,
      numeroSerie: data.numeroSerie ?? null,
      fechaAdquisicion: new Date(data.fechaAdquisicion),
      costoAdquisicion: String(costo),
      valorResidual: String(residual),
      vidaUtilAnos: data.vidaUtilAnos,
      metodoDepreciacion: (data.metodoDepreciacion ?? "LINEA_RECTA") as any,
      valorActualLibros: String(costo),
      notas: data.notas ?? null,
      // Default accounts by type
      ...(CUENTAS_POR_TIPO[data.tipo] ? {
        cuentaGastoDepreciacionId: await resolveCuenta(CUENTAS_POR_TIPO[data.tipo]!.gasto).catch(() => null),
        cuentaDepreciacionAcumuladaId: await resolveCuenta(CUENTAS_POR_TIPO[data.tipo]!.acumulada).catch(() => null),
      } : {}),
    })
    .returning();

  return asset;
}

export async function listFixedAssets(tenantSlug: string) {
  return db()
    .select()
    .from(activosFijos)
    .where(eq(activosFijos.tenantSlug, tenantSlug))
    .orderBy(activosFijos.codigo);
}

export async function getFixedAsset(id: string, tenantSlug: string) {
  const [asset] = await db()
    .select()
    .from(activosFijos)
    .where(and(eq(activosFijos.id, id), eq(activosFijos.tenantSlug, tenantSlug)))
    .limit(1);
  return asset ?? null;
}
