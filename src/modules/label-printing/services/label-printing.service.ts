/**
 * Label Printing Service — ESC/POS, ZPL, and Raw Text generation.
 *
 * Generates printer-ready payloads for thermal/label printers.
 * Supports Code128 barcodes, QR codes, and formatted text.
 *
 * ESC/POS reference: https://reference.epson-biz.com/modules/refescpos/
 * ZPL reference: https://support.zebra.com/cpws/docs/zpl/zpl-zbi2.pdf
 *
 * @module label-printing/services
 */

// ─── Types ────────────────────────────────────

export interface LabelField {
  type: "barcode" | "qrcode" | "text" | "rect" | "line";
  dataField?: string;
  format?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number | string;
  align?: "LEFT" | "CENTER" | "RIGHT";
  bold?: boolean;
  maxChars?: number;
}

export interface LabelLayout {
  fields: LabelField[];
  cutPaper?: boolean;
}

export interface LabelData {
  [key: string]: string | number | undefined;
}

export interface PrintPayload {
  raw: string;
  buffer?: Buffer;
  protocol: string;
  estimatedWidthMm: number;
  estimatedHeightMm: number;
}

// ─── ESC/POS Commands ─────────────────────────

const ESC = "\x1b";
const GS = "\x1d";

/** Initialize printer */
const ESCPOS_INIT = ESC + "@";

/** Cut paper (partial cut) */
const ESCPOS_CUT = GS + "V" + "\x01";

/** Set font to small (Font B) */
const ESCPOS_FONT_SMALL = ESC + "M" + "\x01";

/** Set font to normal (Font A) */
const ESCPOS_FONT_NORMAL = ESC + "M" + "\x00";

/** Bold ON */
const ESCPOS_BOLD_ON = ESC + "E" + "\x01";

/** Bold OFF */
const ESCPOS_BOLD_OFF = ESC + "E" + "\x00";

/** Center alignment */
const ESCPOS_ALIGN_CENTER = ESC + "a" + "\x01";

/** Left alignment */
const ESCPOS_ALIGN_LEFT = ESC + "a" + "\x00";

/** Right alignment */
const ESCPOS_ALIGN_RIGHT = ESC + "a" + "\x02";

/**
 * Generate ESC/POS barcode command (Code128).
 * @param data - Barcode data string
 * @param height - Barcode height in dots (1-255)
 */
function escposBarcode128(data: string, height: number = 50): string {
  const bytes = [
    ESCPOS_ALIGN_CENTER,
    GS, "h", Buffer.from([height]),  // Barcode height
    GS, "H", "\x02",                 // HRI text position (below barcode)
    GS, "k", "\x49",                 // Code128 barcode type
    Buffer.from([data.length]),       // Data length
    data,                            // Barcode data
  ];
  return bytes.map(b => typeof b === "string" ? b : b.toString("binary")).join("");
}

/**
 * Generate ESC/POS QR code command.
 * @param data - QR code data string
 * @param moduleSize - Module size in dots (1-16, default 4)
 */
function escposQRCode(data: string, _moduleSize: number = 4): string {
  const dataLen = data.length;
  // QR Code: Store data
  const storeData = [
    GS, "(", "k",
    Buffer.from([(dataLen + 3) & 0xff, ((dataLen + 3) >> 8) & 0xff]), // Length
    "\x31", "\x50", "\x30",  // Function 80 (store), encoding 80
    data,
  ];
  // QR Code: Print
  const printQR = [
    GS, "(", "k",
    Buffer.from([0x04, 0x00]), // Length = 4
    "\x31", "\x51", "\x30",    // Function 81 (print)
  ];
  return [...storeData, ...printQR]
    .map(b => typeof b === "string" ? b : b.toString("binary"))
    .join("");
}

/**
 * Generate ESC/POS text line.
 * @param text - Text to print
 * @param options - Formatting options
 */
function escposText(
  text: string,
  options: { bold?: boolean; align?: "LEFT" | "CENTER" | "RIGHT"; small?: boolean; maxChars?: number } = {},
): string {
  let cmd = "";
  if (options.bold) cmd += ESCPOS_BOLD_ON;
  if (options.small) cmd += ESCPOS_FONT_SMALL;
  if (options.align === "CENTER") cmd += ESCPOS_ALIGN_CENTER;
  else if (options.align === "RIGHT") cmd += ESCPOS_ALIGN_RIGHT;
  else cmd += ESCPOS_ALIGN_LEFT;

  let t = text;
  if (options.maxChars && t.length > options.maxChars) {
    t = t.substring(0, options.maxChars - 1) + "…";
  }
  cmd += t + "\n";

  if (options.bold) cmd += ESCPOS_BOLD_OFF;
  if (options.small) cmd += ESCPOS_FONT_NORMAL;
  return cmd;
}

