/**
 * Sprint 41 Tests — WhatsApp Template Builder + Automated Follow-ups.
 *
 * Tests for:
 *   - Template Service (CRUD, variable filling, preview, defaults)
 *   - Follow-up Service (scheduling, processing, stats)
 *   - Template Routes (API endpoints)
 *   - Frontend Template Builder (UI structure, variable helpers)
 *
 * @module tests/sprint41
 */

import { describe, it, expect, vi } from "vitest";

// ─── Mock database ────────────────────────────
const mockReturning = vi.fn().mockResolvedValue([{ id: "test-id", key: "test", name: "Test", body: "Hello {{name}}", category: "general", active: true, variables: ["name"], triggerEvent: null, triggerDelayHours: "0", tenantSlug: "taller-el-chero", createdAt: new Date(), updatedAt: new Date() }]);
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({ returning: mockReturning }),
});
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue([]),
      limit: vi.fn().mockResolvedValue([]),
    }),
  }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  }),
});
const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));

// ─── Template Service ────────────────────────

describe("Sprint 41 — Template Service", () => {
  it("exports fillTemplate function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.fillTemplate).toBe("function");
  });

  it("exports extractVariables function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.extractVariables).toBe("function");
  });

  it("exports previewTemplate function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.previewTemplate).toBe("function");
  });

  it("exports listTemplates function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.listTemplates).toBe("function");
  });

  it("exports upsertTemplate function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.upsertTemplate).toBe("function");
  });

  it("exports deleteTemplate function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.deleteTemplate).toBe("function");
  });

  it("exports seedDefaultTemplates function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.seedDefaultTemplates).toBe("function");
  });

  it("exports TEMPLATE_VARIABLES constant", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(typeof mod.TEMPLATE_VARIABLES).toBe("object");
    expect(mod.TEMPLATE_VARIABLES).toHaveProperty("nombre_cliente");
    expect(mod.TEMPLATE_VARIABLES).toHaveProperty("vehiculo");
    expect(mod.TEMPLATE_VARIABLES).toHaveProperty("orden_id");
  });

  it("exports DEFAULT_TEMPLATES array", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(Array.isArray(mod.DEFAULT_TEMPLATES)).toBe(true);
    expect(mod.DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });
});

// ─── Variable Filling ───────────────────────

describe("Sprint 41 — Variable Filling", () => {
  it("fillTemplate replaces variables", async () => {
    const { fillTemplate } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const result = fillTemplate("Hola {{nombre}}, tu auto es {{vehiculo}}", {
      nombre: "Juan",
      vehiculo: "Toyota",
    });
    expect(result).toBe("Hola Juan, tu auto es Toyota");
  });

  it("fillTemplate leaves unresolved variables intact", async () => {
    const { fillTemplate } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const result = fillTemplate("Hola {{nombre}}", {});
    expect(result).toBe("Hola {{nombre}}");
  });

  it("fillTemplate handles multiple same variables", async () => {
    const { fillTemplate } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const result = fillTemplate("{{x}} and {{x}}", { x: "hello" });
    expect(result).toBe("hello and hello");
  });

  it("extractVariables finds all unique variables", async () => {
    const { extractVariables } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const vars = extractVariables("Hola {{a}}, tu auto {{b}} está en {{a}}");
    expect(vars).toContain("a");
    expect(vars).toContain("b");
    expect(vars.length).toBe(2); // deduplicated
  });

  it("extractVariables returns empty array for no variables", async () => {
    const { extractVariables } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const vars = extractVariables("No variables here");
    expect(vars).toEqual([]);
  });

  it("previewTemplate fills with sample data", async () => {
    const { previewTemplate } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const result = previewTemplate("Hola {{nombre_cliente}}, tu {{vehiculo}} está listo");
    expect(result).toContain("Juan Pérez");
    expect(result).toContain("Toyota Hilux 2022");
  });

  it("previewTemplate allows custom sample data override", async () => {
    const { previewTemplate } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const result = previewTemplate("Hola {{nombre_cliente}}", { nombre_cliente: "María" });
    expect(result).toBe("Hola María");
  });
});

// ─── Follow-up Service ──────────────────────

