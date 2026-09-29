-- Migration 0028: tablas huérfanas de marketing + fleet
-- Fase 4 · T-42/T-46 — "CRUD y features huérfanas".
--
-- Contexto: los servicios de marketing (campañas, secuencias, fidelización,
-- reseñas) y fleet (flotas, contratos) ejecutan SQL crudo (y el esquema
-- Drizzle de sequences/fleet-contracts ya estaba definido en src/), pero
-- NINGUNA de estas tablas llegó a migrarse: 11 tablas referenciadas no
-- existían en la base, por lo que cada endpoint de esos módulos fallaba con
-- "relation does not exist" (500).
--
-- Cobertura por servicio:
--   campaign.service.ts    → marketing_campaigns
--   sequence.service.ts    → marketing_sequences / _steps / _enrollments / _log
--   loyalty.service.ts     → loyalty_accounts / loyalty_transactions / loyalty_rewards
--   google-reviews.service.ts → google_reviews
--   fleet.service.ts       → fleets
--   recurring-billing.service.ts → fleet_contracts
--
-- Idempotente (IF NOT EXISTS) para poder aplicarla sobre bases donde alguna
-- tabla haya sido creada manualmente.

-- ─── Marketing: campañas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'email', 'sms')),
  mensaje TEXT NOT NULL,
  programada_at TIMESTAMPTZ,
  segmento TEXT,
  estado TEXT NOT NULL DEFAULT 'BORRADOR'
    CHECK (estado IN ('BORRADOR', 'PROGRAMADA', 'ENVIADA', 'CANCELADA')),
  enviada_at TIMESTAMPTZ,
  destinatarios INTEGER NOT NULL DEFAULT 0,
  enviados INTEGER NOT NULL DEFAULT 0,
  fallidos INTEGER NOT NULL DEFAULT 0,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mkt_campaigns_tenant_idx
  ON marketing_campaigns (tenant_slug, created_at DESC);

-- ─── Marketing: secuencias (drizzle: marketing/schema/sequences.ts) ──
CREATE TABLE IF NOT EXISTS marketing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  trigger_event TEXT NOT NULL DEFAULT 'manual',
  estado TEXT NOT NULL DEFAULT 'ACTIVO',
  total_enrolled INTEGER NOT NULL DEFAULT 0,
  total_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mkt_seq_tenant_idx ON marketing_sequences (tenant_slug);
CREATE INDEX IF NOT EXISTS mkt_seq_trigger_idx ON marketing_sequences (trigger_event);

CREATE TABLE IF NOT EXISTS marketing_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES marketing_sequences(id) ON DELETE CASCADE,
  tenant_slug TEXT NOT NULL,
  orden INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL,
  asunto TEXT,
  mensaje TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mkt_seq_step_seq_idx ON marketing_sequence_steps (sequence_id);

CREATE TABLE IF NOT EXISTS marketing_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES marketing_sequences(id) ON DELETE CASCADE,
  tenant_slug TEXT NOT NULL,
  cliente_id TEXT,
  cliente_nombre TEXT,
  cliente_phone TEXT,
  cliente_email TEXT,
  estado TEXT NOT NULL DEFAULT 'ACTIVO',
  current_step INTEGER NOT NULL DEFAULT 0,
  next_action_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mkt_seq_enroll_seq_idx ON marketing_sequence_enrollments (sequence_id);
CREATE INDEX IF NOT EXISTS mkt_seq_enroll_next_idx ON marketing_sequence_enrollments (next_action_at);
CREATE INDEX IF NOT EXISTS mkt_seq_enroll_estado_idx ON marketing_sequence_enrollments (estado);

CREATE TABLE IF NOT EXISTS marketing_sequence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES marketing_sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES marketing_sequence_steps(id) ON DELETE CASCADE,
  tenant_slug TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'SENT',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS mkt_seq_log_enroll_idx ON marketing_sequence_log (enrollment_id);

-- ─── Marketing: fidelización ─────────────────────────────────────────
-- ON CONFLICT (cliente_id, tenant_slug) de addPoints() requiere la
-- restricción única equivalente.
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL,
  puntos_actuales INTEGER NOT NULL DEFAULT 0,
  puntos_ganados_total INTEGER NOT NULL DEFAULT 0,
  nivel TEXT NOT NULL DEFAULT 'BRONCE'
    CHECK (nivel IN ('BRONCE', 'PLATA', 'ORO', 'PLATINO')),
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_accounts_unique UNIQUE (cliente_id, tenant_slug)
);

CREATE INDEX IF NOT EXISTS loyalty_accounts_tenant_idx ON loyalty_accounts (tenant_slug);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('GANADO', 'CANJEADO', 'EXPIRADO')),
  puntos INTEGER NOT NULL,
  descripcion TEXT,
  tenant_slug TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_tx_tenant_cliente_idx ON loyalty_transactions (tenant_slug, cliente_id);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  puntos_requeridos INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_rewards_tenant_idx ON loyalty_rewards (tenant_slug, puntos_requeridos);

-- ─── Marketing: reseñas de Google ────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  texto TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded BOOLEAN NOT NULL DEFAULT false,
  respuesta TEXT,
  tenant_slug TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS greviews_tenant_fecha_idx ON google_reviews (tenant_slug, fecha DESC);

-- ─── Fleet: flotas B2B (SQL crudo de fleet.service.ts) ───────────────
CREATE TABLE IF NOT EXISTS fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  empresa TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  ruc TEXT NOT NULL,
  contrato_tipo TEXT NOT NULL,
  descuento_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fleets_tenant_idx ON fleets (tenant_slug);
CREATE INDEX IF NOT EXISTS fleets_empresa_idx ON fleets (tenant_slug, empresa);

-- ─── Fleet: contratos recurrentes (drizzle: fleet/schema/fleet-contracts.ts)
CREATE TABLE IF NOT EXISTS fleet_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL,
  fleet_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  monto_mensual NUMERIC(14, 2) NOT NULL,
  ciclo_facturacion TEXT NOT NULL DEFAULT 'MENSUAL',
  dia_cobro INTEGER NOT NULL DEFAULT 1,
  proxima_factura TIMESTAMPTZ,
  estado TEXT NOT NULL DEFAULT 'ACTIVO',
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fleet_contracts_dia_cobro_ck CHECK (dia_cobro BETWEEN 1 AND 28)
);

CREATE INDEX IF NOT EXISTS fleet_contracts_tenant_idx ON fleet_contracts (tenant_slug);
CREATE INDEX IF NOT EXISTS fleet_contracts_fleet_idx ON fleet_contracts (fleet_id);
CREATE INDEX IF NOT EXISTS fleet_contracts_estado_idx ON fleet_contracts (estado);
CREATE INDEX IF NOT EXISTS fleet_contracts_proxima_idx ON fleet_contracts (proxima_factura);
