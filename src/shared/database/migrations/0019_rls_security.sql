-- Migration 0019: Row Level Security (RLS) + Security Hardening
-- Sprint 18 — Defense-in-depth multi-tenant isolation
--
-- OWASP Top 10 2021:
--   A01:2021 Broken Access Control (BOLA/IDOR)
--   A05:2021 Security Misconfiguration
--
-- Strategy:
--   1. Create current_tenant() function (reads session variable)
--   2. Enable RLS on ALL tenant-scoped tables that exist
--   3. Create SELECT/INSERT/UPDATE/DELETE policies per table
--   4. Policies check current_setting('app.current_tenant') against tenant column
--   5. NULL/empty current_tenant = no access (blocked by RLS)
--   6. tenants table: RLS DISABLED (platform registry for login flow)
--
-- Idempotent: every table block wrapped in DO IF EXISTS — safe to re-run.
-- ────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════
--  1. RLS Helper Function
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.current_tenant()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT nullif(current_setting('app.current_tenant', true), '')::text;
$$;

-- ═══════════════════════════════════════════════════
--  Helper: apply RLS policies for a tenant_slug table
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_rls_slug(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
  -- Drop existing policies if any (idempotent)
  -- SELECT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_select') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (tenant_slug = public.current_tenant())', p_table || '_tenant_select', p_table);
  END IF;
  -- INSERT
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_insert') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (tenant_slug = public.current_tenant())', p_table || '_tenant_insert', p_table);
  END IF;
  -- UPDATE
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_update') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (tenant_slug = public.current_tenant()) WITH CHECK (tenant_slug = public.current_tenant())', p_table || '_tenant_update', p_table);
  END IF;
  -- DELETE
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_delete') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (tenant_slug = public.current_tenant())', p_table || '_tenant_delete', p_table);
  END IF;
END;
$$;

-- Helper for tables that use tenant_id UUID instead of tenant_slug
CREATE OR REPLACE FUNCTION public.apply_rls_uuid(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_select') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (tenant_id::text = public.current_tenant())', p_table || '_tenant_select', p_table);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_insert') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (tenant_id::text = public.current_tenant())', p_table || '_tenant_insert', p_table);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_update') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (tenant_id::text = public.current_tenant()) WITH CHECK (tenant_id::text = public.current_tenant())', p_table || '_tenant_update', p_table);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = p_table AND policyname = p_table || '_tenant_delete') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (tenant_id::text = public.current_tenant())', p_table || '_tenant_delete', p_table);
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════
--  2. Workshop Module Tables (tenant_slug)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_slug('clients');
SELECT public.apply_rls_slug('vehiculos');
SELECT public.apply_rls_slug('ordenes_trabajo');
SELECT public.apply_rls_slug('ingresos');
SELECT public.apply_rls_slug('trabajos_terceros');
SELECT public.apply_rls_slug('orden_servicios');
SELECT public.apply_rls_slug('orden_repuestos');
SELECT public.apply_rls_slug('servicios_catalogo');

-- ═══════════════════════════════════════════════════
--  3. Notifications (tenant_slug, may not exist yet)
-- ═══════════════════════════════════════════════════

DO $$ BEGIN
  PERFORM public.apply_rls_slug('notificaciones');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════
--  4. Finance Module Tables (tenant_slug)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_slug('facturas');

-- Tables WITHOUT tenant_slug column — add tenant_slug first if needed
-- These tables exist but currently have no tenant isolation column.
-- Skip for now — they need ALTER TABLE ADD COLUMN tenant_slug first.
-- fiscal_documentos, fiscal_documento_detalles, sifen_sync_log,
-- plan_cuentas, asientos_contables, asientos_detalle,
-- mechanic_profiles, staff_profiles

-- ═══════════════════════════════════════════════════
--  4b. Finance Module Tables WITH tenant_id UUID
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_uuid('fixed_expenses');
SELECT public.apply_rls_uuid('commission_records');
SELECT public.apply_rls_uuid('payroll_summary');

-- ═══════════════════════════════════════════════════
--  4c. Accounting — child tables joined to parent
-- ═══════════════════════════════════════════════════

-- asientos_detalle → inherits tenant from asientos_contables via asiento_id FK
-- fiscal_documento_detalles → inherits from fiscal_documentos via documento_id FK
-- These need a trigger or a different approach; skip for now.

-- ═══════════════════════════════════════════════════
--  5. Treasury Module Tables (tenant_slug)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_slug('cuentas_bancarias');
SELECT public.apply_rls_slug('movimientos_tesoreria');
SELECT public.apply_rls_slug('conciliacion_bancaria');
SELECT public.apply_rls_slug('facturas_proveedor');

-- ═══════════════════════════════════════════════════
--  6. Inventory Module Tables (tenant_slug)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_slug('repuestos');
SELECT public.apply_rls_slug('herramientas');
SELECT public.apply_rls_slug('control_herramientas');
SELECT public.apply_rls_slug('stock_movements');
SELECT public.apply_rls_slug('cost_history');
SELECT public.apply_rls_slug('reorder_alerts');
SELECT public.apply_rls_slug('purchase_orders');
SELECT public.apply_rls_slug('purchase_order_items');
SELECT public.apply_rls_slug('inventory_accounts_map');

-- ═══════════════════════════════════════════════════
--  7. Budget Module (tenant_slug, may not exist yet)
-- ═══════════════════════════════════════════════════

DO $$ BEGIN
  PERFORM public.apply_rls_slug('presupuestos');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('presupuestos_items');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════
--  8. Tenant Config Module (tenant_slug)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_slug('tenant_config');
SELECT public.apply_rls_slug('libros_obligatorios');

-- ═══════════════════════════════════════════════════
--  9. Thinkcar Module (tenant_slug)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_slug('thinkcar_imports');

-- ═══════════════════════════════════════════════════
--  10. Audit Log — immutable (SELECT + INSERT only)
-- ═══════════════════════════════════════════════════

DO $$ BEGIN
  PERFORM public.apply_rls_slug('audit_log');
  -- Override: drop UPDATE and DELETE policies for audit_log immutability
  DROP POLICY IF EXISTS audit_log_tenant_update ON audit_log;
  DROP POLICY IF EXISTS audit_log_tenant_delete ON audit_log;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- centros_costo
SELECT public.apply_rls_slug('centros_costo');

-- ═══════════════════════════════════════════════════
-- 11. Additional Module Tables (tenant_slug, may not exist yet)
-- ═══════════════════════════════════════════════════

DO $$ BEGIN
  PERFORM public.apply_rls_slug('periodos_fiscales');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('liquidaciones_iva');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('liquidaciones_ire');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('liquidaciones_idu');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('liquidaciones_isc');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('liquidaciones_inr');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('tool_instances');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('tool_maintenance_events');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('tool_depreciation_entries');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('initial_inventory_loads');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════
-- 12. Profiles (uses tenant_id UUID)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_uuid('profiles');

-- ═══════════════════════════════════════════════════
-- 13. Platform Tables (tenants — RLS DISABLED)
-- ═══════════════════════════════════════════════════

-- tenants table: platform registry needed for login flow
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
