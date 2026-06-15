import { describe, it, expect } from "vitest";
import { chunkText } from "../../src/modules/intelligence/rag/manual-ingestion.service.js";

describe("Memory stress — RAG chunking", () => {
  it("handles 100KB of text without excessive memory", async () => {
    const line = "Torque specification: 45 Nm. ".repeat(20);
    const text = Array.from({ length: 200 }, () => line).join("\n");
    const initial = process.memoryUsage().heapUsed;
    const chunks = await chunkText(text, 1, null);
    const after = process.memoryUsage().heapUsed;
    const deltaMb = (after - initial) / 1024 / 1024;
    expect(chunks.length).toBeGreaterThan(0);
    expect(deltaMb).toBeLessThan(50);
  });

  it("chunks never exceed 1050 chars", async () => {
    const text = "A".repeat(50_000);
    const chunks = await chunkText(text, 1, null);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(1050);
    }
  });

  it("processes 500KB of repetitive text quickly", async () => {
    const block = "Culata 40 Nm + 90°\nRueda 120 Nm\nAceite 25 Nm\n".repeat(10_000);
    const start = performance.now();
    const chunks = await chunkText(block, 1, "Engine");
    const elapsed = performance.now() - start;
    expect(chunks.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("overlap never duplicates entire chunk content", async () => {
    const text = Array.from({ length: 50 }, (_, i) => `Line ${i}: unique content ${i}`).join("\n");
    const chunks = await chunkText(text, 1, null);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].content).not.toBe(chunks[i - 1].content);
    }
  });
});

describe("Memory stress — payload size", () => {
  it("broadcast payload under 1KB for typical update", () => {
    const payload = {
      orderId: "abc-123-def-456",
      vehicleModel: "BYD Seal 2024",
      plate: "ABC 1234",
      status: "REPARACION",
      torqueSpecs: [
        { component: "Culata", value: "40 Nm + 90°" },
        { component: "Rueda", value: "120 Nm" },
      ],
      isHighVoltage: true,
      sohPercentage: 95,
      dtcCodes: ["P0AA6", "P1A00"],
      estimatedCompletion: "17:30",
    };
    const json = JSON.stringify(payload);
    const kb = Buffer.byteLength(json) / 1024;
    expect(kb).toBeLessThan(1);
  });

  it("large DTC array still under 2KB", () => {
    const dtcCodes = Array.from({ length: 50 }, (_, i) => `P${String(1000 + i).slice(1)}`);
    const payload = {
      orderId: "x".repeat(36),
      vehicleModel: "x".repeat(50),
      plate: "x".repeat(10),
      status: "DIAGNOSTICO" as const,
      torqueSpecs: Array.from({ length: 10 }, (_, i) => ({
        component: `Component ${i}`,
        value: `${10 + i * 5} Nm`,
      })),
      isHighVoltage: false,
      dtcCodes,
    };
    const json = JSON.stringify(payload);
    const kb = Buffer.byteLength(json) / 1024;
    expect(kb).toBeLessThan(2);
  });
});
