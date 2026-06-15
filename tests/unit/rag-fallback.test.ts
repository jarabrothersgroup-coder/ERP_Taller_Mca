import { describe, it, expect } from "vitest";
import { chunkText } from "../../src/modules/intelligence/rag/manual-ingestion.service.js";

describe("RAG chunking", () => {
  it("splits text into chunks of ~1000 chars with overlap", async () => {
    const text = "A".repeat(3000);
    const chunks = await chunkText(text, 1, null);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(1050);
    expect(chunks[0].pageNumber).toBe(1);
  });

  it("handles single short page", async () => {
    const text = "Torque specification: 45 Nm";
    const chunks = await chunkText(text, 5, "Engine");
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe("Torque specification: 45 Nm");
    expect(chunks[0].pageNumber).toBe(5);
    expect(chunks[0].section).toBe("Engine");
  });

  it("handles empty text", async () => {
    const chunks = await chunkText("", 1, null);
    expect(chunks.length).toBe(0);
  });

  it("breaks chunks at newline boundaries when possible", async () => {
    const line = "A".repeat(800);
    const text = Array.from({ length: 3 }, () => line).join("\n");
    const chunks = await chunkText(text, 1, null);
    for (const c of chunks) {
      expect(c.content).not.toContain("\n");
    }
  });
});
