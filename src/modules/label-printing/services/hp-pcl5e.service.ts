/**
 * HP LaserJet P1150 PCL5e Printing Service.
 *
 * Generates PCL5e commands for HP LaserJet P1150 invoice printing.
 * Supports Letter (216×279mm) and Media Carta (216×356mm) paper sizes.
 *
 * HP LaserJet P1150 specs:
 * - PCL5e compatible (NOT PCL6/XL)
 * - 600×600 DPI native, 1200 enhanced
 * - 8MB RAM, USB + Parallel
 * - 250-sheet tray, monochrome only
 *
 * PCL5e reference: HP PCL 5 Printer Language Technical Reference Manual
 *
 * @module label-printing/services/hp-pcl5e
 */

// ─── PCL5e Escape Sequences ────────────────────

const ESC = "\x1b";

/** Enter PCL mode */
const PCL_ENTER = `${ESC}%-12345X`;
/** Universal exit (reset printer) */
const PCL_EXIT = `${ESC}E`;
/** Form feed (eject page) */
const PCL_FORM_FEED = `${ESC}&l0H`;
/** Bold on */
const PCL_BOLD_ON = `${ESC}(s1B`;
/** Bold off */
const PCL_BOLD_OFF = `${ESC}(s0B`;

/** Set page size: 1=Letter, 2=Legal, 3=A4 */
function pclPageSize(id: number): string { return `${ESC}&l${id}A`; }
/** Set orientation: 0=portrait, 1=landscape */
function pclOrientation(o: number): string { return `${ESC}&l${o}O`; }
/** Set top margin (1/48 inch) */
function pclTopMargin(m: number): string { return `${ESC}&l${m}E`; }
/** Set left margin (1/120 inch) */
function pclLeftMargin(m: number): string { return `${ESC}&l${m}F`; }
/** Select font by ID */
function pclFont(id: number): string { return `${ESC}(${id}B`; }
/** Set font size (points) */
function pclFontSize(pt: number): string { return `${ESC}(s${pt}V`; }
/** Set symbol set: 10U=ASCII */
function pclSymbolSet(s: string): string { return `${ESC}(${s}X`; }
/** Horizontal position (1/120 inch) */
function pclHPos(pos: number): string { return `${ESC}&a${pos}C`; }

// ─── Paper Presets ─────────────────────────────

export interface PaperPreset {
  name: string;
  widthMm: number;
  heightMm: number;
  pclSizeId: number;
  description: string;
}

export const HP_P1150_PAPER_PRESETS: PaperPreset[] = [
  { name: "Carta (216×279mm)", widthMm: 216, heightMm: 279, pclSizeId: 1, description: "Tamaño carta estándar — facturación SET Paraguay" },
  { name: "Media Carta (216×356mm)", widthMm: 216, heightMm: 356, pclSizeId: 2, description: "Carta extendida — facturas con muchas líneas" },
  { name: "Legal (216×356mm)", widthMm: 216, heightMm: 356, pclSizeId: 2, description: "Tamaño legal — documentos legales" },
  { name: "A4 (210×297mm)", widthMm: 210, heightMm: 297, pclSizeId: 3, description: "A4 internacional — facturas con formato europeo" },
];

// ─── SET Invoice Elements ──────────────────────

/**
 * Mandatory invoice elements per SET/DNIT regulations:
 * - RG 1382/05: Timbrado, numeración, datos empresa
 * - RG 27/2019: Conservation notice for thermal paper
 * - SIFEN V150: CDC, QR code, firma digital
 *
 * 1. Datos del emisor: nombre, RUC, dirección, actividad económica
 * 2. Timbrado N° y fecha de vigencia (manual only)
 * 3. Factura N° (13 dígitos: 3+3+7)
 * 4. Fecha de emisión
 * 5. Datos del receptor: nombre, RUC (si >₲35M)
 * 6. Detalle de operaciones: descripción, cantidad, precio unitario
 * 7. IVA discriminado (5%, 10%, exento)
 * 8. Total de la operación
 * 9. Condición de venta (contado/crédito)
 * 10. CDC + QR (electrónica) / Código de barras (manual)
 */
