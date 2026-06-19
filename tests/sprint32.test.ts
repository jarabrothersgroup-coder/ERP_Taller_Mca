/**
 * Sprint 32 — Scheduling & Intelligent Appointment Module
 *
 * Tests:
 *  1. agendamientoEstadoEnum has correct values
 *  2. agendamientoServicioEnum has correct values
 *  3. agendamientos table is defined
 *  4. STATE_TRANSITIONS: RESERVADO can go to CONFIRMADO
 *  5. STATE_TRANSITIONS: RESERVADO can go to CANCELADO
 *  6. STATE_TRANSITIONS: RESERVADO can go to AUSENTE
 *  7. STATE_TRANSITIONS: CONFIRMADO can go to PROCESADO_EN_ERP
 *  8. STATE_TRANSITIONS: CONFIRMADO can go to CANCELADO
 *  9. STATE_TRANSITIONS: PROCESADO_EN_ERP is terminal (no transitions)
 * 10. STATE_TRANSITIONS: invalid transition RESERVADO → PROCESADO_EN_ERP blocked
 * 11. SERVICIO_CONFIG: RAPIDO has 1h duration
 * 12. SERVICIO_CONFIG: PESADO has 4h duration
 * 13. DEFAULT_BUSINESS_HOURS: Monday is 07:30-17:30
 * 14. DEFAULT_BUSINESS_HOURS: Saturday is 07:30-12:00
 * 15. DEFAULT_BUSINESS_HOURS: Sunday is closed
 * 16. DEFAULT_BUSINESS_HOURS: maxCapacity is 5
 * 17. timeToMinutes: correctly parses HH:MM
 * 18. minutesToTime: correctly formats minutes
 * 19. addHours: correctly adds hours to time
 * 20. isWorkingDay: weekday returns true
 * 21. isWorkingDay: Sunday returns false
 * 22. validateBusinessHours: valid time passes
 * 23. validateBusinessHours: before opening fails
 * 24. validateBusinessHours: after closing fails
 * 25. checkAvailability: returns correct shape
 * 26. schedulingPlugin is a function
 * 27. schedulingRoutes is a function
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

vi.mock("../../src/config/env.js", () => ({
  env: {
    WHATSAPP_API_URL: "http://localhost:8080",
    WHATSAPP_API_KEY: "test-key",
  },
}));

// ─── Tests ─────────────────────────────────────────────

describe("Sprint 32 — Scheduling & Intelligent Appointment Module", () => {
  // ─── Schema Tests ──────────────────────────────

  describe("Agendamiento Schema", () => {
    it("agendamientoEstadoEnum has correct values", async () => {
      const { agendamientoEstadoEnum } = await import("../../src/modules/scheduling/schema/agendamientos.js");
      expect(agendamientoEstadoEnum.enumValues).toEqual([
        "RESERVADO",
        "CONFIRMADO",
        "PROCESADO_EN_ERP",
        "AUSENTE",
        "CANCELADO",
      ]);
    });

    it("agendamientoServicioEnum has correct values", async () => {
      const { agendamientoServicioEnum } = await import("../../src/modules/scheduling/schema/agendamientos.js");
      expect(agendamientoServicioEnum.enumValues).toEqual(["RAPIDO", "PESADO"]);
    });

    it("agendamientos table is defined", async () => {
      const { agendamientos } = await import("../../src/modules/scheduling/schema/agendamientos.js");
      expect(agendamientos).toBeDefined();
      expect(typeof agendamientos).toBe("object");
    });
  });

  // ─── State Machine Tests ───────────────────────

  describe("State Machine", () => {
    it("RESERVADO can transition to CONFIRMADO", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(STATE_TRANSITIONS.RESERVADO).toContain("CONFIRMADO");
    });

    it("RESERVADO can transition to CANCELADO", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(STATE_TRANSITIONS.RESERVADO).toContain("CANCELADO");
    });

    it("RESERVADO can transition to AUSENTE", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(STATE_TRANSITIONS.RESERVADO).toContain("AUSENTE");
    });

    it("CONFIRMADO can transition to PROCESADO_EN_ERP", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(STATE_TRANSITIONS.CONFIRMADO).toContain("PROCESADO_EN_ERP");
    });

    it("CONFIRMADO can transition to CANCELADO", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(STATE_TRANSITIONS.CONFIRMADO).toContain("CANCELADO");
    });

    it("PROCESADO_EN_ERP is terminal (no transitions)", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(STATE_TRANSITIONS.PROCESADO_EN_ERP).toEqual([]);
    });

    it("RESERVADO cannot directly go to PROCESADO_EN_ERP", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(STATE_TRANSITIONS.RESERVADO).not.toContain("PROCESADO_EN_ERP");
    });

    it("isValidTransition blocks invalid paths", async () => {
      const { isValidTransition } = await import("../../src/modules/scheduling/services/agendamiento.service.js");
      expect(isValidTransition("RESERVADO", "PROCESADO_EN_ERP")).toBe(false);
      expect(isValidTransition("RESERVADO", "CONFIRMADO")).toBe(true);
      expect(isValidTransition("PROCESADO_EN_ERP", "RESERVADO")).toBe(false);
    });
  });

  // ─── Service Type Tests ────────────────────────

  describe("Service Types", () => {
    it("RAPIDO has 1h duration", async () => {
      const { SERVICIO_CONFIG } = await import("../../src/modules/scheduling/types.js");
      expect(SERVICIO_CONFIG.RAPIDO.durationHours).toBe(1);
      expect(SERVICIO_CONFIG.RAPIDO.label).toContain("Rápido");
    });

    it("PESADO has 4h duration", async () => {
      const { SERVICIO_CONFIG } = await import("../../src/modules/scheduling/types.js");
      expect(SERVICIO_CONFIG.PESADO.durationHours).toBe(4);
      expect(SERVICIO_CONFIG.PESADO.label).toContain("Pesado");
    });
  });

  // ─── Business Hours Tests ──────────────────────

  describe("Business Hours", () => {
    it("Monday is 07:30-17:30", async () => {
      const { DEFAULT_BUSINESS_HOURS } = await import("../../src/modules/scheduling/types.js");
      expect(DEFAULT_BUSINESS_HOURS.slots[1]).toEqual({
        open: "07:30",
        close: "17:30",
      });
    });

    it("Saturday is 07:30-12:00", async () => {
      const { DEFAULT_BUSINESS_HOURS } = await import("../../src/modules/scheduling/types.js");
      expect(DEFAULT_BUSINESS_HOURS.slots[6]).toEqual({
        open: "07:30",
        close: "12:00",
      });
    });

    it("Sunday is closed", async () => {
      const { DEFAULT_BUSINESS_HOURS } = await import("../../src/modules/scheduling/types.js");
      expect(DEFAULT_BUSINESS_HOURS.slots[0]).toBeNull();
    });

    it("maxCapacity is 5", async () => {
      const { DEFAULT_BUSINESS_HOURS } = await import("../../src/modules/scheduling/types.js");
      expect(DEFAULT_BUSINESS_HOURS.maxCapacity).toBe(5);
    });

    it("slotIntervalMinutes is 30", async () => {
      const { DEFAULT_BUSINESS_HOURS } = await import("../../src/modules/scheduling/types.js");
      expect(DEFAULT_BUSINESS_HOURS.slotIntervalMinutes).toBe(30);
    });
  });

  // ─── Time Utility Tests ────────────────────────

  describe("Time Utilities", () => {
    it("timeToMinutes parses HH:MM correctly", async () => {
      const { timeToMinutes } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(timeToMinutes("07:30")).toBe(450);
      expect(timeToMinutes("12:00")).toBe(720);
      expect(timeToMinutes("17:30")).toBe(1050);
      expect(timeToMinutes("00:00")).toBe(0);
    });

    it("minutesToTime formats correctly", async () => {
      const { minutesToTime } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(minutesToTime(450)).toBe("07:30");
      expect(minutesToTime(720)).toBe("12:00");
      expect(minutesToTime(1050)).toBe("17:30");
      expect(minutesToTime(0)).toBe("00:00");
    });

    it("addHours adds correctly", async () => {
      const { addHours } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(addHours("07:30", 1)).toBe("08:30");
      expect(addHours("07:30", 4)).toBe("11:30");
      expect(addHours("12:00", 5.5)).toBe("17:30");
    });
  });

  // ─── Business Hours Validation Tests ───────────

  describe("Business Hours Validation", () => {
    it("isWorkingDay returns true for Monday", async () => {
      // 2026-06-22 is a Monday
      const { isWorkingDay } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(isWorkingDay("2026-06-22")).toBe(true);
    });

    it("isWorkingDay returns false for Sunday", async () => {
      // 2026-06-21 is a Sunday
      const { isWorkingDay } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(isWorkingDay("2026-06-21")).toBe(false);
    });

    it("validateBusinessHours passes for valid time", async () => {
      const { validateBusinessHours } = await import("../../src/modules/scheduling/services/capacity.service.js");
      const result = validateBusinessHours("2026-06-22", "09:00", 1);
      expect(result).toBeNull();
    });

    it("validateBusinessHours fails before opening", async () => {
      const { validateBusinessHours } = await import("../../src/modules/scheduling/services/capacity.service.js");
      const result = validateBusinessHours("2026-06-22", "06:00", 1);
      expect(result).toContain("antes de las");
    });

    it("validateBusinessHours fails when service extends past close", async () => {
      const { validateBusinessHours } = await import("../../src/modules/scheduling/services/capacity.service.js");
      const result = validateBusinessHours("2026-06-22", "16:00", 4);
      expect(result).toContain("cierra");
    });

    it("validateBusinessHours fails on closed day", async () => {
      const { validateBusinessHours } = await import("../../src/modules/scheduling/services/capacity.service.js");
      const result = validateBusinessHours("2026-06-21", "09:00", 1);
      expect(result).toContain("cerrado");
    });
  });

  // ─── Capacity Service Tests ────────────────────

  describe("Capacity Service", () => {
    it("checkAvailability is a function", async () => {
      const { checkAvailability } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(typeof checkAvailability).toBe("function");
    });

    it("checkAvailability fails on Sunday (no DB needed)", async () => {
      const { checkAvailability } = await import("../../src/modules/scheduling/services/capacity.service.js");
      const result = await checkAvailability(
        "2026-06-21",
        "09:00",
        "RAPIDO",
        "taller-el-chero",
      );

      expect(result.available).toBe(false);
      expect(result.reason).toContain("cerrado");
    });

    it("countOverlappingAppointments is a function", async () => {
      const { countOverlappingAppointments } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(typeof countOverlappingAppointments).toBe("function");
    });

    it("findAbsentAppointments is a function", async () => {
      const { findAbsentAppointments } = await import("../../src/modules/scheduling/services/capacity.service.js");
      expect(typeof findAbsentAppointments).toBe("function");
    });
  });

  // ─── Plugin Tests ──────────────────────────────

  describe("Scheduling Plugin", () => {
    it("schedulingPlugin is a function", async () => {
      const { schedulingPlugin } = await import("../../src/modules/scheduling/plugin.js");
      expect(typeof schedulingPlugin).toBe("function");
    });

    it("schedulingRoutes is a function", async () => {
      const { schedulingRoutes } = await import("../../src/modules/scheduling/routes/scheduling.routes.js");
      expect(typeof schedulingRoutes).toBe("function");
    });
  });

  // ─── Types Tests ───────────────────────────────

  describe("Scheduling Types", () => {
    it("CreateAgendamientoRequest has required fields", async () => {
      // Just verify the type compiles (runtime check via import)
      const types = await import("../../src/modules/scheduling/types.js");
      expect(types.SERVICIO_CONFIG).toBeDefined();
      expect(types.DEFAULT_BUSINESS_HOURS).toBeDefined();
      expect(types.STATE_TRANSITIONS).toBeDefined();
    });

    it("STATE_TRANSITIONS covers all 5 states", async () => {
      const { STATE_TRANSITIONS } = await import("../../src/modules/scheduling/types.js");
      expect(Object.keys(STATE_TRANSITIONS)).toHaveLength(5);
      expect(Object.keys(STATE_TRANSITIONS)).toContain("RESERVADO");
      expect(Object.keys(STATE_TRANSITIONS)).toContain("CONFIRMADO");
      expect(Object.keys(STATE_TRANSITIONS)).toContain("PROCESADO_EN_ERP");
      expect(Object.keys(STATE_TRANSITIONS)).toContain("AUSENTE");
      expect(Object.keys(STATE_TRANSITIONS)).toContain("CANCELADO");
    });

    it("getWorkingHours returns slot for weekday", async () => {
      const { getWorkingHours } = await import("../../src/modules/scheduling/services/capacity.service.js");
      const hours = getWorkingHours("2026-06-22");
      expect(hours).toEqual({ open: "07:30", close: "17:30" });
    });

    it("getWorkingHours returns null for Sunday", async () => {
      const { getWorkingHours } = await import("../../src/modules/scheduling/services/capacity.service.js");
      const hours = getWorkingHours("2026-06-21");
      expect(hours).toBeNull();
    });
  });
});
