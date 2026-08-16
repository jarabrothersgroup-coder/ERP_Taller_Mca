-- Migration: RLS Policies for Contabilidad (configurador_modulo + cuenta_mapping)
-- Sprint 80+ : Tenant data isolation for accounting configurators
-- Created: 2026-07-21

-- Note: configurador_modulo stores GLOBAL module registrations (shared across tenants)
-- but needs RLS for any future tenant-specific overrides. cuenta_mapping supports
-- both global (tenant_slug IS NULL) and tenant-specific overrides.

-- ═══════════════════════════════════════════════════════════════
-- 0. Self-contained tables (configurador_modulo + cuenta_mapping)
--
-- These two tables are defined in the TS schema (finance/accounting.ts)
-- but were never created by any earlier migration — they only existed in
-- environments bootstrapped via `drizzle-kit push` or manual SQL. Without
-- this block the migration sequence fails on a clean database.
-- `IF NOT EXISTS` keeps this idempotent for DBs where they already exist.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS configurador_modulo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  version TEXT,
  tenant_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS configurador_modulo_activo_idx ON configurador_modulo (activo);

CREATE TABLE IF NOT EXISTS cuenta_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT,
  modulo TEXT NOT NULL,
  tipo_evento TEXT NOT NULL,
  sub_tipo TEXT,
  cuenta_debe_id UUID NOT NULL REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  cuenta_haber_id UUID NOT NULL REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  prioridad INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cuenta_mapping_mod_tipo_idx ON cuenta_mapping (modulo, tipo_evento);
CREATE INDEX IF NOT EXISTS cuenta_mapping_full_idx ON cuenta_mapping (modulo, tipo_evento, sub_tipo);
CREATE INDEX IF NOT EXISTS cuenta_mapping_tenant_idx ON cuenta_mapping (tenant_slug);

-- ═══════════════════════════════════════════════════════════════
-- 1. RLS for configurador_modulo
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE configurador_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurador_modulo FORCE ROW LEVEL SECURITY;

-- Allow SELECT on global records (modulo is unique, no tenant_slug) OR
-- tenant-specific overrides (when tenant_slug matches current tenant)
CREATE POLICY configurador_modulo_select ON configurador_modulo
  FOR SELECT USING (
    -- Global module registrations are visible to all tenants
    -- Tenant-specific overrides match the current tenant
    current_setting('app.current_tenant', true) IS NULL OR
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

CREATE POLICY configurador_modulo_insert ON configurador_modulo
  FOR INSERT WITH CHECK (
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

CREATE POLICY configurador_modulo_update ON configurador_modulo
  FOR UPDATE USING (
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

CREATE POLICY configurador_modulo_delete ON configurador_modulo
  FOR DELETE USING (
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. RLS for cuenta_mapping
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE cuenta_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuenta_mapping FORCE ROW LEVEL SECURITY;

-- Allow SELECT on global mappings (tenant_slug IS NULL) OR
-- tenant-specific overrides (when tenant_slug matches current tenant)
CREATE POLICY cuenta_mapping_select ON cuenta_mapping
  FOR SELECT USING (
    current_setting('app.current_tenant', true) IS NULL OR
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

CREATE POLICY cuenta_mapping_insert ON cuenta_mapping
  FOR INSERT WITH CHECK (
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

CREATE POLICY cuenta_mapping_update ON cuenta_mapping
  FOR UPDATE USING (
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

CREATE POLICY cuenta_mapping_delete ON cuenta_mapping
  FOR DELETE USING (
    tenant_slug IS NULL OR
    tenant_slug = current_setting('app.current_tenant', true)
  );

-- ═══════════════════════════════════════════════════════════════
-- 3. Drop existing conflicting policies (if any from earlier migrations)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS rls_cuenta_mapping_select ON cuenta_mapping;
DROP POLICY IF EXISTS rls_cuenta_mapping_insert ON cuenta_mapping;
DROP POLICY IF EXISTS rls_cuenta_mapping_update ON cuenta_mapping;
DROP POLICY IF EXISTS rls_configurador_modulo_select ON configurador_modulo;
DROP POLICY IF EXISTS rls_configurador_modulo_insert ON configurador_modulo;
DROP POLICY IF EXISTS rls_configurador_modulo_update ON configurador_modulo;
