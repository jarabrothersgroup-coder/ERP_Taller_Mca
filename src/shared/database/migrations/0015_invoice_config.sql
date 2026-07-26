-- Migration 0015: Invoice print configuration + printer protocol expansion
-- Adds invoice_config table for per-tenant invoice print settings
-- Extends printer_protocol enum with PDF and PCL for HP LaserJet support
-- Extends label_type enum with FACTURA type

-- 1. Update printer_protocol enum to add PDF and PCL
ALTER TYPE "printer_protocol" ADD VALUE IF NOT EXISTS 'PDF' BEFORE 'RAW_TEXT';
ALTER TYPE "printer_protocol" ADD VALUE IF NOT EXISTS 'PCL' BEFORE 'RAW_TEXT';

-- 2. Update label_type enum to add FACTURA
ALTER TYPE "label_type" ADD VALUE IF NOT EXISTS 'FACTURA' AFTER 'HERRAMIENTA';

-- 3. Create invoice_config table
CREATE TABLE IF NOT EXISTS "invoice_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_slug" text NOT NULL UNIQUE,
  "paper_width_mm" integer NOT NULL DEFAULT 80,
  "paper_height_mm" integer NOT NULL DEFAULT 200,
  "printer_protocol" text NOT NULL DEFAULT 'ESCPOS',
  "printer_address" text,
  "printer_dpi" integer NOT NULL DEFAULT 203,
  "show_company_header" boolean NOT NULL DEFAULT true,
  "show_client_info" boolean NOT NULL DEFAULT true,
  "show_line_items" boolean NOT NULL DEFAULT true,
  "show_subtotal" boolean NOT NULL DEFAULT true,
  "show_iva" boolean NOT NULL DEFAULT true,
  "show_barcode" boolean NOT NULL DEFAULT true,
  "show_qr_code" boolean NOT NULL DEFAULT true,
  "show_footer" boolean NOT NULL DEFAULT true,
  "show_timbrado" boolean NOT NULL DEFAULT true,
  "show_iva_per_line" boolean NOT NULL DEFAULT false,
  "show_conservation" boolean NOT NULL DEFAULT false,
  "company_nombre" text,
  "company_ruc" text,
  "company_direccion" text,
  "company_telefono" text,
  "company_actividad" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for tenant lookup
CREATE INDEX IF NOT EXISTS "invoice_config_tenant_idx" ON "invoice_config" ("tenant_slug");
