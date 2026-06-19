import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getSettings, saveSettings, getLogoBase64, invalidateCache } from "./services/TenantConfigService.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { BadRequestError } from "../../shared/errors/app-error.js";
import { profileRoutes } from "./routes/profiles.js";
import { authRoutes } from "./routes/auth.js";
import { sucursalesRoutes } from "./routes/sucursales.routes.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);
const MAX_BYTES = 5 * 1024 * 1024;

async function configPlugin(app: FastifyInstance): Promise<void> {
  app.get("/api/config/settings", async (_req: FastifyRequest, reply: FastifyReply) => {
    const settings = await getSettings();
    return reply.send(settings);
  });

  app.put("/api/config/settings", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const updated = await saveSettings(body);
    return reply.send(updated);
  });

  app.post("/api/config/upload-logo", async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) throw new BadRequestError("Archivo de imagen requerido");

    if (!ALLOWED_MIME.has(data.mimetype)) {
      throw new BadRequestError(
        `Tipo de archivo no permitido: ${data.mimetype}. Use PNG o JPEG.`,
      );
    }

    let totalBytes = 0;
    const chunks: Buffer[] = [];

    await pipeline(
      data.file,
      new Writable({
        write(chunk: Buffer, _enc, cb) {
          totalBytes += chunk.length;
          if (totalBytes > MAX_BYTES) {
            cb(new Error(`El archivo excede el límite de 5MB`));
            return;
          }
          chunks.push(chunk);
          cb();
        },
      }),
    );

    const uploadDir = join(process.cwd(), "assets", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, "company_logo.png"), Buffer.concat(chunks));

    invalidateCache();
    const logoBase64 = await getLogoBase64();

    return reply.send({ ok: true, logoBase64 });
  });

  app.get("/api/config/logo", async (_req: FastifyRequest, reply: FastifyReply) => {
    const logoBase64 = await getLogoBase64();
    return reply.send({ logoBase64 });
  });

  await app.register(profileRoutes);
  await app.register(authRoutes);
  await app.register(sucursalesRoutes);

  app.log.info("Config module registered");
}

export default configPlugin;
