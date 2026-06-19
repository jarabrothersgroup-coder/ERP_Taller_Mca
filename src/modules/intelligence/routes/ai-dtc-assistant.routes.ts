/**
 * AI DTC Assistant Routes — diagnostic suggestion endpoints.
 *
 * Endpoints:
 *   POST /intelligence/ai-diagnosis — Analyze DTC codes with AI
 *   GET  /intelligence/ai-diagnosis/:codigo — Get basic suggestions for DTC
 *   POST /intelligence/ai-diagnosis/apply — Apply AI suggestion to a work order
 *
 * @module intelligence/routes/ai-dtc-assistant.routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import { analyzeDTCs } from "../services/ai-dtc-assistant.service.js";

interface DiagnoseBody {
  codigo: string;
  descripcion: string;
  vehiculo: string;
  kilometraje?: number;
}

interface CodigoParams {
  codigo: string;
}

interface ApplyDiagnosisBody {
  ordenTrabajoId: string;
  codigo: string;
  causaProbable: string;
  recomendaciones?: string;
  repuestosNecesarios?: string[];
  tiempoEstimadoHoras?: number;
  costoEstimado?: number;
}

export async function aiDTCAssistantRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── POST /intelligence/ai-diagnosis — Analyze DTCs ──
  app.post<{ Body: DiagnoseBody }>(
    "/intelligence/ai-diagnosis",
    {
      schema: {
        body: {
          type: "object",
          required: ["codigo", "descripcion", "vehiculo"],
          properties: {
            codigo: { type: "string", minLength: 1 },
            descripcion: { type: "string" },
            vehiculo: { type: "string" },
            kilometraje: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: DiagnoseBody }>, reply: FastifyReply) => {
      const result = await analyzeDTCs(request.body);
      return reply.send(result);
    },
  );

  // ── GET /intelligence/ai-diagnosis/:codigo — Basic suggestions ──
  app.get<{ Params: CodigoParams }>(
    "/intelligence/ai-diagnosis/:codigo",
    {
      schema: {
        params: {
          type: "object",
          required: ["codigo"],
          properties: { codigo: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: CodigoParams }>, reply: FastifyReply) => {
      const result = await analyzeDTCs({
        codigo: request.params.codigo,
        descripcion: "",
        vehiculo: "No especificado",
      });
      return reply.send(result);
    },
  );

  // ── POST /intelligence/ai-diagnosis/apply — Apply AI suggestion to OT ──
  app.post<{ Body: ApplyDiagnosisBody }>(
    "/intelligence/ai-diagnosis/apply",
    {
      schema: {
        body: {
          type: "object",
          required: ["ordenTrabajoId", "codigo", "causaProbable"],
          properties: {
            ordenTrabajoId: { type: "string", format: "uuid" },
            codigo: { type: "string", minLength: 1 },
            causaProbable: { type: "string", minLength: 1 },
            recomendaciones: { type: "string" },
            repuestosNecesarios: {
              type: "array",
              items: { type: "string" },
            },
            tiempoEstimadoHoras: { type: "number", minimum: 0 },
            costoEstimado: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: ApplyDiagnosisBody }>,
      reply: FastifyReply,
    ) => {
      const {
        ordenTrabajoId,
        codigo,
        causaProbable,
        recomendaciones,
        repuestosNecesarios,
        tiempoEstimadoHoras,
        costoEstimado,
      } = request.body;

      // 1. Fetch the work order
      const [orden] = await db()
        .select()
        .from(ordenesTrabajo)
        .where(eq(ordenesTrabajo.id, ordenTrabajoId))
        .limit(1);

      if (!orden) {
        return reply.status(404).send({
          error: "NotFoundError",
          message: `Orden de trabajo ${ordenTrabajoId} no encontrada`,
        });
      }

      // 2. Build the diagnosis note
      const timestamp = new Date().toISOString().split("T")[0];
      const existingDiag = orden.diagnosis || "";
      const newDiagBlock = [
        `--- Diagnostico IA (${timestamp}) ---`,
        `Codigo: ${codigo}`,
        `Causa probable: ${causaProbable}`,
        recomendaciones ? `Procedimiento: ${recomendaciones}` : null,
        repuestosNecesarios && repuestosNecesarios.length > 0
          ? `Repuestos: ${repuestosNecesarios.join(", ")}`
          : null,
        tiempoEstimadoHoras ? `Tiempo estimado: ${tiempoEstimadoHoras}h` : null,
        costoEstimado ? `Costo estimado: Gs. ${costoEstimado.toLocaleString("es-PY")}` : null,
        `--- Fin diagnostico IA ---`,
      ]
        .filter(Boolean)
        .join("\n");

      const updatedDiagnosis = existingDiag
        ? `${existingDiag}\n\n${newDiagBlock}`
        : newDiagBlock;

      // 3. Merge DTC codes
      const existingDtcs = orden.dtcCodes || [];
      const newDtcs = codigo
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length >= 3);
      const mergedDtcs = Array.from(new Set([...existingDtcs, ...newDtcs]));

      // 4. Update the work order
      await db()
        .update(ordenesTrabajo)
        .set({
          diagnosis: updatedDiagnosis,
          dtcCodes: mergedDtcs,
          updatedAt: new Date(),
        })
        .where(eq(ordenesTrabajo.id, ordenTrabajoId));

      return reply.send({
        ok: true,
        ordenTrabajoId,
        diagnosis: updatedDiagnosis,
        dtcCodes: mergedDtcs,
        appliedAt: new Date().toISOString(),
        message: `Diagnostico IA aplicado a la OT #${ordenTrabajoId.slice(0, 8)}`,
      });
    },
  );
}
