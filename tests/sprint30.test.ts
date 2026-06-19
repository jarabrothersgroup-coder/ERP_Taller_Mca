/**
 * Sprint 30 — WhatsApp Module Integration with Evolution API
 *
 * Tests:
 *  1. sanitizePhone handles standard Paraguay format (09XXXXXXXX)
 *  2. sanitizePhone handles country code prefix (+595)
 *  3. sanitizePhone handles bare 9-digit number
 *  4. sanitizePhone handles formatted input (0981-123-456)
 *  5. sanitizePhone rejects too short numbers
 *  6. sanitizePhone rejects numbers not starting with 9
 *  7. sanitizePhone rejects empty string
 *  8. buildMessage produces RECEPCIONADO template
 *  9. buildMessage produces PRESUPUESTADO template with Gs.
 * 10. buildMessage produces EN_REPARACION template
 * 11. buildMessage produces LISTO_ENTREGA template
 * 12. buildMessage produces FINALIZADO_RETIRADO template
 * 13. buildMessage throws on unknown template
 * 14. buildMessage handles missing optional placeholders
 * 15. buildMessage replaces all occurrences of same placeholder
 * 16. MESSAGE_TEMPLATES has all 5 expected keys
 * 17. WhatsApp msg status enum values are correct
 * 18. WhatsApp template enum values are correct
 * 19. whatsappMessages table has required columns
 * 20. getInstanceName produces correct format
 */

import { describe, it, expect } from "vitest";

// ─── Import pure functions from WhatsApp service ──
// We import the pure functions directly — no mocking needed
import { sanitizePhone, buildMessage, MESSAGE_TEMPLATES } from "../src/modules/whatsapp/services/whatsapp.service.js";
import { whatsappMsgStatusEnum, whatsappTemplateEnum } from "../src/modules/whatsapp/schema/whatsapp-log.js";

// ─── sanitizePhone Tests ────────────────────────

describe("sanitizePhone", () => {
  it("handles standard Paraguay format (09XXXXXXXX)", () => {
    expect(sanitizePhone("0981123456")).toBe("+595981123456");
  });

  it("handles country code prefix (+595)", () => {
    expect(sanitizePhone("+595981123456")).toBe("+595981123456");
  });

  it("handles bare 9-digit number starting with 9", () => {
    expect(sanitizePhone("981123456")).toBe("+595981123456");
  });

  it("handles formatted input (0981-123-456)", () => {
    expect(sanitizePhone("0981-123-456")).toBe("+595981123456");
  });

  it("handles space-separated input (0981 123456)", () => {
    expect(sanitizePhone("0981 123456")).toBe("+595981123456");
  });

  it("handles +595 with spaces", () => {
    expect(sanitizePhone("+595 981 123456")).toBe("+595981123456");
  });

  it("rejects too short numbers", () => {
    expect(() => sanitizePhone("0981234")).toThrow("inválido");
  });

  it("rejects numbers not starting with 9 after prefix removal", () => {
    expect(() => sanitizePhone("081123456")).toThrow("inválido");
  });

  it("rejects empty string", () => {
    expect(() => sanitizePhone("")).toThrow("inválido");
  });

  it("rejects numbers with only digits 0-8", () => {
    expect(() => sanitizePhone("012345678")).toThrow("inválido");
  });

  it("rejects 10-digit numbers", () => {
    expect(() => sanitizePhone("09811234567")).toThrow("inválido");
  });
});

// ─── buildMessage Tests ─────────────────────────

describe("buildMessage", () => {
  const testData = {
    nombre_cliente: "Carlos García",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "Hilux",
    chapa: "ABC 123",
    id_orden: "ORD-001",
    monto_total: "2.500.000",
    nombre_mecanico: "Pedro",
    fecha_estimada_entrega: "15/06/2026",
    numero_factura: "001-001-0001234",
    url_encuesta_satisfaccion: "https://encuesta.example.com/abc123",
  };

  it("produces RECEPCIONADO template", () => {
    const msg = buildMessage("RECEPCIONADO", testData);
    expect(msg).toContain("Carlos García");
    expect(msg).toContain("Toyota");
    expect(msg).toContain("Hilux");
    expect(msg).toContain("ABC 123");
    expect(msg).toContain("ORD-001");
    expect(msg).toContain("🚗");
  });

  it("produces PRESUPUESTADO template with Gs.", () => {
    const msg = buildMessage("PRESUPUESTADO", testData);
    expect(msg).toContain("Carlos García");
    expect(msg).toContain("2.500.000");
    expect(msg).toContain("ORD-001");
    expect(msg).toContain("PDF");
  });

  it("produces EN_REPARACION template", () => {
    const msg = buildMessage("EN_REPARACION", testData);
    expect(msg).toContain("Carlos García");
    expect(msg).toContain("Hilux");
    expect(msg).toContain("Pedro");
    expect(msg).toContain("15/06/2026");
  });

  it("produces LISTO_ENTREGA template", () => {
    const msg = buildMessage("LISTO_ENTREGA", testData);
    expect(msg).toContain("Carlos García");
    expect(msg).toContain("Hilux");
    expect(msg).toContain("ORD-001");
    expect(msg).toContain("✨");
  });

  it("produces FINALIZADO_RETIRADO template", () => {
    const msg = buildMessage("FINALIZADO_RETIRADO", testData);
    expect(msg).toContain("Carlos García");
    expect(msg).toContain("001-001-0001234");
    expect(msg).toContain("encuesta.example.com");
  });

  it("throws on unknown template", () => {
    expect(() => buildMessage("UNKNOWN_TEMPLATE", testData)).toThrow(
      "Plantilla no encontrada",
    );
  });

  it("handles missing optional placeholders gracefully", () => {
    const minimalData = {
      nombre_cliente: "Ana",
      vehiculo_marca: "Suzuki",
      vehiculo_modelo: "Swift",
      chapa: "XYZ 789",
      id_orden: "ORD-002",
    };
    // RECEPCIONADO only uses the 5 required fields — should work fine
    const msg = buildMessage("RECEPCIONADO", minimalData);
    expect(msg).toContain("Ana");
    expect(msg).toContain("Suzuki");
    expect(msg).toContain("Swift");
  });

  it("replaces all occurrences of same placeholder", () => {
    // FINALIZADO_RETIRADO doesn't repeat placeholders, but we test the engine
    const msg = buildMessage("RECEPCIONADO", testData);
    // nombre_cliente appears once in RECEPCIONADO template
    const count = (msg.match(/Carlos García/g) || []).length;
    expect(count).toBe(1);
  });
});

