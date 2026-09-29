-- 0030_feature_tables.sql — tablas declaradas en Drizzle ausentes en la BD
--
-- Auditoría 2026-09-25 · Fase 4 (T-41): diff esquema Drizzle ↔ tablas reales
-- detectó 7 tablas declaradas en src/**/schema/*.ts que nunca migraron, de modo
-- que cualquier escritura/lectura sobre ellas devolvía 500
-- ("relation ... does not exist"). Idempotente (IF NOT EXISTS), sin FKs porque
-- los esquemas Drizzle correspondientes no usan .references() en columnas.
--
--   proveedores            — catálogo de proveedores (bloquea T-41)
--   billing_plans          — planes SaaS (billing)
--   billing_subscriptions  — suscripciones por tenant (billing)
--   billing_invoices       — historial de facturas de suscripción (billing)
--   crm_pipeline_stages    — etapas del pipeline (CRM)
--   crm_deals              — negocios/oportunidades (CRM)
--   mobile_push_tokens     — tokens de push (app móvil)

-- ── workshop · proveedores ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar(255) NOT NULL,
  ruc varchar(20),
  telefono varchar(30),
  email varchar(255),
  direccion text,
  tipo varchar(20) NOT NULL DEFAULT 'AMBOS',
  especialidades text DEFAULT '[]',
  calificacion integer,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  tenant_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proveedores_tenant_idx ON proveedores (tenant_slug);
CREATE INDEX IF NOT EXISTS proveedores_nombre_idx ON proveedores (nombre);
CREATE INDEX IF NOT EXISTS proveedores_ruc_idx ON proveedores (ruc);

-- ── billing · planes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly_pyg integer NOT NULL,
  price_annual_pyg integer,
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  max_users integer NOT NULL DEFAULT 5,
  max_branches integer NOT NULL DEFAULT 1,
  features jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── billing · suscripciones ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  interval text NOT NULL DEFAULT 'monthly',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  trial_end timestamptz,
  active_users integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── billing · facturas de suscripción ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  stripe_invoice_id text UNIQUE,
  stripe_subscription_id text,
  amount_pyg integer NOT NULL,
  currency text NOT NULL DEFAULT 'PYG',
  status text NOT NULL DEFAULT 'pending',
  period_label text,
  pdf_url text,
  paid_at timestamptz,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── crm · etapas del pipeline ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar(100) NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  color varchar(20) DEFAULT '#6366f1',
  activo boolean NOT NULL DEFAULT true,
  tenant_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_stages_tenant_idx ON crm_pipeline_stages (tenant_slug);

-- ── crm · negocios ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo varchar(255) NOT NULL,
  descripcion text,
  cliente_nombre varchar(255),
  cliente_email varchar(255),
  cliente_phone varchar(30),
  vehiculo_chapa varchar(20),
  vehiculo_marca varchar(100),
  vehiculo_modelo varchar(100),
  stage_id uuid NOT NULL,
  valor_estimado numeric(15, 2) DEFAULT '0',
  probabilidad integer DEFAULT 50,
  fuente varchar(50) DEFAULT 'directo',
  responsable varchar(255),
  fecha_cierre timestamptz,
  ganado boolean,
  orden_trabajo_id uuid,
  tenant_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_deals_tenant_idx ON crm_deals (tenant_slug);
CREATE INDEX IF NOT EXISTS crm_deals_stage_idx ON crm_deals (stage_id);

-- ── mobile · tokens de push ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mobile_push_tokens (
  id text PRIMARY KEY,
  tenant_slug text NOT NULL,
  device_id text NOT NULL,
  push_token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  profile_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_push_tenant_idx ON mobile_push_tokens (tenant_slug);
CREATE UNIQUE INDEX IF NOT EXISTS mobile_push_tenant_device_unique
  ON mobile_push_tokens (tenant_slug, device_id);