// ─── ZPL Commands ─────────────────────────────

/**
 * Generate ZPL barcode command (Code128).
 * @param data - Barcode data
 * @param x - X position in dots
 * @param y - Y position in dots
 * @param height - Barcode height in dots
 * @param printText - Print human-readable text below barcode
 */
function zplBarcode128(
  data: string,
  x: number = 10,
  y: number = 10,
  height: number = 100,
  printText: boolean = true,
): string {
  return `^FO${x},${y}^BY3^BCN,${height},${printText ? "Y" : "N"},N,N^FD${data}^FS`;
}

/**
 * Generate ZPL QR code command.
 * @param data - QR code data
 * @param x - X position in dots
 * @param y - Y position in dots
 * @param moduleSize - Module size (1-10)
 */
function zplQRCode(data: string, x: number = 10, y: number = 10, moduleSize: number = 3): string {
  return `^FO${x},${y}^BQN,2,${moduleSize}^FDMA,${data}^FS`;
}

/**
 * Generate ZPL text field.
 * @param data - Text to print
 * @param x - X position in dots
 * @param y - Y position in dots
 * @param fontSize - Font size (points)
 * @param bold - Bold text
 */
function zplText(data: string, x: number = 10, y: number = 10, fontSize: number = 18, bold: boolean = false): string {
  const fontRef = bold ? "^A0N" : "^A0N";
  return `^FO${x},${y}${fontRef},${fontSize},${fontSize}^FD${data}^FS`;
}

// ─── TSPL Commands ────────────────────────────

function tsplBarcode128(data: string, x: number = 10, y: number = 10, height: number = 80): string {
  return `BARCODE ${x},${y},"CODE128",${height},1,0,3,1,"${data}"`;
}

function tsplQRCode(data: string, x: number = 10, y: number = 10, size: number = 4): string {
  return `QRCODE ${x},${y},M,${size},A,0,"${data}"`;
}

function tsplText(data: string, x: number = 10, y: number = 10, fontSize: number = 3): string {
  return `TEXT ${x},${y},"FONT${fontSize}",0,1,1,"${data}"`;
}

// ─── Template Generators ──────────────────────

/**
 * Generate ESC/POS payload for a repuesto (spare part) label.
 * Size: 50x30mm at 203 DPI ≈ 394x236 dots
 *
 * Layout:
 * ┌──────────────────────────┐
 *  ║  |||||||||||||||||||||  ║  Code128 barcode
 *  ║  FIL-001                ║  Part code
 *  ║  Filtro Aceite Toyota   ║  Description
 *  ║  Marca: Mann Filter     ║  Brand
 *  ║  Gs. 85.000             ║  Price
 * └──────────────────────────┘
 */
export function generateRepuestoESCPOS(data: LabelData): string {
  let cmd = ESCPOS_INIT;
  cmd += escposText(String(data.codigo || ""), { align: "CENTER", bold: true, maxChars: 20 });
  cmd += escposBarcode128(String(data.codigoBarras || data.codigo || ""), 50);
  cmd += "\n";
  cmd += escposText(String(data.descripcion || ""), { align: "CENTER", small: true, maxChars: 25 });
  cmd += escposText(`${data.marca || ""} ${data.modelo || ""}`.trim(), { align: "CENTER", small: true, maxChars: 25 });
  if (data.precio) {
    cmd += escposText(`Gs. ${Number(data.precio).toLocaleString("es-PY")}`, { align: "CENTER", bold: true, small: true });
  }
  cmd += "\n\n";
  cmd += ESCPOS_CUT;
  return cmd;
}

/**
 * Generate ZPL payload for a repuesto label.
 * 50x30mm at 203 DPI ≈ 394x236 dots
 */
