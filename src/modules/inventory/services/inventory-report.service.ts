/**
 * Inventory Report Service — PDF reports for stock, movements, valuation.
 *
 * Generates printable PDF reports using the shared PDF engine (puppeteer-core).
 * All reports are tenant-isolated and use Guaraní (₲) currency formatting.
 *
 * @module inventory/services/inventory-report
 */

import { db } from "../../../shared/database/drizzle.js";
import { repuestos } from "../schema/repuestos.js";
import { stockMovements } from "../schema/stock-movements.js";
import { generatePdf } from "../../../shared/services/pdf-report.service.js";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────

function formatGs(value: number): string {
  return `₲ ${value.toLocaleString("es-PY")}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-PY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function stockStatusLabel(actual: number, minimo: number): string {
  if (actual <= 0) return '<span style="color:#dc2626;font-weight:600">SIN STOCK</span>';
  if (actual <= minimo) return '<span style="color:#d97706;font-weight:600">BAJO</span>';
  return '<span style="color:#16a34a">OK</span>';
}

function baseStyles(): string {
  return `
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; margin: 20px; }
      h1 { font-size: 18px; border-bottom: 2px solid #2563eb; padding-bottom: 6px; color: #1e40af; }
      h2 { font-size: 14px; color: #374151; margin-top: 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
      td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
      tr:nth-child(even) { background: #f8fafc; }
      .summary { display: flex; gap: 20px; margin: 12px 0; }
      .summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; flex: 1; }
      .summary-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
      .summary-card .value { font-size: 16px; font-weight: 700; color: #1e40af; }
      .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 8px; }
      .text-right { text-align: right; }
    </style>`;
}

// ─── Stock Report ─────────────────────────────

/**
 * Generate a PDF report of current inventory stock.
 *
 * @param tenantSlug - Tenant identifier
 * @returns PDF buffer
 */
export async function generateStockReport(
  tenantSlug: string,
): Promise<Buffer> {
  const items = await db()
    .select()
    .from(repuestos)
    .where(eq(repuestos.tenantSlug, tenantSlug))
    .orderBy(repuestos.categoria, repuestos.codigo);

  const totalItems = items.length;
  const totalValue = items.reduce(
    (acc, r) => acc + (Number(r.stockActual) * Number(r.costoPromedio || r.precioCosto || 0)),
    0,
  );
  const belowMin = items.filter(
    (r) => r.stockActual <= (r.stockMinimo || 0) && r.stockActual > 0,
  ).length;
  const outOfStock = items.filter((r) => r.stockActual <= 0).length;
  const categories = new Set(items.map((r) => r.categoria).filter(Boolean)).size;

  const now = new Date();
  const html = `<!DOCTYPE html>
<html><head>${baseStyles()}</head><body>
  <h1>Reporte de Inventario</h1>
  <p style="color:#6b7280;font-size:11px;">Generado: ${formatDate(now)} — Tenant: ${tenantSlug}</p>

  <div class="summary">
    <div class="summary-card"><div class="label">Total Items</div><div class="value">${totalItems}</div></div>
    <div class="summary-card"><div class="label">Valorización Total</div><div class="value">${formatGs(totalValue)}</div></div>
    <div class="summary-card"><div class="label">Categorías</div><div class="value">${categories}</div></div>
    <div class="summary-card"><div class="label">Bajo Mínimo</div><div class="value" style="color:#d97706">${belowMin}</div></div>
    <div class="summary-card"><div class="label">Sin Stock</div><div class="value" style="color:#dc2626">${outOfStock}</div></div>
  </div>

  <h2>Stock Actual</h2>
  <table>
    <thead>
      <tr>
        <th>Código</th><th>Descripción</th><th>Marca</th><th>Categoría</th>
        <th class="text-right">Stock</th><th class="text-right">Mínimo</th>
        <th class="text-right">Costo</th><th class="text-right">Valorización</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (r) => `<tr>
        <td>${r.codigo}</td>
        <td>${r.descripcion}</td>
        <td>${r.marca || "—"}</td>
        <td>${r.categoria || "—"}</td>
        <td class="text-right">${r.stockActual}</td>
        <td class="text-right">${r.stockMinimo}</td>
        <td class="text-right">${formatGs(Number(r.costoPromedio || r.precioCosto || 0))}</td>
        <td class="text-right">${formatGs(r.stockActual * Number(r.costoPromedio || r.precioCosto || 0))}</td>
        <td>${stockStatusLabel(r.stockActual, r.stockMinimo)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">AutomotiveOS — Reporte de Inventario — ${tenantSlug}</div>
</body></html>`;

  return generatePdf(html);
}

// ─── Movements Report ─────────────────────────

/**
 * Generate a PDF report of stock movements within a date range.
 *
 * @param tenantSlug - Tenant identifier
 * @param options - Optional date range filters (ISO strings)
 */
export async function generateMovementsReport(
  tenantSlug: string,
  options?: { from?: string; to?: string },
): Promise<Buffer> {
  const toDate = options?.to ? new Date(options.to) : new Date();
  const fromDate = options?.from
    ? new Date(options.from)
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const conditions = [
    eq(stockMovements.tenantSlug, tenantSlug),
    gte(stockMovements.createdAt, fromDate),
    lte(stockMovements.createdAt, toDate),
  ];

  // Resolve repuesto names
  const repuestoMap = new Map<string, string>();
  const allMovements = await db()
    .select({
      id: stockMovements.id,
      tipo: stockMovements.tipo,
      cantidad: stockMovements.cantidad,
      costoUnitario: stockMovements.costoUnitario,
      costoTotal: stockMovements.costoTotal,
      motivo: stockMovements.motivo,
      repuestoId: stockMovements.repuestoId,
      ordenTrabajoId: stockMovements.ordenTrabajoId,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(and(...conditions))
    .orderBy(desc(stockMovements.createdAt));

  // Batch-fetch repuesto names
  const uniqueRepuestoIds = [...new Set(allMovements.map((m) => m.repuestoId))];
  if (uniqueRepuestoIds.length > 0) {
    const repRows = await db()
      .select({ id: repuestos.id, codigo: repuestos.codigo, descripcion: repuestos.descripcion })
      .from(repuestos)
      .where(sql`${repuestos.id} IN ${uniqueRepuestoIds}`);
    for (const r of repRows) {
      repuestoMap.set(r.id, `${r.codigo} — ${r.descripcion}`);
    }
  }

  const entradaCount = allMovements.filter((m) => m.tipo === "ENTRADA").length;
  const salidaCount = allMovements.filter((m) => m.tipo === "SALIDA").length;
  const ajusteCount = allMovements.filter((m) => m.tipo === "AJUSTE").length;
  const totalValue = allMovements.reduce(
    (acc, m) => acc + Number(m.costoTotal || 0),
    0,
  );

  const html = `<!DOCTYPE html>
<html><head>${baseStyles()}</head><body>
  <h1>Movimientos de Stock</h1>
  <p style="color:#6b7280;font-size:11px;">
    Período: ${formatDate(fromDate)} — ${formatDate(toDate)} | Tenant: ${tenantSlug}
  </p>

  <div class="summary">
    <div class="summary-card"><div class="label">Total Movimientos</div><div class="value">${allMovements.length}</div></div>
    <div class="summary-card"><div class="label">Entradas</div><div class="value" style="color:#16a34a">${entradaCount}</div></div>
    <div class="summary-card"><div class="label">Salidas</div><div class="value" style="color:#dc2626">${salidaCount}</div></div>
    <div class="summary-card"><div class="label">Ajustes</div><div class="value" style="color:#d97706">${ajusteCount}</div></div>
    <div class="summary-card"><div class="label">Valor Total</div><div class="value">${formatGs(totalValue)}</div></div>
  </div>

  <h2>Detalle de Movimientos</h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Tipo</th><th>Repuesto</th>
        <th class="text-right">Cantidad</th><th class="text-right">Costo Unit.</th>
        <th class="text-right">Costo Total</th><th>Motivo</th><th>OT</th>
      </tr>
    </thead>
    <tbody>
      ${allMovements
        .map(
          (m) => `<tr>
        <td>${formatDate(m.createdAt)}</td>
        <td>${m.tipo}</td>
        <td>${repuestoMap.get(m.repuestoId) || m.repuestoId}</td>
        <td class="text-right">${m.cantidad}</td>
        <td class="text-right">${formatGs(Number(m.costoUnitario || 0))}</td>
        <td class="text-right">${formatGs(Number(m.costoTotal || 0))}</td>
        <td>${m.motivo || "—"}</td>
        <td>${m.ordenTrabajoId ? m.ordenTrabajoId.slice(0, 8) + "…" : "—"}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">AutomotiveOS — Movimientos de Stock — ${tenantSlug}</div>
</body></html>`;

  return generatePdf(html);
}

// ─── Valuation Report ─────────────────────────

/**
 * Generate a PDF report of inventory valuation grouped by category.
 *
 * @param tenantSlug - Tenant identifier
 */
export async function generateValuationReport(
  tenantSlug: string,
): Promise<Buffer> {
  const items = await db()
    .select()
    .from(repuestos)
    .where(eq(repuestos.tenantSlug, tenantSlug))
    .orderBy(repuestos.categoria, repuestos.codigo);

  // Group by category
  const byCategory = new Map<
    string,
    { count: number; totalStock: number; totalValue: number }
  >();

  for (const r of items) {
    const cat = r.categoria || "Sin categoría";
    const entry = byCategory.get(cat) || { count: 0, totalStock: 0, totalValue: 0 };
    entry.count++;
    entry.totalStock += r.stockActual;
    entry.totalValue +=
      r.stockActual * Number(r.costoPromedio || r.precioCosto || 0);
    byCategory.set(cat, entry);
  }

  const grandTotal = [...byCategory.values()].reduce(
    (acc, v) => acc + v.totalValue,
    0,
  );
  const grandStock = [...byCategory.values()].reduce(
    (acc, v) => acc + v.totalStock,
    0,
  );
  const sorted = [...byCategory.entries()].sort((a, b) => b[1].totalValue - a[1].totalValue);

  const now = new Date();
  const html = `<!DOCTYPE html>
<html><head>${baseStyles()}</head><body>
  <h1>Valorización de Inventario</h1>
  <p style="color:#6b7280;font-size:11px;">Generado: ${formatDate(now)} — Tenant: {tenantSlug}</p>

  <div class="summary">
    <div class="summary-card"><div class="label">Categorías</div><div class="value">${byCategory.size}</div></div>
    <div class="summary-card"><div class="label">Stock Total</div><div class="value">${grandStock.toLocaleString("es-PY")}</div></div>
    <div class="summary-card"><div class="label">Valorización Total</div><div class="value">${formatGs(grandTotal)}</div></div>
  </div>

  <h2>Por Categoría</h2>
  <table>
    <thead>
      <tr>
        <th>Categoría</th><th class="text-right">Items</th>
        <th class="text-right">Stock Total</th><th class="text-right">Valorización</th>
        <th class="text-right">% del Total</th>
      </tr>
    </thead>
    <tbody>
      ${sorted
        .map(
          ([cat, v]) => `<tr>
        <td><strong>${cat}</strong></td>
        <td class="text-right">${v.count}</td>
        <td class="text-right">${v.totalStock.toLocaleString("es-PY")}</td>
        <td class="text-right">${formatGs(v.totalValue)}</td>
        <td class="text-right">${grandTotal > 0 ? ((v.totalValue / grandTotal) * 100).toFixed(1) : 0}%</td>
      </tr>`,
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr style="font-weight:700;border-top:2px solid #1e40af">
        <td>TOTAL</td>
        <td class="text-right">${items.length}</td>
        <td class="text-right">${grandStock.toLocaleString("es-PY")}</td>
        <td class="text-right">${formatGs(grandTotal)}</td>
        <td class="text-right">100%</td>
      </tr>
    </tfoot>
  </table>

  <h2>Detalle por Categoría</h2>
  ${sorted
    .map(
      ([cat, v]) => `
    <h3 style="color:#1e40af;margin-top:14px">${cat} — ${formatGs(v.totalValue)}</h3>
    <table>
      <thead><tr><th>Código</th><th>Descripción</th><th class="text-right">Stock</th><th class="text-right">Costo</th><th class="text-right">Valorización</th></tr></thead>
      <tbody>
        ${items
          .filter((r) => (r.categoria || "Sin categoría") === cat)
          .map(
            (r) => `<tr>
            <td>${r.codigo}</td>
            <td>${r.descripcion}</td>
            <td class="text-right">${r.stockActual}</td>
            <td class="text-right">${formatGs(Number(r.costoPromedio || r.precioCosto || 0))}</td>
            <td class="text-right">${formatGs(r.stockActual * Number(r.costoPromedio || r.precioCosto || 0))}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`,
    )
    .join("")}

  <div class="footer">AutomotiveOS — Valorización de Inventario — ${tenantSlug}</div>
</body></html>`;

  return generatePdf(html);
}
