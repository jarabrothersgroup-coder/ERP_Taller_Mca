-- Migration 0011: SIFEN Contingencia Queue + Tenant Groups
-- Sprint 86: Contingencia SIFEN + Consolidación Multi-tenant
-- Created: 2026-07-22

-- =============================================================
-- PARTE 1: SIFEN Contingencia Queue
-- =============================================================

CREATE TABLE IF NOT EXISTS sifen_contingencia_queue (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  documento_id UUID NOT NULL,
  cdc_original TEXT,
  xml_original TEXT NOT NULL,
  xml_firmado TEXT,
  serie_contingencia TEXT NOT NULL,
  numero_contingencia TEXT NOT NULL,
  dte_tipo TEXT NOT NULL DEFAULT 'FACTURA',
  total_documento TEXT NOT NULL DEFAULT '0',
  estado TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'FIRMADO', 'ENVIADO', 'ERROR')),
  cdc_asignado TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  enviado_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  intentos INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_contingencia_tenant_estado
  ON sifen_contingencia_queue (tenant_slug, estado);
CREATE INDEX IF NOT EXISTS idx_contingencia_created
  ON sifen_contingencia_queue (created_at);
CREATE INDEX IF NOT EXISTS idx_contingencia_pendientes
  ON sifen_contingencia_queue (tenant_slug, estado, intentos)
  WHERE estado IN ('PENDIENTE', 'ERROR');

-- RLS para tabla de contingencia
ALTER TABLE sifen_contingencia_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sifen_contingencia_queue FORCE ROW LEVEL SECURITY;
CREATE POLICY contingencia_select ON sifen_contingencia_queue
  FOR SELECT USING (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY contingencia_insert ON sifen_contingencia_queue
  FOR INSERT WITH CHECK (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY contingencia_update ON sifen_contingencia_queue
  FOR UPDATE USING (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY contingencia_delete ON sifen_contingencia_queue
  FOR DELETE USING (tenant_slug = current_setting('app.current_tenant', true));

-- =============================================================
-- PARTE 2: Tenant Groups (Consolidación Multi-tenant)
-- =============================================================

-- Group of tenants (e.g., a multi-shop owner group)
CREATE TABLE IF NOT EXISTS tenant_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_tenant_slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_groups_owner
  ON tenant_groups (owner_tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_groups_active
  ON tenant_groups (is_active);

-- Members of a tenant group
CREATE TABLE IF NOT EXISTS tenant_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES tenant_groups(id) ON DELETE CASCADE,
  tenant_slug TEXT NOT NULL,
  role_in_group TEXT NOT NULL DEFAULT 'MEMBER'
    CHECK (role_in_group IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(group_id, tenant_slug)
);

CREATE INDEX IF NOT EXISTS idx_tgm_group ON tenant_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_tgm_tenant ON tenant_group_members (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tgm_active ON tenant_group_members (is_active);

-- Consolidated report snapshots (cache for consolidated reports)
CREATE TABLE IF NOT EXISTS consolidated_report_snapshots (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES tenant_groups(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('BALANCE', 'PNL', 'CASH_FLOW', 'EQUITY')),
  period_anho INTEGER NOT NULL,
  period_mes INTEGER NOT NULL DEFAULT 0,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, report_type, period_anho, period_mes)
);

CREATE INDEX IF NOT EXISTS idx_crs_group ON consolidated_report_snapshots (group_id);
CREATE INDEX IF NOT EXISTS idx_crs_period ON consolidated_report_snapshots (period_anho, period_mes);

-- =============================================================
-- PARTE 3: RLS para tablas de tenant groups
-- =============================================================

ALTER TABLE tenant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tg_select ON tenant_groups
  FOR SELECT USING (
    owner_tenant_slug = current_setting('app.current_tenant', true)
    OR id IN (
      SELECT group_id FROM tenant_group_members
      WHERE tenant_slug = current_setting('app.current_tenant', true)
    )
  );
CREATE POLICY tg_insert ON tenant_groups
  FOR INSERT WITH CHECK (owner_tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY tg_update ON tenant_groups
  FOR UPDATE USING (owner_tenant_slug = current_setting('app.current_tenant', true));

ALTER TABLE tenant_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_group_members FORCE ROW LEVEL SECURITY;
CREATE POLICY tgm_select ON tenant_group_members
  FOR SELECT USING (
    tenant_slug = current_setting('app.current_tenant', true)
    OR group_id IN (
      SELECT group_id FROM tenant_group_members
      WHERE tenant_slug = current_setting('app.current_tenant', true)
    )
  );
CREATE POLICY tgm_insert ON tenant_group_members
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT id FROM tenant_groups
      WHERE owner_tenant_slug = current_setting('app.current_tenant', true)
    )
  );
CREATE POLICY tgm_update ON tenant_group_members
  FOR UPDATE USING (
    group_id IN (
      SELECT id FROM tenant_groups
      WHERE owner_tenant_slug = current_setting('app.current_tenant', true)
    )
  );

ALTER TABLE consolidated_report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidated_report_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY crs_select ON consolidated_report_snapshots
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM tenant_group_members
      WHERE tenant_slug = current_setting('app.current_tenant', true)
    )
  );
CREATE POLICY crs_insert ON consolidated_report_snapshots
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT id FROM tenant_groups
      WHERE owner_tenant_slug = current_setting('app.current_tenant', true)
    )
  );
CREATE POLICY crs_update ON consolidated_report_snapshots
  FOR UPDATE USING (
    group_id IN (
      SELECT id FROM tenant_groups
      WHERE owner_tenant_slug = current_setting('app.current_tenant', true)
    )
  );
CREATE POLICY crs_delete ON consolidated_report_snapshots
  FOR DELETE USING (
    group_id IN (
      SELECT id FROM tenant_groups
      WHERE owner_tenant_slug = current_setting('app.current_tenant', true)
    )
  );
