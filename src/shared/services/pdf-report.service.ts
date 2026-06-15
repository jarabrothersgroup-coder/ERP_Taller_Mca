/**
 * PDF Report Service — Server-side PDF generation.
 *
 * Generates print-quality PDFs for:
 *   - OT (Orden de Trabajo) with services + parts breakdown
 *   - Invoice (Factura) with line items
 *   - Balance General (Financial balance)
 *
 * Uses puppeteer-core with system Chromium.
 * Graceful degradation if Chromium not available.
 *
 * @module services/pdf-report.service
 */

import puppeteer, { type Browser } from "puppeteer-core";
import { execSync } from "child_process";
import { existsSync } from "fs";

// ─── Chromium Detection ────────────────────────

function findChromiumPath(): string | null {
  const candidates = [
    // System Chromium
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    // Alpine (Docker)
    "/usr/bin/chromium",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // Snap
    "/snap/bin/chromium",
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  // Try `which` as fallback
  try {
    return execSync("which chromium-browser || which chromium || which google-chrome", {
      encoding: "utf-8",
    }).trim().split("\n")[0];
  } catch {
    return null;
  }
}

const CHROMIUM_PATH = findChromiumPath();

// ─── HTML Templates ────────────────────────────

function otTemplate(ot: any, items: any[], cliente: any, vehiculo: any): string {
  const servicios = items.filter((i: any) => i.tipo === "servicio");
  const repuestos = items.filter((i: any) => i.tipo === "repuesto");

  return `<!DOCTYPE html>
<html lang="es-PY">
<head>
  <meta charset="UTF-8">
  <style>
    * { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { color: #1f2937; padding: 40px; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 24px; }
    .company { font-size: 20px; font-weight: 800; color: #1e40af; }
    .doc-title { font-size: 24px; font-weight: 700; text-align: right; color: #374151; }
    .doc-number { font-size: 14px; color: #6b7280; text-align: right; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .info-box h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px; }
    .info-box p { font-size: 13px; color: #1f2937; margin-bottom: 4px; }
    .info-box .label { color: #6b7280; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #1e40af; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
    .totals-box { background: #f9fafb; border: 2px solid #1e40af; border-radius: 8px; padding: 16px 24px; min-width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals-row.total { font-weight: 700; font-size: 16px; border-top: 2px solid #1e40af; padding-top: 8px; margin-top: 8px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-Listo { background: #d1fae5; color: #065f46; }
    .status-En_Proceso { background: #dbeafe; color: #1e40af; }
    .status-Presupuestado { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    .signature-area { margin-top: 48px; display: flex; justify-content: space-between; }
    .signature-line { width: 200px; border-top: 1px solid #374151; text-align: center; padding-top: 8px; font-size: 12px; color: #6b7280; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">🔧 AutomotiveOS</div>
      <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">Cloud ERP · Taller Mecánico</div>
    </div>
    <div>
      <div class="doc-title">ORDEN DE TRABAJO</div>
      <div class="doc-number">OT-${ot.id?.slice(0, 8) || "N/A"}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Cliente</h3>
      <p><strong>${cliente?.name || "—"}</strong></p>
      <p><span class="label">RUC:</span> ${cliente?.ruc || "—"}</p>
      <p><span class="label">Email:</span> ${cliente?.email || "—"}</p>
      <p><span class="label">Tel:</span> ${cliente?.phone || "—"}</p>
    </div>
    <div class="info-box">
      <h3>Vehículo</h3>
      <p><strong>${vehiculo?.brand || ""} ${vehiculo?.model || ""}</strong></p>
      <p><span class="label">Patente:</span> ${vehiculo?.plate || "—"}</p>
      <p><span class="label">VIN:</span> ${vehiculo?.vin || "—"}</p>
      <p><span class="label">Año:</span> ${vehiculo?.year || "—"}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Estado</h3>
      <p><span class="status-badge status-${ot.status || "Presupuestado"}">${ot.status || "Presupuestado"}</span></p>
    </div>
    <div class="info-box">
      <h3>Descripción</h3>
      <p>${ot.description || "Sin descripción"}</p>
    </div>
  </div>

  ${servicios.length > 0 ? `
  <h3 style="margin-bottom: 8px; color: #374151;">Servicios</h3>
  <table>
    <thead><tr><th>Servicio</th><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${servicios.map((s: any) => `
        <tr>
          <td>${s.nombre || s.servicioNombre || "—"}</td>
          <td>${s.descripcion || "—"}</td>
          <td>${s.cantidad || 1}</td>
          <td>₲ ${(s.precioUnitario || 0).toLocaleString("es-PY")}</td>
          <td>₲ ${((s.precioUnitario || 0) * (s.cantidad || 1)).toLocaleString("es-PY")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>` : ""}

  ${repuestos.length > 0 ? `
  <h3 style="margin-bottom: 8px; color: #374151;">Repuestos</h3>
  <table>
    <thead><tr><th>Repuesto</th><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${repuestos.map((r: any) => `
        <tr>
          <td>${r.nombre || r.repuestoNombre || "—"}</td>
          <td>${r.descripcion || "—"}</td>
          <td>${r.cantidad || 1}</td>
          <td>₲ ${(r.precioUnitario || 0).toLocaleString("es-PY")}</td>
          <td>₲ ${((r.precioUnitario || 0) * (r.cantidad || 1)).toLocaleString("es-PY")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>` : ""}

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Servicios:</span><span>₲ ${(ot.totalServicios || 0).toLocaleString("es-PY")}</span></div>
      <div class="totals-row"><span>Repuestos:</span><span>₲ ${(ot.totalRepuestos || 0).toLocaleString("es-PY")}</span></div>
      <div class="totals-row total"><span>TOTAL:</span><span>₲ ${(ot.totalCost || 0).toLocaleString("es-PY")}</span></div>
    </div>
  </div>

  <div class="signature-area">
    <div class="signature-line">Firma del Cliente</div>
    <div class="signature-line">Firma del Técnico</div>
  </div>

  <div class="footer">
    Documento generado por AutomotiveOS Cloud ERP — ${new Date().toLocaleDateString("es-PY")} ${new Date().toLocaleTimeString("es-PY")}
  </div>
</body>
</html>`;
}

function invoiceTemplate(factura: any, items: any[], cliente: any): string {
  return `<!DOCTYPE html>
<html lang="es-PY">
<head>
  <meta charset="UTF-8">
  <style>
    * { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { color: #1f2937; padding: 40px; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
    .company { font-size: 20px; font-weight: 800; color: #059669; }
    .doc-title { font-size: 24px; font-weight: 700; text-align: right; color: #374151; }
    .doc-number { font-size: 14px; color: #6b7280; text-align: right; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .info-box h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px; }
    .info-box p { font-size: 13px; color: #1f2937; margin-bottom: 4px; }
    .info-box .label { color: #6b7280; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #059669; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
    .totals-box { background: #f9fafb; border: 2px solid #059669; border-radius: 8px; padding: 16px 24px; min-width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals-row.total { font-weight: 700; font-size: 16px; border-top: 2px solid #059669; padding-top: 8px; margin-top: 8px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-PENDIENTE { background: #fef3c7; color: #92400e; }
    .status-PAGADA { background: #d1fae5; color: #065f46; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">🔧 AutomotiveOS</div>
      <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">Cloud ERP · Taller Mecánico</div>
    </div>
    <div>
      <div class="doc-title">FACTURA</div>
      <div class="doc-number">${factura.serie && factura.numero ? `${factura.serie}-${factura.numero}` : factura.id?.slice(0, 8) || "N/A"}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>Cliente</h3>
      <p><strong>${cliente?.name || "—"}</strong></p>
      <p><span class="label">RUC:</span> ${cliente?.ruc || "—"}</p>
      <p><span class="label">Email:</span> ${cliente?.email || "—"}</p>
    </div>
    <div class="info-box">
      <h3>Detalles</h3>
      <p><span class="label">Estado:</span> <span class="status-badge status-${factura.estadoPago || "PENDIENTE"}">${factura.estadoPago || "PENDIENTE"}</span></p>
      <p><span class="label">Fecha:</span> ${factura.createdAt ? new Date(factura.createdAt).toLocaleDateString("es-PY") : "—"}</p>
      <p><span class="label">Vencimiento:</span> ${factura.fechaVencimiento ? new Date(factura.fechaVencimiento).toLocaleDateString("es-PY") : "—"}</p>
    </div>
  </div>

  ${items.length > 0 ? `
  <table>
    <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
    <tbody>
      ${items.map((item: any) => `
        <tr>
          <td>${item.descripcion || item.servicioNombre || "—"}</td>
          <td>${item.cantidad || 1}</td>
          <td>₲ ${(item.precioUnitario || item.monto || 0).toLocaleString("es-PY")}</td>
          <td> gồ ${((item.precioUnitario || item.monto || 0) * (item.cantidad || 1)).toLocaleString("es-PY")}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>` : ""}

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Subtotal:</span><span>₲ ${(factura.subtotal || factura.total || 0).toLocaleString("es-PY")}</span></div>
      <div class="totals-row"><span>IVA (10%):</span><span>₲ ${(factura.iva || 0).toLocaleString("es-PY")}</span></div>
      <div class="totals-row total"><span>TOTAL:</span><span>₲ ${(factura.total || 0).toLocaleString("es-PY")}</span></div>
      ${factura.saldoPendiente ? `<div class="totals-row"><span>Saldo Pendiente:</span><span>₲ ${factura.saldoPendiente.toLocaleString("es-PY")}</span></div>` : ""}
    </div>
  </div>

  <div class="footer">
    Documento generado por AutomotiveOS Cloud ERP — ${new Date().toLocaleDateString("es-PY")} ${new Date().toLocaleTimeString("es-PY")}
  </div>
</body>
</html>`;
}

// ─── PDF Generation ────────────────────────────

async function generatePdf(html: string): Promise<Buffer> {
  if (!CHROMIUM_PATH) {
    throw new Error("Chromium not found. Install chromium-browser or set PUPPETEER_EXECUTABLE_PATH.");
  }

  const browser: Browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Public API ────────────────────────────────

export async function generateOtPdf(
  ot: any,
  items: any[],
  cliente: any,
  vehiculo: any,
): Promise<Buffer> {
  const html = otTemplate(ot, items, cliente, vehiculo);
  return generatePdf(html);
}

export async function generateInvoicePdf(
  factura: any,
  items: any[],
  cliente: any,
): Promise<Buffer> {
  const html = invoiceTemplate(factura, items, cliente);
  return generatePdf(html);
}

export function isPdfAvailable(): boolean {
  return CHROMIUM_PATH !== null;
}

export function getChromiumPath(): string | null {
  return CHROMIUM_PATH;
}
