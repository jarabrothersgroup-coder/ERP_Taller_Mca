/**
 * Payroll Routes — nómina, equilibrio y comisiones (T-45 · FIN-07).
 *
 * `payroll_summary` y `commission_records` cuelgan de `tenants.id` mediante
 * `tenant_id`, NO de un slug. Antes de T-45 los listados de historial y
 * comisiones no filtraban por tenant: cualquier taller autenticado recibía
 * los números de nómina de todos los demás. Todas las consultas de este
 * archivo resuelven el `tenant_id` de la request y filtran por él.
 *
 * @module finance/routes/payroll-routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../../../shared/database/connection.js";
import { db } from "../../../shared/database/drizzle.js";
import {
  calculateMonthlyCommissions,
  checkWorkshopEquilibrium,
  getBreakevenProgress,
} from "../services/FinancialOrchestratorService.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../../shared/errors/app-error.js";
import { emit, resolveAccount } from "../services/index.js";
import { AccountingBusCodes } from "./accounting-bus-codes.js";
import { asientosContables, commissionRecords, payrollSummary } from "../schema/index.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireManager } from "../../../shared/middleware/rbac.js";
import { resolveTenantId } from "../../../shared/utils/tenant-email.js";

/** Resuelve el `tenants.id` del tenant de la request. */
async function tenantIdDe(request: FastifyRequest): Promise<string> {
  const tenantId = await resolveTenantId(request.tenantSlug);
  if (!tenantId) {
    throw new NotFoundError("Tenant no encontrado");
  }
  return tenantId;
}

/** Valida un período (mes 1-12, año 2020-2100). */
function validarPeriodo(month: unknown, year: unknown): { mes: number; anio: number } {
  const mes = Number(month);
  const anio = Number(year);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new ValidationError("Mes inválido (1-12)");
  }
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    throw new ValidationError("Año inválido (2020-2100)");
  }
  return { mes, anio };
}

