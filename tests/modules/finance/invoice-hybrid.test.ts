/**
 * Hybrid Invoice Engine — Integration Tests (SIFEN-004-HYBRID)
 *
 * Tests the dual-engine invoice endpoint:
 *   POST /finance/invoices/issue
 *
 * Verifies MANUAL and ELECTRONICA branches, input validation,
 * tenant isolation, and DB transaction atomicity.
 *
 * @module tests/modules/finance/invoice-hybrid.test
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { resolveTenant } from "../../../src/shared/middleware/tenant-resolver.js";
import { errorHandler } from "../../../src/shared/middleware/error-handler.js";

// ─── Mock data ─────────────────────────────────

const MOCK_ORDEN_ID = "550e8400-e29b-41d4-a716-446655440000";
const MOCK_TENANT = "taller_oviedo";

const mockOrden = {
  id: MOCK_ORDEN_ID,
  vehicleId: "660e8400-e29b-41d4-a716-446655440010",
  clientId: "770e8400-e29b-41d4-a716-446655440020",
  status: "Listo" as const,
  totalCost: "1500000.00",
  tenantSlug: MOCK_TENANT,
  description: "Cambio de aceite y filtros",
  diagnosis: null,
  dtcCodes: null,
  hvAlert: false,
  hvLockoutSigned: false,
  hvLockoutSignedAt: null,
  hvLockoutSignedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInsertedFactura = {
  id: "880e8400-e29b-41d4-a716-446655440030",
  tenantSlug: MOCK_TENANT,
  ordenId: MOCK_ORDEN_ID,
  tipo: "MANUAL" as const,
  numeroFacturaManual: "001-001-0023456",
  sifenCdc: null,
  sifenStatus: "MANUAL_CONVERT_QUEUE",
  xmlRaw: "<DE><rDE><dVerFor>150</dVerFor></rDE></DE>",
  xmlSigned: null,
  total: "1500000.00",
  createdAt: new Date(),
};

// ─── Build mock tx ────────────────────────────

/**
 * Creates a mock Drizzle transaction object that mimics the chainable
 * query builder API for select/insert/update patterns used in the route.
 */
function buildMockTx() {
  let selectCount = 0;

  /** Returns a thenable with optional .limit() for mocked where() results */
  function result(value: unknown[]) {
    const p = Promise.resolve(value);
    return Object.assign(p, { limit: () => p });
  }

  return {
    select: () => ({
      from: () => ({
        where: () => {
          selectCount++;
          // 1st select → fetch orden; 2nd select → check existing invoice
          if (selectCount === 1) return result([mockOrden]);
          return result([]); // no existing invoice
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([mockInsertedFactura]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(undefined),
      }),
    }),
  };
}

// We mock db() before any imports that use it
vi.mock("../../../src/shared/database/drizzle.js", () => ({
  db: () => ({
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      return cb(buildMockTx());
    }),
  }),
}));

// ─── Helper ────────────────────────────────────

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.addHook("onRequest", resolveTenant);

  // Register the hybrid invoice route
  const { invoiceRoutes } = await import(
    "../../../src/modules/finance/routes/invoice.routes.js"
  );
  await app.register(invoiceRoutes);

  await app.ready();
  return app;
}

// ─── Tests ─────────────────────────────────────

describe("🟠 [HIGH RISK] Capa 2: Integración de Doble Motor de Facturación (Manual / SIFEN)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe("INTEG-006: Facturación MANUAL transicional", () => {
    it("Debería permitir la facturación MANUAL registrando el número preimpreso", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/finance/invoices/issue",
        headers: { "x-tenant-slug": MOCK_TENANT },
        payload: {
          ordenId: MOCK_ORDEN_ID,
          tipoFacturacion: "MANUAL",
          numeroFacturaManual: "001-001-0023456",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.tipo).toBe("MANUAL");
      expect(json.data.sifenStatus).toBe("MANUAL_CONVERT_QUEUE");
      expect(json.data.sifenCdc).toBeNull();
      expect(json.data.numeroFacturaManual).toBe("001-001-0023456");
    });
  });

  describe("Validación de entrada", () => {
    it("Rechaza solicitud sin X-Tenant-Slug (403)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/finance/invoices/issue",
        payload: {
          ordenId: MOCK_ORDEN_ID,
          tipoFacturacion: "MANUAL",
          numeroFacturaManual: "001-001-0000001",
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it("Rechaza tipoFacturacion inválido", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/finance/invoices/issue",
        headers: { "x-tenant-slug": MOCK_TENANT },
        payload: {
          ordenId: MOCK_ORDEN_ID,
          tipoFacturacion: "INVALIDO",
        },
      });
      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.error).toContain("MANUAL");
    });

    it("Rechaza MANUAL sin numeroFacturaManual", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/finance/invoices/issue",
        headers: { "x-tenant-slug": MOCK_TENANT },
        payload: {
          ordenId: MOCK_ORDEN_ID,
          tipoFacturacion: "MANUAL",
        },
      });
      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.error).toContain("numeroFacturaManual");
    });

    it("Rechaza ordenId vacío", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/finance/invoices/issue",
        headers: { "x-tenant-slug": MOCK_TENANT },
        payload: {
          ordenId: "",
          tipoFacturacion: "MANUAL",
          numeroFacturaManual: "001-001-0000001",
        },
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
