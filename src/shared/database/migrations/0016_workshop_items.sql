-- Migration 0016: Workshop Service Catalog + OT Items
--
-- Sprint 8 — Catálogo Servicios + OT Items + VIN Auto + Stock↔OT
-- Nuevas tablas en schema `public` (compartido multi-tenant):
--   1. servicios_catalogo      — Catálogo de servicios del taller
--   2. orden_servicios         — Line-items de servicio por OT
--   3. orden_repuestos         — Line-items de repuesto por OT
--
-- Dependencies: requires ordenes_trabajo table (0003+), repuestos table (0005+).

-- ─── 1. servicios_catalogo ──────────────────────

CREATE TABLE IF NOT EXISTS "servicios_catalogo" (
  "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "nombre"            text        NOT NULL,
  "descripcion"       text,
  "categoria"         text,
  "precio_estimado"   numeric(10,2),
  "duracion_estimada" integer,          -- minutes
  "activo"            boolean     NOT NULL DEFAULT true,
  "tenant_slug"       text        NOT NULL,
  "created_at"        timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "servicios_catalogo_tenant_slug_idx"
  ON "servicios_catalogo" ("tenant_slug");
CREATE INDEX IF NOT EXISTS "servicios_catalogo_categoria_idx"
  ON "servicios_catalogo" ("categoria");
CREATE INDEX IF NOT EXISTS "servicios_catalogo_activo_idx"
  ON "servicios_catalogo" ("activo");

-- ─── 2. orden_servicios ─────────────────────────

CREATE TABLE IF NOT EXISTS "orden_servicios" (
  "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "orden_trabajo_id"  uuid        NOT NULL REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE,
  "servicio_id"       uuid        NOT NULL REFERENCES "servicios_catalogo"("id") ON DELETE RESTRICT,
  "servicio_nombre"   text        NOT NULL,
  "cantidad"          integer     NOT NULL DEFAULT 1,
  "precio_unitario"   numeric(10,2) NOT NULL,
  "subtotal"          numeric(10,2) NOT NULL,
  "tenant_slug"       text        NOT NULL,
  "created_at"        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "orden_servicios_orden_trabajo_id_idx"
  ON "orden_servicios" ("orden_trabajo_id");
CREATE INDEX IF NOT EXISTS "orden_servicios_servicio_id_idx"
  ON "orden_servicios" ("servicio_id");
CREATE INDEX IF NOT EXISTS "orden_servicios_tenant_slug_idx"
  ON "orden_servicios" ("tenant_slug");

-- ─── 3. orden_repuestos ─────────────────────────

CREATE TABLE IF NOT EXISTS "orden_repuestos" (
  "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "orden_trabajo_id"  uuid        NOT NULL REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE,
  "repuesto_id"       uuid,                          -- optional FK to inventory
  "repuesto_nombre"   text        NOT NULL,
  "codigo"            text,                           -- denormalised SKU
  "cantidad"          integer     NOT NULL DEFAULT 1,
  "precio_unitario"   numeric(10,2) NOT NULL,
  "subtotal"          numeric(10,2) NOT NULL,
  "tenant_slug"       text        NOT NULL,
  "created_at"        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "orden_repuestos_orden_trabajo_id_idx"
  ON "orden_repuestos" ("orden_trabajo_id");
CREATE INDEX IF NOT EXISTS "orden_repuestos_tenant_slug_idx"
  ON "orden_repuestos" ("tenant_slug");
