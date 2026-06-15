-- Migration 0010: Tenant Configuration
--
-- Adds tables for tenant MIC classification, IRE regime, and
-- mandatory books management per Paraguayan regulations.
--
-- Dependencies: none

-- ─── Tenant Configuration ─────────────────────
CREATE TABLE IF NOT EXISTS "tenant_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_slug" text NOT NULL,

  -- Identificación Tributaria
  "ruc" text NOT NULL DEFAULT '',
  "dv" text NOT NULL DEFAULT '',
  "razon_social" text NOT NULL DEFAULT '',

  -- Clasificación MIC
  "clasificacion_mic" text NOT NULL DEFAULT 'PEQUENIA',
  "forma_juridica" text NOT NULL DEFAULT 'UNIPERSONAL',
  "regimen_ire" text NOT NULL DEFAULT 'IRE_SIMPLE',

  -- Parámetros
  "ingresos_anuales" numeric(16,2) NOT NULL DEFAULT '0',
  "cantidad_personal" integer NOT NULL DEFAULT 0,
  "capital_integrado" numeric(14,2) NOT NULL DEFAULT '0',

  -- Control de Ejercicio
  "ejercicio_actual" integer NOT NULL DEFAULT 2026,
  "periodo_abierto_mes" integer NOT NULL DEFAULT 1,
  "cerrado_hasta_mes" integer NOT NULL DEFAULT 0,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_config_slug_unique ON tenant_config (tenant_slug);
CREATE INDEX IF NOT EXISTS tenant_config_slug_idx ON tenant_config (tenant_slug);

-- ─── Libros Obligatorios ─────────────────────
CREATE TABLE IF NOT EXISTS "libros_obligatorios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_slug" text NOT NULL,
  "libro" text NOT NULL,
  "obligatorio" boolean NOT NULL DEFAULT true,
  "rubricado" boolean NOT NULL DEFAULT false,
  "fecha_rubrica" timestamptz,
  "numero_rubrica" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS libros_obligatorios_tenant_libro_unique
  ON libros_obligatorios (tenant_slug, libro);
CREATE INDEX IF NOT EXISTS libros_obligatorios_tenant_idx
  ON libros_obligatorios (tenant_slug);
