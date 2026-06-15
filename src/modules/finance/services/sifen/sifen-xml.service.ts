/**
 * SIFEN XML Builder — DNIT V150 structured XML generation.
 *
 * Constructs the full DTE (Documento Tributario Electrónico) XML
 * payload conforming to the DNIT SIFEN V150 specification.
 *
 * The XML is built using safe string concatenation with proper XML
 * escaping — no heavy DOM parser is loaded. This keeps RAM impact
 * negligible (< 10KB per invoice).
 *
 * @module finance/services/sifen/sifen-xml.service
 */

import { XMLParser } from "fast-xml-parser";
import type {
  EmitirDTERequest,
} from "../../types.js";
import type { DTETipo } from "../../schema/fiscal-docs.js";

// ─── Constants ─────────────────────────────────

/** SIFEN XML namespace URI */
const NS_SIFEN = "http://www.dnit.gov.py/sifen/150";

/** SIFEN XML schema version */
const SIFEN_VERSION = "150";

/**
 * Mapeo de códigos de IVA según catálogo SIFEN.
 * Paraguay: 0 = exento, 5 = reducido, 10 = general
 */
const IVA_CODIGO: Record<number, string> = {
  0: "1",   // Exento
  5: "2",   // 5% — reducido
  10: "3",  // 10% — general
};

/**
 * DTE type mapping to SIFEN catalogo.
 */
const DTE_TIPO_CODIGO: Record<DTETipo, string> = {
  FACTURA: "1",
  NOTA_CREDITO: "2",
  NOTA_DEBITO: "3",
  AUTOFACTURA: "4",
  COMPROBANTE_RETENCION: "5",
};

// ─── XML Builder instances ─────────────────────

/**
 * Safe XML string builder for simple fragments.
 * Escapes XML special characters.
 */
function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Creates a simple XML tag safely.
 */
function xmlTag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `  <${name}>${xmlEscape(String(value))}</${name}>\n`;
}

/**
 * Formats a number to 2 decimal places for SIFEN numeric fields.
 */
function fmtNum(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toFixed(2);
}

// ─── Main XML builder ──────────────────────────

/**
 * Generates the full DTE XML for SIFEN V150.
 *
 * Builds the complete document structure including:
 *   - Cabecera (DE) — DTE header with emisor, receptor, totals
 *   - Detalle (items) — line items with prices, IVA
 *
 * @param data - The DTE emission payload
 * @returns The formatted XML string
 *
 * @example
 * ```ts
 * const xml = buildDTEXml(request);
 * // Result: DNIT-compliant XML ready for digital signature
 * ```
 */
