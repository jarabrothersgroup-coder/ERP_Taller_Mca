-- Migration 0014: asiento_id on facturas + IVA rate column
--
-- Sprint 6 fixes:
--   1. Add asiento_id FK to facturas table (trace accounting entry)
--   2. Add tipo_iva column to optionally mark IVA-exempt invoices

-- ─── 1. asiento_id on facturas ──────────────────

ALTER TABLE "facturas"
  ADD COLUMN "asiento_id" uuid REFERENCES "asientos_contables"("id");

COMMENT ON COLUMN "facturas"."asiento_id" IS 'Asiento contable generado automáticamente (Auto VENTA)';

-- Index for quick lookup of invoices by accounting entry
CREATE INDEX IF NOT EXISTS "facturas_asiento_idx"
  ON "facturas" ("asiento_id");
