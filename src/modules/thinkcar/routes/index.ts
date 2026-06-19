import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, like, and, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { thinkcarImports } from "../schema/index.js";
import { processBuffer } from "../services/thinkcar-pipeline.service.js";
import { ingestFromUsb } from "../services/thinkcar-usb.service.js";
import { checkEmailNow } from "../services/thinkcar-email.service.js";
import { scanAndIngest } from "../services/thinkcar-bluetooth.service.js";
import { smartLink, updateOrdenDtcs, updateVehicleDtcs } from "../services/thinkcar-linker.service.js";
import { getAllHealth } from "../services/thinkcar-health.service.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import { BadRequestError, NotFoundError } from "../../../shared/errors/app-error.js";

interface ListQuery {
  status?: string;
  vin?: string;
  limit?: string;
  offset?: string;
}

export async function thinkcarRoutes(app: FastifyInstance): Promise<void> {
  app.get("/thinkcar/imports", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as ListQuery;
    const limit = Math.min(parseInt(query.limit ?? "50", 10), 200);
    const offset = parseInt(query.offset ?? "0", 10);

    const conditions = [];
    if (query.status) {
      conditions.push(eq(thinkcarImports.status, query.status));
    }
    if (query.vin) {
      conditions.push(like(thinkcarImports.vin, `%${query.vin}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, total] = await Promise.all([
      db()
        .select()
        .from(thinkcarImports)
        .where(where)
        .orderBy(desc(thinkcarImports.createdAt))
        .limit(limit)
        .offset(offset),
      db()
        .select({ count: sql<number>`count(*)` })
        .from(thinkcarImports)
        .where(where)
        .then((r) => Number(r[0]?.count ?? 0)),
    ]);

    return reply.send({ data: rows, total, limit, offset });
  });

  app.get<{ Params: { id: string } }>(
    "/thinkcar/imports/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const [record] = await db()
        .select()
        .from(thinkcarImports)
        .where(eq(thinkcarImports.id, id))
        .limit(1);
      if (!record) throw new NotFoundError(`Importe ${id} no encontrado`);
      return reply.send(record);
    },
  );

  app.post<{ Params: { id: string }; Body: { vin?: string; ordenTrabajoId?: string; clientId?: string } }>(
    "/thinkcar/imports/:id/link",
    async (request: FastifyRequest<{ Params: { id: string }; Body: { vin?: string; ordenTrabajoId?: string; clientId?: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { vin, ordenTrabajoId, clientId } = request.body;

      const [record] = await db()
        .select()
        .from(thinkcarImports)
        .where(eq(thinkcarImports.id, id))
        .limit(1);
      if (!record) throw new NotFoundError(`Importe ${id} no encontrado`);

      const updateData: Record<string, any> = { status: "linked", updatedAt: new Date() };
      if (vin) updateData.vin = vin;
      if (ordenTrabajoId) updateData.ordenTrabajoId = ordenTrabajoId;
      if (clientId) updateData.clientId = clientId;

      await db()
        .update(thinkcarImports)
        .set(updateData)
        .where(eq(thinkcarImports.id, id));

      return reply.send({ ok: true, id, status: "linked" });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/thinkcar/imports/:id/retry-link",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

    const [record] = await db()
      .select()
      .from(thinkcarImports)
      .where(eq(thinkcarImports.id, id))
      .limit(1);
    if (!record) throw new NotFoundError(`Importe ${id} no encontrado`);

    const result = await smartLink(record);
    return reply.send({ ok: true, id, linking: result });
  });

  app.post("/thinkcar/import", async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) throw new BadRequestError("Archivo PDF requerido");

    const buffers: Buffer[] = [];
    const { Writable } = await import("node:stream");
    const { pipeline } = await import("node:stream/promises");
    await pipeline(
      data.file,
      new Writable({
        write(chunk: Buffer, _enc, cb) {
          buffers.push(chunk);
          cb();
        },
      }),
    );

    const pdfBuffer = Buffer.concat(buffers);
    const result = await processBuffer(
      pdfBuffer,
      data.filename ?? "upload.pdf",
      "api",
    );

    return reply.status(result.status === "error" ? 422 : 201).send(result);
  });

  app.post("/thinkcar/ingest/usb", async (_request, reply) => {
    const result = await ingestFromUsb(false);
    return reply.send(result);
  });

  app.post("/thinkcar/ingest/email", async (_request, reply) => {
    const count = await checkEmailNow();
    return reply.send({ processed: count, message: `Procesados ${count} adjuntos de correo` });
  });

  app.post("/thinkcar/ingest/bluetooth", async (_request, reply) => {
    const count = await scanAndIngest();
    return reply.send({ processed: count, message: `Escaneados ${count} dispositivos Bluetooth` });
  });

  app.get("/thinkcar/health", async (_request, reply) => {
    const health = getAllHealth();
    return reply.send({
      channels: health,
      allHealthy: health.every((h) => h.isHealthy),
    });
  });

  app.get("/thinkcar/stats", async (_request, reply) => {
    const stats = await db()
      .select({
        status: thinkcarImports.status,
        count: sql<number>`count(*)::int`,
      })
      .from(thinkcarImports)
      .groupBy(thinkcarImports.status);

    const total = stats.reduce((acc, s) => acc + s.count, 0);
    return reply.send({ total, byStatus: stats });
  });

  // ── GET /thinkcar/pending — Diagnósticos pendientes de asignar ──

  app.get("/thinkcar/pending", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit ?? "50", 10), 200);
    const offset = parseInt(query.offset ?? "0", 10);

    const [rows, total] = await Promise.all([
      db()
        .select()
        .from(thinkcarImports)
        .where(eq(thinkcarImports.status, "manual_review"))
        .orderBy(desc(thinkcarImports.createdAt))
        .limit(limit)
        .offset(offset),
      db()
        .select({ count: sql<number>`count(*)` })
        .from(thinkcarImports)
        .where(eq(thinkcarImports.status, "manual_review"))
        .then((r) => Number(r[0]?.count ?? 0)),
    ]);

    return reply.send({ data: rows, total, limit, offset });
  });

  // ── POST /thinkcar/pending/:id/assign — Asignación manual a OT ──

  app.post<{ Params: { id: string }; Body: { ordenTrabajoId: string } }>(
    "/thinkcar/pending/:id/assign",
    async (request: FastifyRequest<{ Params: { id: string }; Body: { ordenTrabajoId: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { ordenTrabajoId } = request.body;

      if (!ordenTrabajoId) {
        throw new BadRequestError("ordenTrabajoId es requerido");
      }

      const [record] = await db()
        .select()
        .from(thinkcarImports)
        .where(eq(thinkcarImports.id, id))
        .limit(1);
      if (!record) throw new NotFoundError(`Importe ${id} no encontrado`);

      const [orden] = await db()
        .select()
        .from(ordenesTrabajo)
        .where(eq(ordenesTrabajo.id, ordenTrabajoId))
        .limit(1);
      if (!orden) throw new NotFoundError(`Orden de trabajo ${ordenTrabajoId} no encontrada`);

      await db()
        .update(thinkcarImports)
        .set({
          status: "linked",
          ordenTrabajoId,
          vehicleId: orden.vehicleId,
          clientId: orden.clientId,
          pendingAssignment: false,
          updatedAt: new Date(),
        })
        .where(eq(thinkcarImports.id, id));

      if (record.dtcCodes && record.dtcCodes.length > 0) {
        await updateOrdenDtcs(
          ordenTrabajoId,
          record.dtcCodes,
          `Diagnóstico Thinkcar asignado manualmente el ${new Date().toISOString().split("T")[0]}`,
        );
        await updateVehicleDtcs(orden.vehicleId, record.dtcCodes);
      }

      return reply.send({
        ok: true,
        importId: id,
        ordenTrabajoId,
        status: "linked",
        message: `Diagnóstico vinculado a la OT #${ordenTrabajoId.slice(0, 8)}`,
      });
    },
  );

  // ── POST /thinkcar/upload — Upload desde navegador (Bluetooth/USB web) ──

  app.post("/thinkcar/upload", async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) throw new BadRequestError("Archivo requerido (.pdf, .json o .csv)");

    const allowedExts = [".pdf", ".json", ".csv"];
    const ext = (data.filename ?? "").toLowerCase().slice(-4);
    if (!allowedExts.some((e) => ext.endsWith(e))) {
      throw new BadRequestError("Formato no soportado. Use .pdf, .json o .csv");
    }

    const buffers: Buffer[] = [];
    const { Writable } = await import("node:stream");
    const { pipeline } = await import("node:stream/promises");
    await pipeline(
      data.file,
      new Writable({
        write(chunk: Buffer, _enc, cb) {
          buffers.push(chunk);
          cb();
        },
      }),
    );

    const fileBuffer = Buffer.concat(buffers);

    if (fileBuffer.length > 50 * 1024 * 1024) {
      throw new BadRequestError("Archivo excede el límite de 50 MB");
    }

    const result = await processBuffer(
      fileBuffer,
      data.filename ?? "upload.pdf",
      "api",
    );

    return reply.status(result.status === "error" ? 422 : 201).send(result);
  });

  // ── GET /thinkcar/pending/count — Conteo rápido de pendientes ──

  app.get("/thinkcar/pending/count", async (_request, reply) => {
    const [result] = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(thinkcarImports)
      .where(eq(thinkcarImports.status, "manual_review"));

    return reply.send({ count: result?.count ?? 0 });
  });
}
