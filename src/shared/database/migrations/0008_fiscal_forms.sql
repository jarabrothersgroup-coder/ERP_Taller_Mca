--> statement-breakpoint
-- Migration 0008: Fiscal Forms (Formularios DNIT)
--
-- Creates tables for the Fiscal Engine:
--   - periodos_fiscales: tracks declared periods per form per tenant
--   - liquidaciones_iva: Form 120 (IVA Mensual) calculation results
--
-- Required by: Form 120 liquidación mensual, IRE anual, IDU
--> statement-breakpoint

CREATE TYPE "public"."formulario_tipo" AS ENUM(
  'FORM_120_IVA', 'FORM_500_IRE', 'FORM_501_IRE_SIMPLE',
  'FORM_502_IRE_RESIMPLE', 'FORM_520_IDU', 'FORM_130_ISC', 'FORM_515_INR'
);
--> statement-breakpoint

CREATE TYPE "public"."liquidacion_estado" AS ENUM(
  'BORRADOR', 'PRESENTADO', 'PAGADO', 'RECTIFICADO'
);
--> statement-breakpoint

CREATE TABLE "periodos_fiscales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "formulario" "formulario_tipo" NOT NULL,
  "anho" integer NOT NULL,
  "mes" integer DEFAULT 0 NOT NULL,
  "estado" "liquidacion_estado" DEFAULT 'BORRADOR' NOT NULL,
  "tenant_slug" text NOT NULL,
  "fecha_presentacion" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "periodo_fiscal_unique" UNIQUE("formulario", "anho", "mes", "tenant_slug")
);
--> statement-breakpoint

CREATE TABLE "liquidaciones_iva" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "periodo_fiscal_id" uuid NOT NULL REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE,

  -- Débito Fiscal (Rubro 1)
  "ventas_gravada_10" numeric(14, 2) DEFAULT '0' NOT NULL,
  "ventas_iva_10" numeric(14, 2) DEFAULT '0' NOT NULL,
  "ventas_gravada_5" numeric(14, 2) DEFAULT '0' NOT NULL,
  "ventas_iva_5" numeric(14, 2) DEFAULT '0' NOT NULL,
  "ventas_exenta" numeric(14, 2) DEFAULT '0' NOT NULL,
  "ventas_total" numeric(14, 2) DEFAULT '0' NOT NULL,

  -- Crédito Fiscal (Rubro 2)
  "compras_gravada_10" numeric(14, 2) DEFAULT '0' NOT NULL,
  "compras_iva_10" numeric(14, 2) DEFAULT '0' NOT NULL,
  "compras_gravada_5" numeric(14, 2) DEFAULT '0' NOT NULL,
  "compras_iva_5" numeric(14, 2) DEFAULT '0' NOT NULL,
  "compras_otras" numeric(14, 2) DEFAULT '0' NOT NULL,
  "compras_total" numeric(14, 2) DEFAULT '0' NOT NULL,

  -- Liquidación (Rubro 3)
  "iva_debito" numeric(14, 2) DEFAULT '0' NOT NULL,
  "iva_credito" numeric(14, 2) DEFAULT '0' NOT NULL,
  "iva_a_pagar" numeric(14, 2) DEFAULT '0' NOT NULL,
  "saldo_favor" numeric(14, 2) DEFAULT '0' NOT NULL,

  "prorrateo_indice" numeric(5, 4),
  "saldo_arrastre" numeric(14, 2) DEFAULT '0' NOT NULL,
  "alertas" text,
  "tenant_slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "periodos_fiscales_tenant_idx" ON "periodos_fiscales" ("tenant_slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "periodos_fiscales_form_idx" ON "periodos_fiscales" ("formulario");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "liq_iva_periodo_idx" ON "liquidaciones_iva" ("periodo_fiscal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "liq_iva_tenant_idx" ON "liquidaciones_iva" ("tenant_slug");
