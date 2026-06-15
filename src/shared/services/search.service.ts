/**
 * Global Search Service — Cross-entity search.
 *
 * Searches across vehiculos, clientes, and ordenes_trabajo
 * using ILIKE (case-insensitive LIKE) with tenant isolation.
 *
 * @module shared/services/search
 */

import { db } from "../database/drizzle.js";
import { eq, or, ilike, and } from "drizzle-orm";
import { vehiculos } from "../../modules/workshop/schema/vehiculos.js";
import { clients } from "../database/schema/clients.js";
import { ordenesTrabajo } from "../../modules/workshop/schema/ordenes-trabajo.js";

// ─── Types ──────────────────────────────────────

export interface SearchResult {
  /** Entity type for icon/routing */
  type: "vehiculo" | "cliente" | "orden";
  /** Entity UUID */
  id: string;
  /** Primary display text */
  title: string;
  /** Secondary display text (subtitle) */
  subtitle: string;
  /** Route to navigate on click */
  route: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

// ─── Service ────────────────────────────────────

/**
 * Global search across multiple entities.
 *
 * Searches:
 *   - Vehículos: VIN, plate, brand, model
 *   - Clientes: name, email, ruc, phone
 *   - Órdenes: description, diagnosis, status
 *
 * @param tenantSlug - Tenant isolation filter
 * @param query - Search string (min 1 char)
 * @param limit - Max results per entity type (default 5)
 * @returns Aggregated results sorted by relevance
 */
export async function globalSearch(
  tenantSlug: string,
  query: string,
  limit: number = 5,
): Promise<SearchResponse> {
  const q = `%${query}%`;
  const results: SearchResult[] = [];

  // ── Search vehicles (VIN, plate, brand, model) ──
  const vehiculoResults = await db()
    .select({
      id: vehiculos.id,
      plate: vehiculos.plate,
      vin: vehiculos.vin,
      brand: vehiculos.brand,
      model: vehiculos.model,
      year: vehiculos.year,
    })
    .from(vehiculos)
    .where(
      and(
        eq(vehiculos.tenantSlug, tenantSlug),
        or(
          ilike(vehiculos.vin, q),
          ilike(vehiculos.plate, q),
          ilike(vehiculos.brand, q),
          ilike(vehiculos.model, q),
        ),
      ),
    )
    .limit(limit);

  for (const v of vehiculoResults) {
    const subtitle = [
      v.year ? `${v.year}` : null,
      v.brand,
      v.model,
      v.plate ? `(${v.plate})` : null,
    ].filter(Boolean).join(" ");
    results.push({
      type: "vehiculo",
      id: v.id,
      title: v.vin || v.plate || "Sin identificador",
      subtitle,
      route: `inventario`,
    });
  }

  // ── Search clients (name, email, ruc, phone) ──
  const clienteResults = await db()
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      ruc: clients.ruc,
      phone: clients.phone,
    })
    .from(clients)
    .where(
      and(
        eq(clients.tenantSlug, tenantSlug),
        or(
          ilike(clients.name, q),
          ilike(clients.email, q),
          ilike(clients.ruc, q),
          ilike(clients.phone, q),
        ),
      ),
    )
    .limit(limit);

  for (const c of clienteResults) {
    const subtitle = [c.ruc ? `RUC: ${c.ruc}` : null, c.email, c.phone]
      .filter(Boolean)
      .join(" · ");
    results.push({
      type: "cliente",
      id: c.id,
      title: c.name,
      subtitle: subtitle || "Sin datos adicionales",
      route: `inventario`,
    });
  }

  // ── Search orders (description, diagnosis, status) ──
  const ordenResults = await db()
    .select({
      id: ordenesTrabajo.id,
      description: ordenesTrabajo.description,
      diagnosis: ordenesTrabajo.diagnosis,
      status: ordenesTrabajo.status,
      totalCost: ordenesTrabajo.totalCost,
      vehicleId: ordenesTrabajo.vehicleId,
    })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.tenantSlug, tenantSlug),
        or(
          ilike(ordenesTrabajo.description, q),
          ilike(ordenesTrabajo.diagnosis, q),
          ilike(ordenesTrabajo.status, q),
        ),
      ),
    )
    .limit(limit);

  for (const o of ordenResults) {
    const subtitle = [
      o.status,
      o.totalCost ? `₲${Number(o.totalCost).toLocaleString("es-PY")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    results.push({
      type: "orden",
      id: o.id,
      title: o.description || o.diagnosis || `OT ${o.id.slice(0, 8)}`,
      subtitle: subtitle || "Sin descripción",
      route: `ordenes`,
    });
  }

  // Sort: vehicles first, then clients, then orders; alphabetically within each group
  const typeOrder = { vehiculo: 0, cliente: 1, orden: 2 };
  results.sort((a, b) => {
    const ta = typeOrder[a.type] ?? 99;
    const tb = typeOrder[b.type] ?? 99;
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title, "es-PY");
  });

  return { results, total: results.length };
}
