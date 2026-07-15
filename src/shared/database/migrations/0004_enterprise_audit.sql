-- Migration: Enterprise Audit Trail + RLS
-- Sprint 75: SSO + 2FA + Enterprise Audit Trail
-- Created: 2026-07-15

-- 1. Create enterprise_audit_log table (immutable, append-only)
CREATE TABLE IF NOT EXISTS enterprise_audit_log (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_slug VARCHAR(100) NOT NULL,
  user_id VARCHAR(100),
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  details JSONB,
  previous_state JSONB,
  new_state JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  hash_chain VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_eal_tenant_created ON enterprise_audit_log (tenant_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_eal_user ON enterprise_audit_log (user_email);
CREATE INDEX IF NOT EXISTS idx_eal_entity ON enterprise_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_eal_action ON enterprise_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_eal_severity ON enterprise_audit_log (severity);
CREATE INDEX IF NOT EXISTS idx_eal_hash_chain ON enterprise_audit_log (hash_chain);

-- 3. Enable RLS
ALTER TABLE enterprise_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Force RLS for table owners (defense-in-depth)
ALTER TABLE enterprise_audit_log FORCE ROW LEVEL SECURITY;

-- 5. Create RLS policy using current_setting('app.current_tenant')
-- SELECT policy
CREATE POLICY enterprise_audit_log_select ON enterprise_audit_log
  FOR SELECT
  USING (tenant_slug = current_setting('app.current_tenant', true));

-- INSERT policy
CREATE POLICY enterprise_audit_log_insert ON enterprise_audit_log
  FOR INSERT
  WITH CHECK (tenant_slug = current_setting('app.current_tenant', true));

-- No UPDATE or DELETE policies — table is immutable (append-only)
-- This ensures audit trail integrity for SOC2/GDPR compliance