describe("Sprint 41 — Follow-up Service", () => {
  it("exports scheduleFollowup function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-followup.service.js");
    expect(typeof mod.scheduleFollowup).toBe("function");
  });

  it("exports scheduleAutoFollowup function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-followup.service.js");
    expect(typeof mod.scheduleAutoFollowup).toBe("function");
  });

  it("exports processDueFollowups function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-followup.service.js");
    expect(typeof mod.processDueFollowups).toBe("function");
  });

  it("exports cancelFollowup function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-followup.service.js");
    expect(typeof mod.cancelFollowup).toBe("function");
  });

  it("exports listFollowups function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-followup.service.js");
    expect(typeof mod.listFollowups).toBe("function");
  });

  it("exports getFollowupStats function", async () => {
    const mod = await import("../../src/modules/whatsapp/services/whatsapp-followup.service.js");
    expect(typeof mod.getFollowupStats).toBe("function");
  });
});

// ─── Template Routes ────────────────────────

describe("Sprint 41 — Template Routes", () => {
  it("exports whatsappTemplateRoutes function", async () => {
    const mod = await import("../../src/modules/whatsapp/routes/whatsapp-template.routes.js");
    expect(typeof mod.whatsappTemplateRoutes).toBe("function");
  });
});

// ─── Plugin Registration ────────────────────

describe("Sprint 41 — Plugin Registration", () => {
  it("whatsapp plugin imports template routes", async () => {
    const fs = await import("fs");
    const pluginPath = new URL(
      "../src/modules/whatsapp/plugin.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(pluginPath, "utf-8");

    expect(content).toContain("whatsappTemplateRoutes");
    expect(content).toContain("whatsapp-template.routes.js");
  });

  it("whatsapp plugin registers template routes", async () => {
    const fs = await import("fs");
    const pluginPath = new URL(
      "../src/modules/whatsapp/plugin.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(pluginPath, "utf-8");

    expect(content).toContain("await app.register(whatsappTemplateRoutes)");
  });
});

// ─── Schema Validation ──────────────────────

describe("Sprint 41 — Schema Validation", () => {
  it("whatsapp_templates schema has required fields", async () => {
    const fs = await import("fs");
    const schemaPath = new URL(
      "../src/modules/whatsapp/schema/whatsapp-template.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(schemaPath, "utf-8");

    expect(content).toContain("whatsapp_templates");
    expect(content).toContain("tenant_slug");
    expect(content).toContain("key");
    expect(content).toContain("name");
    expect(content).toContain("body");
    expect(content).toContain("category");
    expect(content).toContain("active");
    expect(content).toContain("variables");
    expect(content).toContain("trigger_event");
    expect(content).toContain("trigger_delay_hours");
  });

  it("whatsapp_followups schema has required fields", async () => {
    const fs = await import("fs");
    const schemaPath = new URL(
      "../src/modules/whatsapp/schema/whatsapp-followup.ts",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(schemaPath, "utf-8");

    expect(content).toContain("whatsapp_followups");
    expect(content).toContain("tenant_slug");
    expect(content).toContain("template_key");
    expect(content).toContain("orden_id");
    expect(content).toContain("phone");
    expect(content).toContain("filled_body");
    expect(content).toContain("variables");
    expect(content).toContain("status");
    expect(content).toContain("scheduled_at");
    expect(content).toContain("sent_at");
    expect(content).toContain("retry_count");
  });
});

// ─── Frontend Template Builder ──────────────

describe("Sprint 41 — Frontend Template Builder", () => {
  it("has valid file structure", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("/* global api, esc");
    expect(content).toContain("@module js/wa-templates");
  });

  it("exports renderWhatsAppTemplates function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function renderWhatsAppTemplates");
    expect(content).toContain("window.renderWhatsAppTemplates");
  });

  it("exports template editor function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function waTmplOpenEditor");
    expect(content).toContain("window.waTmplOpenEditor");
  });

  it("exports save function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function waTmplSave");
    expect(content).toContain("window.waTmplSave");
  });

  it("exports variable insertion function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function waTmplInsertVar");
    expect(content).toContain("window.waTmplInsertVar");
  });

  it("exports preview function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function waTmplPreview");
    expect(content).toContain("window.waTmplPreview");
  });

  it("exports seed defaults function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function waTmplSeedDefaults");
    expect(content).toContain("window.waTmplSeedDefaults");
  });

  it("exports cancel follow-up function", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("function waTmplCancelFollowup");
    expect(content).toContain("window.waTmplCancelFollowup");
  });

  it("has live preview with sample data", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("waTmplRefreshPreview");
    expect(content).toContain("Juan Pérez");
    expect(content).toContain("Toyota Hilux 2022");
  });

  it("has variable insertion via textarea cursor position", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("textarea.selectionStart");
    expect(content).toContain("textarea.selectionEnd");
  });

  it("has follow-up stats rendering", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("waTmplRenderFollowupStats");
    expect(content).toContain("waTmplRenderFollowupList");
  });

  it("has API calls for templates CRUD", async () => {
    const fs = await import("fs");
    const fePath = new URL(
      "../src/shared/public/js/wa-templates.js",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(fePath, "utf-8");

    expect(content).toContain("api('/whatsapp/templates')");
    expect(content).toContain("api('/whatsapp/templates/seed'");
    expect(content).toContain("api('/whatsapp/templates/variables')");
    expect(content).toContain("api('/whatsapp/followups");
  });

  it("is included in index.html", async () => {
    const fs = await import("fs");
    const indexPath = new URL(
      "../src/shared/public/index.html",
      import.meta.url,
    ).pathname;
    const content = fs.readFileSync(indexPath, "utf-8");

    expect(content).toContain('src="js/wa-templates.js"');
  });
});