export function generateRepuestoZPL(data: LabelData): string {
  let zpl = "^XA";  // Start
  zpl += "^LL236";  // Label length = 236 dots (30mm)
  zpl += "^PW394";  // Print width = 394 dots (50mm)
  zpl += zplText(String(data.codigo || ""), 10, 5, 20, true);
  zpl += zplBarcode128(String(data.codigoBarras || data.codigo || ""), 10, 30, 80);
  zpl += zplText(String(data.descripcion || "").substring(0, 25), 10, 120, 16);
  zpl += zplText(`${data.marca || ""}`.substring(0, 20), 10, 140, 14);
  if (data.precio) {
    zpl += zplText(`Gs. ${Number(data.precio).toLocaleString("es-PY")}`, 10, 160, 18, true);
  }
  zpl += "^XZ";  // End
  return zpl;
}

/**
 * Generate ESC/POS payload for a herramienta (heavy tool) label.
 * Size: 60x40mm at 203 DPI ≈ 472x315 dots
 *
 * Layout:
 * ┌────────────────────────────────┐
 *  ║  ┌──────────┐                ║
 *  ║  │ ▄▄▄▄▄▄▄▄ │  QR Code      ║
 *  ║  │ █ QR  █ │                ║
 *  ║  │ ▀▀▀▀▀▀▀▀ │                ║
 *  ║  └──────────┘                ║
 *  ║  Pistola Neumática 1/2"     ║  Tool name
 *  ║  Estado: CALIBRADO ✓        ║  Calibration status
 *  ║  ⚠ PROPIEDAD DEL TALLER     ║  Ownership warning
 * └────────────────────────────────┘
 */
export function generateHerramientaESCPOS(data: LabelData): string {
  let cmd = ESCPOS_INIT;
  cmd += escposText(String(data.codigo || ""), { align: "CENTER", bold: true, maxChars: 25 });
  cmd += escposQRCode(JSON.stringify({
    id: data.id,
    codigo: data.codigo,
    nombre: data.nombre,
    estado: data.estado,
  }), 4);
  cmd += "\n";
  cmd += escposText(String(data.nombre || ""), { align: "CENTER", bold: true, maxChars: 30 });
  const estado = String(data.estado || "DESCONOCIDO");
  const estadoIcon = estado === "CALIBRADO" ? "✓" : estado === "EN_USO" ? "●" : "?";
  cmd += escposText(`Estado: ${estado} ${estadoIcon}`, { align: "CENTER", small: true });
  cmd += ESCPOS_BOLD_ON + ESCPOS_ALIGN_CENTER + "⚠ PROPIEDAD DEL TALLER\n" + ESCPOS_BOLD_OFF;
  cmd += ESCPOS_ALIGN_LEFT + "\n\n";
  cmd += ESCPOS_CUT;
  return cmd;
}

/**
 * Generate ZPL payload for a herramienta label.
 * 60x40mm at 203 DPI ≈ 472x315 dots
 */
export function generateHerramientaZPL(data: LabelData): string {
  let zpl = "^XA";
  zpl += "^LL315";  // Label length = 315 dots (40mm)
  zpl += "^PW472";  // Print width = 472 dots (60mm)
  zpl += zplText(String(data.codigo || ""), 10, 5, 20, true);
  zpl += zplQRCode(JSON.stringify({ id: data.id, codigo: data.codigo }), 130, 10, 4);
  zpl += zplText(String(data.nombre || "").substring(0, 30), 10, 110, 20, true);
  const estado = String(data.estado || "DESCONOCIDO");
  zpl += zplText(`Estado: ${estado}`, 10, 135, 16);
  zpl += zplText("⚠ PROPIEDAD DEL TALLER", 10, 160, 18, true);
  zpl += "^XZ";
  return zpl;
}

/**
 * Generate TSPL payload for a repuesto label.
 */
export function generateRepuestoTSPL(data: LabelData): string {
  let cmd = "SIZE 50 mm,30 mm\n";
  cmd += "CLS\n";
  cmd += tsplBarcode128(String(data.codigoBarras || data.codigo || ""), 10, 10, 60);
  cmd += "\n";
  cmd += tsplText(String(data.codigo || ""), 10, 80, 2);
  cmd += tsplText(String(data.descripcion || "").substring(0, 20), 10, 100, 1);
  if (data.precio) {
    cmd += tsplText(`Gs. ${data.precio}`, 10, 120, 2);
  }
  cmd += "PRINT 1\n";
  return cmd;
}

/**
 * Generate TSPL payload for a herramienta label.
 */
