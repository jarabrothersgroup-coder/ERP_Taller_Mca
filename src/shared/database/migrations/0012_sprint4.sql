-- Migration 0012: Sprint 4 — Exchange Rates, Revaluations, Legal Reserve
--
-- Adds tables and enums for:
--   1. Exchange Rates (Tipos de Cambio) — historical forex quotes
--   2. Revaluations (Revaluo de Activos) — asset revaluation events
--
-- Also enables the accounting entry generation for:
--   - Legal Reserve (Reserva Legal) — handled by service layer
--   - Journal Consolidation (Refundición) — handled by service layer
--   - FX Adjustment (Diferencia de Cambio) — handled by service layer
--
-- Dependencies: migration 0011 (fixed_assets)

-- ─── ENUMs ─────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE moneda_extranjera AS ENUM (
    'USD', 'EUR', 'BRL', 'ARS', 'CLP', 'GBP'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fuente_tipo_cambio AS ENUM (
    'BCP', 'REFERENCIA', 'COMPRA', 'VENTA', 'MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Tipos de Cambio (Exchange Rates) ─────────

CREATE TABLE IF NOT EXISTS "tipos_cambio" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "moneda" moneda_extranjera NOT NULL,
  "fecha" timestamptz NOT NULL,
  "compra" numeric(14,2) NOT NULL,
  "venta" numeric(14,2) NOT NULL,
  "referencia" numeric(14,2),
  "fuente" fuente_tipo_cambio NOT NULL DEFAULT 'BCP',
  "tenant_slug" text NOT NULL,
  "notas" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tipos_cambio_unique"
  ON "tipos_cambio" ("moneda", "fecha", "fuente", "tenant_slug");

CREATE INDEX IF NOT EXISTS "tipos_cambio_moneda_fecha_idx"
  ON "tipos_cambio" ("moneda", "fecha");

CREATE INDEX IF NOT EXISTS "tipos_cambio_tenant_idx"
  ON "tipos_cambio" ("tenant_slug");

-- ─── Revaluaciones (Asset Revaluations) ────────

CREATE TABLE IF NOT EXISTS "revaluaciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "activo_fijo_id" uuid NOT NULL
    REFERENCES "activos_fijos"("id") ON DELETE CASCADE,
  "tenant_slug" text NOT NULL,
  "fecha" timestamptz NOT NULL,
  "valor_anterior" numeric(14,2) NOT NULL,
  "valor_nuevo" numeric(14,2) NOT NULL,
  "diferencia" numeric(14,2) NOT NULL,
  "depreciacion_acumulada_anterior" numeric(14,2),
  "asiento_id" uuid,
  "motivo" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "revaluaciones_activo_idx"
  ON "revaluaciones" ("activo_fijo_id");

CREATE INDEX IF NOT EXISTS "revaluaciones_tenant_idx"
  ON "revaluaciones" ("tenant_slug");
