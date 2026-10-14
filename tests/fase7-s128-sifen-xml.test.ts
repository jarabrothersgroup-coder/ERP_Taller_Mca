/**
 * Sprint 128 — Lote B: tests unitarios para sifen-xml.service (puras).
 *
 * Cubre buildDTEXml (generación de XML DTE), validateDTEXml (validación
 * estructural), y parseSifenSoapResponse (parsing de respuesta SOAP DNIT).
 * Funciones puras, sin DB ni red.
 *
 * @module tests/fase7-s128-sifen-xml
 */
import { describe, it, expect } from "vitest";
import {
  buildDTEXml,
  validateDTEXml,
  parseSifenSoapResponse,
} from "../src/modules/finance/services/sifen/sifen-xml.service.js";
import type { EmitirDTERequest } from "../src/modules/finance/types.js";

const baseDTE: EmitirDTERequest & {
  emisorRuc: string;
  emisorRazonSocial: string;
  receptorRuc: string;
  receptorRazonSocial: string;
  receptorDireccion?: string;
} = {
  ordenTrabajoId: "00000000-0000-0000-0000-000000000001",
  clienteId: "00000000-0000-0000-0000-000000000002",
  dteTipo: "FACTURA",
  serie: "001",
  numero: "0000001",
  fechaEmision: "2024-06-15T10:00:00Z",
  condicionVenta: "CONTADO",
  moneda: "PYG",
  items: [
    {
      cantidad: 1,
      unidadMedida: "HORA",
      descripcion: "Servicio de diagnóstico",
      precioUnitario: "150000",
      iva: 10,
      subtotal: "150000",
    },
  ],
  regimenIVA: "GENERAL",
  emisorRuc: "80012345-6",
  emisorRazonSocial: "TALLER MCA S.A.",
  receptorRuc: "90098765-4",
  receptorRazonSocial: "CLIENTE EJEMPLO",
  receptorDireccion: "Av. España 1234, Asunción",
};

describe("buildDTEXml", () => {
  it("genera XML válido con declaración y raíz rEnvioDTE", () => {
    const xml = buildDTEXml(baseDTE);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<rEnvioDTE");
    expect(xml).toContain("</rEnvioDTE>");
  });

  it("incluye cabecera con serie, número, RUC emisor y receptor", () => {
    const xml = buildDTEXml(baseDTE);
    expect(xml).toContain("<dSerie>001</dSerie>");
    expect(xml).toContain("<dNumDoc>0000001</dNumDoc>");
    expect(xml).toContain("<dRucEm>80012345-6</dRucEm>");
    expect(xml).toContain("<dRucRe>90098765-4</dRucRe>");
    expect(xml).toContain("<dRazSocEm>TALLER MCA S.A.</dRazSocEm>");
    expect(xml).toContain("<dRazSocRe>CLIENTE EJEMPLO</dRazSocRe>");
  });

  it("incluye dDetalle con items y dTotales", () => {
    const xml = buildDTEXml(baseDTE);
    expect(xml).toContain("<dDetalle>");
    expect(xml).toContain("<dTotales>");
    expect(xml).toContain("Servicio de diagnóstico");
  });

  it("incluye dirección del receptor cuando está presente", () => {
    const xml = buildDTEXml(baseDTE);
    expect(xml).toContain("<dDirRe>Av. España 1234, Asunción</dDirRe>");
  });

  it("omite dirección del receptor cuando no está presente", () => {
    const { receptorDireccion: _omit, ...sinDireccion } = baseDTE;
    const xml = buildDTEXml(sinDireccion);
    expect(xml).not.toContain("<dDirRe>");
  });
});

describe("validateDTEXml", () => {
  it("valida un XML bien formado como válido", () => {
    const xml = buildDTEXml(baseDTE);
    const result = validateDTEXml(xml);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rechaza XML vacío", () => {
    const result = validateDTEXml("");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("XML vacío");
  });

  it("rechaza XML sin declaración", () => {
    const result = validateDTEXml("<rEnvioDTE></rEnvioDTE>");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Falta declaración XML");
  });

  it("rechaza XML sin elementos estructurales requeridos", () => {
    const result = validateDTEXml('<?xml version="1.0"?><rEnvioDTE></rEnvioDTE>');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("DE"))).toBe(true);
    expect(result.errors.some((e) => e.includes("dCabecera"))).toBe(true);
  });

  it("detecta XML malformado", () => {
    const result = validateDTEXml('<?xml version="1.0"?><rEnvioDTE><unclosed>');
    expect(result.isValid).toBe(false);
  });
});

describe("parseSifenSoapResponse", () => {
  it("extrae código de resultado y CDC de respuesta SOAP válida", () => {
    const soap = `<?xml version="1.0"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <RetEnviDTE xmlns="http://sifen.dnit.gov.py/">
            <dCodRes>0000</dCodRes>
            <dCDC>123456789012345678901234567890123456789012345</dCDC>
            <dNumTrans>998877</dNumTrans>
          </RetEnviDTE>
        </soap:Body>
      </soap:Envelope>`;
    const result = parseSifenSoapResponse(soap);
    expect(result.codigoResultado).toBeDefined();
    expect(result.cdc).toBeDefined();
  });

  it("retorna valores por defecto en XML no parseable", () => {
    const result = parseSifenSoapResponse("esto no es XML");
    // El parser no lanza — retorna estructura con nulls o códigos de error
    expect(result).toBeDefined();
    expect(typeof result.codigoResultado).toBe("string");
  });

  it("maneja respuesta vacía", () => {
    const result = parseSifenSoapResponse("");
    expect(result).toBeDefined();
  });
});
