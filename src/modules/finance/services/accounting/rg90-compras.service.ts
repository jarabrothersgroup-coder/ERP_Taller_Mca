/**
 * RG 90 Módulo Compras — Purchase Export (CAPA 3).
 *
 * Exporta las compras (entradas de stock / OC) del período en el
 * formato exacto TXT/CSV/JSON exigido por el Sistema Marangatú
 * (Hechauka) de la DNIT.
 *
 * @module finance/services/accounting/rg90-compras.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { stockMovements } from "../../../inventory/schema/stock-movements.js";
import { repuestos } from "../../../inventory/schema/repuestos.js";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { ValidationError } from "../../../../shared/errors/app-error.js";
import {
  stripAccents,
  montoFixed,
  fechaDDMMAAAA,
  csvEscape,
} from "./capa3-formatters.js";

// ─── Types ──────────────────────────────────────

export interface RG90ComprasEntry {
  tipoRegistro: string;    // 'C'
  fecha: string;           // DDMMAAAA
  tipoOperacion: string;   // COMPRA_LOCAL | IMPORTACION
  numeroDocumento: string;
  proveedorRuc: string;
  proveedorNombre: string;
  total: string;
  iva10: string;
  iva5: string;
  descripcion: string;
}

export interface RG90ComprasReport {
  periodo: { anho: number; mes: number };
  totalRegistros: number;
  totalCompras: string;
  formato: "JSON" | "TXT" | "CSV";
  entries: RG90ComprasEntry[];
  contenido?: string;
}

// ─── Service ────────────────────────────────────

export async function exportarRG90Compras(
  tenantSlug: string,
  anho: number,
  mes: number,
  formato: "JSON" | "TXT" | "CSV" = "JSON",
): Promise<RG90ComprasReport> {
  if (anho < 2020 || anho > 2100) throw new ValidationError("Año inválido");
  if (mes < 1 || mes > 12) throw new ValidationError("Mes inválido");

  const desde = new Date(anho, mes - 1, 1);
  const hasta = new Date(anho, mes, 0, 23, 59, 59);

  // Stock entries = purchases (ENTRADA)
  const movimientos = await db()
    .select({
      id: stockMovements.id,
      tipo: stockMovements.tipo,
      cantidad: stockMovements.cantidad,
      costoTotal: stockMovements.costoTotal,
      purchaseOrderId: stockMovements.purchaseOrderId,
      createdAt: stockMovements.createdAt,
      repuestoId: stockMovements.repuestoId,
      codigoRepuesto: repuestos.codigo,
      descripcionRepuesto: repuestos.descripcion,
    })
    .from(stockMovements)
    .leftJoin(repuestos, eq(stockMovements.repuestoId, repuestos.id))
    .where(
      and(
        eq(stockMovements.tipo, "ENTRADA"),
        eq(stockMovements.tenantSlug, tenantSlug),
        gte(stockMovements.createdAt, desde),
        lte(stockMovements.createdAt, hasta),
      ),
    )
    .orderBy(asc(stockMovements.createdAt));

  const entries: RG90ComprasEntry[] = [];
  let totalCompras = 0;

  for (const m of movimientos) {
    const total = Number(m.costoTotal ?? 0);
    totalCompras += total;

    entries.push({
      tipoRegistro: "C",
      fecha: fechaDDMMAAAA(m.createdAt),
      tipoOperacion: "COMPRA_LOCAL",
      numeroDocumento: m.purchaseOrderId?.slice(0, 20) ?? `MOV-${m.id?.slice(0, 8)}`,
      proveedorRuc: "",
      proveedorNombre: "",
      total: total.toFixed(2),
      iva10: (total * 0.1).toFixed(2),
      iva5: "0.00",
      descripcion: m.descripcionRepuesto ?? `Entrada #${m.id?.slice(0, 8)}`,
    });
  }

  if (formato === "TXT") return formatTxt(anho, mes, entries, totalCompras);
  if (formato === "CSV") return formatCsv(anho, mes, entries, totalCompras);

  return {
    periodo: { anho, mes },
    totalRegistros: entries.length,
    totalCompras: totalCompras.toFixed(2),
    formato: "JSON",
    entries,
  };
}

// ─── Formatters ────────────────────────────────

function formatTxt(
  anho: number, mes: number,
  entries: RG90ComprasEntry[], totalCompras: number,
): RG90ComprasReport {
  const lines = entries.map((e) => {
    return [
      e.tipoRegistro,
      e.fecha,
      e.tipoOperacion.padEnd(15, " ").slice(0, 15),
      e.numeroDocumento.padEnd(20, " ").slice(0, 20),
      e.proveedorRuc.padEnd(15, " ").slice(0, 15),
      stripAccents(e.proveedorNombre).padEnd(100, " ").slice(0, 100),
      montoFixed(e.total, 16),
      montoFixed(e.iva10, 14),
      montoFixed(e.iva5, 14),
      stripAccents(e.descripcion).padEnd(200, " ").slice(0, 200),
    ].join("");
  });

  const header = `H${String(anho)}${String(mes).padStart(2, "0")}`.padEnd(430, " ");
  lines.unshift(header);
  const trailer = [
    "T", String(entries.length).padStart(10, "0"),
    montoFixed(totalCompras, 20),
  ].join("").padEnd(430, " ");
  lines.push(trailer);

  return {
    periodo: { anho, mes }, totalRegistros: entries.length,
    totalCompras: totalCompras.toFixed(2), formato: "TXT", entries,
    contenido: lines.join("\n"),
  };
}

function formatCsv(
  anho: number, mes: number,
  entries: RG90ComprasEntry[], totalCompras: number,
): RG90ComprasReport {
  const rows = [["TipoReg","Fecha","TipoOp","NroDoc","RUC","Proveedor","Total","IVA10","IVA5","Descripcion"].join(",")];
  for (const e of entries) {
    rows.push([
      e.tipoRegistro, e.fecha, e.tipoOperacion, e.numeroDocumento,
      e.proveedorRuc, csvEscape(e.proveedorNombre), e.total,
      e.iva10, e.iva5, csvEscape(e.descripcion),
    ].join(","));
  }
  rows.push(`TOTAL,,,,,${entries.length},${totalCompras.toFixed(2)},,,`);
  return {
    periodo: { anho, mes }, totalRegistros: entries.length,
    totalCompras: totalCompras.toFixed(2), formato: "CSV", entries,
    contenido: rows.join("\n"),
  };
}
