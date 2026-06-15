/**
 * SIFEN SOAP Web Service Client — HTTPS/SOAP connection with DNIT.
 *
 * Handles the secure SOAP 1.1/1.2 communication with the DNIT SIFEN
 * web services for:
 *   - sif-01: Envío de DTE (Send invoice) → receives CDC
 *   - sif-02: Consulta de DTE (Query invoice status)
 *   - sif-03: Anulación de DTE (Cancel invoice)
 *
 * All communication is over HTTPS with TLS 1.2+.
 * The SOAP envelope is built manually (no heavy SOAP stack) to keep
 * RAM under 50MB.
 *
 * @module finance/services/sifen/sifen-soap.service
 */

import https from "node:https";
import { env } from "../../../../config/env.js";
import type { SIFENSoapResponse } from "../../types.js";
import { parseSifenSoapResponse } from "./sifen-xml.service.js";

// ─── Constants ─────────────────────────────────

/** SIFEN production SOAP endpoint URL */
const SIFEN_PROD_URL = "https://sifen.dnit.gov.py/sifen-ws";

/** SIFEN test (homologación) SOAP endpoint URL */
const SIFEN_TEST_URL = "https://sifen-test.dnit.gov.py/sifen-ws";

/** SOAP XML namespace for SIFEN */
const NS_SIFEN_WS = "http://www.dnit.gov.py/sifen/ws/";

/** HTTP timeout in milliseconds */
const SOAP_TIMEOUT_MS = 30_000;

/** Maximum retries for transient network errors */
const MAX_RETRIES = 3;

/** Retry delay base (exponential backoff) in ms */
const RETRY_DELAY_MS = 1000;

// ─── SOAP Envelope builders ────────────────────

/**
 * Builds the SOAP envelope for sif-01 (Envío de DTE).
 *
 * @param signedXml - The signed DTE XML
 * @param dteId - Internal document ID for tracking
 * @returns Complete SOAP 1.1 envelope XML string
 */
function buildEnvioSOAP(signedXml: string, dteId: string): string {
  // Escape XML for embedding in SOAP body
  const escapedXml = signedXml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">`,
    `  <soap:Body>`,
    `    <sifEnviar xmlns="${NS_SIFEN_WS}">`,
    `      <xId>${dteId}</xId>`,
    `      <xDE>${escapedXml}</xDE>`,
    `    </sifEnviar>`,
    `  </soap:Body>`,
    `</soap:Envelope>`,
  ].join("\n");
}

/**
 * Builds the SOAP envelope for sif-02 (Consulta de DTE).
 *
 * @param cdc - The CDC (Código de Control) to query
 * @returns Complete SOAP envelope XML string
 */
function buildConsultaSOAP(cdc: string): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">`,
    `  <soap:Body>`,
    `    <sifConsultar xmlns="${NS_SIFEN_WS}">`,
    `      <xCDC>${cdc}</xCDC>`,
    `    </sifConsultar>`,
    `  </soap:Body>`,
    `</soap:Envelope>`,
  ].join("\n");
}

/**
 * Builds the SOAP envelope for sif-03 (Anulación de DTE).
 *
 * @param cdc - The CDC of the document to cancel
 * @param motivo - Cancellation reason
 * @returns Complete SOAP envelope XML string
 */
function buildAnulacionSOAP(cdc: string, motivo: string): string {
  const escapedMotivo = motivo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">`,
    `  <soap:Body>`,
    `    <sifAnular xmlns="${NS_SIFEN_WS}">`,
    `      <xCDC>${cdc}</xCDC>`,
    `      <xMotivo>${escapedMotivo}</xMotivo>`,
    `    </sifAnular>`,
    `  </soap:Body>`,
    `</soap:Envelope>`,
  ].join("\n");
}

// ─── HTTPS/SOAP Transport ──────────────────────

/**
 * Determines the SIFEN endpoint URL based on environment config.
 */
function getEndpoint(): string {
  return env.SIFEN_USE_TEST === true || env.NODE_ENV === "development"
    ? SIFEN_TEST_URL
    : SIFEN_PROD_URL;
}

/**
 * Sends a raw SOAP envelope to the DNIT SIFEN web service.
 *
 * Uses Node.js built-in `https` module — no external SOAP library.
 * Implements retry with exponential backoff for transient failures.
 *
 * @param soapXml - Complete SOAP envelope XML
 * @param operation - Operation label for logging ("ENVIO"|"CONSULTA"|"ANULACION")
 * @returns SOAP response object with CDC and result codes
 */
async function sendSoapRequest(
  soapXml: string,
  operation: string,
): Promise<{
  rawResponse: string;
  parsed: SIFENSoapResponse;
}> {
  const endpoint = getEndpoint();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const rawResponse = await httpsPost(endpoint, soapXml, operation);
      const parsed = parseSifenSoapResponse(rawResponse);

      return { rawResponse, parsed };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error(`SOAP request failed after ${MAX_RETRIES} retries`);
}