export interface SETInvoiceElements {
  emisor: { nombre: string; ruc: string; direccion: string; telefono?: string; actividadEconomica: string };
  timbrado?: { numero: string; fechaVigencia: string };
  factura: { numero: string; fechaEmision: string; tipo: "MANUAL" | "ELECTRONICA" };
  cliente: { nombre: string; ruc?: string; direccion?: string };
  lineItems: Array<{ descripcion: string; cantidad: number; precioUnitario: number; iva: number; subtotal: number }>;
  iva: { exento: number; gravado5: number; gravado10: number; totalIva: number };
  totales: { subtotal: number; totalIva: number; total: number };
  condicionVenta: "CONTADO" | "CREDITO";
  cdc?: string;
}

// ─── PCL5e Invoice Generation ──────────────────

/**
 * Generate PCL5e commands for HP LaserJet P1150 invoice printing.
 */
export function generateFacturaPCL5e(
  data: SETInvoiceElements,
  paperWidthMm: number = 216,
  paperHeightMm: number = 279,
): string {
  const LMARGIN = 360;
  const usableWidth = Math.floor(((paperWidthMm / 25.4) - 1.2) * 120);

  let pclPaperSize = 1;
  if (paperWidthMm <= 210 && paperHeightMm <= 297) pclPaperSize = 3;
  else if (paperHeightMm > 279 && paperHeightMm <= 356) pclPaperSize = 2;

  let pcl = "";

  // Initialize
  pcl += PCL_ENTER;
  pcl += pclPageSize(pclPaperSize);
  pcl += pclOrientation(0);
  pcl += pclTopMargin(60);
  pcl += pclLeftMargin(LMARGIN);
  pcl += pclSymbolSet("10U");
  pcl += pclFont(0);
  pcl += pclFontSize(12);

  // Company header
  pcl += PCL_BOLD_ON + pclFontSize(16);
  pcl += pclHPos(0) + centeredText(data.emisor.nombre, usableWidth);
  pcl += PCL_BOLD_OFF + pclFontSize(10);
  pcl += pclHPos(0) + centeredText(`RUC: ${data.emisor.ruc}`, usableWidth);
  pcl += pclHPos(0) + centeredText(data.emisor.direccion, usableWidth);
  if (data.emisor.telefono) pcl += pclHPos(0) + centeredText(`Tel: ${data.emisor.telefono}`, usableWidth);
  pcl += pclHPos(0) + centeredText(`Actividad: ${data.emisor.actividadEconomica}`, usableWidth);

  // Separator
  pcl += pclFontSize(8) + pclHPos(0) + "─".repeat(Math.floor(usableWidth / 8)) + "\n";

  // Timbrado (manual)
  if (data.timbrado && data.factura.tipo === "MANUAL") {
    pcl += PCL_BOLD_ON + pclFontSize(11) + pclHPos(0);
    pcl += `TIMBRADO: ${data.timbrado.numero}`;
    pcl += pclHPos(Math.floor(usableWidth * 0.6));
    pcl += `Vigencia: ${data.timbrado.fechaVigencia}\n`;
    pcl += PCL_BOLD_OFF;
  }

  // Invoice number
  pcl += PCL_BOLD_ON + pclFontSize(14) + pclHPos(0);
  pcl += `FACTURA N°: ${data.factura.numero}` + PCL_BOLD_OFF;
  pcl += pclFontSize(10) + pclHPos(0);
  pcl += `Fecha: ${data.factura.fechaEmision}  Tipo: ${data.factura.tipo === "ELECTRONICA" ? "Electrónica" : "Manual"}\n`;

  // Separator
  pcl += pclFontSize(8) + pclHPos(0) + "─".repeat(Math.floor(usableWidth / 8)) + "\n";

  // Client
  pcl += pclFontSize(10) + PCL_BOLD_ON + pclHPos(0) + `Cliente: ${data.cliente.nombre}\n` + PCL_BOLD_OFF;
  if (data.cliente.ruc) pcl += pclHPos(0) + `RUC: ${data.cliente.ruc}\n`;
  if (data.cliente.direccion) pcl += pclHPos(0) + `Dir: ${data.cliente.direccion}\n`;

  // Separator
  pcl += pclFontSize(8) + pclHPos(0) + "─".repeat(Math.floor(usableWidth / 8)) + "\n";

  // Line items header
  pcl += pclFontSize(10) + PCL_BOLD_ON + pclHPos(0);
  pcl += "Descripción".padEnd(35) + "Cant.".padStart(8) + "P.Unit".padStart(15) + "Subtotal".padStart(15);
  pcl += PCL_BOLD_OFF + "\n";
  pcl += pclHPos(0) + "─".repeat(Math.floor(usableWidth / 8)) + "\n";

  // Line items
  for (const item of data.lineItems) {
    pcl += pclHPos(0);
    pcl += item.descripcion.substring(0, 35).padEnd(35);
    pcl += String(item.cantidad).padStart(8);
    pcl += formatGuaranies(item.precioUnitario).padStart(15);
    pcl += formatGuaranies(item.subtotal).padStart(15) + "\n";
    if (item.iva > 0) {
      pcl += pclFontSize(8) + pclHPos(0) + `  IVA ${item.iva}%\n` + pclFontSize(10);
    }
  }

  // Double separator
  pcl += pclFontSize(8) + pclHPos(0) + "═".repeat(Math.floor(usableWidth / 8)) + "\n";

  // Totals
  pcl += pclFontSize(11) + pclHPos(0) + `Exento:           ${formatGuaranies(data.iva.exento).padStart(15)}\n`;
  pcl += pclHPos(0) + `Gravado 5%:       ${formatGuaranies(data.iva.gravado5).padStart(15)}\n`;
  pcl += pclHPos(0) + `Gravado 10%:      ${formatGuaranies(data.iva.gravado10).padStart(15)}\n`;
  pcl += pclHPos(0) + `IVA Total:        ${formatGuaranies(data.iva.totalIva).padStart(15)}\n`;
  pcl += pclHPos(0) + "─".repeat(Math.floor(usableWidth / 8)) + "\n";

  pcl += PCL_BOLD_ON + pclFontSize(14) + pclHPos(0);
  pcl += `TOTAL:            ${formatGuaranies(data.totales.total).padStart(15)}` + PCL_BOLD_OFF + "\n";
  pcl += pclHPos(0) + "═".repeat(Math.floor(usableWidth / 8)) + "\n";

  // Condición de venta
  pcl += pclFontSize(10) + pclHPos(0) + `Condición de venta: ${data.condicionVenta}\n`;

  // CDC
  if (data.cdc) {
    pcl += pclFontSize(8) + pclHPos(0) + centeredText(`CDC: ${data.cdc}`, usableWidth);
    pcl += pclHPos(0) + centeredText("Verificar en sifen.gov.py/consulte", usableWidth);
  }

  // Footer
  pcl += pclFontSize(9) + "\n";
  pcl += pclHPos(0) + centeredText("Gracias por su preferencia", usableWidth);
  pcl += pclHPos(0) + centeredText("www.automotiveos.com.py", usableWidth);

  pcl += PCL_FORM_FEED + PCL_EXIT;
  return pcl;
}