export function generateHerramientaTSPL(data: LabelData): string {
  let cmd = "SIZE 60 mm,40 mm\n";
  cmd += "CLS\n";
  cmd += tsplQRCode(JSON.stringify({ id: data.id, codigo: data.codigo }), 10, 10, 5);
  cmd += tsplText(String(data.codigo || ""), 120, 10, 2);
  cmd += tsplText(String(data.nombre || "").substring(0, 20), 120, 35, 1);
  const estado = String(data.estado || "DESCONOCIDO");
  cmd += tsplText(`Estado: ${estado}`, 120, 55, 1);
  cmd += tsplText("PROPIEDAD DEL TALLER", 120, 75, 2);
  cmd += "PRINT 1\n";
  return cmd;
}

// ─── FACTURA (Invoice Receipt) — ESC/POS 80mm ──

/**
 * Generate ESC/POS receipt for a factura (invoice) on 80mm thermal paper.
 *
 * Layout (80mm ≈ 640 dots at 203 DPI):
 * ┌────────────────────────────────────────────┐
 * │         AUTOMOTIVEOS — TALLER              │  Company header
 * │    RUC: 800XXXX-X  Coronel Oviedo          │
 * │────────────────────────────────────────────│
 * │  FACTURA N°: 001-001-0001234               │  Invoice number
 * │  Fecha: 25/07/2026  Tipo: MANUAL           │
 * │────────────────────────────────────────────│
 * │  Cliente: Juan Pérez                       │  Client info
 * │  RUC: 1234567-8                            │
 * │────────────────────────────────────────────│
 * │  2x Cambio de aceite      Gs. 900.000      │  Line items
 * │  1x Filtro de aceite      Gs. 150.000      │
 * │────────────────────────────────────────────│
 * │  Subtotal:                Gs. 1.050.000    │
 * │  IVA 10%:                   Gs. 95.455     │
 * │  ─────────────────────────────────         │
 * │  TOTAL:                   Gs. 1.050.000    │
 * │────────────────────────────────────────────│
 * │  ||||||||||||||||||||||||||||||||||||||     │  Barcode/QR
 * │  CDC: 00000000000000...                    │
 * │  Gracias por su preferencia                │
 * └────────────────────────────────────────────┘
 */