// ─── Default Templates ──────────────────────

describe("Sprint 41 — Default Templates", () => {
  it("has at least 5 default templates", async () => {
    const { DEFAULT_TEMPLATES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it("default templates have required fields", async () => {
    const { DEFAULT_TEMPLATES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    for (const tmpl of DEFAULT_TEMPLATES) {
      expect(tmpl.key).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.body).toBeTruthy();
      expect(tmpl.category).toBeTruthy();
      expect(Array.isArray(tmpl.variables)).toBe(true);
    }
  });

  it("has order lifecycle templates", async () => {
    const { DEFAULT_TEMPLATES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const keys = DEFAULT_TEMPLATES.map(t => t.key);
    expect(keys).toContain("recepcion");
    expect(keys).toContain("presupuesto");
    expect(keys).toContain("listo_entrega");
  });

  it("has follow-up templates with triggers", async () => {
    const { DEFAULT_TEMPLATES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const withTriggers = DEFAULT_TEMPLATES.filter(t => t.triggerEvent);
    expect(withTriggers.length).toBeGreaterThanOrEqual(3);
  });

  it("has warranty reminder template", async () => {
    const { DEFAULT_TEMPLATES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const warranty = DEFAULT_TEMPLATES.find(t => t.key === "garantia");
    expect(warranty).toBeTruthy();
    expect(warranty?.triggerEvent).toBe("warranty_expiring");
  });

  it("has service reminder template", async () => {
    const { DEFAULT_TEMPLATES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const service = DEFAULT_TEMPLATES.find(t => t.key === "proximo_servicio");
    expect(service).toBeTruthy();
    expect(service?.triggerEvent).toBe("service_reminder");
  });

  it("has survey template with delay", async () => {
    const { DEFAULT_TEMPLATES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    const survey = DEFAULT_TEMPLATES.find(t => t.key === "encuesta");
    expect(survey).toBeTruthy();
    expect(parseInt(survey?.triggerDelayHours || "0")).toBeGreaterThan(0);
  });
});

// ─── Template Variable Reference ────────────

describe("Sprint 41 — Template Variable Reference", () => {
  it("has all expected variable descriptions", async () => {
    const { TEMPLATE_VARIABLES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    expect(TEMPLATE_VARIABLES).toHaveProperty("nombre_cliente");
    expect(TEMPLATE_VARIABLES).toHaveProperty("vehiculo");
    expect(TEMPLATE_VARIABLES).toHaveProperty("chapa");
    expect(TEMPLATE_VARIABLES).toHaveProperty("orden_id");
    expect(TEMPLATE_VARIABLES).toHaveProperty("monto_total");
    expect(TEMPLATE_VARIABLES).toHaveProperty("fecha_estimada");
    expect(TEMPLATE_VARIABLES).toHaveProperty("tecnico");
    expect(TEMPLATE_VARIABLES).toHaveProperty("taller");
    expect(TEMPLATE_VARIABLES).toHaveProperty("numero_factura");
    expect(TEMPLATE_VARIABLES).toHaveProperty("url_encuesta");
    expect(TEMPLATE_VARIABLES).toHaveProperty("kilometraje");
    expect(TEMPLATE_VARIABLES).toHaveProperty("garantia_hasta");
  });

  it("all variable descriptions are non-empty strings", async () => {
    const { TEMPLATE_VARIABLES } = await import("../../src/modules/whatsapp/services/whatsapp-template.service.js");
    for (const [key, desc] of Object.entries(TEMPLATE_VARIABLES)) {
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});
