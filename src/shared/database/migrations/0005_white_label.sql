-- Migration: White-Label + SSO + Data Retention tables
-- Sprint 77: White-label + Custom Domain
-- Created: 2026-07-15

-- 1. SSO Configuration (SAML / OIDC per tenant)
CREATE TABLE IF NOT EXISTS sso_config (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL UNIQUE,
  saml_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  saml_metadata_url TEXT,
  saml_entity_id TEXT,
  saml_acs_url TEXT,
  saml_certificate TEXT,
  oidc_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  oidc_client_secret TEXT,
  oidc_scopes TEXT NOT NULL DEFAULT 'openid email profile',
  enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
  default_role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_tenant ON sso_config (tenant_slug);

-- 2. White-Label Settings (custom domain + branding)
CREATE TABLE IF NOT EXISTS white_label_config (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT,
  ssl_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  company_name TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#f97316',
  secondary_color TEXT NOT NULL DEFAULT '#1e293b',
  accent_color TEXT NOT NULL DEFAULT '#3b82f6',
  footer_text TEXT,
  privacy_policy_url TEXT,
  terms_of_service_url TEXT,
  email_from_name TEXT,
  email_from_address TEXT,
  email_header_html TEXT,
  email_footer_html TEXT,
  ios_app_id TEXT,
  android_package_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_tenant ON white_label_config (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_wl_domain ON white_label_config (custom_domain);

-- 3. Data Retention Policy (SOC2)
CREATE TABLE IF NOT EXISTS data_retention_policy (
  id TEXT PRIMARY KEY,
  tenant_slug TEXT NOT NULL UNIQUE,
  audit_log_retention_days TEXT NOT NULL DEFAULT '2555',
  email_log_retention_days TEXT NOT NULL DEFAULT '365',
  backup_retention_days TEXT NOT NULL DEFAULT '90',
  session_retention_days TEXT NOT NULL DEFAULT '30',
  auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_cleanup_at TIMESTAMP WITH TIME ZONE,
  encryption_at_rest BOOLEAN NOT NULL DEFAULT TRUE,
  encryption_in_transit BOOLEAN NOT NULL DEFAULT TRUE,
  gdpr_compliant BOOLEAN NOT NULL DEFAULT TRUE,
  data_export_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  right_to_erasure BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dr_tenant ON data_retention_policy (tenant_slug);

-- 4. Row Level Security (tenant isolation via app.current_tenant)
ALTER TABLE sso_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_config FORCE ROW LEVEL SECURITY;
CREATE POLICY sso_config_select ON sso_config
  FOR SELECT USING (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY sso_config_insert ON sso_config
  FOR INSERT WITH CHECK (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY sso_config_update ON sso_config
  FOR UPDATE USING (tenant_slug = current_setting('app.current_tenant', true));

ALTER TABLE white_label_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_config FORCE ROW LEVEL SECURITY;
CREATE POLICY white_label_config_select ON white_label_config
  FOR SELECT USING (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY white_label_config_insert ON white_label_config
  FOR INSERT WITH CHECK (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY white_label_config_update ON white_label_config
  FOR UPDATE USING (tenant_slug = current_setting('app.current_tenant', true));

ALTER TABLE data_retention_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policy FORCE ROW LEVEL SECURITY;
CREATE POLICY data_retention_policy_select ON data_retention_policy
  FOR SELECT USING (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY data_retention_policy_insert ON data_retention_policy
  FOR INSERT WITH CHECK (tenant_slug = current_setting('app.current_tenant', true));
CREATE POLICY data_retention_policy_update ON data_retention_policy
  FOR UPDATE USING (tenant_slug = current_setting('app.current_tenant', true));
