/**
 * Row Level Security (RLS) Middleware — PostgreSQL tenant context enforcement.
 *
 * Delegates `app.current_tenant` to the per-request transaction-context
 * middleware (transaction-context.ts) when ENABLE_REQUEST_TENANT_CONTEXT is
 * on (the default). When it is explicitly off, this hook sets NOTHING:
 *
 * T-21d / SEG-02 FIX — this hook used to run a session-scoped
 * `set_config('app.current_tenant', ..., false)` on the SHARED singleton
 * pool, so a pooled connection that served tenant A could carry A's context
 * into a later request (the pooled-connection leak). The per-request reserved
 * connection is the only sanctioned way to set the context; the shared pool
 * is never mutated here.
 *
 * With the context off, RLS policies see `current_setting(...)` = NULL and
 * (FORCE ROW LEVEL SECURITY, fail-closed) hide all rows, while tenant
 * isolation relies on application-level `tenant_slug` filtering —
 * audited by scripts/audit-tenant-filters.mjs and
 * tests/tenant-filter-audit.test.ts.
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
import { env } from "../../config/env.js";

/**
 * Fastify preHandler hook that defers tenant-context enforcement.
 *
 * Must run AFTER resolveTenant (needs `request.tenantSlug`).
 *
 * - ENABLE_REQUEST_TENANT_CONTEXT on (default): no-op — transaction-context.ts
 *   sets `app.current_tenant` on a per-request reserved connection.
 * - Explicitly off: warn once and set nothing (never mutate the shared pool).
 *
 * @see 0019_rls_security.sql for the RLS policies that consume this setting
 * @see transaction-context.ts for the sanctioned context mechanism
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

  // When the per-request tenant context is enabled, the tenant context is set
  // session-scoped on a dedicated reserved connection by the
  // transaction-context middleware (see transaction-context.ts) at the start
  // of every request. Setting it again here (session-scoped, on the shared
  // pool) would re-introduce the pooled-connection leak we are fixing. So we
  // defer to it.
  if (env.ENABLE_REQUEST_TENANT_CONTEXT) return;

  // T-21d / SEG-02 FIX: the flag is explicitly off. Do NOT fall back to a
  // session-scoped set_config on the shared pool — that is the leak this
  // hook existed to warn about. RLS stays fail-closed (NULL context hides
  // rows under FORCE ROW LEVEL SECURITY) and tenant isolation relies on
  // app-level filters, which the tenant-filter audit enforces.
  warnContextDisabledOnce();
}

let contextDisabledWarned = false;

function warnContextDisabledOnce(): void {
  if (contextDisabledWarned) return;
  contextDisabledWarned = true;
  console.warn(
    "[RLS] ENABLE_REQUEST_TENANT_CONTEXT is off: app.current_tenant is NOT set " +
      "(RLS policies fail closed to zero rows). Tenant isolation relies on " +
      "app-level tenant_slug filters — see scripts/audit-tenant-filters.mjs.",
  );
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
 *
 * FAIL-CLOSED: no `OR current_tenant() = ''` escape hatch (audit CRITICAL-3).
 * When `app.current_tenant` is unset (NULL), no rows are visible — a missing
 * tenant context blocks access instead of opening the whole table.
 *
 * Only use for tables that are NEVER read pre-auth (login/webhook bootstrap).
 * Pre-auth bootstrap tables (profiles, facturas, ...) must stay app-filtered.
 * See migration 0019_rls_security.sql.
 */
export function generateRlsPolicySql(
  tableName: string,
  tenantColumn: string = "tenant_slug",
): string {
  return `
-- RLS policy for ${tableName}
-- Enforces tenant isolation at database level (fail-closed — no escape hatch).

-- Enable RLS
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (defense in depth)
ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;

-- SELECT policy — only allow rows matching current tenant
CREATE POLICY "${tableName}_tenant_isolation_select" ON ${tableName}
  FOR SELECT
  USING (${tenantColumn} = public.current_tenant());

-- INSERT policy — enforce tenant_slug matches session
CREATE POLICY "${tableName}_tenant_isolation_insert" ON ${tableName}
  FOR INSERT
  WITH CHECK (${tenantColumn} = public.current_tenant());

-- UPDATE policy — enforce tenant_slug matches session
CREATE POLICY "${tableName}_tenant_isolation_update" ON ${tableName}
  FOR UPDATE
  USING (${tenantColumn} = public.current_tenant())
  WITH CHECK (${tenantColumn} = public.current_tenant());

-- DELETE policy — enforce tenant_slug matches session
CREATE POLICY "${tableName}_tenant_isolation_delete" ON ${tableName}
  FOR DELETE
  USING (${tenantColumn} = public.current_tenant());
`;
}

/**
 * SQL helper to generate RLS policies for tables with tenant_id (UUID FK) instead of tenant_slug.
 *
 * WARNING: `app.current_tenant` holds the tenant SLUG, never the UUID. Comparing
 * `tenant_id::text = current_tenant()` can never match, so this policy would
 * lock the table for everyone (including the correct tenant). Do NOT enable RLS
 * on tenant_id tables until the context is set to the tenant UUID.
 *
 * @param tableName - The table name
 * @param tenantColumn - The UUID column containing the tenant ID (default: 'tenant_id')
 * @returns SQL string for CREATE POLICY (fail-closed)
 */
export function generateRlsPolicyUuidSql(
  tableName: string,
  tenantColumn: string = "tenant_id",
): string {
  return `
-- RLS policy for ${tableName} (UUID tenant column)
-- WARNING: current_tenant() holds the slug, not the UUID — this policy only
-- matches when app.current_tenant is set to the tenant UUID. Verify before use.
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;

CREATE POLICY "${tableName}_tenant_isolation_select" ON ${tableName}
  FOR SELECT
  USING (
    ${tenantColumn}::text = public.current_tenant()
  );

CREATE POLICY "${tableName}_tenant_isolation_insert" ON ${tableName}
  FOR INSERT
  WITH CHECK (
    ${tenantColumn}::text = public.current_tenant()
  );

CREATE POLICY "${tableName}_tenant_isolation_update" ON ${tableName}
  FOR UPDATE
  USING (
    ${tenantColumn}::text = public.current_tenant()
  )
  WITH CHECK (
    ${tenantColumn}::text = public.current_tenant()
  );

CREATE POLICY "${tableName}_tenant_isolation_delete" ON ${tableName}
  FOR DELETE
  USING (
    ${tenantColumn}::text = public.current_tenant()
  );
`;
}
