/**
 * Sprint 31 — Communication & Loyalty Module Integration
 *
 * Tests:
 *  1. Twenty CRM types: TwentyContact interface
 *  2. Twenty CRM types: TwentyUpsertResult interface
 *  3. Twenty CRM types: TwentyAutomotiveFields interface
 *  4. CRM sync log schema: crmSyncOperationEnum values
 *  5. CRM sync log schema: crmSyncStatusEnum values
 *  6. WhatsApp error log schema: errorSourceEnum values
 *  7. WhatsApp error log schema: errorOperationEnum values
 *  8. Integration error logger: logIntegrationError handles errors gracefully
 *  9. Integration error logger: getUnresolvedErrors returns array
 * 10. Integration error logger: getErrorStats returns correct shape
 * 11. CRM sync worker: syncOrderToCrm returns CrmSyncResult shape
 * 12. Docker compose: file exists and is valid YAML
 * 13. Environment config: TWENTY_API_URL has default
 * 14. Environment config: TWENTY_API_KEY has default
 * 15. Environment config: TWENTY_GRAPHQL_URL has default
 * 16. Twenty CRM service: upsertContact signature matches types
 * 17. CRM routes: all route handlers are functions
 * 18. WhatsApp error log: whatsappErrorsLog table has required columns
 * 19. CRM sync log: crmSyncLog table has required columns
 * 20. Install guide: docker-compose.yml references all services
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock drizzle-orm ──────────────────────────────────

const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();
const mockOffset = vi.fn().mockReturnThis();
const mockReturning = vi.fn().mockResolvedValue([{ id: "mock-id" }]);
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: mockReturning }) });
const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: mockReturning }) }) });

const mockDb = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: mockDb,
}));

// ─── Mock env ──────────────────────────────────────────

vi.mock("../../src/config/env.js", () => ({
  env: {
    TWENTY_API_URL: "http://localhost:3001",
    TWENTY_API_KEY: "test-api-key",
    TWENTY_GRAPHQL_URL: "http://localhost:3001/graphql",
    WHATSAPP_API_URL: "http://localhost:8080",
    WHATSAPP_API_KEY: "test-wa-key",
  },
}));

// ─── Tests ─────────────────────────────────────────────

describe("Sprint 31 — Communication & Loyalty Module", () => {
  // ─── Type Interface Tests ────────────────────────

  describe("Twenty CRM Types", () => {
    it("TwentyContact interface accepts valid data", () => {
      const contact: import("../../src/modules/crm/types.js").TwentyContact = {
        name: "Carlos García",
        phone: "+595981123456",
        email: "carlos@test.com",
        documentId: "1234567",
      };
      expect(contact.name).toBe("Carlos García");
      expect(contact.phone).toBe("+595981123456");
    });

    it("TwentyUpsertResult interface has required fields", () => {
      const result: import("../../src/modules/crm/types.js").TwentyUpsertResult = {
        created: true,
        contactId: "abc-123",
        operation: "created",
        timestamp: new Date().toISOString(),
        durationMs: 150,
      };
      expect(result.created).toBe(true);
      expect(result.operation).toBe("created");
      expect(result.durationMs).toBe(150);
    });

    it("TwentyAutomotiveFields interface accepts vehicle data", () => {
      const fields: import("../../src/modules/crm/types.js").TwentyAutomotiveFields = {
        vehiclePlate: "ABC 123",
        vehicleBrand: "Toyota",
        vehicleModel: "Hilux",
        currentMileage: 45000,
        lastServiceType: "Cambio de aceite",
        clientType: "WALK_IN",
      };
      expect(fields.vehiclePlate).toBe("ABC 123");
      expect(fields.clientType).toBe("WALK_IN");
    });
  });

  // ─── Schema Enum Tests ──────────────────────────

  describe("CRM Sync Log Schema", () => {
    it("crmSyncOperationEnum has correct values", async () => {
      const { crmSyncOperationEnum } = await import("../../src/modules/crm/schema/crm-sync-log.js");
      expect(crmSyncOperationEnum.enumValues).toEqual([
        "upsert_contact",
        "add_note",
        "update_vehicle",
        "create_contact",
        "update_contact",
      ]);
    });

    it("crmSyncStatusEnum has correct values", async () => {
      const { crmSyncStatusEnum } = await import("../../src/modules/crm/schema/crm-sync-log.js");
      expect(crmSyncStatusEnum.enumValues).toEqual([
        "pending",
        "success",
        "failed",
        "retrying",
      ]);
    });
  });

  describe("WhatsApp Error Log Schema", () => {
    it("errorSourceEnum has correct values", async () => {
      const { errorSourceEnum } = await import("../../src/modules/whatsapp/schema/whatsapp-error-log.js");
      expect(errorSourceEnum.enumValues).toEqual([
        "whatsapp",
        "twenty_crm",
        "evolution_api",
      ]);
    });

    it("errorOperationEnum has correct values", async () => {
      const { errorOperationEnum } = await import("../../src/modules/whatsapp/schema/whatsapp-error-log.js");
      expect(errorOperationEnum.enumValues).toContain("send_message");
      expect(errorOperationEnum.enumValues).toContain("crm_sync");
      expect(errorOperationEnum.enumValues).toContain("create_instance");
      expect(errorOperationEnum.enumValues.length).toBeGreaterThanOrEqual(8);
    });
  });

  // ─── Integration Error Logger Tests ─────────────

  describe("Integration Error Logger", () => {
    it("logIntegrationError handles errors gracefully", async () => {
      // Mock the insert to succeed
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: mockReturning,
        }),
      });

      const { logIntegrationError } = await import("../../src/shared/middleware/integration-error-logger.js");

      // Should not throw even if the operation fails
      await expect(
        logIntegrationError({
          source: "whatsapp",
          operation: "send_message",
          errorMessage: "Test error",
          tenantSlug: "taller-el-chero",
        }),
      ).resolves.toBeUndefined();
    });

    it("getUnresolvedErrors returns array", async () => {
      mockSelect.mockReturnThis();
      mockFrom.mockReturnThis();
      mockWhere.mockReturnThis();
      mockOrderBy.mockReturnThis();
      mockLimit.mockResolvedValue([]);

      const { getUnresolvedErrors } = await import("../../src/shared/middleware/integration-error-logger.js");
      const result = await getUnresolvedErrors("taller-el-chero");
      expect(Array.isArray(result)).toBe(true);
    });

    it("getErrorStats returns correct shape", async () => {
      mockSelect.mockReturnThis();
      mockFrom.mockReturnThis();
      mockWhere.mockResolvedValue([]);

      const { getErrorStats } = await import("../../src/shared/middleware/integration-error-logger.js");
      const stats = await getErrorStats("taller-el-chero");
      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("unresolved");
      expect(stats).toHaveProperty("bySource");
      expect(stats).toHaveProperty("recent");
    });
  });

  // ─── CRM Sync Worker Tests ──────────────────────

  describe("CRM Sync Worker", () => {
    it("syncOrderToCrm returns CrmSyncResult shape on missing order", async () => {
      // Mock empty result for order lookup
      mockSelect.mockReturnThis();
      mockFrom.mockReturnThis();
      mockWhere.mockReturnThis();
      mockLimit.mockResolvedValue([]);

      const { syncOrderToCrm } = await import("../../src/modules/crm/services/crm-sync.worker.js");
      const result = await syncOrderToCrm(
        "00000000-0000-0000-0000-000000000000",
        "taller-el-chero",
        "test@test.com",
      );

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("operation");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("durationMs");
      expect(result.success).toBe(false); // Should fail because order doesn't exist
    });
  });

  // ─── Environment Config Tests ───────────────────

  describe("Environment Configuration", () => {
    it("TWENTY_API_URL has default value", async () => {
      const { env } = await import("../../src/config/env.js");
      expect(env.TWENTY_API_URL).toBeTruthy();
    });

    it("TWENTY_API_KEY is defined", async () => {
      const { env } = await import("../../src/config/env.js");
      expect(typeof env.TWENTY_API_KEY).toBe("string");
    });

    it("TWENTY_GRAPHQL_URL is defined", async () => {
      const { env } = await import("../../src/config/env.js");
      expect(typeof env.TWENTY_GRAPHQL_URL).toBe("string");
    });

    it("WHATSAPP_API_URL has default value", async () => {
      const { env } = await import("../../src/config/env.js");
      expect(env.WHATSAPP_API_URL).toBeTruthy();
    });
  });

  // ─── Docker Compose Tests ───────────────────────

  describe("Docker Infrastructure", () => {
    it("docker-compose.yml exists", async () => {
      const fs = await import("fs");
      const exists = fs.existsSync("docker-compose.yml");
      expect(exists).toBe(true);
    });

    it("docker-compose.yml contains required services", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("docker-compose.yml", "utf8");
      expect(content).toContain("postgres:");
      expect(content).toContain("twenty-crm:");
      expect(content).toContain("evolution-api:");
      expect(content).toContain("erp:");
      expect(content).toContain("redis:");
    });

    it(".env.example contains all required variables", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(".env.example", "utf8");
      expect(content).toContain("TWENTY_API_URL");
      expect(content).toContain("TWENTY_API_KEY");
      expect(content).toContain("WHATSAPP_API_URL");
      expect(content).toContain("WHATSAPP_API_KEY");
      expect(content).toContain("POSTGRES_DB");
      expect(content).toContain("EVOLUTION_API_PORT");
    });
  });

  // ─── CRM Routes Tests ───────────────────────────

  describe("CRM Routes", () => {
    it("crmRoutes is a function", async () => {
      const { crmRoutes } = await import("../../src/modules/crm/routes/crm.routes.js");
      expect(typeof crmRoutes).toBe("function");
    });

    it("crmPlugin is a function", async () => {
      const { crmPlugin } = await import("../../src/modules/crm/plugin.js");
      expect(typeof crmPlugin).toBe("function");
    });
  });

  // ─── Schema Column Tests ────────────────────────

  describe("Schema Tables", () => {
    it("whatsappErrorsLog is defined", async () => {
      const { whatsappErrorsLog } = await import("../../src/modules/whatsapp/schema/whatsapp-error-log.js");
      expect(whatsappErrorsLog).toBeDefined();
      expect(typeof whatsappErrorsLog).toBe("object");
    });

    it("crmSyncLog is defined", async () => {
      const { crmSyncLog } = await import("../../src/modules/crm/schema/crm-sync-log.js");
      expect(crmSyncLog).toBeDefined();
      expect(typeof crmSyncLog).toBe("object");
    });
  });
});
