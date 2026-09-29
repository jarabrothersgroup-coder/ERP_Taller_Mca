/**
 * Fleet Module Service — B2B fleet management.
 *
 * Manages corporate fleet clients with service contracts,
 * consolidated billing, and vehicle tracking.
 *
 * @module fleet/services/fleet.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { getDb } from "../../../shared/database/connection.js";
import { sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

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
  createdAt?: string;
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

export type UpdateFleetRequest = Partial<CreateFleetRequest>;

// ─── Row mapping (DB snake_case → API camelCase) ──

/**
 * Maps a raw `fleets` row to the camelCase API shape expected by the UI.
 */
function mapFleetRow(row: any): Fleet {
  return {
    id: row.id,
    nombre: row.nombre,
    empresa: row.empresa,
    contacto: row.contacto,
    telefono: row.telefono,
    email: row.email ?? undefined,
    ruc: row.ruc,
    contratoTipo: row.contrato_tipo,
    descuentoPorcentaje: Number(row.descuento_porcentaje ?? 0),
    activa: row.activa,
    createdAt: row.created_at,
  };
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

  return mapFleetRow(result[0]);
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

  return result.map(mapFleetRow);
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

  return result.length > 0 ? mapFleetRow(result[0]) : null;
}

/**
 * Updates a fleet client (PATCH).
 *
 * @param id - Fleet UUID
 * @param data - Fields to update (at least one)
 * @param tenantSlug - Current tenant
 * @throws {ValidationError} If no updatable field is provided
 * @throws {NotFoundError} If the fleet does not belong to the tenant
 */
export async function updateFleet(
  id: string,
  data: UpdateFleetRequest,
  tenantSlug: string,
): Promise<Fleet> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const columnByField: Record<string, string> = {
    nombre: "nombre",
    empresa: "empresa",
    contacto: "contacto",
    telefono: "telefono",
    email: "email",
    ruc: "ruc",
    contratoTipo: "contrato_tipo",
    descuentoPorcentaje: "descuento_porcentaje",
  };

  for (const [field, column] of Object.entries(columnByField)) {
    const value = (data as Record<string, unknown>)[field];
    if (value !== undefined) {
      sets.push(`${column} = $${idx++}`);
      values.push(value);
    }
  }

  if (sets.length === 0) {
    throw new ValidationError("No hay campos para actualizar");
  }

  sets.push("updated_at = now()");
  values.push(id, tenantSlug);

  const rows = await getDb().unsafe(
    `UPDATE fleets SET ${sets.join(", ")} WHERE id = $${idx++} AND tenant_slug = $${idx} RETURNING *`,
    values as any[],
  );

  if (rows.length === 0) {
    throw new NotFoundError("Flota no encontrada");
  }

  return mapFleetRow(rows[0]);
}

/**
 * Deactivates a fleet client (soft delete: `activa = false`).
 *
 * History (contracts, invoices) is preserved; the fleet simply stops
 * appearing in the active list.
 *
 * @param id - Fleet UUID
 * @param tenantSlug - Current tenant
 * @throws {NotFoundError} If the fleet does not belong to the tenant
 */
export async function deleteFleet(
  id: string,
  tenantSlug: string,
): Promise<{ deleted: true }> {
  const rows = await db().execute(sql`
    UPDATE fleets SET activa = false, updated_at = now()
    WHERE id = ${id} AND tenant_slug = ${tenantSlug} AND activa = true
    RETURNING id
  `);

  if (rows.length === 0) {
    // Distinguish "not found" from "already inactive" for a clear 404
    const existing = await db().execute(sql`
      SELECT id FROM fleets WHERE id = ${id} AND tenant_slug = ${tenantSlug}
    `);
    if (existing.length === 0) {
      throw new NotFoundError("Flota no encontrada");
    }
    // Already deactivated — idempotent success
  }

  return { deleted: true };
}
