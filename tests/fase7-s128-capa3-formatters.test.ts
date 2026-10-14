/**
 * Sprint 128 — Lote B: tests unitarios para capa3-formatters (puras).
 *
 * Cubre las funciones puras del módulo DNIT/Marangatú:
 * parseMoneyToCentavos, centavosToString, buildTxtRecord, stripAccents,
 * montoFixed, fechaDDMMAAAA, marangatuHeader, marangatuTrailer, csvEscape,
 * csvRow. Sin DB ni red — 100% determinista.
 *
 * @module tests/fase7-s128-capa3-formatters
 */
import { describe, it, expect } from "vitest";
import {
  parseMoneyToCentavos,
  centavosToString,
  buildTxtRecord,
  stripAccents,
  montoFixed,
  fechaDDMMAAAA,
  marangatuHeader,
  marangatuTrailer,
  csvEscape,
  csvRow,
} from "../src/modules/finance/services/accounting/capa3-formatters.js";

describe("parseMoneyToCentavos", () => {
  it("convierte string entero a centavos", () => {
    expect(parseMoneyToCentavos("150000")).toBe(15000000n);
  });

  it("convierte número a centavos", () => {
    expect(parseMoneyToCentavos(150000)).toBe(15000000n);
  });

  it("maneja formato paraguayo con puntos de miles", () => {
    expect(parseMoneyToCentavos("1.500.000")).toBe(150000000n);
  });

  it("maneja coma decimal", () => {
    expect(parseMoneyToCentavos("1500,50")).toBe(150050n);
  });

  it("retorna 0n para null/undefined/vacío", () => {
    expect(parseMoneyToCentavos(null)).toBe(0n);
    expect(parseMoneyToCentavos(undefined)).toBe(0n);
    expect(parseMoneyToCentavos("")).toBe(0n);
  });

  it("retorna 0n para string no numérico", () => {
    expect(parseMoneyToCentavos("abc")).toBe(0n);
  });

  it("retorna 0n para '0'", () => {
    expect(parseMoneyToCentavos("0")).toBe(0n);
  });

  it("maneja negativos", () => {
    expect(parseMoneyToCentavos("-100")).toBe(-10000n);
  });
});

describe("centavosToString", () => {
  it("convierte centavos a string decimal", () => {
    expect(centavosToString(15000000n)).toBe("150000.00");
  });

  it("maneja negativos", () => {
    expect(centavosToString(-15000000n)).toBe("-150000.00");
  });

  it("rellena centavos con padStart", () => {
    expect(centavosToString(1500005n)).toBe("15000.05");
  });

  it("roundtrip con parseMoneyToCentavos", () => {
    const original = "150000";
    const centavos = parseMoneyToCentavos(original);
    expect(centavosToString(centavos)).toBe("150000.00");
  });
});

describe("buildTxtRecord", () => {
  it("construye record de ancho fijo con padding a la derecha", () => {
    const rec = buildTxtRecord([
      { value: "ABC", width: 5 },
      { value: "123", width: 5, align: "right", padChar: "0" },
    ]);
    expect(rec).toBe("ABC  00123");
  });

  it("trunca valores que exceden el ancho", () => {
    const rec = buildTxtRecord([{ value: "TOOLONGVALUE", width: 5 }]);
    expect(rec).toBe("TOOLO");
  });

  it("stripZero elimina ceros a la izquierda", () => {
    const rec = buildTxtRecord([
      { value: "00123", width: 5, align: "right", padChar: "0", stripZero: true },
    ]);
    expect(rec).toBe("00123");
  });
});

describe("stripAccents", () => {
  it("elimina acentos de caracteres latinos", () => {
    expect(stripAccents("áéíóú")).toBe("aeiou");
    expect(stripAccents("ÁÉÍÓÚ")).toBe("AEIOU");
  });

  it("conserva caracteres sin acento (ñ se normaliza a n en NFD)", () => {
    // stripAccents usa NFD + remove combining marks; ñ y ç se normalizan a n y c
    expect(stripAccents("ñç")).toBe("nc");
  });

  it("maneja cadena vacía", () => {
    expect(stripAccents("")).toBe("");
  });
});

describe("montoFixed", () => {
  it("formatea a ancho fijo sin punto decimal", () => {
    expect(montoFixed("150000", 16)).toBe("0000000015000000");
  });

  it("maneja números", () => {
    expect(montoFixed(150000, 16)).toBe("0000000015000000");
  });

  it("ignora signo negativo con Math.abs", () => {
    expect(montoFixed("-100", 10)).toBe("0000010000");
  });
});

describe("fechaDDMMAAAA", () => {
  it("formatea fecha como DDMMAAAA", () => {
    const d = new Date(2024, 0, 15); // 15 enero 2024
    expect(fechaDDMMAAAA(d)).toBe("15012024");
  });

  it("rellena con ceros a la izquierda", () => {
    const d = new Date(2024, 2, 5); // 5 marzo 2024
    expect(fechaDDMMAAAA(d)).toBe("05032024");
  });
});

describe("marangatuHeader", () => {
  it("construye header con prefijo H", () => {
    const h = marangatuHeader(2024, 12, 20);
    expect(h.startsWith("H202412")).toBe(true);
  });

  it("rellena a recordLen", () => {
    const h = marangatuHeader(2024, 12, 20);
    expect(h.length).toBe(20);
  });
});

describe("marangatuTrailer", () => {
  it("construye trailer con prefijo T", () => {
    const t = marangatuTrailer(100, 5000000, 5000000, 60);
    expect(t.startsWith("T")).toBe(true);
    expect(t.length).toBe(60);
  });

  it("incluye totales con padding", () => {
    const t = marangatuTrailer(1, 100000, 200000, 60);
    expect(t).toContain("0000000001"); // totalRecords padded to 10
  });
});

describe("csvEscape / csvRow", () => {
  it("escapa comillas y comas", () => {
    expect(csvEscape('foo,bar')).toBe('"foo,bar"');
    expect(csvEscape('foo"bar')).toBe('"foo""bar"');
  });

  it("maneja null/undefined con string vacío", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("csvRow une valores con comas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });
});
