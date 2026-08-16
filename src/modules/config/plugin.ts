import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getSettings, saveSettings, getLogoBase64, invalidateCache } from "./services/TenantConfigService.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { BadRequestError } from "../../shared/errors/app-error.js";
import { resolveTenant } from "../../shared/middleware/tenant-resolver.js";
import { resolveProfile } from "../../shared/middleware/rbac.js";
import { profileRoutes } from "./routes/profiles.js";
import { authRoutes } from "./routes/auth.js";
import { sucursalesRoutes } from "./routes/sucursales.routes.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);
const MAX_BYTES = 5 * 1024 * 1024;

async function configPlugin(app: FastifyInstance): Promise<void> {
  // ── Protected config routes (tenant-scoped + profile resolution) ──
  // Registered in a nested scope so the tenant/auth hooks do NOT apply to the
  // public /api/auth/* routes below (login must not require X-Tenant-Slug).
  await app.register(async (protectedApp: FastifyInstance): Promise<void> => {
    protectedApp.addHook("onRequest", resolveTenant);
    protectedApp.addHook("onRequest", resolveProfile);

    protectedApp.get("/api/config/settings", async (request: FastifyRequest, reply: FastifyReply) => {
      const settings = await getSettings(request.tenantSlug);
      return reply.send(settings);
    });

    protectedApp.put("/api/config/settings", async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;
      const updated = await saveSettings(body, request.tenantSlug);
      return reply.send(updated);
    });

    protectedApp.post("/api/config/upload-logo", async (request: FastifyRequest, reply: FastifyReply) => {
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

      // Logo per-tenant: assets/uploads/logo.<slug>.png
      // El logo global company_logo.png queda como fallback/legacy.
      const uploadDir = join(process.cwd(), "assets", "uploads");
      await mkdir(uploadDir, { recursive: true });
      const logoName = request.tenantSlug
        ? `logo.${request.tenantSlug}.png`
        : "company_logo.png";
      await writeFile(join(uploadDir, logoName), Buffer.concat(chunks));

      invalidateCache(request.tenantSlug);
      const logoBase64 = await getLogoBase64(request.tenantSlug);

      return reply.send({ ok: true, logoBase64 });
    });

    protectedApp.get("/api/config/logo", async (request: FastifyRequest, reply: FastifyReply) => {
      const logoBase64 = await getLogoBase64(request.tenantSlug);
      return reply.send({ logoBase64 });
    });

    // Sucursales routes already enforce requireAdmin; give them tenant+profile context.
    await protectedApp.register(sucursalesRoutes);
  });

  // ── Public auth routes (login/logout) + profile routes (own resolveTenant) ──
  await app.register(profileRoutes);
  await app.register(authRoutes);

  app.log.info("Config module registered");
}

export default configPlugin;
