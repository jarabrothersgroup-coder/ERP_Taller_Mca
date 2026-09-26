-- Migration 0023 — Terminal OT state + mechanic assignment + HUB index
--
-- 1. Add 'Finalizado_Retirado' to estado_orden enum. Legacy UIs
--    (whatsapp-ot-config.js, executive-dashboard.js) already referenced this
--    state but it was unrepresentable in the DB. ALTER TYPE ... ADD VALUE
--    cannot run inside a transaction block in PostgreSQL < 12; drizzle-kit
--    wraps statements with breakpoints so we keep it as a standalone statement.
-- 2. Add ordenes_trabajo.assigned_to — mechanic assignment consumed by the
--    Operations Hub technician filter (previously filtering on a field the
--    API never returned).
-- 3. Composite index for the Hub board query: tenant + status + recent first.

ALTER TYPE "estado_orden" ADD VALUE 'Finalizado_Retirado';--> statement-breakpoint

ALTER TABLE "ordenes_trabajo" ADD COLUMN "assigned_to" text;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ordenes_trabajo_tenant_status_created_idx"
  ON "ordenes_trabajo" ("tenant_slug", "status", "created_at" DESC);