export function generateFacturaESCPOS(data: LabelData): string {
  let cmd = ESCPOS_INIT;

  // ── Company header ──
  cmd += ESCPOS_ALIGN_CENTER + ESCPOS_BOLD_ON;
  cmd += escposText(String(data.empresaNombre || "AUTOMOTIVEOS"), { align: "CENTER", bold: true, maxChars: 32 });
  cmd += ESCPOS_BOLD_OFF;
  cmd += escposText(String(data.empresaRuc || ""), { align: "CENTER", small: true, maxChars: 32 });
  cmd += escposText(String(data.empresaDireccion || ""), { align: "CENTER", small: true, maxChars: 32 });
  cmd += escposText(String(data.empresaTelefono || ""), { align: "CENTER", small: true, maxChars: 32 });

  // ── Separator ──
  cmd += ESCPOS_ALIGN_LEFT;
  cmd += "─".repeat(48) + "\n";

  // ── Invoice header ──
  cmd += ESCPOS_ALIGN_CENTER + ESCPOS_BOLD_ON;
  cmd += escposText("FACTURA", { align: "CENTER", bold: true, maxChars: 32 });
  cmd += ESCPOS_BOLD_OFF;
  cmd += escposText(`N°: ${data.numeroFactura || ""}`, { align: "CENTER", bold: true, maxChars: 32 });

  cmd += ESCPOS_ALIGN_LEFT;
  const tipoLabel = data.tipoFactura === "ELECTRONICA" ? "Electrónica" : "Manual";
  cmd += escposText(`Fecha: ${data.fechaEmision || ""}  Tipo: ${tipoLabel}`, { small: true, maxChars: 48 });
  if (data.numeroFactura && data.tipoFactura !== "ELECTRONICA") {
    cmd += escposText(`Timbrado: ${data.timbrado || "N/A"}`, { small: true, maxChars: 48 });
  }

  // ── Separator ──
  cmd += "─".repeat(48) + "\n";

  // ── Client info ──
  cmd += escposText(`Cliente: ${data.clienteNombre || ""}`, { maxChars: 48 });
  if (data.clienteRuc) {
    cmd += escposText(`RUC: ${data.clienteRuc}`, { small: true, maxChars: 48 });
  }
  if (data.clienteDireccion) {
    cmd += escposText(`Dir: ${data.clienteDireccion}`, { small: true, maxChars: 48 });
  }

  // ── Separator ──
  cmd += "─".repeat(48) + "\n";

  // ── Line items ──
  const items = String(data.lineItems || "");
  if (items) {
    try {
      const parsed = JSON.parse(items) as Array<{ desc: string; cant: number; precio: number; total: number }>;
      for (const item of parsed) {
        const cantStr = String(item.cant || 1).padStart(2, " ");
        const precioStr = `Gs. ${Number(item.precio || 0).toLocaleString("es-PY")}`.padStart(16, " ");
        cmd += escposText(`${cantStr}x ${item.desc}`, { maxChars: 30 });
        cmd += escposText(precioStr, { align: "RIGHT", maxChars: 48 });
      }
    } catch {
      cmd += escposText(items, { maxChars: 48 });
    }
  }

  // ── Separator ──
  cmd += "─".repeat(48) + "\n";

  // ── Totals ──
  const subtotal = data.subtotal || data.total || "";
  const iva = data.ivaMonto || "";
  const total = data.total || "";

  if (subtotal) {
    cmd += escposText(`Subtotal:     ${String(subtotal).padStart(16, " ")}`, { maxChars: 48 });
  }
  if (iva) {
    cmd += escposText(`IVA 10%:      ${String(iva).padStart(16, " ")}`, { maxChars: 48 });
  }
  cmd += ESCPOS_BOLD_ON;
  cmd += escposText(`TOTAL:        ${String(total).padStart(16, " ")}`, { bold: true, maxChars: 48 });
  cmd += ESCPOS_BOLD_OFF;

  // ── Separator ──
  cmd += "═".repeat(48) + "\n";

  // ── CDC (electronic) or Barcode ──
  if (data.cdc) {
    cmd += ESCPOS_ALIGN_CENTER;
    cmd += escposText("CDC:", { align: "CENTER", small: true });
    cmd += escposText(String(data.cdc), { align: "CENTER", small: true, maxChars: 48 });
    cmd += "\n";
    cmd += escposQRCode(`https://sifen.gov.py/consulte?r=${data.cdc}`, 5);
  } else if (data.numeroFactura) {
    cmd += ESCPOS_ALIGN_CENTER;
    cmd += escposBarcode128(String(data.numeroFactura), 50);
  }

  // ── Footer ──
  cmd += "\n";
  cmd += escposText("Gracias por su preferencia", { align: "CENTER", small: true, maxChars: 48 });
  cmd += escposText("www.automotiveos.com.py", { align: "CENTER", small: true, maxChars: 48 });

  // ── Cut paper ──
  cmd += "\n\n\n";
  cmd += ESCPOS_CUT;

  return cmd;
}

/**
 * Generate plain text receipt for factura (fallback).
 */
function generateFacturaPlainText(data: LabelData): string {
  const w = 48;
  const sep = "─".repeat(w);
  const doubleSep = "═".repeat(w);
  let txt = "";

  const empNombre = String(data.empresaNombre || "AUTOMOTIVEOS");
  const empRuc = String(data.empresaRuc || "");
  const empDir = String(data.empresaDireccion || "");
  txt += `${" ".repeat(Math.floor((w - empNombre.length) / 2))}${empNombre}\n`;
  if (empRuc) txt += `${" ".repeat(Math.floor((w - empRuc.length) / 2))}${empRuc}\n`;
  txt += `${" ".repeat(Math.floor((w - empDir.length) / 2))}${empDir}\n`;
  txt += sep + "\n";
  txt += `${" ".repeat(Math.floor((w - 7) / 2))}FACTURA\n`;
  const numFactura = String(data.numeroFactura || "");
  txt += `${" ".repeat(Math.floor((w - numFactura.length - 3) / 2))}N°: ${numFactura}\n`;
  const tipoLabel = data.tipoFactura === "ELECTRONICA" ? "Electrónica" : "Manual";
  txt += `Fecha: ${data.fechaEmision || ""}  Tipo: ${tipoLabel}\n`;
  txt += sep + "\n";
  txt += `Cliente: ${data.clienteNombre || ""}\n`;
  if (data.clienteRuc) txt += `RUC: ${data.clienteRuc}\n`;
  txt += sep + "\n";

  const items = String(data.lineItems || "");
  if (items) {
    try {
      const parsed = JSON.parse(items) as Array<{ desc: string; cant: number; precio: number; total: number }>;
      for (const item of parsed) {
        txt += `  ${item.cant || 1}x ${item.desc}\n`;
        txt += `          Gs. ${Number(item.precio || 0).toLocaleString("es-PY")}\n`;
      }
    } catch {
      txt += items + "\n";
    }
  }

  txt += sep + "\n";
  if (data.subtotal) txt += `Subtotal:     ${String(data.subtotal).padStart(16)}\n`;
  if (data.ivaMonto) txt += `IVA 10%:      ${String(data.ivaMonto).padStart(16)}\n`;
  txt += doubleSep + "\n";
  txt += `TOTAL:        ${String(data.total || "").padStart(16)}\n`;
  txt += doubleSep + "\n";
  if (data.cdc) txt += `CDC: ${data.cdc}\n`;
  txt += "\nGracias por su preferencia\n";
  return txt;
}

