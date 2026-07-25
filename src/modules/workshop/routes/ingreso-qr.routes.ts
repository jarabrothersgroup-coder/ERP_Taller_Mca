/**
 * Ingreso QR Routes — Generate QR code for vehicle check-in.
 *
 * Endpoints:
 *   GET /workshop/ingresos/:id/qr — Returns QR code as PNG image
 *
 * @module workshop/routes/ingreso-qr
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { generateIngresoQR } from "../services/ingreso-qr.service.js";

export async function ingresoQRRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /workshop/ingresos/:id/qr — Generate QR code PNG ──
  app.get<{ Params: { id: string } }>(
    "/workshop/ingresos/:id/qr",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: ingresoId } = request.params;
      const tenantSlug = request.tenantSlug;

      try {
        const buffer = await generateIngresoQR(ingresoId, tenantSlug);

        return reply
          .header("Content-Type", "image/png")
          .header(
            "Content-Disposition",
            `inline; filename="ingreso-${ingresoId.slice(0, 8)}.png"`,
          )
          .send(buffer);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("no encontrado")) {
          return reply.status(404).send({ error: message });
        }
        throw err;
      }
    },
  );
}