export function buildDTEXml(data: EmitirDTERequest): string {
  const {
    dteTipo,
    serie,
    numero,
    fechaEmision,
    condicionVenta,
    moneda,
    tipoCambio,
    items,
    regimenIVA,
    descuentoGlobal,
    emisorRuc,
    emisorRazonSocial,
    receptorRuc,
    receptorRazonSocial,
    receptorDireccion,
  } = data as EmitirDTERequest & {
    emisorRuc: string;
    emisorRazonSocial: string;
    receptorRuc: string;
    receptorRazonSocial: string;
    receptorDireccion?: string;
  };

  const fecha = fechaEmision
    ? new Date(fechaEmision).toISOString().slice(0, 19)
    : new Date().toISOString().slice(0, 19);

  // ── Build XML manually for full control ──
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<rEnvioDTE xmlns="${NS_SIFEN}" version="${SIFEN_VERSION}">\n`;
  xml += "  <DE>\n";

  // ── dCabecera (Header) ──
  xml += "    <dCabecera>\n";
  xml += xmlTag("dVerFor", SIFEN_VERSION);
  xml += xmlTag("dTipoDTE", DTE_TIPO_CODIGO[dteTipo] ?? "1");
  xml += xmlTag("dSerie", serie);
  xml += xmlTag("dNumDoc", numero);
  xml += xmlTag("dFecEm", fecha);
  xml += xmlTag("dFeVen", fecha); // Default: same as emission
  xml += xmlTag("dTipoImp", "1"); // IVA (default tax type)
  xml += xmlTag("dRucEm", emisorRuc);
  xml += xmlTag("dRazSocEm", emisorRazonSocial);
  xml += xmlTag("dRucRe", receptorRuc);
  xml += xmlTag("dRazSocRe", receptorRazonSocial);
  if (receptorDireccion) {
    xml += xmlTag("dDirRe", receptorDireccion);
  }
  xml += xmlTag("dConVen", condicionVenta);
  xml += "    </dCabecera>\n";

  // ── dDetalle (Line Items) ──
  xml += "    <dDetalle>\n";

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    xml += "      <dItem>\n";
    xml += xmlTag("dNumItem", i + 1);
    xml += xmlTag("dCantidad", fmtNum(item.cantidad));
    xml += xmlTag("dUnidadMedida", item.unidadMedida);
    xml += xmlTag("dDescItem", item.descripcion);
    xml += xmlTag("dPrecioUnitario", fmtNum(item.precioUnitario));
    xml += xmlTag("dPrecioUnitario", fmtNum(item.precioUnitario));
    xml += xmlTag("dSubtotal", fmtNum(item.subtotal));
    xml += xmlTag("dTipoIVA", IVA_CODIGO[item.iva] ?? "3");
    xml += xmlTag("dMontoIVA", fmtNum(item.ivaMonto ?? "0"));
    xml += "      </dItem>\n";
  }

  xml += "    </dDetalle>\n";

  // ── Totales ──
  const totalExento = items
    .filter((i) => i.iva === 0)
    .reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const totalIva5 = items
    .filter((i) => i.iva === 5)
    .reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const totalIva10 = items
    .filter((i) => i.iva === 10)
    .reduce((sum, i) => sum + parseFloat(i.subtotal), 0);
  const totalIva5Amount = items
    .filter((i) => i.iva === 5)
    .reduce((sum, i) => sum + parseFloat(i.ivaMonto ?? "0"), 0);
  const totalIva10Amount = items
    .filter((i) => i.iva === 10)
    .reduce((sum, i) => sum + parseFloat(i.ivaMonto ?? "0"), 0);
  const totalLiquido = totalExento + totalIva5 + totalIva10;
  const totalIva = totalIva5Amount + totalIva10Amount;
  const totalDocumento = totalLiquido + totalIva;

  xml += "    <dTotales>\n";
  xml += xmlTag("dTotalExento", fmtNum(totalExento));
  xml += xmlTag("dTotalIva5", fmtNum(totalIva5));
  xml += xmlTag("dTotalIva10", fmtNum(totalIva10));
  xml += xmlTag("dTotalLiquido", fmtNum(totalLiquido));
  xml += xmlTag("dTotalIVA", fmtNum(totalIva));
  if (descuentoGlobal) {
    xml += xmlTag("dDescuentoGlobal", fmtNum(descuentoGlobal));
  }
  xml += xmlTag("dTotalDocumento", fmtNum(totalDocumento));
  xml += "    </dTotales>\n";

  // ── dCamProp (Complementary fields) ──
  xml += "    <dCamProp>\n";
  xml += xmlTag("dRegimenIVA", regimenIVA === "GENERAL" ? "1" :
    regimenIVA === "PEQUENIO" ? "2" :
    regimenIVA === "SIMPLIFICADO" ? "3" : "4");
  xml += xmlTag("dMoneda", moneda);
  if (tipoCambio && moneda !== "PYG") {
    xml += xmlTag("dTipoCambio", fmtNum(tipoCambio));
  }
  xml += "    </dCamProp>\n";

  xml += "  </DE>\n";
  xml += "</rEnvioDTE>";

  return xml;
}

/**
 * Parses a SIFEN SOAP response XML to extract CDC and result codes.
 *
 * @param soapXml - Raw SOAP response from DNIT
 * @returns Parsed result object
 */
export function parseSifenSoapResponse(
  soapXml: string,
): {
  codigoResultado: string;
  cdc: string | null;
  numeroTransaccion: string | null;
  mensajeError: string | null;
} {
  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(soapXml);

    // Navigate through SOAP envelope
    const envelope =
      parsed["soap:Envelope"] ??
      parsed["s:Envelope"] ??
      parsed["Envelope"] ??
      {};
    const body =
      envelope["soap:Body"] ??
      envelope["s:Body"] ??
      envelope["Body"] ??
      {};
    const response =
      body["sifEnviarResponse"] ??
      body["ns2:sifEnviarResponse"] ??
      body["sif-01Response"] ??
      body["EnviarResponse"] ??
      {};

    // Extract fields
    const codigoResultado =
      response["xCodigoResultado"] ??
      response["dCodRes"] ??
      response["codigoResultado"] ??
      "";
    const cdc =
      response["xCDC"] ??
      response["dCDC"] ??
      response["cdc"] ??
      response["CDC"] ??
      null;
    const numeroTransaccion =
      response["xNumTran"] ??
      response["dNumTran"] ??
      response["numeroTransaccion"] ??
      null;
    const mensajeError =
      response["xMensajeError"] ??
      response["dMsgErr"] ??
      response["mensajeError"] ??
      null;

    return {
      codigoResultado: String(codigoResultado ?? ""),
      cdc: cdc ? String(cdc) : null,
      numeroTransaccion: numeroTransaccion ? String(numeroTransaccion) : null,
      mensajeError: mensajeError ? String(mensajeError) : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "XML parse error";
    return {
      codigoResultado: "ERROR_PARSE",
      cdc: null,
      numeroTransaccion: null,
      mensajeError: `Error parsing SOAP response: ${message}`,
    };
  }
}

/**
 * Valida que un XML de DTE cumpla con la estructura básica de SIFEN V150.
 *
 * @param xml - The DTE XML to validate
 * @returns Validation result with any errors
 */
export function validateDTEXml(xml: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!xml || xml.length === 0) {
    errors.push("XML vacío");
    return { isValid: false, errors };
  }

  // Structural validations
  if (!xml.includes('<?xml version="1.0"')) {
    errors.push("Falta declaración XML");
  }

  if (!xml.includes("<rEnvioDTE")) {
    errors.push("Falta elemento raíz rEnvioDTE");
  }

  if (!xml.includes("<DE>")) {
    errors.push("Falta elemento DE (Documento Electrónico)");
  }

  if (!xml.includes("<dCabecera>")) {
    errors.push("Falta dCabecera");
  }

  if (!xml.includes("<dDetalle>")) {
    errors.push("Falta dDetalle (items)");
  }

  if (!xml.includes("<dTotales>")) {
    errors.push("Falta dTotales");
  }

  try {
    const parser = new XMLParser({ ignoreAttributes: false });
    parser.parse(xml);
  } catch (err) {
    const message = err instanceof Error ? err.message : "XML parse error";
    errors.push(`XML malformado: ${message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
