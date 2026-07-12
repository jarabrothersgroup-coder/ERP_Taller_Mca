-- RLS rollback — remove-rls.sql
-- Disables RLS and drops the current_tenant() helper on every tenant-scoped
-- table. Idempotent.

DO $$
DECLARE
  r RECORD;
  t text;
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
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.current_tenant();
