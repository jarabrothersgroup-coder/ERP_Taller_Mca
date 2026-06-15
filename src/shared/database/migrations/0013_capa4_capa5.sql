-- Migration 0013: CAPA 4-5 — Audit Log, Cost Centers
--
-- Tables for:
--   1. Audit Log (auditoría APPEND-ONLY) — CAPA 4 Compliance
--   2. Cost Centers (centros de costo jerárquicos) — CAPA 5 Costing
--
-- Dependencies: migration 0012 (sprint4)

-- ─── 1. AUDIT LOG (CAPA 4) ────────────────────

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_slug" text NOT NULL,
  "usuario_id" text NOT NULL,
  "ip" text,
  "accion" text NOT NULL,
  "entidad" text NOT NULL,
  "entidad_id" text NOT NULL,
  "valor_anterior" jsonb,
  "valor_nuevo" jsonb,
  "descripcion" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_log_tenant_idx"
  ON "audit_log" ("tenant_slug");

CREATE INDEX IF NOT EXISTS "audit_log_entidad_idx"
  ON "audit_log" ("entidad", "entidad_id");

CREATE INDEX IF NOT EXISTS "audit_log_accion_idx"
  ON "audit_log" ("accion");

CREATE INDEX IF NOT EXISTS "audit_log_created_idx"
  ON "audit_log" ("created_at");

CREATE INDEX IF NOT EXISTS "audit_log_usuario_idx"
  ON "audit_log" ("usuario_id");

COMMENT ON TABLE "audit_log" IS 'APPEND-ONLY: registro inmutable de operaciones críticas contables';

-- ─── 2. CENTROS DE COSTO (CAPA 5) ─────────────

CREATE TABLE IF NOT EXISTS "centros_costo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo" text NOT NULL,
  "nombre" text NOT NULL,
  "descripcion" text,
  "centro_padre_id" uuid,
  "activo" boolean NOT NULL DEFAULT true,
  "tenant_slug" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "centros_costo_codigo_tenant_idx"
  ON "centros_costo" ("codigo", "tenant_slug");

CREATE INDEX IF NOT EXISTS "centros_costo_padre_idx"
  ON "centros_costo" ("centro_padre_id");

CREATE INDEX IF NOT EXISTS "centros_costo_tenant_slug_idx"
  ON "centros_costo" ("tenant_slug");

CREATE INDEX IF NOT EXISTS "centros_costo_activo_idx"
  ON "centros_costo" ("activo");

COMMENT ON TABLE "centros_costo" IS 'Centros de costo jerárquicos para contabilidad analítica';
