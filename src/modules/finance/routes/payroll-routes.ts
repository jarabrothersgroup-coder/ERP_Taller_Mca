import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../../../shared/database/connection.js";
import { db } from "../../../shared/database/drizzle.js";
import {
  calculateMonthlyCommissions,
  checkWorkshopEquilibrium,
  getBreakevenProgress,
} from "../services/FinancialOrchestratorService.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";
import { emit, resolveAccount } from "../services/index.js";
import { AccountingBusCodes } from "./accounting-bus-codes.js";
import { asientosContables } from "../schema/index.js";
import { eq, and, sql } from "drizzle-orm";

export async function payrollRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/v1/finance/payroll/calculate", async (request: FastifyRequest, reply: FastifyReply) => {
    const slug = request.tenantSlug;
    const { month, year } = request.body as { month?: number; year?: number };
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    if (targetMonth < 1 || targetMonth > 12) {
      throw new BadRequestError("Mes inválido (1-12)");
    }
    if (targetYear < 2020 || targetYear > 2100) {
      throw new BadRequestError("Año inválido");
    }

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
}
