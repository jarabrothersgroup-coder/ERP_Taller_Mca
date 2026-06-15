import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { chunkText, generateEmbedding, storeChunks, queryRag } from "./manual-ingestion.service.js";
import { BadRequestError } from "../../../shared/errors/app-error.js";

interface IngestResponse {
  ok: true;
  chunksStored: number;
  vehicleId?: string;
}

interface QueryBody {
  question: string;
  vehicleId?: string;
  topK?: number;
}

export async function ragRoutes(app: FastifyInstance): Promise<void> {
  app.post("/intelligence/manuals/ingest", async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) throw new BadRequestError("Archivo PDF requerido");

    const vehicleId = (request.query as any).vehicleId as string | undefined;
    const buffers: Buffer[] = [];
    await pipeline(data.file, new Writable({
      write(chunk: Buffer, _enc, cb) {
        buffers.push(chunk);
        cb();
      },
    }));

    const pdfBuffer = Buffer.concat(buffers);
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(pdfBuffer);

    const fullText = parsed.text ?? "";
    const numPages = (parsed.numpages as number) ?? 1;
    const charsPerPage = Math.max(Math.floor(fullText.length / numPages), 1);

    const allChunks: Array<{ content: string; pageNumber: number; section: string | null }> = [];

    for (let p = 0; p < numPages; p++) {
      const start = p * charsPerPage;
      const end = Math.min((p + 1) * charsPerPage, fullText.length);
      const pageText = fullText.slice(start, end);
      const pageChunks = await chunkText(pageText, p + 1, null);
      allChunks.push(...pageChunks);
    }

    const batchSize = 20;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const embeddings = await Promise.all(
        batch.map((c) =>
          generateEmbedding(c.content).catch(() => null as number[] | null),
        ),
      );
      const valid = batch.filter((_, j) => embeddings[j] !== null);
      const validEmb = embeddings.filter((e): e is number[] => e !== null);
      if (valid.length > 0) {
        await storeChunks(vehicleId, valid, validEmb);
      }
    }

    const response: IngestResponse = { ok: true, chunksStored: allChunks.length, vehicleId };
    return reply.status(201).send(response);
  });

  app.post<{ Body: QueryBody }>(
    "/intelligence/manuals/query",
    {
      schema: {
        body: {
          type: "object",
          required: ["question"],
          properties: {
            question: { type: "string", minLength: 3 },
            vehicleId: { type: "string", format: "uuid" },
            topK: { type: "integer", minimum: 1, maximum: 20 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: QueryBody }>, reply: FastifyReply) => {
      const { question, vehicleId, topK } = request.body;
      if (!question || question.trim().length < 3) {
        throw new BadRequestError("La consulta debe tener al menos 3 caracteres");
      }
      const result = await queryRag({ question, vehicleId, topK });
      return reply.send(result);
    },
  );
}
