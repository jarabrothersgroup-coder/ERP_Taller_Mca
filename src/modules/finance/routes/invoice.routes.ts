/**
 * Hybrid Invoice Routes — SIFEN-004-HYBRID
 *
 * Dual-engine invoice endpoint:
 *   POST /finance/invoices/issue
 *
 * - **MANUAL** branch: registers a pre-printed invoice number, stores CDC=null
 *   for later retroactive conversion when DNIT homologation is approved.
 * - **ELECTRONICA** branch: delegates XML signing to the async worker thread
 *   (signXMLInWorker) and stores the signed XML with CDC.
 *
 * Both branches run inside a single Drizzle transaction for atomicity.
 *
 * @module finance/routes/invoice
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import {
  ordenesTrabajo,
  facturas,
  type SifenStatus,
} from "../../../shared/database/schema/index.js";
import { signXMLInWorker } from "../services/sifen/sifen-crypto.service.js";
import { emit, resolveAccount } from "../services/index.js";
import { AccountingBusCodes } from "./accounting-bus-codes.js";

// ─── Request body type ─────────────────────────

interface IssueInvoiceBody {
  ordenId: string;
  tipoFacturacion: "MANUAL" | "ELECTRONICA";
  numeroFacturaManual?: string;
  /** Si es true, no se genera línea de IVA (servicio exento) */
  ivaExento?: boolean;
}

// ─── Routes ────────────────────────────────────

