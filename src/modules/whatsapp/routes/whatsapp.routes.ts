/**
 * WhatsApp Routes — Integration endpoints.
 *
 * Endpoints:
 *   POST /whatsapp/instance/create     — Create WhatsApp instance
 *   GET  /whatsapp/qr                  — Get QR code for pairing
 *   GET  /whatsapp/status              — Get connection status
 *   POST /whatsapp/send                — Send a message with template
 *   POST /whatsapp/send-text           — Send raw text message
 *   GET  /whatsapp/log                 — Get message log
 *   POST /whatsapp/disconnect          — Disconnect instance
 *   DELETE /whatsapp/instance          — Delete instance
 *
 * All routes require `X-Tenant-Slug` header.
 *
 * @module whatsapp/routes/whatsapp
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import {
  ordenesTrabajo,
  clients,
  vehiculos,
  facturas,
} from "../../../shared/database/schema/index.js";
import { whatsappMessages } from "../schema/whatsapp-log.js";
import {
  createInstance,
  getQRCode,
  getConnectionStatus,
  sendTextMessage,
  sendDocumentMessage,
  disconnectInstance,
  deleteInstance,
  sanitizePhone,
  buildMessage,
  MESSAGE_TEMPLATES,
} from "../services/whatsapp.service.js";
import type {
  SendMessageRequest,
  MessageTemplateData,
} from "../types.js";

// ─── Route registration ────────────────────────

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /whatsapp/instance/create — Create instance ──
  app.post(
    "/whatsapp/instance/create",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const result = await createInstance(tenantSlug);
        return reply.status(201).send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error creando instancia";
        return reply.status(500).send({ error: "WhatsAppError", message: msg });
      }
    },
  );

  // ── GET /whatsapp/qr — Get QR code ──
  app.get(
    "/whatsapp/qr",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const qr = await getQRCode(tenantSlug);
        return reply.send(qr);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error obteniendo QR";
        return reply.status(500).send({ error: "WhatsAppError", message: msg });
      }
    },
  );

  // ── GET /whatsapp/status — Get connection status ──
  app.get(
    "/whatsapp/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const status = await getConnectionStatus(tenantSlug);
        return reply.send(status);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error consultando estado";
        return reply.status(500).send({
          status: "ERROR",
          instanceName: `erp-${tenantSlug}`,
          error: msg,
        });
      }
    },
  );

  // ── POST /whatsapp/send — Send message with template ──
  app.post<{ Body: SendMessageRequest }>(
    "/whatsapp/send",
    {
      schema: {
        body: {
          type: "object",
          required: ["ordenId", "estadoSolicitado"],
          properties: {
            ordenId: { type: "string", format: "uuid" },
            estadoSolicitado: { type: "string" },
            customMessage: { type: "string" },
            pdfUrl: { type: "string" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: SendMessageRequest }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const userEmail = (request as any).userEmail as string || "system";
      const { ordenId, estadoSolicitado, customMessage, pdfUrl } = request.body;

      // ── 1. Fetch order + client + vehicle data ──
      const [ordenRow] = await db()
        .select({
          id: ordenesTrabajo.id,
          status: ordenesTrabajo.status,
          totalCost: ordenesTrabajo.totalCost,
          clientId: ordenesTrabajo.clientId,
          vehicleId: ordenesTrabajo.vehicleId,
          createdAt: ordenesTrabajo.createdAt,
        })
        .from(ordenesTrabajo)
        .where(eq(ordenesTrabajo.id, ordenId))
        .limit(1);

      if (!ordenRow) {
        return reply.status(404).send({
          error: "NotFoundError",
          message: `Orden ${ordenId} no encontrada`,
        });
      }

      const [clientRow] = await db()
        .select({
          id: clients.id,
          name: clients.name,
          phone: clients.phone,
        })
        .from(clients)
        .where(eq(clients.id, ordenRow.clientId))
        .limit(1);

      if (!clientRow) {
        return reply.status(404).send({
          error: "NotFoundError",
          message: "Cliente no encontrado para esta orden",
        });
      }

      if (!clientRow.phone) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "El cliente no tiene número de teléfono registrado",
        });
      }

      const [vehicleRow] = await db()
        .select({
          id: vehiculos.id,
          brand: vehiculos.brand,
          model: vehiculos.model,
          plate: vehiculos.plate,
        })
        .from(vehiculos)
        .where(eq(vehiculos.id, ordenRow.vehicleId))
        .limit(1);

      // ── 2. Build template data ──
      const templateData: MessageTemplateData = {
        nombre_cliente: clientRow.name,
        vehiculo_marca: vehicleRow?.brand || "vehículo",
        vehiculo_modelo: vehicleRow?.model || "",
        chapa: vehicleRow?.plate || "S/N",
        id_orden: ordenId.substring(0, 8).toUpperCase(),
        monto_total: ordenRow.totalCost
          ? Number(ordenRow.totalCost).toLocaleString("es-PY")
          : "0",
      };

      // ── 3. Get factura number if finalizing ──
      if (estadoSolicitado === "FINALIZADO_RETIRADO") {
        const [facturaRow] = await db()
          .select({ id: facturas.id })
          .from(facturas)
          .where(eq(facturas.ordenId, ordenId))
          .limit(1);

        if (facturaRow) {
          templateData.numero_factura = facturaRow.id.substring(0, 8).toUpperCase();
        }

        // Default survey URL (configurable per tenant)
        templateData.url_encuesta_satisfaccion =
          "https://encuesta.taller.com.py/short?o=" + ordenId.substring(0, 8);
      }

      // ── 4. Build message ──
      let messageText: string;
      if (customMessage) {
        messageText = customMessage;
      } else {
        messageText = buildMessage(estadoSolicitado, templateData);
      }

      // ── 5. Send via Evolution API ──
      const hasPdf = estadoSolicitado === "PRESUPUESTADO" && pdfUrl;
      let result;

      if (hasPdf) {
        result = await sendDocumentMessage(
          tenantSlug,
          clientRow.phone,
          messageText,
          pdfUrl,
          `Presupuesto_Orden_${templateData.id_orden}.pdf`,
        );
      } else {
        result = await sendTextMessage(
          tenantSlug,
          clientRow.phone,
          messageText,
        );
      }

      // ── 6. Log the message ──
      const templateKey = Object.keys(MESSAGE_TEMPLATES).includes(estadoSolicitado)
        ? (estadoSolicitado as keyof typeof MESSAGE_TEMPLATES)
        : "CUSTOM";

      await db().insert(whatsappMessages).values({
        ordenId,
        clienteName: clientRow.name,
        phoneNumber: sanitizePhone(clientRow.phone),
        template: templateKey as any,
        messageText,
        hasAttachment: !!hasPdf,
        attachmentFilename: hasPdf ? `Presupuesto_${templateData.id_orden}.pdf` : null,
        status: result.success ? "SENT" : "FAILED",
        externalKey: result.key || null,
        errorMessage: result.error || null,
        sentBy: userEmail,
        tenantSlug,
        sentAt: result.success ? new Date() : null,
      });

      // ── 7. Respond ──
      if (!result.success) {
        return reply.status(500).send({
          error: "WhatsAppSendError",
          message: `Error de envío: ${result.error}`,
          details: {
            phone: sanitizePhone(clientRow.phone),
            template: estadoSolicitado,
          },
        });
      }

      return reply.status(201).send({
        success: true,
        messageId: result.key,
        template: estadoSolicitado,
        phone: sanitizePhone(clientRow.phone),
        sentAt: result.timestamp,
      });
    },
  );

  // ── POST /whatsapp/send-text — Send raw text ──
  app.post<{ Body: { phone: string; message: string } }>(
    "/whatsapp/send-text",
    {
      schema: {
        body: {
          type: "object",
          required: ["phone", "message"],
          properties: {
            phone: { type: "string" },
            message: { type: "string", maxLength: 4096 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { phone: string; message: string } }>,
      reply: FastifyReply,
    ) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { phone, message } = request.body;

      try {
        const result = await sendTextMessage(tenantSlug, phone, message);
        return reply.send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error de envío";
        return reply.status(500).send({ error: "WhatsAppSendError", message: msg });
      }
    },
  );

  // ── GET /whatsapp/log — Get message log ──
  app.get<{ Querystring: { ordenId?: string; page?: string; limit?: string } }>(
    "/whatsapp/log",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { ordenId, page: pageStr, limit: limitStr } = request.query;
      const page = pageStr ? parseInt(pageStr, 10) : 1;
      const limit = limitStr ? parseInt(limitStr, 10) : 20;
      const offset = (page - 1) * limit;

      const conditions = [eq(whatsappMessages.tenantSlug, tenantSlug)];
      if (ordenId) {
        conditions.push(eq(whatsappMessages.ordenId, ordenId));
      }

      const whereClause = and(...conditions);

      const [totalRow] = await db()
        .select({ total: count() })
        .from(whatsappMessages)
        .where(whereClause);

      const items = await db()
        .select()
        .from(whatsappMessages)
        .where(whereClause)
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(limit)
        .offset(offset);

      const total = Number(totalRow?.total ?? 0);

      return reply.send({
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      });
    },
  );

  // ── POST /whatsapp/disconnect — Disconnect ──
  app.post(
    "/whatsapp/disconnect",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        await disconnectInstance(tenantSlug);
        return reply.send({ success: true, message: "Instancia desconectada" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconectando";
        return reply.status(500).send({ error: "WhatsAppError", message: msg });
      }
    },
  );

  // ── DELETE /whatsapp/instance — Delete instance ──
  app.delete(
    "/whatsapp/instance",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        await deleteInstance(tenantSlug);
        return reply.send({ success: true, message: "Instancia eliminada" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error eliminando";
        return reply.status(500).send({ error: "WhatsAppError", message: msg });
      }
    },
  );

  // ── GET /whatsapp/errors — Get error log ──
  app.get<{ Querystring: { page?: string; limit?: string } }>(
    "/whatsapp/errors",
    async (request, reply) => {
      const tenantSlug = (request as any).tenantSlug as string;
      const { page: pageStr, limit: limitStr } = request.query;
      const page = pageStr ? parseInt(pageStr, 10) : 1;
      const limit = limitStr ? parseInt(limitStr, 10) : 20;

      try {
        const { getUnresolvedErrors, getErrorStats } = await import(
          "../../../shared/middleware/integration-error-logger.js"
        );

        const errors = await getUnresolvedErrors(tenantSlug, limit);
        const stats = await getErrorStats(tenantSlug);

        return reply.send({
          items: errors,
          stats,
          page,
          limit,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error obteniendo errores";
        return reply.status(500).send({ error: "ErrorLogError", message: msg });
      }
    },
  );

  // ── POST /whatsapp/errors/:errorId/resolve — Mark error as resolved ──
  app.post<{ Params: { errorId: string }; Body: { notes?: string } }>(
    "/whatsapp/errors/:errorId/resolve",
    {
      schema: {
        params: {
          type: "object",
          required: ["errorId"],
          properties: {
            errorId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            notes: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const userEmail = (request as any).userEmail as string || "system";
      const { errorId } = request.params;
      const { notes } = request.body || {};

      try {
        const { resolveError } = await import(
          "../../../shared/middleware/integration-error-logger.js"
        );

        await resolveError(errorId, userEmail, notes);
        return reply.send({ success: true, message: "Error marcado como resuelto" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error resolviendo";
        return reply.status(500).send({ error: "ResolveError", message: msg });
      }
    },
  );

  // ── POST /whatsapp/queue/process — Process pending messages ──
  app.post(
    "/whatsapp/queue/process",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const { processPendingMessages } = await import(
          "../services/whatsapp-queue.service.js"
        );
        const result = await processPendingMessages(tenantSlug);
        return reply.send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error procesando cola";
        return reply.status(500).send({ error: "QueueError", message: msg });
      }
    },
  );

  // ── POST /whatsapp/queue/retry — Retry failed messages ──
  app.post(
    "/whatsapp/queue/retry",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const { retryFailedMessages } = await import(
          "../services/whatsapp-queue.service.js"
        );
        const result = await retryFailedMessages(tenantSlug);
        return reply.send(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error reintentando";
        return reply.status(500).send({ error: "RetryError", message: msg });
      }
    },
  );

  // ── GET /whatsapp/queue/stats — Get queue statistics ──
  app.get(
    "/whatsapp/queue/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenantSlug = (request as any).tenantSlug as string;

      try {
        const { getQueueStats } = await import(
          "../services/whatsapp-queue.service.js"
        );
        const stats = await getQueueStats(tenantSlug);
        return reply.send(stats);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error obteniendo estadísticas";
        return reply.status(500).send({ error: "StatsError", message: msg });
      }
    },
  );
}
