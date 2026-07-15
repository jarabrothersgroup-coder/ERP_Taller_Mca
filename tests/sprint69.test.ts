/**
 * Sprint 69 — Billing Module Tests
 *
 * Tests for:
 *   1. Billing plugin registration in app.ts
 *   2. Stripe webhook signature verification
 *   3. Swagger Billing tag presence
 *   4. Billing service exports
 *   5. Billing schema definitions
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

// ─── Helper: read file content ──────────────
function readFile(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), "utf-8");
}

// ═══════════════════════════════════════════════
// 1. Billing Plugin Registration
// ═══════════════════════════════════════════════
describe("Sprint 69 — Billing Module Registration", () => {
  it("app.ts imports billing plugin", () => {
    const appTs = readFile("src/app.ts");
    expect(appTs).toContain("billing/plugin.js");
  });

  it("app.ts registers billing plugin before enterprise module", () => {
    const appTs = readFile("src/app.ts");
    const billingIdx = appTs.indexOf("billing/plugin.js");
    const enterpriseIdx = appTs.indexOf("enterprise/plugin.js");
    expect(billingIdx).toBeGreaterThan(-1);
    expect(enterpriseIdx).toBeGreaterThan(-1);
    expect(billingIdx).toBeLessThan(enterpriseIdx);
  });

  it("app.ts has Billing Swagger tag", () => {
    const appTs = readFile("src/app.ts");
    expect(appTs).toContain('name: "Billing"');
    expect(appTs).toContain("Gestión de suscripciones SaaS");
  });
});

// ═══════════════════════════════════════════════
// 2. Stripe Webhook Signature Verification
// ═══════════════════════════════════════════════
describe("Sprint 69 — Stripe Webhook Signature Verification", () => {
  it("webhook route uses raw body parser", () => {
    const routes = readFile("src/modules/billing/routes/stripe.routes.ts");
    expect(routes).toContain("addContentTypeParser");
    expect(routes).toContain('parseAs: "buffer"');
  });

  it("webhook route captures raw body on request", () => {
    const routes = readFile("src/modules/billing/routes/stripe.routes.ts");
    expect(routes).toContain("_rawBody = body");
  });

  it("webhook route calls constructEvent with raw body", () => {
    const routes = readFile("src/modules/billing/routes/stripe.routes.ts");
    expect(routes).toContain("constructEvent(");
    expect(routes).toContain("rawBody,");
    expect(routes).toContain("signature,");
    expect(routes).toContain("webhookSecret");
  });

  it("webhook route rejects missing signature in production", () => {
    const routes = readFile("src/modules/billing/routes/stripe.routes.ts");
    expect(routes).toContain('Missing stripe-signature header');
    expect(routes).toContain('NODE_ENV === "production"');
    expect(routes).toContain("Webhook signature required in production");
  });

  it("webhook route returns 400 on invalid signature", () => {
    const routes = readFile("src/modules/billing/routes/stripe.routes.ts");
    expect(routes).toContain("Stripe webhook signature verification failed");
    expect(routes).toContain('error: "Invalid signature"');
  });
});

// ═══════════════════════════════════════════════
// 3. Swagger Billing Tags
// ═══════════════════════════════════════════════
describe("Sprint 69 — Swagger Billing Tags", () => {
  const routesFile = readFile("src/modules/billing/routes/stripe.routes.ts");

  it("GET /billing/plans has Billing tag", () => {
    expect(routesFile).toContain('tags: ["Billing"]');
  });

  it("all 6 billing routes have schema with tags", () => {
    // Count occurrences of tags: ["Billing"] — should be 6 (plans, subscription, invoices, checkout, portal, webhook)
    const tagMatches = routesFile.match(/tags: \["Billing"\]/g);
    expect(tagMatches).not.toBeNull();
    expect(tagMatches!.length).toBe(6);
  });

  it("all 6 billing routes have summary descriptions", () => {
    const summaryMatches = routesFile.match(/summary: "[^"]+"/g);
    expect(summaryMatches).not.toBeNull();
    expect(summaryMatches!.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════
// 4. Billing Service Exports
// ═══════════════════════════════════════════════
describe("Sprint 69 — Billing Service", () => {
  it("stripe.service.ts exports expected functions", async () => {
    const mod = await import("../src/modules/billing/services/stripe.service.js");
    expect(typeof mod.getPlans).toBe("function");
    expect(typeof mod.getPlanById).toBe("function");
    expect(typeof mod.getSubscription).toBe("function");
    expect(typeof mod.getInvoices).toBe("function");
    expect(typeof mod.createCheckoutSession).toBe("function");
    expect(typeof mod.createPortalSession).toBe("function");
    expect(typeof mod.processWebhookEvent).toBe("function");
  });
});

// ═══════════════════════════════════════════════
// 5. Billing Schema Definitions
// ═══════════════════════════════════════════════
describe("Sprint 69 — Billing Schemas", () => {
  it("plans schema exports a valid pgTable object", async () => {
    const { plans } = await import("../src/modules/billing/schema/plans.js");
    expect(plans).toBeDefined();
    expect(typeof plans).toBe("object");
    // Verify it has Drizzle column metadata (any Symbol key confirms pgTable)
    const hasSymbolKey = Object.getOwnPropertySymbols(plans).length > 0;
    expect(hasSymbolKey).toBe(true);
  });

  it("subscriptions schema exports a valid pgTable object", async () => {
    const { subscriptions } = await import("../src/modules/billing/schema/subscriptions.js");
    expect(subscriptions).toBeDefined();
    expect(typeof subscriptions).toBe("object");
    const hasSymbolKey = Object.getOwnPropertySymbols(subscriptions).length > 0;
    expect(hasSymbolKey).toBe(true);
  });

  it("invoices schema exports a valid pgTable object", async () => {
    const { subscriptionInvoices } = await import("../src/modules/billing/schema/invoices.js");
    expect(subscriptionInvoices).toBeDefined();
    expect(typeof subscriptionInvoices).toBe("object");
    const hasSymbolKey = Object.getOwnPropertySymbols(subscriptionInvoices).length > 0;
    expect(hasSymbolKey).toBe(true);
  });

  it("schema barrel exports all tables", async () => {
    const barrel = await import("../src/modules/billing/schema/index.js");
    expect(barrel.plans).toBeDefined();
    expect(barrel.subscriptions).toBeDefined();
    expect(barrel.subscriptionInvoices).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// 6. Billing Types
// ═══════════════════════════════════════════════
describe("Sprint 69 — Billing Types", () => {
  it("types.ts defines BillingPlan interface", () => {
    const types = readFile("src/modules/billing/types.ts");
    expect(types).toContain("BillingPlan");
    expect(types).toContain("interface");
  });

  it("types.ts defines BillingSubscription interface", () => {
    const types = readFile("src/modules/billing/types.ts");
    expect(types).toContain("BillingSubscription");
  });

  it("types.ts defines BillingInvoice interface", () => {
    const types = readFile("src/modules/billing/types.ts");
    expect(types).toContain("BillingInvoice");
  });

  it("types.ts has FastifyRequest _rawBody augmentation", () => {
    const types = readFile("src/modules/billing/types.ts");
    expect(types).toContain("declare module");
    expect(types).toContain("_rawBody");
  });
});
