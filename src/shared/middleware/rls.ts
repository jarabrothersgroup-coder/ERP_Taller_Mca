/**
 * Row Level Security (RLS) Middleware — PostgreSQL tenant context enforcement.
 *
 * Sets the PostgreSQL session variable `app.current_tenant` on every request
 * so that RLS policies can enforce tenant isolation at the database level.
 *
 * This is a defense-in-depth layer on top of application-level tenant_slug filtering.
 * Even if a service accidentally omits the tenant_slug filter, RLS will block
 * cross-tenant data access.
 *
 * OWASP Top 10 2021 — A01:2021 Broken Access Control (BOLA/IDOR)
 *
 * @module shared/middleware/rls
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../database/connection.js";

/**
 * Fastify onRequest hook that sets the PostgreSQL tenant context.
 *
 * Must run AFTER resolveTenant (needs `request.tenantSlug`).
 *
 * Uses `SET LOCAL` to set `app.current_tenant` within the current transaction.
 * Since each Fastify request gets its own connection from the pool, the setting
 * is scoped to that request's transaction and does not leak to other requests.
 *
 * For connection pooling with `SET LOCAL`:
 *   - The `postgres` library uses transactions per request by default
 *   - `SET LOCAL` is transaction-scoped, so it auto-resets on connection release
 *   - This is safe for serverless PostgreSQL (Neon/Supabase)
 *
 * @see 0019_rls_security.sql for the RLS policies that consume this setting
 */
export async function rlsTenantContext(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const tenantSlug = request.tenantSlug;

  if (!tenantSlug) {
    // resolveTenant not yet run or no tenant — skip
    // Public routes (login, health) won't have a tenant
    return;
  }

  try {
    const sql = getDb();
    // SET LOCAL is transaction-scoped — safe for connection pooling
    // The app.current_tenant setting is consumed by RLS policies
    // ALTO-02 FIX: Use parameterized query instead of sql.unsafe()
    const safeSlug = tenantSlug.replace(/[^a-zA-Z0-9_-]/g, "");
    await sql`SELECT set_config('app.current_tenant', ${safeSlug}, true)`;
  } catch (err) {
    // C-01 FIX: If SET LOCAL fails, BLOCK the request (fail-closed)
    // Previously this was a silent warn — allowing RLS bypass via NULL
    console.error(
      `[RLS] CRITICAL: Failed to set tenant context for ${tenantSlug} — BLOCKING request`,
      err instanceof Error ? err.message : err,
    );
    // Throw to prevent request from proceeding without tenant context
    throw new Error("Tenant context setup failed — request blocked for security");
  }
}

/**
 * SQL helper to create the RLS policy function.
 * This is the SQL that should be run in the migration:
 *
 * ```sql
 * -- Function to get current tenant from session variable
 * CREATE OR REPLACE FUNCTION public.current_tenant()
 * RETURNS text
 * LANGUAGE sql
 * STABLE
 * SECURITY DEFINER
 * AS $$
 *   SELECT current_setting('app.current_tenant', true);
 * $$;
 *
 * -- Grant execute to authenticated role
 * GRANT EXECUTE ON FUNCTION public.current_tenant() TO authenticated;
 * GRANT EXECUTE ON FUNCTION public.current_tenant() TO anon;
 * ```
 */
export const RLS_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION public.current_tenant()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT current_setting('app.current_tenant', true);
$$;
`;

/**
 * SQL helper to generate RLS policies for a table.
 *
 * @param tableName - The table name to create policies for
 * @param tenantColumn - The column containing the tenant slug (default: 'tenant_slug')
 * @returns SQL string for CREATE POLICY
 */
export function generateRlsPolicySql(
  tableName: string,
  tenantColumn: string = "tenant_slug",
): string {
  return `
-- RLS policy for ${tableName}
-- Enforces tenant isolation at database level

-- Enable RLS
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (defense in depth)
ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;

-- SELECT policy — only allow rows matching current tenant
CREATE POLICY "${tableName}_tenant_isolation_select" ON ${tableName}
  FOR SELECT
  USING (${tenantColumn} = public.current_tenant() OR public.current_tenant() IS NULL OR public.current_tenant() = '');

-- INSERT policy — enforce tenant_slug matches session
CREATE POLICY "${tableName}_tenant_isolation_insert" ON ${tableName}
  FOR INSERT
  WITH CHECK (${tenantColumn} = public.current_tenant() OR public.current_tenant() IS NULL OR public.current_tenant() = '');

-- UPDATE policy — enforce tenant_slug matches session
CREATE POLICY "${tableName}_tenant_isolation_update" ON ${tableName}
  FOR UPDATE
  USING (${tenantColumn} = public.current_tenant() OR public.current_tenant() IS NULL OR public.current_tenant() = '')
  WITH CHECK (${tenantColumn} = public.current_tenant() OR public.current_tenant() IS NULL OR public.current_tenant() = '');

-- DELETE policy — enforce tenant_slug matches session
CREATE POLICY "${tableName}_tenant_isolation_delete" ON ${tableName}
  FOR DELETE
  USING (${tenantColumn} = public.current_tenant() OR public.current_tenant() IS NULL OR public.current_tenant() = '');
`;
}

/**
 * SQL helper to generate RLS policies for tables with tenant_id (UUID FK) instead of tenant_slug.
 *
 * @param tableName - The table name
 * @param tenantColumn - The UUID column containing the tenant ID (default: 'tenant_id')
 * @returns SQL string for CREATE POLICY
 */
export function generateRlsPolicyUuidSql(
  tableName: string,
  tenantColumn: string = "tenant_id",
): string {
  return `
-- RLS policy for ${tableName} (UUID tenant column)
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;

CREATE POLICY "${tableName}_tenant_isolation_select" ON ${tableName}
  FOR SELECT
  USING (
    ${tenantColumn}::text = public.current_tenant()
    OR public.current_tenant() IS NULL
    OR public.current_tenant() = ''
  );

CREATE POLICY "${tableName}_tenant_isolation_insert" ON ${tableName}
  FOR INSERT
  WITH CHECK (
    ${tenantColumn}::text = public.current_tenant()
    OR public.current_tenant() IS NULL
    OR public.current_tenant() = ''
  );

CREATE POLICY "${tableName}_tenant_isolation_update" ON ${tableName}
  FOR UPDATE
  USING (
    ${tenantColumn}::text = public.current_tenant()
    OR public.current_tenant() IS NULL
    OR public.current_tenant() = ''
  )
  WITH CHECK (
    ${tenantColumn}::text = public.current_tenant()
    OR public.current_tenant() IS NULL
    OR public.current_tenant() = ''
  );

CREATE POLICY "${tableName}_tenant_isolation_delete" ON ${tableName}
  FOR DELETE
  USING (
    ${tenantColumn}::text = public.current_tenant()
    OR public.current_tenant() IS NULL
    OR public.current_tenant() = ''
  );
`;
}
