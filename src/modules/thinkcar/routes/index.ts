import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, like, and, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { thinkcarImports } from "../schema/index.js";
import { processBuffer } from "../services/thinkcar-pipeline.service.js";
import { ingestFromUsb } from "../services/thinkcar-usb.service.js";
import { checkEmailNow } from "../services/thinkcar-email.service.js";
import { scanAndIngest } from "../services/thinkcar-bluetooth.service.js";
import { smartLink } from "../services/thinkcar-linker.service.js";
import { getAllHealth } from "../services/thinkcar-health.service.js";
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
}