// ─── Helpers ───────────────────────────────────

function centeredText(text: string, widthUnits: number): string {
  const charWidth = 8;
  const textWidth = text.length * charWidth;
  const spaces = Math.max(0, Math.floor((widthUnits - textWidth) / (2 * charWidth)));
  return " ".repeat(spaces) + text + "\n";
}

export function formatGuaranies(amount: number): string {
  return `Gs. ${Math.round(amount).toLocaleString("es-PY")}`;
}

// ─── Printer Config ────────────────────────────

export interface HPPrinterConfig {
  cupsName: string;
  uri: string;
  media: string;
  dpi: number;
  inputSlot: string;
}

export const HP_P1150_DEFAULT_CONFIG: HPPrinterConfig = {
  cupsName: "HP_LaserJet_1150",
  uri: "usb://HP/LaserJet%201150",
  media: "Letter",
  dpi: 600,
  inputSlot: "Auto",
};

export function buildCupsOptions(config: HPPrinterConfig): string {
  return [
    `media=${config.media}`,
    `resolution=${config.dpi}dpi`,
    `inputslot=${config.inputSlot.toLowerCase()}`,
    "sides=one-sided",
    "colormodel=Gray",
    "print-quality=normal",
  ].join(" ");
}

export function buildLpCommand(config: HPPrinterConfig, filePath: string, copies: number = 1): string {
  return `lp -d ${config.cupsName} -n ${copies} -o ${buildCupsOptions(config)} ${filePath}`;
}
