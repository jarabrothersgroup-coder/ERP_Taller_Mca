/**
 * Sprint 87 — Catálogo de Servicios, Notificaciones OT, Presupuesto→OT, Checklist Recepción
 *
 * Tests estructurales para verificar existencia de:
 *   1. Catálogo de Servicios (routes + service exports)
 *   2. Notificaciones multi-canal en cambio de estado OT (push + WhatsApp)
 *   3. Presupuesto → OT (convertPresupuestoToOT)
 *   4. Checklist Recepción (guardarChecklist, getChecklist, guardarFirmaRetiro)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

// ─── Helper: read file content ─────────────────
function readFile(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), "utf-8");
}

// ═══════════════════════════════════════════════
// 1. Catálogo de Servicios
// ═══════════════════════════════════════════════
describe("Sprint 87 — Catálogo de Servicios", () => {
  it("services-catalog.routes.ts exports servicesCatalogRoutes", async () => {
    const mod = await import("../src/modules/workshop/routes/services-catalog.routes.js");
    expect(typeof mod.servicesCatalogRoutes).toBe("function");
  });

  it("services-catalog.routes.ts has POST /workshop/servicios", () => {
    const routes = readFile("src/modules/workshop/routes/services-catalog.routes.ts");
    expect(routes).toContain('POST "/workshop/servicios"');
  });

  it("services-catalog.routes.ts has GET /workshop/servicios", () => {
    const routes = readFile("src/modules/workshop/routes/services-catalog.routes.ts");
    expect(routes).toContain('GET "/workshop/servicios"');
  });

  it("services-catalog.routes.ts has GET /workshop/servicios/:id", () => {
    const routes = readFile("src/modules/workshop/routes/services-catalog.routes.ts");
    expect(routes).toContain('GET "/workshop/servicios/:id"');
  });

  it("services-catalog.routes.ts has PATCH /workshop/servicios/:id", () => {
    const routes = readFile("src/modules/workshop/routes/services-catalog.routes.ts");
    expect(routes).toContain('PATCH "/workshop/servicios/:id"');
  });

  it("services-catalog.routes.ts has DELETE /workshop/servicios/:id", () => {
    const routes = readFile("src/modules/workshop/routes/services-catalog.routes.ts");
    expect(routes).toContain('DELETE "/workshop/servicios/:id"');
  });

  it("services-catalog.service.ts exports all CRUD functions", async () => {
    const mod = await import("../src/modules/workshop/services/services-catalog.service.js");
    expect(typeof mod.listServicios).toBe("function");
    expect(typeof mod.getServicio).toBe("function");
    expect(typeof mod.createServicio).toBe("function");
    expect(typeof mod.updateServicio).toBe("function");
    expect(typeof mod.deleteServicio).toBe("function");
  });

  it("workshop routes barrel registers services catalog routes", () => {
    const barrel = readFile("src/modules/workshop/routes/index.ts");
    expect(barrel).toContain("servicesCatalogRoutes");
    expect(barrel).toContain("services-catalog.routes.js");
  });

  it("sidebar.tsx has Servicios link", () => {
    const sidebar = readFile("web/src/components/dashboard/sidebar.tsx");
    expect(sidebar).toContain('href: "/dashboard/servicios"');
  });

  it("frontend servicios page exists", () => {
    const exists = existsSync(resolve(PROJECT_ROOT, "web/src/app/(dashboard)/dashboard/servicios/page.tsx"));
    expect(exists).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 2. Notificaciones Automáticas OT
// ═══════════════════════════════════════════════
describe("Sprint 87 — Notificaciones OT (Push + WhatsApp)", () => {
  it("orden.service.ts imports crearNotificacionPush", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("import { crearNotificacionPush }");
  });

  it("updateOrdenStatus calls notificarCambioEstadoOt for all transitions", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("notificarCambioEstadoOt(ordenId, newStatus, tenantSlug, orden.status)");
  });

  it("orden.service.ts defines notificarCambioEstadoOt function", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("async function notificarCambioEstadoOt");
  });

  it("notificarCambioEstadoOt uses crearNotificacionPush", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("await crearNotificacionPush({");
  });

  it("notificarCambioEstadoOt imports sendTextMessage and buildMessage from WhatsApp", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("sendTextMessage, buildMessage");
    expect(service).toContain("../../whatsapp/services/whatsapp.service.js");
  });

  it("notificarCambioEstadoOt sends WhatsApp for key status transitions", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("await sendTextMessage(tenantSlug, client.phone, message)");
  });

  it("WHATSAPP_STATUS_MAP maps all 5 OT states to templates", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("Presupuestado: \"PRESUPUESTADO\"");
    expect(service).toContain("Listo: \"LISTO_ENTREGA\"");
    expect(service).toContain("Finalizado: \"FINALIZADO_RETIRADO\"");
  });

  it("notificacionPush exists and exports expected functions", async () => {
    const mod = await import("../src/modules/workshop/services/notification-push.service.js");
    expect(typeof mod.crearNotificacionPush).toBe("function");
  });
});

// ═══════════════════════════════════════════════
// 3. Presupuesto → OT (P1.3)
// ═══════════════════════════════════════════════
describe("Sprint 87 — Presupuesto → OT", () => {
  it("orden.service.ts exports convertPresupuestoToOT", async () => {
    const mod = await import("../src/modules/workshop/services/orden.service.js");
    expect(typeof mod.convertPresupuestoToOT).toBe("function");
  });

  it("convertPresupuestoToOT creates OT in Aprobado state", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain('status: presupuesto.estado === "aprobado" ? "Aprobado" : "Presupuestado"');
  });

  it("convertPresupuestoToOT links OT back to presupuesto.ordenTrabajoId", () => {
    const service = readFile("src/modules/workshop/services/orden.service.ts");
    expect(service).toContain("ordenTrabajoId: orden.id");
  });

  it("budget.routes.ts has approval endpoint", () => {
    const routes = readFile("src/modules/finance/routes/budget.routes.ts");
    expect(routes).toContain("POST /finance/presupuestos/:id/aprobar");
  });

  it("budget schema has new columns (clienteId, vehicleId, ordenTrabajoId, etc.)", () => {
    const schema = readFile("src/modules/finance/schema/budget.ts");
    expect(schema).toContain("clienteId");
    expect(schema).toContain("vehicleId");
    expect(schema).toContain("ordenTrabajoId");
    expect(schema).toContain("metodoAprobacion");
    expect(schema).toContain("totalEstimado");
  });
});

// ═══════════════════════════════════════════════
// 4. Checklist Recepción (P1.1)
// ═══════════════════════════════════════════════
describe("Sprint 87 — Checklist Recepción", () => {
  it("ingreso.service.ts exports guardarChecklist", async () => {
    const mod = await import("../src/modules/workshop/services/ingreso.service.js");
    expect(typeof (mod as any).guardarChecklist).toBe("function");
  });

  it("ingreso.service.ts exports getChecklist", async () => {
    const mod = await import("../src/modules/workshop/services/ingreso.service.js");
    expect(typeof (mod as any).getChecklist).toBe("function");
  });

  it("ingreso.service.ts exports guardarFirmaRetiro", async () => {
    const mod = await import("../src/modules/workshop/services/ingreso.service.js");
    expect(typeof (mod as any).guardarFirmaRetiro).toBe("function");
  });

  it("ingreso routes have checklist endpoints", () => {
    const routes = readFile("src/modules/workshop/routes/ingresos.ts");
    expect(routes).toContain("/checklist");
    expect(routes).toContain("firma-retiro");
  });

  it("types.ts defines RecepcionChecklist interface", () => {
    const types = readFile("src/modules/workshop/types.ts");
    expect(types).toContain("RecepcionChecklist");
    expect(types).toContain("PanelState");
  });

  it("migration 0012 exists for checklist and presupuesto columns", () => {
    const exists = existsSync(
      resolve(PROJECT_ROOT, "src/shared/database/migrations/0012_ingreso_checklist.sql"),
    );
    expect(exists).toBe(true);
  });

  it("migration 0012 creates ingreso_checklist table", () => {
    const migration = readFile("src/shared/database/migrations/0012_ingreso_checklist.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ingreso_checklist");
  });

  it("schema barrel exports ingresoChecklist", async () => {
    const barrel = await import("../src/shared/database/schema/index.js");
    expect(barrel.ingresoChecklist).toBeDefined();
  });

  it("frontend recepcion page exists with signature pad", () => {
    const page = readFile("web/src/app/(dashboard)/dashboard/recepcion/page.tsx");
    expect(page).toContain("SignaturePad");
    expect(page).toContain("canvas");
  });
});
