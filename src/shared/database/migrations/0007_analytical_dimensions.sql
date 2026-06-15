--> statement-breakpoint
-- Migration 0007: Add analytical dimensions to asientos_detalle
--
-- Adds centro_costo_id and orden_trabajo_id_linea columns to support
-- analytical accounting (contabilidad analítica) per journal line.
-- These dimensions are mandatory for COSTO (5) and GASTO (6) account lines.
--
-- Required by: initial load, autofacturas, donaciones, stock movements
--> statement-breakpoint

ALTER TABLE "asientos_detalle"
  ADD COLUMN "centro_costo_id" uuid;
--> statement-breakpoint

ALTER TABLE "asientos_detalle"
  ADD COLUMN "orden_trabajo_id_linea" uuid;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "asientos_detalle_cc_idx" ON "asientos_detalle" ("centro_costo_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "asientos_detalle_ot_linea_idx" ON "asientos_detalle" ("orden_trabajo_id_linea");
