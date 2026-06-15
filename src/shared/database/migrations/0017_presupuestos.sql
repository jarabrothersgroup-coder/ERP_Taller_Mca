-- Migration 0017: Presupuestos + Control de Gestión
--
-- Sprint 11 — Presupuestos por Centro de Costo + Comparativa Real vs Presupuestado
-- Nuevas tablas en schema `public` (compartido multi-tenant):
--   1. presupuestos          — Encabezado de presupuesto (período, estado)
--   2. presupuestos_items    — Líneas de presupuesto por centro de costo
--
-- Dependencies: requires centros_costo table (0007+).

-- ─── 1. presupuestos ────────────────────────────

CREATE TABLE IF NOT EXISTS "presupuestos" (
  "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "periodo"           text        NOT NULL,           -- "2026-01", "2026-Q1", "2026"
  "descripcion"       text,
  "estado"            text        NOT NULL DEFAULT 'borrador',  -- borrador | aprobado | cerrado
  "tenant_slug"       text        NOT NULL,
  "created_at"        timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "presupuestos_periodo_idx"
  ON "presupuestos" ("periodo");
CREATE INDEX IF NOT EXISTS "presupuestos_estado_idx"
  ON "presupuestos" ("estado");
CREATE INDEX IF NOT EXISTS "presupuestos_tenant_slug_idx"
  ON "presupuestos" ("tenant_slug");

-- ─── 2. presupuestos_items ──────────────────────

CREATE TABLE IF NOT EXISTS "presupuestos_items" (
  "id"                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "presupuesto_id"        uuid        NOT NULL REFERENCES "presupuestos"("id") ON DELETE CASCADE,
  "centro_costo_id"       uuid        NOT NULL REFERENCES "centros_costo"("id") ON DELETE RESTRICT,
  "categoria"             text        NOT NULL,         -- servicios | repuestos | mano_obra | fijo | otro
  "monto_presupuestado"   numeric(14,2) NOT NULL DEFAULT 0,
  "monto_real"            numeric(14,2) NOT NULL DEFAULT 0,  -- calculado vía asientos_detalle
  "notas"                 text,
  "tenant_slug"           text        NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "presupuestos_items_presupuesto_id_idx"
  ON "presupuestos_items" ("presupuesto_id");
CREATE INDEX IF NOT EXISTS "presupuestos_items_centro_costo_id_idx"
  ON "presupuestos_items" ("centro_costo_id");
CREATE INDEX IF NOT EXISTS "presupuestos_items_categoria_idx"
  ON "presupuestos_items" ("categoria");
CREATE INDEX IF NOT EXISTS "presupuestos_items_tenant_slug_idx"
  ON "presupuestos_items" ("tenant_slug");
