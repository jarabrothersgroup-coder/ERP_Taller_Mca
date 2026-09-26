/**
 * Tecnicos Service — active mechanics/supervisors for a tenant.
 *
 * Shared by GET /workshop/tecnicos (Hub filter dropdown) and
 * GET /workshop/hub/board (aggregated board payload) so both stay
 * consistent — before Sprint 101b the dropdown query lived inline in
 * the route while other consumers re-implemented it.
 *
 * @module workshop/services/tecnicos.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { profiles, tenants } from "../../../shared/database/schema/index.js";
import { eq, and, inArray, sql } from "drizzle-orm";

/** Technician entry for the Operations Hub filter dropdown */
export interface TecnicoRow {
  id: string;
  nombre: string;
  activo: boolean;
}

/**
 * Lists active mechanics and supervisors of a tenant, ordered by name.
 *
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @param limit - Max rows (default 50)
 */
export async function listActiveTecnicos(
  tenantSlug: string,
  limit = 50,
): Promise<TecnicoRow[]> {
  return db()
    .select({
      id: profiles.id,
      nombre: sql<string>`COALESCE(${profiles.fullName}, ${profiles.email})`,
      activo: profiles.isActive,
    })
    .from(profiles)
    .innerJoin(tenants, eq(profiles.tenantId, tenants.id))
    .where(
      and(
        eq(tenants.slug, tenantSlug),
        eq(profiles.isActive, true),
        inArray(profiles.role, ["mechanic", "supervisor"]),
      ),
    )
    .orderBy(profiles.fullName)
    .limit(limit);
}
