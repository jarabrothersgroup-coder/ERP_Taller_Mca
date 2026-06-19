/**
 * SIFEN routes — Electronic Invoicing endpoints.
 *
 * Endpoints:
 *   POST /finance/sifen/emitir        — Emit (create + sign + send) a DTE
 *   POST /finance/sifen/firmar        — Sign an existing XML (async)
 *   POST /finance/sifen/enviar        — Send signed XML to DNIT
 *   GET  /finance/sifen/consultar     — Query DTE status by CDC
 *   POST /finance/sifen/anular        — Cancel a DTE
 *   GET  /finance/sifen/documentos    — List fiscal documents
 *   GET  /finance/sifen/documentos/:id — Get fiscal document detail
 *   GET  /finance/sifen/sync-log      — View SIFEN sync log
 *   GET  /finance/sifen/health        — Test SIFEN connection
 *
 * All routes require `X-Tenant-Slug` header (resolved by tenant-resolver).
 *
 * @module finance/routes/sifen
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  buildDTEXml,
  validateDTEXml,
  signXMLAsync,
  enviarDTE,
  consultarDTE,
  anularDTE,
  testSifenConnection,
} from "../services/index.js";
import {
  createFiscalDocumento,
  getFiscalDocumentoById,
  listFiscalDocumentos,
  updateFiscalDocumentoEstado,
  createSyncLogEntry,
  getSyncLog,
} from "../services/sifen/sifen-db.service.js";
import { parseMoneyToCentavos, centavosToString } from "../services/accounting/capa3-formatters.js";
import { eq, count } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants, clients, fiscalDocumentos } from "../../../shared/database/schema/index.js";
import { sifenSyncLog } from "../schema/fiscal-docs.js";
import type { EmitirDTERequest, ConsultaDTEQuery, SIFENSoapResponse } from "../types.js";

// ─── Route registration ────────────────────────

/**
 * Registers SIFEN fiscal routes on the Fastify instance.
 *
 * @param app - Fastify instance
 */
