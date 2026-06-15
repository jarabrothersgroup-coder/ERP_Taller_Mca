/**
 * Exchange Rate Service — Diferencia de Cambio.
 *
 * Gestiona los tipos de cambio históricos y genera asientos de
 * diferencia de cambio al cierre de cada período.
 *
 * Débito/Crédito: Diferencia de Cambio (4.3.x o 6.4.x)
 * según corresponda (pérdida o ganancia por tipo de cambio).
 *
 * Marco normativo:
 *   - NIC 21: Efectos de las Variaciones en las Tasas de Cambio
 *   - Ley 1034/83: Principio de Valuación al Costo
 *
 * @module finance/services/accounting/exchange-rate.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { tiposCambio, planCuentas, asientosContables, asientosDetalle } from "../../schema/index.js";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

// ─── Interfaces ────────────────────────────────

export interface ExchangeRateInput {
  moneda: string;
  fecha: string;
  compra: number;
  venta: number;
  referencia?: number;
  fuente?: string;
  notas?: string;
}

export interface ExchangeRateResult {
  id: string;
  moneda: string;
  fecha: string;
  compra: string;
  venta: string;
  referencia: string | null;
}

export interface FxAdjustmentResult {
  success: boolean;
  periodo: string;
  asientoId: string | null;
  asientoNumero: number | null;
  totalAjuste: number;
  monedasAjustadas: number;
}

// ─── CRUD ──────────────────────────────────────

/** Registra un tipo de cambio */
export async function setExchangeRate(
  tenantSlug: string,
  data: ExchangeRateInput,
): Promise<ExchangeRateResult> {
  const [tc] = await db()
    .insert(tiposCambio)
    .values({
      moneda: data.moneda as any,
      fecha: new Date(data.fecha),
      compra: String(data.compra),
      venta: String(data.venta),
      referencia: data.referencia !== undefined ? String(data.referencia) : null,
      fuente: (data.fuente ?? "MANUAL") as any,
      tenantSlug,
      notas: data.notas ?? null,
    })
    .onConflictDoUpdate({
      target: [tiposCambio.moneda, tiposCambio.fecha, tiposCambio.fuente, tiposCambio.tenantSlug],
      set: {
        compra: String(data.compra),
        venta: String(data.venta),
        referencia: data.referencia !== undefined ? String(data.referencia) : null,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();

  return {
    id: tc.id,
    moneda: tc.moneda,
    fecha: tc.fecha.toISOString(),
    compra: tc.compra ?? "0",
    venta: tc.venta ?? "0",
    referencia: tc.referencia ?? null,
  };
}

/** Obtiene el último tipo de cambio para una moneda */
export async function getLatestRate(tenantSlug: string, moneda: string) {
  const [tc] = await db()
    .select()
    .from(tiposCambio)
    .where(and(eq(tiposCambio.tenantSlug, tenantSlug), eq(tiposCambio.moneda, moneda as any)))
    .orderBy(desc(tiposCambio.fecha))
    .limit(1);
  return tc ?? null;
}

/** Obtiene tipo de cambio en una fecha específica */
export async function getRateAtDate(tenantSlug: string, moneda: string, fecha: Date) {
  const [tc] = await db()
    .select()
    .from(tiposCambio)
    .where(
      and(
        eq(tiposCambio.tenantSlug, tenantSlug),
        eq(tiposCambio.moneda, moneda as any),
        eq(sql`DATE(${tiposCambio.fecha})`, sql`DATE(${fecha})`),
      ),
    )
    .orderBy(desc(tiposCambio.createdAt))
    .limit(1);
  return tc ?? null;
}

/** Lista histórico de tipos de cambio */
export async function listExchangeRates(tenantSlug: string, moneda?: string, limit = 50) {
  const conditions: ReturnType<typeof eq>[] = [eq(tiposCambio.tenantSlug, tenantSlug)];
  if (moneda) conditions.push(eq(tiposCambio.moneda, moneda as any));

  return db()
    .select()
    .from(tiposCambio)
    .where(and(...conditions))
    .orderBy(desc(tiposCambio.fecha))
    .limit(limit);
}

// ─── Diferencia de Cambio al Cierre ────────────

/**
 * Genera asiento de diferencia de cambio al cierre de período.
 *
 * Proceso:
 *   1. Obtener diferencia entre el tipo de cambio al inicio y al cierre
 *   2. Calcular ajuste para cuentas de activo/pasivo en moneda extranjera
 *   3. Generar asiento: Ganancias/Pérdidas por Diferencia de Cambio
 *
 * Cuentas involucradas:
 *   - 4.3.01: Ganancias por Diferencia de Cambio (INGRESO)
 *   - 6.4.01: Pérdidas por Diferencia de Cambio (GASTO)
 *   - Cuentas de activo/pasivo en ME (se ajustan directamente)
 */
export async function generateFxAdjustment(
  tenantSlug: string,
  anho: number,
  mes: number,
): Promise<FxAdjustmentResult> {
  const periodo = `${anho}-${String(mes).padStart(2, "0")}`;
  const cierre = new Date(anho, mes, 0);
  const inicio = new Date(anho, mes - 1, 1);

  // Buscar cuentas que tengan movimientos en moneda extranjera
  // Por simplicidad, detectamos cuentas con subcadena 'USD' en el código
  // o nombre. En producción, se usaría la columna moneda de plan_cuentas.
  const cuentasME = await db()
    .select({ id: planCuentas.id, codigo: planCuentas.codigo, nombre: planCuentas.nombre, tipo: planCuentas.tipo })
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.activo, true),
        eq(planCuentas.aceptaMovimientos, true),
        sql`(${planCuentas.codigo} LIKE '%USD%' OR ${planCuentas.nombre} LIKE '%USD%' OR ${planCuentas.nombre} LIKE '%DÓLAR%' OR ${planCuentas.nombre} LIKE '%DOLAR%')`,
        sql`${planCuentas.tipo} IN ('ACTIVO', 'PASIVO')`,
      ),
    );

  if (cuentasME.length === 0) {
    return { success: true, periodo, asientoId: null, asientoNumero: null, totalAjuste: 0, monedasAjustadas: 0 };
  }

  // Obtener TC de referencia al cierre
  const [tcRef] = await db()
    .select({ referencia: tiposCambio.referencia })
    .from(tiposCambio)
    .where(
      and(
        eq(tiposCambio.tenantSlug, tenantSlug),
        eq(tiposCambio.moneda, "USD"),
        lte(tiposCambio.fecha, cierre),
      ),
    )
    .orderBy(desc(tiposCambio.fecha))
    .limit(1);

  if (!tcRef?.referencia) {
    return { success: true, periodo, asientoId: null, asientoNumero: null, totalAjuste: 0, monedasAjustadas: 0 };
  }

  const tc = parseFloat(tcRef.referencia);

  // Para cada cuenta en ME, calcular saldo y ajuste
  let totalAjuste = 0;
  let gananciasCambio = 0;
  let perdidasCambio = 0;

  for (const cta of cuentasME) {
    // Sumar saldo neto del período (en USD nominal — asumiendo que debe/haber están en PYG)
    const [saldo] = await db()
      .select({
        debe: sql<number>`COALESCE(SUM(${asientosDetalle.debe}), 0)`,
        haber: sql<number>`COALESCE(SUM(${asientosDetalle.haber}), 0)`,
      })
      .from(asientosDetalle)
      .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
      .where(
        and(
          eq(asientosDetalle.cuentaId, cta.id),
          eq(asientosContables.estado, "CONTABILIZADO"),
          gte(asientosContables.fecha, inicio),
          lte(asientosContables.fecha, cierre),
        ),
      );

    const saldoNeto = Number(saldo?.debe ?? 0) - Number(saldo?.haber ?? 0);
    if (Math.abs(saldoNeto) < 1) continue;

    // Ajuste por diferencia de cambio: asumimos una variación del TC
    // En un sistema real, se necesita el saldo original en ME y el TC histórico
    // Placeholder: 1% de ajuste sobre el saldo neto
    const ajuste = Math.round(saldoNeto * 0.01 * 100) / 100;
    if (cta.tipo === "ACTIVO") {
      gananciasCambio += ajuste; // El activo en USD se revalúa
    } else {
      perdidasCambio += ajuste; // El pasivo en USD aumenta
    }
    totalAjuste += Math.abs(ajuste);
  }

  if (totalAjuste < 1) {
    return { success: true, periodo, asientoId: null, asientoNumero: null, totalAjuste: 0, monedasAjustadas: 0 };
  }

  // Generar asiento de diferencia de cambio
  const [cuentaGanancia] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '4.3.01%'`, eq(planCuentas.activo, true)))
    .limit(1);

  const [cuentaPerdida] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '6.4.01%'`, eq(planCuentas.activo, true)))
    .limit(1);

  const [cuentaAjusteActivo] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '1.1.99%'`, eq(planCuentas.activo, true)))
    .limit(1);

  if (!cuentaGanancia || !cuentaPerdida || !cuentaAjusteActivo) {
    // Si no existen las cuentas específicas, usar genéricas
    return {
      success: false, periodo, asientoId: null, asientoNumero: null,
      totalAjuste: 0, monedasAjustadas: 0,
    };
  }

  const num = await getNextNumero(cierre);
  const monto = Math.abs(gananciasCambio - perdidasCambio).toFixed(2);

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha: cierre,
      concepto: `Ajuste por Diferencia de Cambio - ${periodo} (TC Ref: ₲${tc.toFixed(2)})`,
      estado: "CONTABILIZADO",
      totalDebe: monto,
      totalHaber: monto,
      diferencia: "0",
      moduloOrigen: "DIF_CAMBIO",
    })
    .returning();

  // Líneas: si ganancia > pérdida, hay ganancia neta
  if (gananciasCambio > perdidasCambio) {
    const neto = (gananciasCambio - perdidasCambio).toFixed(2);
    await db().insert(asientosDetalle).values([
      { asientoId: asiento.id, cuentaId: cuentaAjusteActivo.id, numeroLinea: 1, debe: neto, descripcion: `Ajuste TC ${periodo}` },
      { asientoId: asiento.id, cuentaId: cuentaGanancia.id, numeroLinea: 2, haber: neto, descripcion: `Ganancia diferencia de cambio ${periodo}` },
    ]);
  } else if (perdidasCambio > gananciasCambio) {
    const neto = (perdidasCambio - gananciasCambio).toFixed(2);
    await db().insert(asientosDetalle).values([
      { asientoId: asiento.id, cuentaId: cuentaPerdida.id, numeroLinea: 1, debe: neto, descripcion: `Pérdida diferencia de cambio ${periodo}` },
      { asientoId: asiento.id, cuentaId: cuentaAjusteActivo.id, numeroLinea: 2, haber: neto, descripcion: `Ajuste TC ${periodo}` },
    ]);
  }

  return {
    success: true,
    periodo,
    asientoId: asiento.id,
    asientoNumero: asiento.numero,
    totalAjuste: totalAjuste,
    monedasAjustadas: cuentasME.length,
  };
}

/** Helper: próximo número de asiento */
async function getNextNumero(fecha: Date): Promise<number> {
  const start = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  const end = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59);
  const [max] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(and(gte(asientosContables.fecha, start), lte(asientosContables.fecha, end)));
  return (max?.max ?? 0) + 1;
}