export async function invoiceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/finance/invoices/issue",
    async (
      request: FastifyRequest<{ Body: IssueInvoiceBody }>,
      reply: FastifyReply,
    ) => {
      const tenant = request.tenantSlug;
      const { ordenId, tipoFacturacion, numeroFacturaManual, ivaExento } = request.body;

      // ── Input validation ───────────────────────
      if (!ordenId) {
        return reply.code(400).send({
          success: false,
          error: "ordenId es requerido",
        });
      }

      if (tipoFacturacion !== "MANUAL" && tipoFacturacion !== "ELECTRONICA") {
        return reply.code(400).send({
          success: false,
          error: "tipoFacturacion debe ser 'MANUAL' o 'ELECTRONICA'",
        });
      }

      if (tipoFacturacion === "MANUAL" && !numeroFacturaManual) {
        return reply.code(400).send({
          success: false,
          error: "numeroFacturaManual es obligatorio para facturación MANUAL",
        });
      }

      try {
        const resultadoFactura = await db().transaction(async (tx) => {
          // ── 1. Fetch the work order ──────────────
          const [orden] = await tx
            .select()
            .from(ordenesTrabajo)
            .where(
              and(
                eq(ordenesTrabajo.id, ordenId),
                eq(ordenesTrabajo.tenantSlug, tenant),
              ),
            );

          if (!orden) {
            throw new Error(
              "La orden de trabajo no existe o no pertenece al taller.",
            );
          }

          // Check if already invoiced
          const [existing] = await tx
            .select({ id: facturas.id })
            .from(facturas)
            .where(
              and(
                eq(facturas.ordenId, ordenId),
                eq(facturas.tenantSlug, tenant),
              ),
            )
            .limit(1);

          if (existing) {
            throw new Error(
              "Esta orden de trabajo ya ha sido facturada previamente.",
            );
          }

          // ── 2. Validate totalCost ────────────
          if (!orden.totalCost || Number(orden.totalCost) <= 0) {
            throw new Error(
              "La orden de trabajo no tiene un costo total válido. " +
              "Complete los costos antes de facturar.",
            );
          }

          // ── 3. Calculate totals ───────────────
          const total = Number(orden.totalCost);

          // ── 3. Build base DTE XML structure ────
          const xmlPlanoDTE = `
            <DE>
              <rDE><dVerFor>150</dVerFor></rDE>
              <gOpeDE>
                <dTotOpe>${total}</dTotOpe>
                <tenant>${tenant}</tenant>
              </gOpeDE>
            </DE>
          `.trim();

          let cdcGenerado: string | null = null;
          let xmlFirmadoResult: string | null = null;
          let estadoSifen: SifenStatus = "OFFLINE_PENDING";
          const tipoFactura: "MANUAL" | "ELECTRONICA" = tipoFacturacion;

          // ── 4. Dual-engine branch ──────────────
          if (tipoFacturacion === "ELECTRONICA") {
            // Motor A — full electronic DTE with X.509 signature
            xmlFirmadoResult =
              await signXMLInWorker(xmlPlanoDTE);
            const cdcMatch = xmlFirmadoResult.match(/cdc="([^"]+)"/);
            cdcGenerado = cdcMatch
              ? cdcMatch[1]!
              : "PENDING_HOMOLOGATION";
            estadoSifen = "APROBADO_DNIT";
          } else {
            // Motor B — manual/transitional (pre-printed invoice)
            estadoSifen = "MANUAL_CONVERT_QUEUE";
            // cdcGenerado remains null
          }

          // ── 5. Insert invoice record with CxC fields ──
          const vencimiento = new Date();
          vencimiento.setDate(vencimiento.getDate() + 30);

          const [nuevaFactura] = await tx
            .insert(facturas)
            .values({
              tenantSlug: tenant,
              ordenId: ordenId,
              tipo: tipoFactura,
              numeroFacturaManual: numeroFacturaManual ?? null,
              sifenCdc: cdcGenerado,
              sifenStatus: estadoSifen,
              xmlRaw: xmlPlanoDTE,
              xmlSigned: xmlFirmadoResult,
              total: String(total),
              estadoPago: "PENDIENTE",
              saldoPendiente: String(total),
              fechaVencimiento: vencimiento,
            })
            .returning();

          // ── 6. Fiscal documento_detalles deferred to SIFEN integration phase ──
          // NOTE: fiscalDocumentos requires SIFEN fields (emisorRuc, receptorRuc, etc.)
          // For now, the primary CxC tracking uses the `facturas` table.

          // ── 7. Update work order timestamp ────
          await tx
            .update(ordenesTrabajo)
            .set({ updatedAt: new Date() })
            .where(eq(ordenesTrabajo.id, ordenId));

          return nuevaFactura;
        });

        // ── 7. Auto VENTA: generate accounting entry via Accounting Bus ──
        // Graceful degradation — if accounting fails, invoice is still valid
        try {
          const ctaClienteId = await resolveAccount(AccountingBusCodes.CLIENTES);
          const ctangresoId = await resolveAccount(AccountingBusCodes.INGRESO_SERVICIOS);
          const ctaIvaId = ivaExento ? null : await resolveAccount(AccountingBusCodes.IVA_DEBITO_FISCAL);

          const totalNum = Number(resultadoFactura.total ?? 0);

          if (ctaClienteId && ctangresoId) {
            // Build lines: with or without IVA
            const lineas = [];
            if (ivaExento) {
              // Servicio exento de IVA: todo el total es ingreso
              lineas.push(
                { cuentaId: ctaClienteId, debe: totalNum, descripcion: "Cliente por factura (IVA exento)" },
                { cuentaId: ctangresoId, haber: totalNum, descripcion: "Ingreso por servicios (IVA exento)" },
              );
            } else if (ctaIvaId) {
              // IVA 10% estándar Paraguay: separar base imponible e IVA
              const ivaRate = 0.10;
              const base = Math.round((totalNum / (1 + ivaRate)) * 100) / 100;
              const iva = Math.round((totalNum - base) * 100) / 100;
              lineas.push(
                { cuentaId: ctaClienteId, debe: totalNum, descripcion: "Cliente por factura" },
                { cuentaId: ctangresoId, haber: base, descripcion: "Ingreso por servicios" },
                { cuentaId: ctaIvaId, haber: iva, descripcion: "IVA 10% sobre servicios" },
              );
            }

            if (lineas.length > 0) {
              const result = await emit({
                tenantSlug: tenant,
                tipo: "VENTA",
                fecha: new Date(),
                referenciaId: resultadoFactura.id,
                referenciaTipo: "factura",
                descripcion: `Factura ${resultadoFactura.numeroFacturaManual ?? "ELECTRONICA"} — OT ${ordenId}`,
                lineas,
              });

              // Save asientoId on factura if accounting succeeded
              if (result.success && result.asientoId) {
                await db()
                  .update(facturas)
                  .set({ asientoId: result.asientoId })
                  .where(eq(facturas.id, resultadoFactura.id));
              } else {
                request.log.warn(
                  { error: result.error },
                  "[accounting-bus] Auto VENTA emit falló (no bloqueante)",
                );
              }
            } else {
              request.log.warn(
                "[accounting-bus] No se pudo resolver cuenta IVA_DEBITO_FISCAL — se omite asiento de IVA",
              );
            }
          } else {
            request.log.warn(
              { ctaClienteId, ctangresoId },
              "[accounting-bus] No se pudo resolver cuentas contables para VENTA",
            );
          }
        } catch (err) {
          request.log.warn({ err }, "[accounting-bus] Auto VENTA falló (no bloqueante)");
        }

        return reply.code(201).send({ success: true, data: resultadoFactura });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Error desconocido";
        return reply.code(400).send({ success: false, error: message });
      }
    },
  );
}
