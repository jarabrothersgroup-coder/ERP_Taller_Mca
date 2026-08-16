-- ═══════════════════════════════════════════════════════════════════════════
-- 0019_rls_security.sql — Fail-closed RLS for all tenant-scoped tables
--
-- REPLACES scripts/apply-rls.sql (which was never versioned and used an
-- escape hatch `OR current_tenant() = ''` that allowed ALL rows when the
-- tenant context was unset — see audit CRITICAL-3).
--
-- This migration is FAIL-CLOSED: policies require the row's tenant column to
-- exactly match `app.current_tenant`. When the context is unset (NULL) no rows
-- are visible — a missing `app.current_tenant` can no longer open cross-tenant
-- reads.
--
-- Excluded tables (documented rationale):
--   * profiles, commission_records, fixed_expenses, payroll_summary
--       — tenant isolation column is tenant_id (UUID). RLS compares
--         tenant_id::text = current_tenant() where current_tenant() is the
--         SLUG, never the UUID — the policy would lock the table entirely.
--         Kept app-filtered only; enabling RLS requires setting
--         app.current_tenant to the tenant UUID (future work).
--   * facturas, cuentas_bancarias, movimientos_tesoreria
--       — read pre-auth by the Stripe/PagosPy webhook (invoice-ID lookup)
--         BEFORE the tenant is known (chicken-and-egg). RLS here would break
--         payment reconciliation. Kept app-filtered only.
--   * Tables that already have RLS (0003/0004/0005/0008) are left untouched
--     (idempotent — skipped via the `NOT EXISTS rowsecurity` guard).
--
-- NOTE: the application connects as a role with BYPASSRLS (erp_user superuser),
-- so these policies are defense-in-depth until a least-privilege app role is
-- introduced. They take effect immediately for any non-bypass role.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.current_tenant()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT current_setting('app.current_tenant', true);
$$;

-- Grant to the application role; skip roles that don't exist (portable across
-- environments where the superuser is named differently, e.g. postgres vs erp_user).
DO $$
DECLARE
  app_role text := current_user;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_user') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_tenant() TO erp_user';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.current_tenant() TO %I', app_role);
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
  t text;
  tenant_col text;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.tables c
    WHERE c.table_schema = 'public'
      AND c.table_type = 'BASE TABLE'
      -- Skip tables that already have RLS (0003/0004/0005/0008) — idempotent
      AND NOT EXISTS (
        SELECT 1 FROM pg_tables pt
        WHERE pt.schemaname = 'public' AND pt.tablename = c.table_name AND pt.rowsecurity
      )
      -- Documented exclusions (see header)
      AND c.table_name NOT IN (
        'profiles', 'commission_records', 'fixed_expenses', 'payroll_summary',
        'facturas', 'cuentas_bancarias', 'movimientos_tesoreria'
      )
      AND (
        EXISTS (SELECT 1 FROM information_schema.columns col
                WHERE col.table_schema = 'public' AND col.table_name = c.table_name AND col.column_name = 'tenant_slug')
        OR EXISTS (SELECT 1 FROM information_schema.columns col
                WHERE col.table_schema = 'public' AND col.table_name = c.table_name AND col.column_name = 'tenant_id')
      )
  LOOP
    t := r.table_name;
    IF EXISTS (SELECT 1 FROM information_schema.columns col
               WHERE col.table_schema = 'public' AND col.table_name = t AND col.column_name = 'tenant_slug') THEN
      tenant_col := 'tenant_slug';
    ELSE
      tenant_col := 'tenant_id::text';
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    -- Fail-closed: NO `OR current_tenant() = ''` escape hatch.
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL'
      ' USING (%s = public.current_tenant())'
      ' WITH CHECK (%s = public.current_tenant())',
      t || '_tenant_isolation', t, tenant_col, tenant_col
    );
  END LOOP;
END $$;

COMMENT ON FUNCTION public.current_tenant() IS
  'RLS tenant context — returns app.current_tenant session var (NULL when unset; fail-closed).';
