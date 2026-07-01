/**
 * Local Storage Plugin — Serves files from the local filesystem.
 *
 * Registers a Fastify route that serves files stored in the
 * on-premise storage directory. Replaces Supabase Storage URLs.
 *
 * Route: GET /storage/:bucket/*path
 *
 * Security:
 *   - Path traversal prevention (resolved paths must stay within STORAGE_ROOT)
 *   - Private by default (no caching of sensitive DVI photos)
 *   - Content-Type detection from file extension
 *
 * @module plugins/storage
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const STORAGE_ROOT = resolve(process.env["STORAGE_PATH"] || "/data/erp-storage");

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
  csv: "text/csv",
  json: "application/json",
};

function detectContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME_MAP[ext] || "application/octet-stream";
}

/**
 * Fastify plugin that serves files from local storage.
 */
export async function storagePlugin(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { bucket: string; path: string };
  }>("/storage/:bucket/*path", async (request: FastifyRequest, reply: FastifyReply) => {
    const { bucket } = request.params as { bucket: string };

    // Fastify wildcard param is an array of path segments
    const pathSegments = (request.params as { path: string }).path;
    // The wildcard captures everything after /storage/:bucket/
    // We need to reconstruct from the raw URL
    const urlPath = request.url.split("?")[0]; // Remove query string
    const storagePrefix = `/storage/${bucket}/`;
    const relativePath = urlPath.startsWith(storagePrefix)
      ? urlPath.slice(storagePrefix.length)
      : pathSegments;

    const fullPath = join(STORAGE_ROOT, bucket, relativePath);

    // Security: prevent path traversal
    const resolved = resolve(fullPath);
    if (!resolved.startsWith(STORAGE_ROOT)) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      const data = await readFile(resolved);
      const contentType = detectContentType(relativePath);

      return reply
        .header("Content-Type", contentType)
        .header("Cache-Control", "private, max-age=3600")
        .header("X-Content-Type-Options", "nosniff")
        .send(data);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return reply.status(404).send({ error: "File not found" });
      }
      app.log.error({ err }, "Storage error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.log.info("Local storage plugin registered (GET /storage/:bucket/*)");
}
