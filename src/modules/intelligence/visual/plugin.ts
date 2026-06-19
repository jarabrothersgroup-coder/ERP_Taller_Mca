import type { FastifyInstance } from "fastify";
import WebSocket from "@fastify/websocket";
import { VisualStreamGateway } from "./VisualStreamGateway.js";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tvHtml = readFileSync(join(__dirname, "tv-template.html"), "utf-8");

const publicDir = resolve(__dirname, "../../../shared/public");
const dashboardHtml = readFileSync(join(publicDir, "index.html"), "utf-8");
const dashboardAppJs = readFileSync(join(publicDir, "app.js"), "utf-8");
const landingHtml = readFileSync(join(publicDir, "landing.html"), "utf-8");

async function visualPlugin(app: FastifyInstance): Promise<void> {
  await app.register(WebSocket);

  VisualStreamGateway.registerGateway(app);

  app.get("/api/v1/visual/tv", (_req, reply) => {
    reply.type("text/html").send(tvHtml);
  });

  app.get("/dashboard", (_req, reply) => {
    reply.type("text/html").send(dashboardHtml);
  });

  app.get("/app.js", (_req, reply) => {
    reply.type("application/javascript").send(dashboardAppJs);
  });

  app.get("/landing", (_req, reply) => {
    reply.type("text/html").send(landingHtml);
  });

  app.get("/api/v1/visual/status", async (_req, reply) => {
    return reply.send({
      connectedScreens: VisualStreamGateway.connectedCount,
      uptime: process.uptime(),
    });
  });

  app.log.info("Visual Orchestration module registered");
}

export default visualPlugin;
