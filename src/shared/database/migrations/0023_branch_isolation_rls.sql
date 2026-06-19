-- Migration 0023: Multi-Tenant Branch Isolation + RLS Hardening
-- Sprint 54 — Fixes CRITICAL-01 and MEDIUM-03
--
-- 1. Add RLS policies to sucursales table (CRITICAL fix)
-- 2. Add FK constraint + index on ordenes_trabajo.sucursal_id
-- 3. Add sucursal_id index for cross-branch analytics
-- ────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════
--  1. RLS on sucursales (CRITICAL — was missing)
-- ═══════════════════════════════════════════════════

SELECT public.apply_rls_slug('sucursales');

-- ═══════════════════════════════════════════════════
--  2. FK constraint on ordenes_trabajo.sucursal_id
-- ═══════════════════════════════════════════════════

-- Add FK constraint (if not already present)
DO $$ BEGIN
  ALTER TABLE ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_sucursal_id_fk
    FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════
--  3. Index on sucursal_id for cross-branch queries
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_sucursal_id
  ON ordenes_trabajo(sucursal_id);

-- Composite index for branch + tenant filtering
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_tenant_sucursal
  ON ordenes_trabajo(tenant_slug, sucursal_id);

-- ═══════════════════════════════════════════════════
--  4. RLS on additional tables that were missing
-- ═══════════════════════════════════════════════════

-- Agendamientos (scheduling module)
DO $$ BEGIN
  PERFORM public.apply_rls_slug('agendamientos');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- WhatsApp logs
DO $$ BEGIN
  PERFORM public.apply_rls_slug('whatsapp_logs');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('whatsapp_error_logs');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('whatsapp_templates');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- DVI (photo inspection)
DO $$ BEGIN
  PERFORM public.apply_rls_slug('dvi_inspecciones');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('dvi_fotos');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Label templates
DO $$ BEGIN
  PERFORM public.apply_rls_slug('label_templates');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Analytics (if table exists)
DO $$ BEGIN
  PERFORM public.apply_rls_slug('analytics_events');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- CRM sync logs
DO $$ BEGIN
  PERFORM public.apply_rls_slug('crm_sync_logs');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Fleet
DO $$ BEGIN
  PERFORM public.apply_rls_slug('fleet_vehicles');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  PERFORM public.apply_rls_slug('fleet_maintenance');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
