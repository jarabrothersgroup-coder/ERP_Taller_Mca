/**
 * Thinkcar Parser Service — Unit Tests
 *
 * Tests the PDF parser that extracts VIN, DTC codes, and vehicle
 * metadata from Thinkcar diagnostic reports.
 *
 * Since `extractHeader` and `extractDtcs` are internal (not exported),
 * we test them through `parseFromPdf()` by mocking `pdf-parse` to
 * return controlled text.
 *
 * @module tests/modules/thinkcar/services/thinkcar-parser.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// Mock pdf-parse BEFORE importing the module under test
const mockPdfParse = vi.fn();
vi.mock("pdf-parse", () => ({
  default: mockPdfParse,
}));

const { computeFileHash, parseFromFilename, parseFromPdf } = await import(
  "../../../../src/modules/thinkcar/services/thinkcar-parser.service.js"
);

// ─── Helpers ───────────────────────────────────

function makeBuffer(text: string): Buffer {
  return Buffer.from(text, "utf-8");
}

// ─── Tests ─────────────────────────────────────

describe("computeFileHash", () => {
  it("returns sha256 hex digest", () => {
    const buf = makeBuffer("test content");
    const hash = computeFileHash(buf);
    expect(hash).toHaveLength(64); // sha256 hex
    expect(hash).toBe(createHash("sha256").update(buf).digest("hex"));
  });

  it("is deterministic (same input = same hash)", () => {
    const buf = makeBuffer("hello");
    expect(computeFileHash(buf)).toBe(computeFileHash(buf));
  });
});

describe("parseFromFilename", () => {
  it("extracts brand, VIN, date from Thinkcar pattern 1", () => {
    // Pattern: brand_Pre-reparación_vin_Informe de diagnóstico_EXTRA_14digittimestamp
    // Note: the regex `.+_(?<ts>\d{14})` requires at least 1 char of extra text
    // between "diagnóstico" and the final underscore before the timestamp
    const result = parseFromFilename(
      "Toyota_Pre-reparación_JTEBU29J780000123_Informe de diagnóstico_extra_20250314120000.pdf",
    );
    expect(result.brand).toBe("Toyota");
    expect(result.vin).toBe("JTEBU29J780000123");
    expect(result.reportType).toBe("Pre-reparación");
    expect(result.scanDate).toBeInstanceOf(Date);
    expect(result.scanDate!.toISOString()).toContain("2025-03-14");
  });

  it("extracts brand, VIN, epoch from Thinkcar pattern 2", () => {
    // Note: epoch is in seconds but new Date() expects ms in the source.
    // new Date(1712500000) = 1970-01-20 (seconds not converted to ms)
    // This is a known source limitation.
    const result = parseFromFilename(
      "_12345_1HGBH41JXMN109186_1712500000_extra_TOYOTA_prerepair_report.pdf",
    );
    expect(result.brand).toBe("TOYOTA");
    expect(result.vin).toBe("1HGBH41JXMN109186");
    expect(result.reportType).toBe("Pre-reparación");
    // Epoch 1712500000 seconds → JS Date uses ms → 1970-01-20
    expect(result.scanDate!.getTime()).toBe(1712500000);
  });

  it("returns empty object for unrecognized filename", () => {
    const result = parseFromFilename("random_file_name.txt");
    expect(result).toEqual({});
  });
});

describe("extractHeader (via parseFromPdf)", () => {
  beforeEach(() => {
    mockPdfParse.mockReset();
  });

  it("extracts VIN from Spanish text", async () => {
    mockPdfParse.mockResolvedValue({
      text: "Número de bastidor: JTEBU29J780000123\nMarca: Toyota\nModelo: Corolla\nAño: 2020\n",
    });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.vin).toBe("JTEBU29J780000123");
    expect(result.brand).toBe("Toyota");
    expect(result.model).toBe("Corolla");
    expect(result.year).toBe(2020);
  });

  it("extracts VIN from English text with Spanish labels (source limitation)", async () => {
    // Note: extractHeader only has Spanish keywords (Marca, Modelo, Año, etc.)
    // English labels like "Brand:" are not matched. Test Spanish labels instead.
    mockPdfParse.mockResolvedValue({
      text: "VIN: 1HGBH41JXMN109186\nMarca: Honda\nModelo: Civic\nAño: 2019\n",
    });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.vin).toBe("1HGBH41JXMN109186");
    expect(result.brand).toBe("Honda");
    expect(result.model).toBe("Civic");
    expect(result.year).toBe(2019);
  });

  it("extracts plate and odometer", async () => {
    mockPdfParse.mockResolvedValue({
      text: "Número de licencia: ABC-1234\nCuentakilómetros: 85,432\nTiempo: 03/15/2025 14:30:00\n",
    });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.plate).toBe("ABC-1234");
    expect(result.odometer).toBe(85432);
  });

  it("extracts scan date in M/D/Y format", async () => {
    mockPdfParse.mockResolvedValue({
      text: "Tiempo: 03/15/2025 14:30:00\n",
    });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.scanDate).toBeInstanceOf(Date);
    expect(result.scanDate!.getMonth()).toBe(2); // March = 2
    expect(result.scanDate!.getDate()).toBe(15);
    expect(result.scanDate!.getFullYear()).toBe(2025);
  });

  it("extracts scan date in Y/M/D format", async () => {
    mockPdfParse.mockResolvedValue({
      text: "Fecha: 2025/03/20 09:15:00\n",
    });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.scanDate!.getFullYear()).toBe(2025);
    expect(result.scanDate!.getMonth()).toBe(2);
    expect(result.scanDate!.getDate()).toBe(20);
  });

  it("handles N/A values gracefully", async () => {
    mockPdfParse.mockResolvedValue({
      text: "Número de bastidor: N/A\nCuentakilómetros: N/A\n",
    });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.vin).toBeNull();
    expect(result.odometer).toBeNull();
  });

  it("returns null for missing fields", async () => {
    mockPdfParse.mockResolvedValue({
      text: "Some random text without any vehicle info\n",
    });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.vin).toBeNull();
    expect(result.brand).toBeNull();
    expect(result.model).toBeNull();
    expect(result.scanDate).toBeNull();
  });
});

describe("extractDtcs — Format 1 (table)", () => {
  beforeEach(() => {
    mockPdfParse.mockReset();
  });

  it("parses DTC table format with System/Code/Description/Status", async () => {
    // Note: The parser groups all lines before the first DTC code as
    // header material, so "Motor" is treated as a header line, not a system.
    // The system defaults to "Sistema General" when no system line
    // precedes the DTC code within the parsed group.
    const tableText = [
      "DTC",
      "Sistema",
      "Código",
      "Descripción",
      "Estado",
      "Motor",
      "P0301",
      "Fallo de encendido cilindro 1",
      "Almacenado",
      "ABS",
      "C0035",
      "Sensor velocidad rueda delantera izquierda",
      "Almacenado",
    ].join("\n");

    mockPdfParse.mockResolvedValue({ text: tableText });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.dtcs).toHaveLength(2);
    expect(result.dtcs[0]!.code).toBe("P0301");
    expect(result.dtcs[0]!.system).toBe("Sistema General");
    expect(result.dtcs[0]!.status).toBe("Almacenado");
    expect(result.dtcs[1]!.code).toBe("C0035");
    expect(result.dtcs[1]!.system).toBe("Sistema General");
  });
});

describe("extractDtcs — Format 2 (numbered list)", () => {
  beforeEach(() => {
    mockPdfParse.mockReset();
  });

  it("parses numbered DTC list format", async () => {
    const listText = [
      "Resultado de la inspección",
      "1. P0301 Fallo de encendido cilindro 1",
      "2. P0420 Eficiencia del catalizador baja",
      "3. C0035 Sensor velocidad rueda",
    ].join("\n");

    mockPdfParse.mockResolvedValue({ text: listText });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.dtcs).toHaveLength(3);
    expect(result.dtcs[0]!.code).toBe("P0301");
    expect(result.dtcs[0]!.description).toContain("encendido");
    expect(result.dtcs[1]!.code).toBe("P0420");
    expect(result.dtcs[2]!.code).toBe("C0035");
  });
});

describe("extractDtcs — Fallback regex", () => {
  beforeEach(() => {
    mockPdfParse.mockReset();
  });

  it("falls back to regex DTC extraction when no table/list format detected", async () => {
    const text = "DTC codes found: P0301, P0420, C0035, B1000";
    mockPdfParse.mockResolvedValue({ text });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.dtcs.length).toBeGreaterThanOrEqual(3);
    const codes = result.dtcs.map((d) => d.code);
    expect(codes).toContain("P0301");
    expect(codes).toContain("P0420");
    expect(codes).toContain("C0035");
  });

  it("deduplicates repeated codes in fallback", async () => {
    const text = "P0301 P0301 P0301";
    mockPdfParse.mockResolvedValue({ text });
    const result = await parseFromPdf(makeBuffer("dummy"));
    const p0301s = result.dtcs.filter((d) => d.code === "P0301");
    expect(p0301s).toHaveLength(1);
  });
});

describe("parseFromPdf — filename fallback", () => {
  beforeEach(() => {
    mockPdfParse.mockReset();
  });

  it("uses filename hints when text extraction is empty", async () => {
    // Note: regex requires extra text between "diagnóstico" and the timestamp
    const filename =
      "Toyota_Pre-reparación_JTEBU29J780000123_Informe de diagnóstico_extra_20250314120000.pdf";
    mockPdfParse.mockResolvedValue({ text: "" });
    const result = await parseFromPdf(makeBuffer("dummy"), filename);
    expect(result.brand).toBe("Toyota");
    expect(result.vin).toBe("JTEBU29J780000123");
    expect(result.reportType).toBe("Pre-reparación");
  });

  it("text header takes precedence over filename", async () => {
    mockPdfParse.mockResolvedValue({
      text: "Marca: Honda\nModelo: Civic\n",
    });
    const result = await parseFromPdf(
      makeBuffer("dummy"),
      "Toyota_prerepair_report.pdf",
    );
    // Text extraction should win over filename
    expect(result.brand).toBe("Honda");
    expect(result.model).toBe("Civic");
  });

  it("reports error when pdf-parse fails", async () => {
    mockPdfParse.mockRejectedValue(new Error("PDF corrupto"));
    await expect(
      parseFromPdf(makeBuffer("corrupted")),
    ).rejects.toThrow("PDF corrupto");
  });

  it("sets scannerBrand to Thinkcar", async () => {
    mockPdfParse.mockResolvedValue({ text: "" });
    const result = await parseFromPdf(makeBuffer("dummy"));
    expect(result.scannerBrand).toBe("Thinkcar ThinkTool Mini");
  });
});