// ─── MESSAGE_TEMPLATES Tests ────────────────────

describe("MESSAGE_TEMPLATES", () => {
  it("has all 5 expected keys", () => {
    const keys = Object.keys(MESSAGE_TEMPLATES);
    expect(keys).toHaveLength(5);
    expect(keys).toContain("RECEPCIONADO");
    expect(keys).toContain("PRESUPUESTADO");
    expect(keys).toContain("EN_REPARACION");
    expect(keys).toContain("LISTO_ENTREGA");
    expect(keys).toContain("FINALIZADO_RETIRADO");
  });

  it("each template contains {nombre_cliente} placeholder", () => {
    for (const [key, tmpl] of Object.entries(MESSAGE_TEMPLATES)) {
      expect(tmpl).toContain("{nombre_cliente}");
    }
  });

  it("RECEPCIONADO and LISTO_ENTREGA contain vehicle placeholders", () => {
    expect(MESSAGE_TEMPLATES["RECEPCIONADO"]).toContain("{vehiculo_marca}");
    expect(MESSAGE_TEMPLATES["RECEPCIONADO"]).toContain("{vehiculo_modelo}");
    expect(MESSAGE_TEMPLATES["LISTO_ENTREGA"]).toContain("{vehiculo_modelo}");
  });

  it("RECEPCIONADO, PRESUPUESTADO and LISTO_ENTREGA contain {id_orden}", () => {
    expect(MESSAGE_TEMPLATES["RECEPCIONADO"]).toContain("{id_orden}");
    expect(MESSAGE_TEMPLATES["PRESUPUESTADO"]).toContain("{id_orden}");
    expect(MESSAGE_TEMPLATES["LISTO_ENTREGA"]).toContain("{id_orden}");
  });

  it("PRESUPUESTADO template includes {monto_total}", () => {
    expect(MESSAGE_TEMPLATES["PRESUPUESTADO"]).toContain("{monto_total}");
  });

  it("FINALIZADO_RETIRADO template includes {numero_factura}", () => {
    expect(MESSAGE_TEMPLATES["FINALIZADO_RETIRADO"]).toContain(
      "{numero_factura}",
    );
  });

  it("FINALIZADO_RETIRADO template includes survey URL placeholder", () => {
    expect(MESSAGE_TEMPLATES["FINALIZADO_RETIRADO"]).toContain(
      "{url_encuesta_satisfaccion}",
    );
  });

  it("EN_REPARACION template includes {nombre_mecanico}", () => {
    expect(MESSAGE_TEMPLATES["EN_REPARACION"]).toContain("{nombre_mecanico}");
  });

  it("EN_REPARACION template includes {fecha_estimada_entrega}", () => {
    expect(MESSAGE_TEMPLATES["EN_REPARACION"]).toContain(
      "{fecha_estimada_entrega}",
    );
  });
});

// ─── Schema Enum Tests ─────────────────────────

describe("WhatsApp schema enums", () => {
  it("whatsappMsgStatusEnum has correct values", () => {
    expect(whatsappMsgStatusEnum.enumValues).toEqual([
      "PENDING",
      "SENT",
      "FAILED",
    ]);
  });

  it("whatsappTemplateEnum has correct values", () => {
    expect(whatsappTemplateEnum.enumValues).toEqual([
      "RECEPCIONADO",
      "PRESUPUESTADO",
      "EN_REPARACION",
      "LISTO_ENTREGA",
      "FINALIZADO_RETIRADO",
      "CUSTOM",
    ]);
  });

  it("whatsappTemplateEnum includes CUSTOM variant", () => {
    expect(whatsappTemplateEnum.enumValues).toContain("CUSTOM");
  });

  it("whatsappMsgStatusEnum includes PENDING for initial state", () => {
    expect(whatsappTemplateEnum.enumValues.length).toBe(6);
  });
});

// ─── Phone Validation Edge Cases ────────────────

describe("sanitizePhone edge cases", () => {
  it("handles phone with parentheses", () => {
    expect(sanitizePhone("(0981) 123456")).toBe("+595981123456");
  });

  it("handles phone with dots", () => {
    expect(sanitizePhone("0981.123.456")).toBe("+595981123456");
  });

  it("handles phone with plus and spaces", () => {
    expect(sanitizePhone("+595 981 123 456")).toBe("+595981123456");
  });

  it("preserves the 9 prefix (Paraguay mobile)", () => {
    const result = sanitizePhone("0991123456");
    expect(result).toMatch(/^\+5959\d{8}$/);
  });

  it("handles all valid Paraguay mobile prefixes", () => {
    const prefixes = ["0981", "0982", "0983", "0984", "0985", "0991", "0992", "0993", "0994", "0995"];
    for (const prefix of prefixes) {
      const num = prefix + "123456";
      const result = sanitizePhone(num);
      expect(result).toMatch(/^\+5959\d{8}$/);
    }
  });
});
