/**
 * Lead Capture Route — Landing page form submissions.
 *
 * POST /api/lead — Capture a lead from the landing page (public, no auth)
 *
 * @module marketing/routes/lead
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface LeadRequest {
  nombre: string;
  email: string;
  source?: string;
}

// In-memory store (replace with DB table in production)
const leads: Array<{
  id: string;
  nombre: string;
  email: string;
  source: string;
  createdAt: string;
}> = [];

export async function leadRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: LeadRequest }>(
    "/api/lead",
    {
      // No auth required — this is a public landing page endpoint
      schema: {
        body: {
          type: "object",
          required: ["nombre", "email"],
          properties: {
            nombre: { type: "string", minLength: 1, maxLength: 200 },
            email: { type: "string", format: "email" },
            source: { type: "string", default: "landing" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LeadRequest }>, reply: FastifyReply) => {
      const { nombre, email, source } = request.body;

      // Basic sanitization
      const cleanNombre = nombre.trim().replace(/<[^>]*>/g, "");
      const cleanEmail = email.trim().toLowerCase();

      // Check for duplicate email
      const existing = leads.find((l) => l.email === cleanEmail);
      if (existing) {
        return reply.status(200).send({
          success: true,
          message: "Ya tenemos tu registro. ¡Gracias!",
          duplicate: true,
        });
      }

      const lead = {
        id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: cleanNombre,
        email: cleanEmail,
        source: source || "landing",
        createdAt: new Date().toISOString(),
      };

      leads.push(lead);

      console.log(`[LEAD] New lead captured: ${cleanNombre} <${cleanEmail}> from ${source || "landing"}`);

      return reply.status(201).send({
        success: true,
        message: "¡Gracias! Recibirás la guía en tu correo electrónico.",
        leadId: lead.id,
      });
    },
  );
}
