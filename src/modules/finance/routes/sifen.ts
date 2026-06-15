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
import { eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { tenants, clients, fiscalDocumentos } from "../../../shared/database/schema/index.js";
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

      // ── 5. Compute totals for DB ──
      const totalExento = data.items
        .filter((i) => i.iva === 0)
        .reduce((s, i) => s + parseFloat(i.subtotal), 0);
      const totalIva5 = data.items
        .filter((i) => i.iva === 5)
        .reduce((s, i) => s + parseFloat(i.subtotal), 0);
      const totalIva10 = data.items
        .filter((i) => i.iva === 10)
        .reduce((s, i) => s + parseFloat(i.subtotal), 0);
      const totalIva = data.items
        .reduce((s, i) => s + parseFloat(i.ivaMonto ?? "0"), 0);
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
  app.get<{ Querystring: { estado?: string; page?: string; limit?: string } }>(
    "/finance/sifen/documentos",
    async (request, reply) => {
      const { estado, page, limit } = request.query;
      const result = await listFiscalDocumentos({
        estado,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
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
  app.get<{ Querystring: { documentoId?: string; page?: string; limit?: string } }>(
    "/finance/sifen/sync-log",
    async (request, reply) => {
      const { documentoId, page, limit } = request.query;
      const result = await getSyncLog({
        documentoId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
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
}
