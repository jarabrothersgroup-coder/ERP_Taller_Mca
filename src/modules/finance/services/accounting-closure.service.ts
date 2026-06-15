/**
 * Accounting Closure Service — Monthly Consolidated Close (ACC-001).
 *
 * Aggregates all invoices (MANUAL + ELECTRONICA) for a given month
 * using PostgreSQL `SUM()` via Drizzle ORM — no data loaded into the Node.js heap.
 * Generates a double-entry journal entry (asiento contable) with:
 *   - Debit to Operating Cash / Accounts Receivable (activo incrementa)
 *   - Credit to Service Revenue (ingreso reconocido)
 *
 * Multi-tenant: each close runs within a tenant scope.
 *
 * @module finance/services/accounting-closure.service
 */

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import {
  facturas,
  asientosContables,
  asientosDetalle,
  planCuentas,
} from "../../../shared/database/schema/index.js";

export interface ClosureResult {
  periodo: string;
  totalConsolidado: number;
  asientoId: string;
  status: "CLOSED_SUCCESS";
}

export class AccountingClosureService {
  /**
   * Executes the monthly accounting closure for a tenant.
   *
   * Steps:
   *   1. Aggregate all invoice totals for the period (RAM-safe SQL SUM)
   *   2. Auto-generate a CONTABILIZADO journal entry with double-entry lines
   *
   * @param tenantSlug - Tenant identifier
   * @param year       - Fiscal year (e.g. 2026)
   * @param month      - Fiscal month (1-12)
   * @returns Closure summary with consolidated total and journal entry ID
   * @throws Error if no transactions exist for the period
   */
  public static async executeMonthlyClosure(
    tenantSlug: string,
    year: number,
    month: number,
  ): Promise<ClosureResult> {
    // ── 1. Date range for the period ──────────────────
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const periodo = `${year}-${String(month).padStart(2, "0")}`;

    return await db().transaction(async (tx) => {
      // ── 2. Aggregate totals directly in PostgreSQL ──
      // COALESCE ensures 0 instead of NULL when no rows match
      const [metrics] = await tx
        .select({
          ingresoTotal: sql<number>`COALESCE(SUM(${facturas.total}::numeric), 0)`,
        })
        .from(facturas)
        .where(
          and(
            eq(facturas.tenantSlug, tenantSlug),
            gte(facturas.createdAt, startDate),
            lte(facturas.createdAt, endDate),
          ),
        );

      const totalMes = Number(metrics?.ingresoTotal || 0);

      if (totalMes === 0) {
        throw new Error(
          `No se registraron transacciones comerciales para el periodo ${periodo}.`,
        );
      }

      // ── 3. Determine next sequential numero ──
      const [lastEntry] = await tx
        .select({ maxNum: sql<number>`COALESCE(MAX(${asientosContables.numero}), 0)` })
        .from(asientosContables);

      const nextNumero = (lastEntry?.maxNum ?? 0) + 1;

      // ── 4. Create journal entry header (asiento contable) ──
      const [asiento] = await tx
        .insert(asientosContables)
        .values({
          numero: nextNumero,
          fecha: endDate,
          concepto: `Cierre Contable Mensual Automatizado - Ventas Consolidadas (Híbrido Manual/DTE) - ${periodo}`,
          estado: "CONTABILIZADO",
          totalDebe: String(totalMes),
          totalHaber: String(totalMes),
          diferencia: "0",
          moduloOrigen: "CIERRE_MENSUAL",
          documentoRef: `CIERRE-${periodo}`,
        })
        .returning();

      // ── 5. Look up chart-of-account IDs for the entry lines ──
      // These accounts must exist in the plan_cuentas table.
      // Codigos: 1.1.01 = Caja/Banco (activo), 4.1.01 = Ingresos por Servicios
      const [cajaCuenta, ingresosCuenta] = await Promise.all([
        tx
          .select({ id: planCuentas.id })
          .from(planCuentas)
          .where(eq(planCuentas.codigo, "1.1.01"))
          .limit(1)
          .then((r) => r[0]),
        tx
          .select({ id: planCuentas.id })
          .from(planCuentas)
          .where(eq(planCuentas.codigo, "4.1.01"))
          .limit(1)
          .then((r) => r[0]),
      ]);

      // ── 6. Create double-entry detail lines ──
      const lineas = [];

      if (cajaCuenta) {
        lineas.push({
          asientoId: asiento.id,
          numeroLinea: 1,
          cuentaId: cajaCuenta.id,
          debe: String(totalMes),
          haber: null,
          descripcion: `Ingreso por ventas del periodo ${periodo}`,
        });
      }

      if (ingresosCuenta) {
        lineas.push({
          asientoId: asiento.id,
          numeroLinea: 2,
          cuentaId: ingresosCuenta.id,
          debe: null,
          haber: String(totalMes),
          descripcion: `Reconocimiento de ingresos del periodo ${periodo}`,
        });
      }

      if (lineas.length > 0) {
        await tx.insert(asientosDetalle).values(lineas);
      }

      return {
        periodo,
        totalConsolidado: totalMes,
        asientoId: asiento.id,
        status: "CLOSED_SUCCESS" as const,
      };
    });
  }
}
