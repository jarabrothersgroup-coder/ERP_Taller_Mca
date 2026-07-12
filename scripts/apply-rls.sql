-- RLS tenant isolation — apply-rls.sql
-- Idempotent. Enables FORCE ROW LEVEL SECURITY on every tenant-scoped table
-- (those with a tenant_slug or tenant_id column) with a single policy that
-- allows rows when app.current_tenant matches the row's tenant column OR when
-- app.current_tenant is '' (unset). The '' escape keeps public routes,
-- migrations and system queries working — so applying this is NON-REGRESSIVE.
--
-- Real per-request isolation requires the app to set app.current_tenant on the
-- connection used for the request's queries (see docs/RUNBOOK_ONPREM.md).
-- Until then this is defense-in-depth on top of app-level tenant_slug filtering.

CREATE OR REPLACE FUNCTION public.current_tenant()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT current_setting('app.current_tenant', true);
$$;

GRANT EXECUTE ON FUNCTION public.current_tenant() TO erp_user, postgres;

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
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL'
      ' USING (%s = public.current_tenant() OR public.current_tenant() = '''')'
      ' WITH CHECK (%s = public.current_tenant() OR public.current_tenant() = '''')',
      t || '_tenant_isolation', t, tenant_col, tenant_col
    );
  END LOOP;
END $$;

COMMENT ON FUNCTION public.current_tenant() IS
  'RLS tenant context — returns app.current_tenant session var ('''' when unset).';