/**
 * Performs an HTTPS POST with the SOAP XML payload.
 *
 * @param url - SOAP endpoint URL
 * @param soapXml - SOAP envelope XML
 * @param operation - Operation label for logging
 * @returns Raw response body string
 */
function httpsPost(
  url: string,
  soapXml: string,
  operation: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const urlObj = new URL(url);

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: "POST",
      timeout: SOAP_TIMEOUT_MS,
      headers: {
        "Content-Type": 'text/xml; charset="utf-8"',
        "SOAPAction": operation === "ENVIO"
          ? "sifEnviar"
          : operation === "CONSULTA"
          ? "sifConsultar"
          : "sifAnular",
        "Content-Length": Buffer.byteLength(soapXml, "utf-8"),
        "User-Agent": "AutomotiveOS-ERP/0.1",
        "Accept": "text/xml",
      },
      // TLS 1.2+ only
      secureOptions: crypto.constants
        ? crypto.constants.SSL_OP_NO_TLSv1 |
          crypto.constants.SSL_OP_NO_TLSv1_1
        : undefined,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${body.slice(0, 500)}`,
            ),
          );
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`HTTPS error: ${err.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`SOAP request timed out after ${SOAP_TIMEOUT_MS}ms`));
    });

    req.write(soapXml);
    req.end();
  });
}

// ─── Public API ────────────────────────────────

/**
 * Envía un DTE firmado a la DNIT para su validación y obtención del CDC.
 *
 * Operation: sif-01 — Envío de Documento Tributario Electrónico.
 *
 * @param signedXml - The DTE XML with embedded X.509 signature
 * @param dteId - Internal document tracking ID
 * @returns Parsed SIFEN response with CDC
 *
 * @example
 * ```ts
 * const result = await enviarDTE(signedXml, "doc-123");
 * if (result.cdc) {
 *   console.log(`CDC asignado: ${result.cdc}`);
 * }
 * ```
 */
export async function enviarDTE(
  signedXml: string,
  dteId: string,
): Promise<SIFENSoapResponse> {
  const soapXml = buildEnvioSOAP(signedXml, dteId);

  try {
    const { parsed } = await sendSoapRequest(soapXml, "ENVIO");

    return {
      ...parsed,
      rawXml: soapXml,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SOAP error";
    return {
      codigoResultado: "ERROR_CONEXION",
      cdc: null,
      numeroTransaccion: null,
      mensajeError: `Error de conexión con SIFEN: ${message}`,
    };
  }
}

/**
 * Consulta el estado de un DTE ante la DNIT mediante su CDC.
 *
 * Operation: sif-02 — Consulta de Documento Tributario Electrónico.
 *
 * @param cdc - The CDC to query
 * @returns SIFEN response with current status
 */
export async function consultarDTE(
  cdc: string,
): Promise<SIFENSoapResponse> {
  const soapXml = buildConsultaSOAP(cdc);

  try {
    const { parsed } = await sendSoapRequest(soapXml, "CONSULTA");
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "SOAP error";
    return {
      codigoResultado: "ERROR_CONEXION",
      cdc: null,
      numeroTransaccion: null,
      mensajeError: `Error de consulta SIFEN: ${message}`,
    };
  }
}

/**
 * Anula un DTE ante la DNIT.
 *
 * Operation: sif-03 — Anulación de Documento Tributario Electrónico.
 *
 * @param cdc - CDC of the document to cancel
 * @param motivo - Cancellation reason
 * @returns SIFEN response
 */
export async function anularDTE(
  cdc: string,
  motivo: string,
): Promise<SIFENSoapResponse> {
  const soapXml = buildAnulacionSOAP(cdc, motivo);

  try {
    const { parsed } = await sendSoapRequest(soapXml, "ANULACION");
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "SOAP error";
    return {
      codigoResultado: "ERROR_CONEXION",
      cdc: null,
      numeroTransaccion: null,
      mensajeError: `Error de anulación SIFEN: ${message}`,
    };
  }
}

/**
 * Tests the connection to the SIFEN web service.
 *
 * Sends a lightweight ping to verify reachability.
 *
 * @returns Connection status
 */
export async function testSifenConnection(): Promise<{
  reachable: boolean;
  endpoint: string;
  latencyMs: number;
}> {
  const endpoint = getEndpoint();
  const startTime = Date.now();

  try {
    // Send a minimal SOAP request to check connectivity
    const minimalPing = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">`,
      `  <soap:Body>`,
      `    <sifConsultar xmlns="${NS_SIFEN_WS}">`,
      `      <xCDC>00000000000000000000000000000000000000000000</xCDC>`,
      `    </sifConsultar>`,
      `  </soap:Body>`,
      `</soap:Envelope>`,
    ].join("\n");

    await httpsPost(endpoint, minimalPing, "CONSULTA");

    return {
      reachable: true,
      endpoint,
      latencyMs: Date.now() - startTime,
    };
  } catch {
    return {
      reachable: false,
      endpoint,
      latencyMs: Date.now() - startTime,
    };
  }
}

// Crypto for TLS options
import crypto from "node:crypto";
