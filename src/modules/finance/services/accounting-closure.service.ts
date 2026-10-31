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
} from "../../../shared/database/schema/index.js";
import { ValidationError } from "../../../shared/errors/app-error.js";
import { resolvePostingAccount } from "./accounting/account-resolver.js";

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

      // ── 4. Resolve chart-of-account IDs BEFORE writing the header ──
      // Solo cuentas de movimiento: resolver una agrupadora (`1.1.01`,
      // `4.1.01`) insertaba detalle en cuentas de consolidación, y si el
      // código no existía el cierre quedaba con cabecera «balanceada»
      // pero sin líneas de detalle.
      let cajaCuentaId: string;
      let ingresosCuentaId: string;
      try {
        [cajaCuentaId, ingresosCuentaId] = await Promise.all([
          resolvePostingAccount({
            codigos: ["1.1.1.01", "1.1.01.001", "1.1.01"],
            prefijos: ["1.1.1.", "1.1.01."],
            etiqueta: "caja/bancos del cierre mensual",
          }),
          resolvePostingAccount({
            codigos: ["4.1.1.01", "4.1.01.001", "4.1.01"],
            prefijos: ["4.1.1.", "4.1.01.", "4.1."],
            etiqueta: "ingresos del cierre mensual",
          }),
        ]);
      } catch (err) {
        throw new ValidationError(
          `No se puede ejecutar el cierre ${periodo}: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }

      // ── 5. Create journal entry header (asiento contable) ──
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

      // ── 6. Create double-entry detail lines (siempre 2, balanceadas) ──
      await tx.insert(asientosDetalle).values([
        {
          asientoId: asiento.id,
          numeroLinea: 1,
          cuentaId: cajaCuentaId,
          debe: String(totalMes),
          haber: null,
          descripcion: `Ingreso por ventas del periodo ${periodo}`,
        },
        {
          asientoId: asiento.id,
          numeroLinea: 2,
          cuentaId: ingresosCuentaId,
          debe: null,
          haber: String(totalMes),
          descripcion: `Reconocimiento de ingresos del periodo ${periodo}`,
        },
      ]);

      return {
        periodo,
        totalConsolidado: totalMes,
        asientoId: asiento.id,
        status: "CLOSED_SUCCESS" as const,
      };
    });
  }
}
