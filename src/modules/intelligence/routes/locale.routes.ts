import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../../../shared/public/locales");

// Pre-load locale files at startup for performance
const LOCALES: Record<string, string> = {
  es: readFileSync(join(localesDir, "es.json"), "utf-8"),
  gu: readFileSync(join(localesDir, "gu.json"), "utf-8"),
};

const SUPPORTED = ["es", "gu"];

/**
 * Locale API routes — serves translation JSON files.
 * GET /api/v1/locale/:lang — returns translation file for given language
 * GET /api/v1/locale — returns list of supported locales
 */
async function localeRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/locale — List supported locales
   */
  app.get("/api/v1/locale", async (_req, reply) => {
    return reply.send({
      supported: SUPPORTED,
      default: "es",
    });
  });

  /**
   * GET /api/v1/locale/:lang — Get translation file
   */
  app.get<{ Params: { lang: string } }>(
    "/api/v1/locale/:lang",
    async (req, reply) => {
      const { lang } = req.params;
      const safe = lang.split(".")[0]; // path traversal guard

      if (!SUPPORTED.includes(safe)) {
        return reply.status(404).send({
          error: "Locale not found",
          supported: SUPPORTED,
        });
      }

      const json = LOCALES[safe];
      if (!json) {
        return reply.status(404).send({ error: "Locale file missing" });
      }

      return reply
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Cache-Control", "public, max-age=86400")
        .send(json);
    },
  );

  app.log.info("Locale API routes registered");
}

export default localeRoutes;