// ─── Main Service ─────────────────────────────

/**
 * Generate a print payload for a label or receipt.
 *
 * @param tipo - Label type ("REPUESTO", "HERRAMIENTA", or "FACTURA")
 * @param protocolo - Printer protocol ("ESCPOS", "ZPL", or "TSPL")
 * @param data - Label data (fields to render)
 * @param layout - Optional custom layout configuration
 * @returns Print payload with raw commands
 */
export function generateLabelPayload(
  tipo: string,
  protocolo: string,
  data: LabelData,
  _layout?: LabelLayout,
): PrintPayload {
  let raw = "";
  let widthMm = 50;
  let heightMm = 30;

  if (tipo === "HERRAMIENTA") {
    widthMm = 60;
    heightMm = 40;
  } else if (tipo === "FACTURA") {
    widthMm = 80;
    heightMm = 200; // dynamic, receipt-length
  }

  switch (protocolo) {
    case "ESCPOS":
      if (tipo === "FACTURA") {
        raw = generateFacturaESCPOS(data);
      } else if (tipo === "HERRAMIENTA") {
        raw = generateHerramientaESCPOS(data);
      } else {
        raw = generateRepuestoESCPOS(data);
      }
      break;
    case "ZPL":
      if (tipo === "HERRAMIENTA") {
        raw = generateHerramientaZPL(data);
      } else {
        raw = generateRepuestoZPL(data);
      }
      break;
    case "TSPL":
      if (tipo === "HERRAMIENTA") {
        raw = generateHerramientaTSPL(data);
      } else {
        raw = generateRepuestoTSPL(data);
      }
      break;
    default:
      if (tipo === "FACTURA") {
        raw = generateFacturaPlainText(data);
      } else {
        raw = generatePlainText(tipo, data);
      }
      break;
  }

  return {
    raw,
    protocol: protocolo,
    estimatedWidthMm: widthMm,
    estimatedHeightMm: heightMm,
  };
}

/**
 * Generate plain text fallback for unsupported printers.
 */
function generatePlainText(tipo: string, data: LabelData): string {
  const sep = tipo === "HERRAMIENTA"
    ? "═".repeat(35)
    : "─".repeat(30);
  let txt = sep + "\n";
  txt += `${tipo === "HERRAMIENTA" ? "🔧 HERRAMIENTA" : "📦 REPUESTO"}\n`;
  txt += sep + "\n";
  txt += `Código: ${data.codigo || "N/A"}\n`;
  txt += `Nombre: ${data.descripcion || data.nombre || "N/A"}\n`;
  if (data.marca) txt += `Marca: ${data.marca}\n`;
  if (data.precio) txt += `Precio: Gs. ${Number(data.precio).toLocaleString("es-PY")}\n`;
  if (data.estado) txt += `Estado: ${data.estado}\n`;
  if (tipo === "HERRAMIENTA") txt += "⚠ PROPIEDAD DEL TALLER\n";
  txt += sep + "\n";
  return txt;
}

/**
 * Validate label data — ensures required fields are present.
 */
export function validateLabelData(tipo: string, data: LabelData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (tipo === "FACTURA") {
    if (!data.numeroFactura) errors.push("Número de factura es requerido");
    if (!data.total) errors.push("Total es requerido");
    if (!data.clienteNombre) errors.push("Nombre del cliente es requerido");
  } else {
    if (!data.codigo) errors.push("Código es requerido");
  }

  if (tipo === "REPUESTO") {
    if (!data.descripcion) errors.push("Descripción es requerida para repuestos");
  } else if (tipo === "HERRAMIENTA") {
    if (!data.nombre) errors.push("Nombre es requerido para herramientas");
  }

  return { valid: errors.length === 0, errors };
}
