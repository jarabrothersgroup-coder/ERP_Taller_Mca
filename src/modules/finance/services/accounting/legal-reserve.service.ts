/**
 * Legal Reserve Service — Reserva Legal (Ley 1034/83).
 *
 * Calcula y contabiliza la reserva legal obligatoria del 5% de la
 * renta neta del ejercicio, conforme al Artículo 22 de la Ley 1034/83.
 *
 * Débito: Ganancias Retenidas (3.4.x) / Resultados Acumulados
 * Crédito: Reserva Legal (3.5.x)
 *
 * La reserva se constituye anualmente y solo puede utilizarse para:
 *   - Absorber pérdidas acumuladas
 *   - Aumentar el capital social
 *   - Cumplir con disposiciones legales
 *
 * @module finance/services/accounting/legal-reserve.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas, asientosContables, asientosDetalle } from "../../schema/index.js";
import { liquidacionesIre, periodosFiscales } from "../../schema/index.js";
import { eq, and, sql, desc } from "drizzle-orm";

// ─── Interfaces ────────────────────────────────

export interface LegalReserveRequest {
  /** Año fiscal */
  anho: number;
}

export interface LegalReserveResult {
  success: boolean;
  periodo: string;
  rentaNeta: number;
  reservaLegalCalculada: number;
  reservaAcumulada: number;
  asientoId: string | null;
  asientoNumero: number | null;
}

// ─── Core ──────────────────────────────────────

const TASA_RESERVA_LEGAL = 0.05; // 5% Ley 1034/83

/**
 * Constituye la reserva legal anual.
 *
 * Calcula el 5% de la renta neta del ejercicio y genera el asiento
 * de apropiación: Ganancias Retenidas → Reserva Legal.
 *
 * @throws Si no existe liquidación de IRE para el año
 * @throws Si la reserva ya fue constituida para el período
 */
export async function constituirReservaLegal(
  tenantSlug: string,
  data: LegalReserveRequest,
): Promise<LegalReserveResult> {
  const { anho } = data;
  const periodo = `${anho}`;

  // 1. Verificar que exista liquidación de IRE para el año
  const [liquidacion] = await db()
    .select({
      id: liquidacionesIre.id,
      rentaNeta: liquidacionesIre.rentaNeta,
      reservaLegal: liquidacionesIre.reservaLegal,
    })
    .from(liquidacionesIre)
    .innerJoin(periodosFiscales, eq(liquidacionesIre.periodoFiscalId, periodosFiscales.id))
    .where(and(eq(periodosFiscales.anho, anho), eq(liquidacionesIre.tenantSlug, tenantSlug)))
    .orderBy(desc(liquidacionesIre.createdAt))
    .limit(1);

  if (!liquidacion) {
    throw new Error(`No hay liquidación de IRE para el ejercicio ${anho}. Calcule el IRE primero.`);
  }

  const rentaNeta = parseFloat(liquidacion.rentaNeta ?? "0");
  if (rentaNeta <= 0) {
    return {
      success: true, periodo, rentaNeta: 0, reservaLegalCalculada: 0,
      reservaAcumulada: 0, asientoId: null, asientoNumero: null,
    };
  }

  const reservaLegalCalculada = Math.round(rentaNeta * TASA_RESERVA_LEGAL * 100) / 100;

  // 2. Verificar que no exista ya un asiento de reserva legal para el período
  const [existing] = await db()
    .select({ id: asientosContables.id })
    .from(asientosContables)
    .where(
      and(
        eq(asientosContables.moduloOrigen, "RESERVA_LEGAL"),
        sql`EXTRACT(YEAR FROM ${asientosContables.fecha}) = ${anho}`,
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error(`La reserva legal del ejercicio ${anho} ya fue constituida (asiento #${existing.id.slice(0, 8)})`);
  }

  // 3. Obtener cuentas contables
  const [cuentaGananciasRetenidas] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '3.4.%'`, eq(planCuentas.activo, true)))
    .limit(1);

  const [cuentaReservaLegal] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '3.5.%'`, eq(planCuentas.activo, true)))
    .limit(1);

  if (!cuentaGananciasRetenidas || !cuentaReservaLegal) {
    throw new Error(
      "No se encontraron las cuentas contables necesarias. " +
      "Verifique que existan cuentas 3.4.x (Ganancias Retenidas) y 3.5.x (Reserva Legal)",
    );
  }

  // 4. Generar asiento
  const fecha = new Date(anho, 11, 31); // 31-dic del ejercicio
  const num = await nextNumero(fecha, anho);
  const monto = reservaLegalCalculada.toFixed(2);

  const [asiento] = await db()
    .insert(asientosContables)
    .values({
      numero: num,
      fecha,
      concepto: `Constitución de Reserva Legal - Ejercicio ${anho} (5% de ₲${rentaNeta.toFixed(2)})`,
      estado: "CONTABILIZADO",
      totalDebe: monto,
      totalHaber: monto,
      diferencia: "0",
      moduloOrigen: "RESERVA_LEGAL",
    })
    .returning();

  // Débito: Ganancias Retenidas / Crédito: Reserva Legal
  await db().insert(asientosDetalle).values([
    {
      asientoId: asiento.id,
      cuentaId: cuentaGananciasRetenidas.id,
      numeroLinea: 1,
      debe: monto,
      descripcion: `Reserva Legal ${anho} (5% × ₲${rentaNeta.toFixed(2)})`,
    },
    {
      asientoId: asiento.id,
      cuentaId: cuentaReservaLegal.id,
      numeroLinea: 2,
      haber: monto,
      descripcion: `Reserva Legal ${anho}`,
    },
  ]);

  // 5. Calcular reserva acumulada histórica
  const [acumulado] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.haber}::numeric, 0)), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .where(
      and(
        eq(asientosContables.moduloOrigen, "RESERVA_LEGAL"),
        eq(asientosContables.estado, "CONTABILIZADO"),
        eq(asientosDetalle.cuentaId, cuentaReservaLegal.id),
      ),
    );

  const reservaAcumulada = Number(acumulado?.total ?? 0) + reservaLegalCalculada;

  return {
    success: true,
    periodo,
    rentaNeta,
    reservaLegalCalculada,
    reservaAcumulada,
    asientoId: asiento.id,
    asientoNumero: asiento.numero,
  };
}

/** Obtiene el saldo actual de reserva legal */
export async function getReservaLegalSaldo(): Promise<number> {
  const [cuenta] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(and(sql`${planCuentas.codigo} LIKE '3.5.%'`, eq(planCuentas.activo, true)))
    .limit(1);

  if (!cuenta) return 0;

  const [result] = await db()
    .select({
      total: sql<number>`COALESCE(SUM(COALESCE(${asientosDetalle.haber}::numeric, 0) - COALESCE(${asientosDetalle.debe}::numeric, 0)), 0)`,
    })
    .from(asientosDetalle)
    .innerJoin(asientosContables, eq(asientosDetalle.asientoId, asientosContables.id))
    .where(
      and(
        eq(asientosDetalle.cuentaId, cuenta.id),
        eq(asientosContables.estado, "CONTABILIZADO"),
      ),
    );

  return Number(result?.total ?? 0);
}

async function nextNumero(_fecha: Date, anho: number): Promise<number> {
  const [max] = await db()
    .select({ max: sql<number>`COALESCE(MAX(numero), 0)` })
    .from(asientosContables)
    .where(sql`EXTRACT(YEAR FROM ${asientosContables.fecha}) = ${anho}`);
  return (max?.max ?? 0) + 1;
}
