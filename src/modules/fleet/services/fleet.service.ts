/**
 * Fleet Module Service — B2B fleet management.
 *
 * Manages corporate fleet clients with service contracts,
 * consolidated billing, and vehicle tracking.
 *
 * @module fleet/services/fleet.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql, eq, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface Fleet {
  id: string;
  nombre: string;
  empresa: string;
  contacto: string;
  telefono: string;
  email?: string;
  ruc: string;
  contratoTipo: string;
  descuentoPorcentaje: number;
  activa: boolean;
}

export interface CreateFleetRequest {
  nombre: string;
  empresa: string;
  contacto: string;
  telefono: string;
  email?: string;
  ruc: string;
  contratoTipo: string;
  descuentoPorcentaje?: number;
}

// ─── Fleet CRUD ───────────────────────────────

/**
 * Creates a new fleet client.
 */
export async function createFleet(
  data: CreateFleetRequest,
  tenantSlug: string,
): Promise<Fleet> {
  const result = await db().execute(sql`
    INSERT INTO fleets (nombre, empresa, contacto, telefono, email, ruc,
                        contrato_tipo, descuento_porcentaje, activa, tenant_slug)
    VALUES (${data.nombre}, ${data.empresa}, ${data.contacto}, ${data.telefono},
            ${data.email || null}, ${data.ruc}, ${data.contratoTipo},
            ${data.descuentoPorcentaje || 0}, true, ${tenantSlug})
    RETURNING *
  `);

  return result.rows[0] as Fleet;
}

/**
 * Lists fleet clients for a tenant.
 */
export async function listFleets(tenantSlug: string): Promise<Fleet[]> {
  const result = await db().execute(sql`
    SELECT * FROM fleets
    WHERE tenant_slug = ${tenantSlug} AND activa = true
    ORDER BY empresa
  `);

  return result.rows as Fleet[];
}

/**
 * Gets fleet by ID.
 */
export async function getFleetById(
  id: string,
  tenantSlug: string,
): Promise<Fleet | null> {
  const result = await db().execute(sql`
    SELECT * FROM fleets
    WHERE id = ${id} AND tenant_slug = ${tenantSlug}
  `);

  return (result.rows[0] as Fleet) || null;
}
