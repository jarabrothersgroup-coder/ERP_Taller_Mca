/**
 * Notification WebSocket Gateway — Real-time push notifications.
 *
 * Features:
 *   - Tenant-scoped WebSocket connections
 *   - Real-time push for new notifications
 *   - Priority-based delivery (URGENT → immediate push)
 *   - Connection heartbeats
 *
 * @module workshop/ws/notification-gateway
 */

import type { FastifyInstance } from "fastify";
import WebSocket from "ws";

/** Connected clients per tenant */
const connections: Map<string, Set<WebSocket>> = new Map();

/** Connection metadata */
interface WSClient {
  socket: WebSocket;
  tenantSlug: string;
  userEmail: string;
  lastPing: number;
}

const clients: Map<WebSocket, WSClient> = new Map();

/**
 * Register notification WebSocket endpoint.
 */
export async function registerNotificationWS(app: FastifyInstance): Promise<void> {
  app.get("/ws/notifications", { websocket: true }, (socket, req) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const tenantSlug = url.searchParams.get("tenant") || "";
    const userEmail = url.searchParams.get("user") || "";

    if (!tenantSlug) {
      socket.close(4001, "Missing tenant parameter");
      return;
    }

    // Register connection
    if (!connections.has(tenantSlug)) {
      connections.set(tenantSlug, new Set());
    }
    connections.get(tenantSlug)!.add(socket);

    clients.set(socket, {
      socket,
      tenantSlug,
      userEmail,
      lastPing: Date.now(),
    });

    console.log(`[notification-ws] Client connected: ${tenantSlug}/${userEmail}`);

    // Send welcome message
    socket.send(JSON.stringify({
      type: "connected",
      tenant: tenantSlug,
      timestamp: new Date().toISOString(),
    }));

    // Handle messages
    socket.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(socket, msg);
      } catch {
        // Ignore invalid JSON
      }
    });

    // Handle disconnect
    socket.on("close", () => {
      connections.get(tenantSlug)?.delete(socket);
      clients.delete(socket);
      console.log(`[notification-ws] Client disconnected: ${tenantSlug}/${userEmail}`);
    });

    // Handle errors
    socket.on("error", (err) => {
      console.error(`[notification-ws] Error:`, err.message);
      connections.get(tenantSlug)?.delete(socket);
      clients.delete(socket);
    });
  });

  // Heartbeat check every 30s
  setInterval(() => {
    const now = Date.now();
    for (const [socket, client] of clients) {
      if (now - client.lastPing > 60_000) {
        socket.close(4002, "Ping timeout");
        connections.get(client.tenantSlug)?.delete(socket);
        clients.delete(socket);
      }
    }
  }, 30_000);

  app.log.info("Notification WebSocket gateway registered");
}

/**
 * Handle client messages (ping/pong).
 */
function handleClientMessage(socket: WebSocket, msg: any): void {
  const client = clients.get(socket);
  if (!client) return;

  if (msg.type === "ping") {
    client.lastPing = Date.now();
    socket.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
  }
}

/**
 * Push notification to all connected clients of a tenant.
 */
export function pushNotification(
  tenantSlug: string,
  notification: {
    id: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    priority?: string;
    actionUrl?: string;
    entityType?: string;
    entityId?: string;
  },
): number {
  const tenantConnections = connections.get(tenantSlug);
  if (!tenantConnections || tenantConnections.size === 0) return 0;

  const payload = JSON.stringify({
    type: "notification",
    data: notification,
    timestamp: new Date().toISOString(),
  });

  let sent = 0;
  for (const socket of tenantConnections) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      sent++;
    }
  }

  return sent;
}

/**
 * Push notification to a specific user (if connected).
 */
export function pushToUser(
  tenantSlug: string,
  userEmail: string,
  notification: Record<string, any>,
): boolean {
  for (const [, client] of clients) {
    if (client.tenantSlug === tenantSlug && client.userEmail === userEmail) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify({
          type: "notification",
          data: notification,
          timestamp: new Date().toISOString(),
        }));
        return true;
      }
    }
  }
  return false;
}

/**
 * Get connected client count for a tenant.
 */
export function getConnectionCount(tenantSlug: string): number {
  return connections.get(tenantSlug)?.size || 0;
}

/**
 * Get total connections across all tenants.
 */
export function getTotalConnections(): number {
  return clients.size;
}
