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
function escposQRCode(data: string, moduleSize: number = 4): string {
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

// ─── Main Service ─────────────────────────────

/**
 * Generate a print payload for a label.
 *
 * @param tipo - Label type ("REPUESTO" or "HERRAMIENTA")
 * @param protocolo - Printer protocol ("ESCPOS", "ZPL", or "TSPL")
 * @param data - Label data (fields to render)
 * @param layout - Optional custom layout configuration
 * @returns Print payload with raw commands
 */
export function generateLabelPayload(
  tipo: string,
  protocolo: string,
  data: LabelData,
  layout?: LabelLayout,
): PrintPayload {
  let raw = "";
  let widthMm = 50;
  let heightMm = 30;

  if (tipo === "HERRAMIENTA") {
    widthMm = 60;
    heightMm = 40;
  }

  switch (protocolo) {
    case "ESCPOS":
      raw = tipo === "HERRAMIENTA"
        ? generateHerramientaESCPOS(data)
        : generateRepuestoESCPOS(data);
      break;
    case "ZPL":
      raw = tipo === "HERRAMIENTA"
        ? generateHerramientaZPL(data)
        : generateRepuestoZPL(data);
      break;
    case "TSPL":
      raw = tipo === "HERRAMIENTA"
        ? generateHerramientaTSPL(data)
        : generateRepuestoTSPL(data);
      break;
    default:
      raw = generatePlainText(tipo, data);
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

  if (!data.codigo) errors.push("Código es requerido");

  if (tipo === "REPUESTO") {
    if (!data.descripcion) errors.push("Descripción es requerida para repuestos");
  } else if (tipo === "HERRAMIENTA") {
    if (!data.nombre) errors.push("Nombre es requerido para herramientas");
  }

  return { valid: errors.length === 0, errors };
}
