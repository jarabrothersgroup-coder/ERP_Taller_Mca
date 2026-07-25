/**
 * Financial WebSocket Route — real-time financial data streaming.
 *
 * Protocol:
 *   Client sends: { type: "subscribe", channels: ["kpis", "cashflow", "invoices"] }
 *   Server pushes: { type: "update", channel: "...", data: {...} } every 30s
 *
 * @module finance/routes/financial-ws
 */

import type { FastifyInstance } from "fastify";
import { getFinancialKPIs, getCashflowData, getInvoiceSummary } from "../services/financial-realtime.service.js";

interface WSClient {
  socket: any;
  tenantSlug: string;
  channels: Set<string>;
}

const clients = new Map<any, WSClient>();
let broadcastTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the periodic broadcast to all connected WS clients.
 */
function startBroadcast(): void {
  if (broadcastTimer) return;

  broadcastTimer = setInterval(async () => {
    for (const [socket, client] of clients) {
      try {
        for (const channel of client.channels) {
          let data: any;
          switch (channel) {
            case "kpis":
              data = await getFinancialKPIs(client.tenantSlug);
              break;
            case "cashflow":
              data = await getCashflowData(client.tenantSlug);
              break;
            case "invoices":
              data = await getInvoiceSummary(client.tenantSlug);
              break;
          }
          if (data && socket.readyState === 1) {
            socket.send(JSON.stringify({ type: "update", channel, data }));
          }
        }
      } catch {
        clients.delete(socket);
      }
    }
  }, 30_000);
}

export async function financialWsRoute(app: FastifyInstance): Promise<void> {
  app.get("/ws/financial-dashboard", { websocket: true }, (socket: any, req: any) => {
    // Extract tenant from query or header
    const url = new URL(req.url, "http://localhost");
    const tenantSlug = url.searchParams.get("tenant") || req.headers["x-tenant-slug"] || "default";

    const client: WSClient = { socket, tenantSlug, channels: new Set() };
    clients.set(socket, client);

    socket.on("message", (raw: string) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "subscribe" && Array.isArray(msg.channels)) {
          for (const ch of msg.channels) {
            if (["kpis", "cashflow", "invoices"].includes(ch)) {
              client.channels.add(ch);
            }
          }
          // Send initial data for subscribed channels
          (async () => {
            for (const ch of client.channels) {
              let data: any;
              switch (ch) {
                case "kpis": data = await getFinancialKPIs(tenantSlug); break;
                case "cashflow": data = await getCashflowData(tenantSlug); break;
                case "invoices": data = await getInvoiceSummary(tenantSlug); break;
              }
              if (data && socket.readyState === 1) {
                socket.send(JSON.stringify({ type: "update", channel: ch, data }));
              }
            }
          })();
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
    });

    startBroadcast();
  });
}