export async function payrollRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/finance/payroll/calculate", async (request: FastifyRequest, reply: FastifyReply) => {
    const slug = request.tenantSlug;
    const { month, year } = request.body as { month?: number; year?: number };
    const now = new Date();
    const { mes: targetMonth, anio: targetYear } = validarPeriodo(
      month ?? now.getMonth() + 1,
      year ?? now.getFullYear(),
    );

    const commissions = await calculateMonthlyCommissions(slug, targetMonth, targetYear);
    const equilibrium = await checkWorkshopEquilibrium(slug, targetMonth, targetYear);

    // ── Auto NÓMINA: generate accounting entry via Accounting Bus ──
    // Graceful degradation — if accounting fails, payroll is still valid
    try {
      const rawDb = getDb();
      const [tenantRow] = await rawDb`SELECT id FROM public.tenants WHERE slug = ${slug}`;
      if (!tenantRow) {
        throw new Error(`Tenant not found: ${slug}`);
      }

      // ── Dedup: skip if asiento already exists for this period ──
      const documentoRef = `nomina_mensual:payroll_${targetYear}_${targetMonth}`;
      const [existing] = await db()
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(asientosContables)
        .where(
          and(
            eq(asientosContables.documentoRef, documentoRef),
            eq(asientosContables.estado, "CONTABILIZADO"),
          ),
        );
      if (existing?.count && existing.count > 0) {
        request.log.info(
          { documentoRef, count: existing.count },
          "[accounting-bus] Auto NÓMINA saltado — ya existe asiento para este período",
        );
      } else {
        const [totals] = await rawDb`
          SELECT
            COALESCE(SUM(COALESCE(labor_amount, 0)), 0) as "totalLabor",
            COALESCE(SUM(COALESCE(commission_amount, 0)), 0) as "totalCommission"
          FROM public.commission_records
          WHERE tenant_id = ${tenantRow.id}
            AND month = ${targetMonth}
            AND year = ${targetYear}
        `;
        const totalSalary = (Number(totals?.totalLabor ?? 0) + Number(totals?.totalCommission ?? 0));

        if (totalSalary > 0) {
          const ctaGastoId = await resolveAccount(AccountingBusCodes.GASTO_SUELDOS);
          const ctaPagarId = await resolveAccount(AccountingBusCodes.SALARIOS_X_PAGAR);

          if (ctaGastoId && ctaPagarId) {
            emit({
              tenantSlug: slug,
              tipo: "NOMINA",
              fecha: new Date(targetYear, targetMonth - 1, 1),
              referenciaId: `payroll_${targetYear}_${targetMonth}`,
              referenciaTipo: "nomina_mensual",
              descripcion: `Nómina mensual ${targetMonth}/${targetYear} — Comisiones y Mano de Obra`,
              lineas: [
                { cuentaId: ctaGastoId, debe: totalSalary, descripcion: "Sueldos y comisiones del período" },
                { cuentaId: ctaPagarId, haber: totalSalary, descripcion: "Sueldos y comisiones por pagar" },
              ],
            }).catch((err) =>
              request.log.warn({ err }, "[accounting-bus] Auto NÓMINA falló (no bloqueante)"),
            );
          }
        }
      }
    } catch (err) {
      request.log.warn({ err }, "[accounting-bus] Auto NÓMINA: error al generar asiento (no bloqueante)");
    }

    return reply.send({
      ok: true,
      month: targetMonth,
      year: targetYear,
      commissionsCreated: commissions.created,
      ...equilibrium,
    });
  });

  app.get("/api/v1/finance/dashboard/break-even", async (request: FastifyRequest, reply: FastifyReply) => {
    const slug = request.tenantSlug;
    const progress = await getBreakevenProgress(slug);

    return reply.send({
      ok: true,
      ...progress,
    });
  });

  /**
   * GET /api/v1/finance/payroll/history
   * Resúmenes de nómina del tenant, del año más reciente al más antiguo.
   */
  app.get("/api/v1/finance/payroll/history", async (request, reply) => {
    const tenantId = await tenantIdDe(request);
    const { year } = request.query as { year?: string };

    const conditions = [eq(payrollSummary.tenantId, tenantId)];
    if (year) {
      const anio = Number(year);
      if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
        throw new ValidationError("Año inválido (2020-2100)");
      }
      conditions.push(eq(payrollSummary.year, anio));
    }

    const rows = await db()
      .select()
      .from(payrollSummary)
      .where(and(...conditions))
      .orderBy(desc(payrollSummary.year), desc(payrollSummary.month))
      .limit(24);

    return reply.send(rows);
  });

  /**
   * GET /api/v1/finance/payroll/summary?month=X&year=Y
   * Resumen de un período concreto (404 si aún no se calculó).
   */
  app.get("/api/v1/finance/payroll/summary", async (request, reply) => {
    const tenantId = await tenantIdDe(request);
    const now = new Date();
    const { month, year } = request.query as { month?: string; year?: string };
    const { mes, anio } = validarPeriodo(
      month ?? now.getMonth() + 1,
      year ?? now.getFullYear(),
    );

    const [row] = await db()
      .select()
      .from(payrollSummary)
      .where(
        and(
          eq(payrollSummary.tenantId, tenantId),
          eq(payrollSummary.month, mes),
          eq(payrollSummary.year, anio),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundError(
        `No hay resumen de nómina para ${mes}/${anio}. Ejecute POST /api/v1/finance/payroll/calculate.`,
      );
    }

    return reply.send(row);
  });

  /**
   * PATCH /api/v1/finance/payroll/summary/:id
   * Ajuste manual de un resumen ya calculado (manager+).
   *
   * Solo se permite corregir los importes, NO el estado de equilibrio: ese
   * campo es derivado de los gastos fijos y la nómina base, y editarlo a mano
   * haría que la decisión de liberar comisiones dejara de ser coherente con
   * las cuentas.
   */
  app.patch<{ Params: { id: string }; Body: Partial<Record<string, number>> }>(
    "/api/v1/finance/payroll/summary/:id",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            fixedExpensesTotal: { type: "number" },
            payrollBaseTotal: { type: "number" },
            netLaborRevenue: { type: "number" },
            breakevenThreshold: { type: "number" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantId = await tenantIdDe(request);
      const body = request.body;

      // `breakevenHit` y `breakevenPercentage` se derivan de los importes, por
      // eso no se aceptan aquí: se recalculan tras el ajuste.
      const NUMEROS = [
        "fixedExpensesTotal",
        "payrollBaseTotal",
        "netLaborRevenue",
        "breakevenThreshold",
      ] as const;

      const update: Record<string, number> = {};
      for (const campo of NUMEROS) {
        const valor = body[campo];
        if (valor === undefined) continue;
        if (!Number.isFinite(valor) || valor < 0) {
          throw new ValidationError(`${campo} debe ser un número mayor o igual a cero`);
        }
        update[campo] = Math.round(valor);
      }

      if (Object.keys(update).length === 0) {
        throw new ValidationError(
          "Indique al menos un importe a corregir (fixedExpensesTotal, payrollBaseTotal, netLaborRevenue o breakevenThreshold)",
        );
      }

      // Fila actual: sirve para 404 y para recomponer el umbral cuando el
      // ajuste no lo menciona de forma explícita.
      const [actual] = await db()
        .select({
          id: payrollSummary.id,
          fixedExpensesTotal: payrollSummary.fixedExpensesTotal,
          payrollBaseTotal: payrollSummary.payrollBaseTotal,
          netLaborRevenue: payrollSummary.netLaborRevenue,
        })
        .from(payrollSummary)
        .where(
          and(
            eq(payrollSummary.id, request.params.id),
            eq(payrollSummary.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!actual) {
        throw new NotFoundError("Resumen de nómina no encontrado");
      }

      // El umbral es la suma de gastos fijos + nómina base. Si el ajuste toca
      // cualquiera de esos dos y no fija el umbral, se recompone: dejarlo
      // desactualizado haría que breakevenHit se calculara sobre una cifra
      // que ya no corresponde a los importes guardados.
      const fijos = update.fixedExpensesTotal ?? Number(actual.fixedExpensesTotal);
      const payrollBase = update.payrollBaseTotal ?? Number(actual.payrollBaseTotal);
      const threshold = update.breakevenThreshold ?? fijos + payrollBase;
      const netRevenue = update.netLaborRevenue ?? Number(actual.netLaborRevenue);
      const hit = threshold > 0 && netRevenue >= threshold;

      const [row] = await db()
        .update(payrollSummary)
        .set({
          ...update,
          breakevenThreshold: threshold,
          breakevenHit: hit,
          breakevenPercentage:
            threshold > 0
              ? String(Math.round((netRevenue / threshold) * 10000) / 100)
              : "0",
        })
        .where(
          and(
            eq(payrollSummary.id, request.params.id),
            eq(payrollSummary.tenantId, tenantId),
          ),
        )
        .returning();

      if (!row) {
        throw new NotFoundError("Resumen de nómina no encontrado");
      }

      return reply.send(row);
    },
  );

  /**
   * DELETE /api/v1/finance/payroll/summary/:id
   * Descarta un resumen para que el siguiente `calculate` lo rehaga (manager+).
   *
   * Se rechaza si el período ya tiene asiento de nómina contabilizado:
   * borrar el resumen dejaría el asiento huérfano y el próximo cálculo volvería
   * a emitir uno duplicado.
   */
  app.delete<{ Params: { id: string } }>(
    "/api/v1/finance/payroll/summary/:id",
    {
      preHandler: requireManager,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      const tenantId = await tenantIdDe(request);

      const [row] = await db()
        .select({
          id: payrollSummary.id,
          month: payrollSummary.month,
          year: payrollSummary.year,
        })
        .from(payrollSummary)
        .where(
          and(
            eq(payrollSummary.id, request.params.id),
            eq(payrollSummary.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new NotFoundError("Resumen de nómina no encontrado");
      }

      const documentoRef = `nomina_mensual:payroll_${row.year}_${row.month}`;
      const [asiento] = await db()
        .select({ id: asientosContables.id })
        .from(asientosContables)
        .where(
          and(
            eq(asientosContables.documentoRef, documentoRef),
            eq(asientosContables.estado, "CONTABILIZADO"),
          ),
        )
        .limit(1);

      if (asiento) {
        throw new ConflictError(
          `El período ${row.month}/${row.year} ya tiene un asiento de nómina contabilizado. ` +
            `Anule primero ese asiento; de lo contrario el próximo cálculo emitiría un asiento duplicado.`,
        );
      }

      await db()
        .delete(payrollSummary)
        .where(
          and(
            eq(payrollSummary.id, request.params.id),
            eq(payrollSummary.tenantId, tenantId),
          ),
        );

      return reply.send({ deleted: true, id: row.id });
    },
  );

  /**
   * GET /api/v1/finance/payroll/commissions?month=X&year=Y
   * Commission records for a specific period (tenant-scoped).
   */
  app.get("/api/v1/finance/payroll/commissions", async (request, reply) => {
    const tenantId = await tenantIdDe(request);
    const { month, year } = request.query as { month?: string; year?: string };
    const now = new Date();
    const { mes: targetMonth, anio: targetYear } = validarPeriodo(
      month ?? now.getMonth() + 1,
      year ?? now.getFullYear(),
    );

    const rows = await db()
      .select()
      .from(commissionRecords)
      .where(
        and(
          eq(commissionRecords.tenantId, tenantId),
          eq(commissionRecords.month, targetMonth),
          eq(commissionRecords.year, targetYear),
        ),
      )
      .orderBy(desc(commissionRecords.laborAmount));

    return reply.send(rows);
  });
}
