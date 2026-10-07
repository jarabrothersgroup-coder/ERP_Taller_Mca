/**
 * Client Portal Routes — Auth + self-service + data access.
 *
 * Routes:
 *   POST /portal/auth/magic        — Generate magic link
 *   GET  /portal/auth/magic/:token — Validate magic link
 *   POST /portal/auth/pin          — Generate PIN
 *   POST /portal/auth/pin/validate — Validate PIN
 *   GET  /portal/session           — Validate session
 *   GET  /portal/summary           — Client summary
 *   GET  /portal/vehicles          — Client vehicles
 *   GET  /portal/orders            — Client work orders
 *   GET  /portal/invoices          — Client invoices
 *   POST /portal/feedback          — Submit feedback
 *   GET  /portal/availability      — Check appointment availability
 *   POST /portal/appointments      — Book appointment
 *
 * @module client-portal/routes/portal.routes
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../../config/env.js";
import {
  generateMagicLink,
  validateMagicLink,
  generatePIN,
  validatePIN,
  encodeSession,
  decodeSession,
} from "../services/portal-auth.service.js";
import {
  getClientSummary,
  getClientVehicles,
  getClientOrders,
  getClientOrderById,
  getClientInvoices,
  submitFeedback,
  checkAvailability,
  bookAppointment,
} from "../services/portal.service.js";

export async function portalRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /portal/auth/magic — Generate magic link ──
  app.post("/portal/auth/magic", async (request, reply) => {
    const tenantSlug = request.tenantSlug;
    const { email } = request.body as { email: string };

    if (!email) return reply.status(400).send({ error: "email is required" });

    const result = await generateMagicLink(tenantSlug, email);
    return reply.send(result);
  });

  // ── GET /portal/auth/magic/:token — Validate magic link ──
  // Handler compartido con el alias /portal/api/auth/magic/:token (abajo).
  const validateMagicToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const { session, error } = await validateMagicLink(token);

    if (!session) return reply.status(401).send({ error });

    const encodedSession = encodeSession(session);
    return reply.send({ session: encodedSession, client: { name: session.name, email: session.email } });
  };
  app.get("/portal/auth/magic/:token", validateMagicToken);

  // ── GET /portal/api/auth/magic/:token — Alias para el fetch del cliente ──
  // La página Next `/portal/auth/magic/[token]` y esta API comparten path;
  // con el rewrite `/portal/:path*` en la sección `fallback` de Next la
  // página gana y el fetch del cliente recibía HTML en vez de JSON. El page
  // component valida por este alias, que sí cae en el fallback rewrite
  // porque no existe página Next bajo `/portal/api/*`.
  app.get("/portal/api/auth/magic/:token", validateMagicToken);

  // ── POST /portal/auth/pin — Generate PIN ──
  app.post("/portal/auth/pin", async (request, reply) => {
    const tenantSlug = request.tenantSlug;
    const { clientId } = request.body as { clientId: string };

    if (!clientId) return reply.status(400).send({ error: "clientId is required" });

    const result = await generatePIN(tenantSlug, clientId);
    return reply.send(result);
  });

  // ── POST /portal/auth/pin/validate — Validate PIN ──
  app.post("/portal/auth/pin/validate", async (request, reply) => {
    const tenantSlug = request.tenantSlug;
    const { clientId, pin } = request.body as { clientId: string; pin: string };

    if (!clientId || !pin) {
      return reply.status(400).send({ error: "clientId and pin are required" });
    }

    const { session, error } = await validatePIN(tenantSlug, clientId, pin);
    if (!session) return reply.status(401).send({ error });

    const encodedSession = encodeSession(session);
    return reply.send({ session: encodedSession, client: { name: session.name, email: session.email } });
  });

  // ── Middleware: validate session for portal routes ──
  const requirePortalSession = async (request: any, reply: any) => {
    const sessionToken = request.headers["x-portal-session"];
    if (!sessionToken) {
      return reply.status(401).send({ error: "Portal session required" });
    }

    const session = decodeSession(sessionToken);
    if (!session) {
      return reply.status(401).send({ error: "Invalid or expired session" });
    }

    request.portalSession = session;
  };

  // ── GET /portal/session — Validate session ──
  app.get("/portal/session", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    return reply.send({ valid: true, client: { name: session.name, email: session.email } });
  });

  // ── GET /portal/summary — Client summary ──
  app.get("/portal/summary", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const summary = await getClientSummary(session.tenantSlug, session.clientId);
    if (!summary) return reply.status(404).send({ error: "Client not found" });
    return reply.send(summary);
  });

  // ── GET /portal/vehicles — Client vehicles ──
  app.get("/portal/vehicles", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const vehicles = await getClientVehicles(session.tenantSlug, session.clientId);
    return reply.send(vehicles);
  });

  // ── GET /portal/orders — Client work orders ──
  app.get("/portal/orders", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const { limit } = request.query as { limit?: string };
    const orders = await getClientOrders(session.tenantSlug, session.clientId, limit ? parseInt(limit) : 20);
    return reply.send(orders);
  });

  // ── GET /portal/invoices — Client invoices ──
  app.get("/portal/invoices", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const invoices = await getClientInvoices(session.tenantSlug, session.clientId);
    return reply.send(invoices);
  });

  // ── POST /portal/invoices/:id/pay — Generate payment link ──
  app.post("/portal/invoices/:id/pay", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const { id } = request.params as { id: string };
    const { provider } = (request.body || {}) as { provider?: string };

    try {
      const { generatePaymentLink } = await import(
        "../../finance/services/treasury/online-payment.service.js"
      );

      const baseUrl = env.APP_URL || "http://localhost:3000";
      const result = await generatePaymentLink(
        {
          facturaId: id,
          provider: (provider === "PAGOS_PY" ? "PAGOS_PY" : "STRIPE") as "STRIPE" | "PAGOS_PY",
          successUrl: `${baseUrl}/portal/facturas?payment=success`,
          cancelUrl: `${baseUrl}/portal/facturas?payment=cancelled`,
        },
        session.tenantSlug,
      );

      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err?.message || "Error al generar link de pago" });
    }
  });

  // ── GET /portal/orders/:id — Single order detail ──
  app.get("/portal/orders/:id", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const { id } = request.params as { id: string };
    const order = await getClientOrderById(session.tenantSlug, session.clientId, id);
    if (!order) return reply.status(404).send({ error: "Orden no encontrada" });
    return reply.send(order);
  });

  // ── POST /portal/feedback — Submit feedback ──
  app.post("/portal/feedback", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const { ordenId, rating, comment } = request.body as {
      ordenId: string;
      rating: number;
      comment?: string;
    };

    if (!ordenId || !rating) {
      return reply.status(400).send({ error: "ordenId and rating are required" });
    }

    try {
      const result = await submitFeedback({
        tenantSlug: session.tenantSlug,
        ordenId,
        clientId: session.clientId,
        rating,
        comment,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ── GET /portal/availability — Check availability ──
  app.get("/portal/availability", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const { date } = request.query as { date: string };
    if (!date) return reply.status(400).send({ error: "date is required" });

    const result = await checkAvailability(session.tenantSlug, date);
    return reply.send(result);
  });

  // ── POST /portal/appointments — Book appointment ──
  app.post("/portal/appointments", { preHandler: [requirePortalSession] }, async (request, reply) => {
    const session = (request as any).portalSession;
    const { vehicleId, date, time, motivo } = request.body as {
      vehicleId: string;
      date: string;
      time: string;
      motivo: string;
    };

    if (!vehicleId || !date || !time || !motivo) {
      return reply.status(400).send({ error: "vehicleId, date, time, motivo are required" });
    }

    try {
      const result = await bookAppointment({
        tenantSlug: session.tenantSlug,
        clientId: session.clientId,
        vehicleId,
        date,
        time,
        motivo,
        phone: session.email || "",
      });
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