export async function sifenRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /finance/sifen/emitir — Emit full DTE ──
  app.post<{ Body: EmitirDTERequest }>(
    "/finance/sifen/emitir",
    {
      schema: {
        body: {
          type: "object",
          required: ["ordenTrabajoId", "clienteId", "dteTipo", "serie", "numero", "condicionVenta", "moneda", "items", "regimenIVA"],
          properties: {
            ordenTrabajoId: { type: "string", format: "uuid" },
            clienteId: { type: "string", format: "uuid" },
            dteTipo: { type: "string", enum: ["FACTURA", "NOTA_CREDITO", "NOTA_DEBITO", "AUTOFACTURA", "COMPROBANTE_RETENCION"] },
            serie: { type: "string", maxLength: 3 },
            numero: { type: "string", maxLength: 7 },
            condicionVenta: { type: "string", enum: ["CONTADO", "CREDITO", "TARJETA_CRED", "TARJETA_DEB", "TRANSFERENCIA", "OTRO"] },
            moneda: { type: "string", enum: ["PYG", "USD", "EUR", "BRL", "ARS"] },
            regimenIVA: { type: "string", enum: ["GENERAL", "PEQUENIO", "SIMPLIFICADO", "EXENTO"] },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["cantidad", "unidadMedida", "descripcion", "precioUnitario", "iva", "subtotal"],
                properties: {
                  cantidad: { type: "number", minimum: 0.01 },
                  unidadMedida: { type: "string" },
                  descripcion: { type: "string", maxLength: 300 },
                  precioUnitario: { type: "string" },
                  iva: { type: "integer", enum: [0, 5, 10] },
                  subtotal: { type: "string" },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              documento: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  dteTipo: { type: "string" },
                  serie: { type: "string" },
                  numero: { type: "string" },
                  cdc: { type: "string", nullable: true },
                  estado: { type: "string" },
                  xmlFirmado: { type: "string", nullable: true },
                  kuDePdfUrl: { type: "string", nullable: true },
                },
              },
              emitidoEn: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: EmitirDTERequest }>,
      reply: FastifyReply,
    ) => {
      const data = request.body;

      // ── 1. Look up tenant fiscal data ──
      const [tenant] = await db()
        .select({ ruc: tenants.ruc, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.slug, request.tenantSlug))
        .limit(1);

      if (!tenant || !tenant.ruc) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "Tenant sin RUC configurado. Configure el RUC del taller primero.",
        });
      }

      // ── 2. Look up client fiscal data ──
      const [cliente] = await db()
        .select({ ruc: clients.ruc, name: clients.name, address: clients.address })
        .from(clients)
        .where(eq(clients.id, data.clienteId))
        .limit(1);

      if (!cliente) {
        return reply.status(404).send({
          error: "NotFoundError",
          message: "Cliente no encontrado",
        });
      }

      // ── 3. Build XML with full fiscal data ──
      const emisorRuc = tenant.ruc;
      const emisorRazonSocial = tenant.name;

      const enrichedData = {
        ...data,
        emisorRuc,
        emisorRazonSocial,
        receptorRuc: cliente.ruc ?? "00000000-0",
        receptorRazonSocial: cliente.name,
        receptorDireccion: cliente.address ?? null,
      };

      const xmlOriginal = buildDTEXml(enrichedData as any);

      // ── 4. Validate XML structure ──
      const validation = validateDTEXml(xmlOriginal);
      if (!validation.isValid) {
        return reply.status(422).send({
          error: "ValidationError",
          message: "XML inválido para SIFEN",
          details: { errors: validation.errors },
        });
      }

      // ── 5. Compute totals for DB (using BigInt for exact IVA arithmetic) ──
      const totalExentoCtv = data.items
        .filter((i) => i.iva === 0)
        .reduce((s, i) => s + parseMoneyToCentavos(i.subtotal), 0n);
      const totalIva5Ctv = data.items
        .filter((i) => i.iva === 5)
        .reduce((s, i) => s + parseMoneyToCentavos(i.subtotal), 0n);
      const totalIva10Ctv = data.items
        .filter((i) => i.iva === 10)
        .reduce((s, i) => s + parseMoneyToCentavos(i.subtotal), 0n);
      const totalIvaCtv = data.items
        .reduce((s, i) => s + parseMoneyToCentavos(i.ivaMonto ?? "0"), 0n);
      const totalExento = parseFloat(centavosToString(totalExentoCtv));
      const totalIva5 = parseFloat(centavosToString(totalIva5Ctv));
      const totalIva10 = parseFloat(centavosToString(totalIva10Ctv));
      const totalIva = parseFloat(centavosToString(totalIvaCtv));
      const totalDoc = totalExento + totalIva5 + totalIva10 + totalIva;

      // ── 6. Save as BORRADOR in DB ──
      const documento = await createFiscalDocumento({
        emisorRuc,
        emisorRazonSocial,
        clienteId: data.clienteId,
        receptorRuc: cliente.ruc ?? "",
        receptorRazonSocial: cliente.name,
        receptorDireccion: cliente.address ?? null,
        ordenTrabajoId: data.ordenTrabajoId,
        dteTipo: data.dteTipo,
        serie: data.serie,
        numero: data.numero,
        moneda: data.moneda,
        totalExento: totalExento.toFixed(2),
        totalIva5: totalIva5.toFixed(2),
        totalIva10: totalIva10.toFixed(2),
        totalLiquido: (totalExento + totalIva5 + totalIva10).toFixed(2),
        totalIva: totalIva.toFixed(2),
        totalDocumento: totalDoc.toFixed(2),
        condicionVenta: data.condicionVenta,
        xmlOriginal,
      });

      // ── 7. Sign XML async (non-blocking) ──
      let xmlFirmado: string | null = null;
      try {
        xmlFirmado = await signXMLAsync(xmlOriginal);
        await updateFiscalDocumentoEstado(documento.id, "FIRMADO", xmlFirmado);
      } catch (err) {
        // XML signed async — continue with BORRADOR status if signing fails
        const msg = err instanceof Error ? err.message : "Error de firma";
        await createSyncLogEntry({
          documentoId: documento.id,
          operacion: "FIRMA",
          codigoResultado: "ERROR",
          mensajeError: msg,
          exitoso: false,
        });
      }

      // ── 8. Send to DNIT if signed successfully ──
      let resultadoSifen: SIFENSoapResponse | null = null;
      if (xmlFirmado) {
        try {
          resultadoSifen = await enviarDTE(xmlFirmado, documento.id);

          if (resultadoSifen.cdc) {
            await updateFiscalDocumentoEstado(
              documento.id,
              "APROBADO",
              xmlFirmado,
              resultadoSifen.cdc,
              resultadoSifen.numeroTransaccion,
            );
          } else {
            await updateFiscalDocumentoEstado(documento.id, "RECHAZADO", xmlFirmado);
          }

          await createSyncLogEntry({
            documentoId: documento.id,
            operacion: "ENVIO",
            codigoResultado: resultadoSifen.codigoResultado,
            cdc: resultadoSifen.cdc,
            xmlEnviado: xmlFirmado,
            exitoso: !!resultadoSifen.cdc,
            mensajeError: resultadoSifen.mensajeError,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "SOAP error";
          await createSyncLogEntry({
            documentoId: documento.id,
            operacion: "ENVIO",
            exitoso: false,
            mensajeError: msg,
          });
        }
      }

      // ── 9. Respond ──
      const docFinal = await getFiscalDocumentoById(documento.id);

      return reply.status(201).send({
        documento: docFinal,
        emitidoEn: new Date().toISOString(),
      });
    },
  );

  // ── POST /finance/sifen/firmar — Sign existing XML (async) ──
  app.post<{ Body: { documentoId: string } }>(
    "/finance/sifen/firmar",
    {
      schema: {
        body: {
          type: "object",
          required: ["documentoId"],
          properties: {
            documentoId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { documentoId } = request.body;
      const doc = await getFiscalDocumentoById(documentoId);

      if (!doc.xmlOriginal) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "El documento no tiene XML original para firmar",
        });
      }

      const xmlFirmado = await signXMLAsync(doc.xmlOriginal);
      await updateFiscalDocumentoEstado(doc.id, "FIRMADO", xmlFirmado);

      return reply.send({ id: doc.id, estado: "FIRMADO" });
    },
  );

  // ── POST /finance/sifen/enviar — Send signed XML to DNIT ──
  app.post<{ Body: { documentoId: string } }>(
    "/finance/sifen/enviar",
    async (request, reply) => {
      const { documentoId } = request.body;
      const doc = await getFiscalDocumentoById(documentoId);

      if (!doc.xmlFirmado) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "El documento debe estar firmado antes de enviar",
        });
      }

      const resultado = await enviarDTE(doc.xmlFirmado, doc.id);

      if (resultado.cdc) {
        await updateFiscalDocumentoEstado(
          doc.id,
          "APROBADO",
          doc.xmlFirmado,
          resultado.cdc,
          resultado.numeroTransaccion,
        );
      } else {
        await updateFiscalDocumentoEstado(doc.id, "RECHAZADO", doc.xmlFirmado);
      }

      await createSyncLogEntry({
        documentoId: doc.id,
        operacion: "ENVIO",
        codigoResultado: resultado.codigoResultado,
        cdc: resultado.cdc,
        exitoso: !!resultado.cdc,
        mensajeError: resultado.mensajeError,
      });

      return reply.send(resultado);
    },
  );

  // ── GET /finance/sifen/consultar — Query DTE status ──
  app.get<{ Querystring: ConsultaDTEQuery }>(
    "/finance/sifen/consultar",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["cdc"],
          properties: {
            cdc: { type: "string", minLength: 44, maxLength: 44 },
            dteTipo: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { cdc } = request.query;
      const resultado = await consultarDTE(cdc);

      return reply.send(resultado);
    },
  );

  // ── POST /finance/sifen/anular — Cancel a DTE ──
  app.post<{ Body: { cdc: string; motivo: string } }>(
    "/finance/sifen/anular",
    {
      schema: {
        body: {
          type: "object",
          required: ["cdc", "motivo"],
          properties: {
            cdc: { type: "string", minLength: 44, maxLength: 44 },
            motivo: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { cdc, motivo } = request.body;
      const resultado = await anularDTE(cdc, motivo);

      if (resultado.codigoResultado === "ERROR") {
        return reply.status(400).send(resultado);
      }

      // Update local document status if found
      const [doc] = await db()
        .select({ id: fiscalDocumentos.id })
        .from(fiscalDocumentos)
        .where(eq(fiscalDocumentos.cdc, cdc))
        .limit(1);
      if (doc) {
        await updateFiscalDocumentoEstado(doc.id, "ANULADO");
      }

      return reply.send(resultado);
    },
  );

  // ── GET /finance/sifen/documentos — List fiscal documents ──
  app.get<{ Querystring: { estado?: string; page?: string; limit?: string; sortBy?: string; sortOrder?: string } }>(
    "/finance/sifen/documentos",
    async (request, reply) => {
      const { estado, page, limit, sortBy, sortOrder } = request.query;
      const result = await listFiscalDocumentos({
        estado,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        sortBy,
        sortOrder: sortOrder as "asc" | "desc" | undefined,
      });
      return reply.send(result);
    },
  );

  // ── GET /finance/sifen/documentos/:id — Get document detail ──
  app.get<{ Params: { id: string } }>(
    "/finance/sifen/documentos/:id",
    async (request, reply) => {
      const doc = await getFiscalDocumentoById(request.params.id);
      return reply.send(doc);
    },
  );

  // ── GET /finance/sifen/sync-log — View SIFEN sync log ──
  app.get<{ Querystring: { documentoId?: string; page?: string; limit?: string; sortBy?: string; sortOrder?: string } }>(
    "/finance/sifen/sync-log",
    async (request, reply) => {
      const { documentoId, page, limit, sortBy, sortOrder } = request.query;
      const result = await getSyncLog({
        documentoId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        sortBy,
        sortOrder: sortOrder as "asc" | "desc" | undefined,
      });
      return reply.send(result);
    },
  );

  // ── GET /finance/sifen/health — Test SIFEN connection ──
  app.get(
    "/finance/sifen/health",
    async (_request, reply) => {
      const result = await testSifenConnection();
      return reply.send({
        ...result,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── POST /finance/sifen/consultar-lote — Batch consultation ──
  app.post<{ Body: { cdcList: string[] } }>(
    "/finance/sifen/consultar-lote",
    {
      schema: {
        body: {
          type: "object",
          required: ["cdcList"],
          properties: {
            cdcList: {
              type: "array",
              minItems: 1,
              maxItems: 50,
              items: { type: "string", minLength: 44, maxLength: 44 },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { cdcList } = request.body;

      // Validate: max 50 CDCs per batch
      if (cdcList.length > 50) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "Máximo 50 CDCs por consulta en lote",
        });
      }

      // Validate each CDC is exactly 44 characters
      const invalidCdc = cdcList.find((cdc) => cdc.length !== 44);
      if (invalidCdc) {
        return reply.status(400).send({
          error: "ValidationError",
          message: `CDC inválido: "${invalidCdc}" — debe tener exactamente 44 caracteres`,
        });
      }

      // Query each CDC sequentially to avoid overwhelming DNIT
      const results: Array<{
        cdc: string;
        resultado: SIFENSoapResponse;
      }> = [];

      for (const cdc of cdcList) {
        const resultado = await consultarDTE(cdc);
        results.push({ cdc, resultado });
      }

      // Create batch sync log entry
      const successCount = results.filter((r) => !!r.resultado.cdc).length;
      const errorCount = results.filter((r) => r.resultado.codigoResultado === "ERROR").length;

      // Log batch operation (use first document ID if available, or skip)
      // Batch consultation doesn't tie to a single document, so we log without documentoId if possible
      // However, the sync log requires documentoId, so we skip logging for pure batch queries
      // unless we have a reference document

      return reply.send({
        totalConsultados: cdcList.length,
        aprobados: successCount,
        rechazados: results.filter((r) => r.resultado.codigoResultado === "RECHAZADO").length,
        errores: errorCount,
        resultados: results,
        consultadoEn: new Date().toISOString(),
      });
    },
  );

  // ── GET /finance/sifen/dashboard — Status dashboard ──
  app.get(
    "/finance/sifen/dashboard",
    async (_request, reply) => {
      // Count documents by status
      const statusCounts = await db()
        .select({
          estado: fiscalDocumentos.estado,
          total: count(),
        })
        .from(fiscalDocumentos)
        .groupBy(fiscalDocumentos.estado);

      // Build status summary
      const summary: Record<string, number> = {
        BORRADOR: 0,
        FIRMADO: 0,
        ENVIADO: 0,
        APROBADO: 0,
        RECHAZADO: 0,
        ANULADO: 0,
      };
      for (const row of statusCounts) {
        if (row.estado && row.estado in summary) {
          summary[row.estado] = Number(row.total);
        }
      }

      // Recent activity (last 10 sync log entries)
      const recentActivity = await db()
        .select({
          id: sifenSyncLog.id,
          documentoId: sifenSyncLog.documentoId,
          operacion: sifenSyncLog.operacion,
          codigoResultado: sifenSyncLog.codigoResultado,
          cdc: sifenSyncLog.cdc,
          exitoso: sifenSyncLog.exitoso,
          mensajeError: sifenSyncLog.mensajeError,
          createdAt: sifenSyncLog.createdAt,
        })
        .from(sifenSyncLog)
        .orderBy(sifenSyncLog.createdAt)
        .limit(10);

      // Pending documents (ENVIADO status) with age
      const pendingDocs = await db()
        .select({
          id: fiscalDocumentos.id,
          dteTipo: fiscalDocumentos.dteTipo,
          serie: fiscalDocumentos.serie,
          numero: fiscalDocumentos.numero,
          fechaEnvio: fiscalDocumentos.fechaEnvio,
        })
        .from(fiscalDocumentos)
        .where(eq(fiscalDocumentos.estado, "ENVIADO"))
        .orderBy(fiscalDocumentos.fechaEnvio)
        .limit(20);

      // Calculate age for pending docs
      const pendingWithAge = pendingDocs.map((doc) => ({
        ...doc,
        ageHours: doc.fechaEnvio
          ? Math.round((Date.now() - doc.fechaEnvio.getTime()) / (1000 * 60 * 60))
          : null,
      }));

      return reply.send({
        summary,
        totalDocumentos: Object.values(summary).reduce((a, b) => a + b, 0),
        recentActivity,
        pendingDocuments: pendingWithAge,
        consultadoEn: new Date().toISOString(),
      });
    },
  );
}
