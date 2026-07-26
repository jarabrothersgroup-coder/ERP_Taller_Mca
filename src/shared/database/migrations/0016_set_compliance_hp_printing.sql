-- Migration 0016: SET compliance elements + HP LaserJet P1150 support
-- Extends invoice_config with timbrado, HP PCL5e, and SET-mandated fields

-- 1. Add SET compliance columns
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "timbrado_numero" text;
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "timbrado_vigencia_inicio" text;
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "timbrado_vigencia_fin" text;
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "condicion_venta_default" text DEFAULT 'CONTADO';
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "show_condicion_venta" boolean NOT NULL DEFAULT true;
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "show_contribuyente_iva" boolean NOT NULL DEFAULT true;
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "show_tipo_cambio" boolean NOT NULL DEFAULT false;
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "serie_prefix" text DEFAULT '001';

-- 2. Add HP LaserJet P1150 specific columns
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "printer_model" text DEFAULT 'generic';
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "cups_printer_name" text;
ALTER TABLE "invoice_config" ADD COLUMN IF NOT EXISTS "paper_tray" text DEFAULT 'Auto';

-- 3. Create print_jobs table if not exists (for reimpresion tracking)
CREATE TABLE IF NOT EXISTS "print_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "protocolo" text NOT NULL,
  "impresora" text,
  "copias" integer NOT NULL DEFAULT 1,
  "payload" text,
  "estado" text NOT NULL DEFAULT 'PENDIENTE',
  "error" text,
  "tenant_slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "print_jobs_entity_idx" ON "print_jobs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "print_jobs_tenant_idx" ON "print_jobs" ("tenant_slug");
