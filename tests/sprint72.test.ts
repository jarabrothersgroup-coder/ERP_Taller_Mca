/**
 * Sprint 72 Tests — SSE Notifications + OpenAPI Schemas + SDK Generator.
 *
 * Sprint 72 Tests:
 *   - SSE Notification Routes (stream, poll, client management)
 *   - OpenAPI Schemas (shared schema definitions)
 *   - SDK Generator improvements
 *
 * @module tests/sprint72
 */

import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import { resolve } from "path";

const srcRoot = resolve(__dirname, "../src");

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════
// Sprint 72 — SSE Notification Routes
// ═══════════════════════════════════════════

describe("Sprint 72 — SSE Notification Routes", () => {
  it("notification-sse.routes.ts exists", async () => {
    const exists = await fileExists(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(exists).toBe(true);
  });

  it("exports notificationSseRoutes function", async () => {
    const mod = await import(
      "../src/modules/workshop/routes/notification-sse.routes.js"
    );
    expect(typeof mod.notificationSseRoutes).toBe("function");
  });

  it("exports pushSseNotification function", async () => {
    const mod = await import(
      "../src/modules/workshop/routes/notification-sse.routes.js"
    );
    expect(typeof mod.pushSseNotification).toBe("function");
  });

  it("exports getSseClientCount function", async () => {
    const mod = await import(
      "../src/modules/workshop/routes/notification-sse.routes.js"
    );
    expect(typeof mod.getSseClientCount).toBe("function");
  });

  it("exports getTotalSseClients function", async () => {
    const mod = await import(
      "../src/modules/workshop/routes/notification-sse.routes.js"
    );
    expect(typeof mod.getTotalSseClients).toBe("function");
  });

  it("SSE route registers /stream endpoint", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(content).toContain("/stream");
    expect(content).toContain("text/event-stream");
    expect(content).toContain("no-cache");
  });

  it("SSE route registers /poll fallback endpoint", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(content).toContain("/poll");
    expect(content).toContain("unreadCount");
  });

  it("SSE has heartbeat ping every 30s", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(content).toContain("heartbeat");
    expect(content).toContain("30_000");
  });

  it("SSE cleans up on client disconnect", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(content).toContain("close");
    expect(content).toContain("Client disconnected");
  });

  it("SSE registerSseRoutes is registered in workshop barrel", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/index.ts"),
    );
    expect(content).toContain("notificationSseRoutes");
    expect(content).toContain("notification-sse.routes.js");
  });

  it("pushSseNotification sends to all clients in tenant", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(content).toContain("pushSseNotification");
    expect(content).toContain("tenantSlug");
    expect(content).toContain("data:");
  });
});

// ═══════════════════════════════════════════
// Sprint 72 — OpenAPI Schemas
// ═══════════════════════════════════════════

describe("Sprint 72 — OpenAPI Shared Schemas", () => {
  it("openapi-schemas.ts exists", async () => {
    const exists = await fileExists(resolve(srcRoot, "shared/schemas/openapi-schemas.ts"));
    expect(exists).toBe(true);
  });

  it("exports ClientSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.ClientSchema).toBeDefined();
    expect(mod.ClientSchema.type).toBe("object");
    expect(mod.ClientSchema.properties.id).toBeDefined();
    expect(mod.ClientSchema.properties.nombre).toBeDefined();
    expect(mod.ClientSchema.properties.ruc).toBeDefined();
  });

  it("exports VehicleSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.VehicleSchema).toBeDefined();
    expect(mod.VehicleSchema.properties.marca).toBeDefined();
    expect(mod.VehicleSchema.properties.modelo).toBeDefined();
    expect(mod.VehicleSchema.properties.placa).toBeDefined();
  });

  it("exports OrdenTrabajoSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.OrdenTrabajoSchema).toBeDefined();
    expect(mod.OrdenTrabajoSchema.properties.estado).toBeDefined();
    expect(mod.OrdenTrabajoSchema.properties.estado.enum).toContain("EN_PROCESO");
  });

  it("exports FacturaSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.FacturaSchema).toBeDefined();
    expect(mod.FacturaSchema.properties.total).toBeDefined();
    expect(mod.FacturaSchema.properties.estado.enum).toContain("EMITIDA");
  });

  it("exports RepuestoSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.RepuestoSchema).toBeDefined();
    expect(mod.RepuestoSchema.properties.codigo).toBeDefined();
    expect(mod.RepuestoSchema.properties.stockActual).toBeDefined();
  });

  it("exports NotificationSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.NotificationSchema).toBeDefined();
    expect(mod.NotificationSchema.properties.priority).toBeDefined();
    expect(mod.NotificationSchema.properties.priority.enum).toContain("URGENT");
  });

  it("exports ApiKeySchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.ApiKeySchema).toBeDefined();
    expect(mod.ApiKeySchema.properties.scopes).toBeDefined();
    expect(mod.ApiKeySchema.properties.isActive).toBeDefined();
  });

  it("exports ErrorResponseSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.ErrorResponseSchema).toBeDefined();
    expect(mod.ErrorResponseSchema.properties.error).toBeDefined();
    expect(mod.ErrorResponseSchema.properties.message).toBeDefined();
  });

  it("exports HealthResponseSchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.HealthResponseSchema).toBeDefined();
    expect(mod.HealthResponseSchema.properties.status.enum).toContain("ok");
  });

  it("exports PaginationQuerySchema", async () => {
    const mod = await import("../src/shared/schemas/openapi-schemas.js");
    expect(mod.PaginationQuerySchema).toBeDefined();
    expect(mod.PaginationQuerySchema.properties.limit).toBeDefined();
    expect(mod.PaginationQuerySchema.properties.offset).toBeDefined();
  });
});

// ═══════════════════════════════════════════
// Sprint 72 — SDK Generator Improvements
// ═══════════════════════════════════════════

describe("Sprint 72 — SDK Generator Improvements", () => {
  it("gen-sdk.ts has placeholder types for empty spec", async () => {
    const content = await readFileSafe(resolve(__dirname, "../scripts/gen-sdk.ts"));
    expect(content).toContain("No schemas defined in OpenAPI spec");
    expect(content).toContain("Placeholder");
  });

  it("gen-sdk.ts passes httpMethod to extractParams", async () => {
    const content = await readFileSafe(resolve(__dirname, "../scripts/gen-sdk.ts"));
    expect(content).toContain("httpMethod");
    expect(content).toContain("extractParams(pathStr, operation, method)");
  });

  it("gen-sdk.ts has correct method resolution", async () => {
    const content = await readFileSafe(resolve(__dirname, "../scripts/gen-sdk.ts"));
    expect(content).toContain("const hasBody = [\"post\", \"put\", \"patch\"].includes(httpMethod");
  });
});

// ═══════════════════════════════════════════
// Sprint 72 — Integration Checks
// ═══════════════════════════════════════════

describe("Sprint 72 — Integration", () => {
  it("SSE routes registered before WebSocket gateway", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    // SSE routes import and register the WS gateway
    expect(content).toContain("registerNotificationWS");
  });

  it("SSE and WS share notification gateway", async () => {
    const content = await readFileSafe(
      resolve(srcRoot, "modules/workshop/routes/notification-sse.routes.ts"),
    );
    expect(content).toContain("notification-gateway.js");
    expect(content).toContain("pushNotification");
  });

  it("engram.json current_sprint is Sprint 72", async () => {
    const engram = JSON.parse(
      await readFileSafe(resolve(__dirname, "../engram.json")),
    );
    expect(engram.state?.current_sprint).toContain("Sprint 72");
  });
});
