-- Migration 0009: Liquidaciones IRE (Formularios 500/501/502)
-- 
-- Agrega la tabla liquidaciones_ire para el cálculo del
-- Impuesto a la Renta Empresarial + Reserva Legal.
--
-- Dependencies: migration 0008 (periodos_fiscales, formulario_tipo ENUM)

CREATE TABLE IF NOT EXISTS "liquidaciones_ire" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "periodo_fiscal_id" uuid NOT NULL REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE,

  -- Ingresos Brutos
  "ingresos_servicios" numeric(14,2) DEFAULT '0' NOT NULL,
  "ingresos_bienes" numeric(14,2) DEFAULT '0' NOT NULL,
  "ingresos_no_operacionales" numeric(14,2) DEFAULT '0' NOT NULL,
  "ingresos_brutos" numeric(14,2) DEFAULT '0' NOT NULL,

  -- Costos
  "costo_repuestos" numeric(14,2) DEFAULT '0' NOT NULL,
  "costo_mano_obra" numeric(14,2) DEFAULT '0' NOT NULL,
  "costos_indirectos" numeric(14,2) DEFAULT '0' NOT NULL,
  "total_costos" numeric(14,2) DEFAULT '0' NOT NULL,

  -- Gastos Deducibles
  "gastos_administrativos" numeric(14,2) DEFAULT '0' NOT NULL,
  "gastos_ventas" numeric(14,2) DEFAULT '0' NOT NULL,
  "total_gastos" numeric(14,2) DEFAULT '0' NOT NULL,

  -- Deducciones Adicionales
  "donaciones" numeric(14,2) DEFAULT '0' NOT NULL,
  "otras_deducciones" numeric(14,2) DEFAULT '0' NOT NULL,

  -- Cálculo
  "renta_neta" numeric(14,2) DEFAULT '0' NOT NULL,
  "impuesto_ire" numeric(14,2) DEFAULT '0' NOT NULL,
  "reserva_legal" numeric(14,2) DEFAULT '0' NOT NULL,
  "retenciones" numeric(14,2) DEFAULT '0' NOT NULL,
  "anticipos" numeric(14,2) DEFAULT '0' NOT NULL,
  "saldo_pagar" numeric(14,2) DEFAULT '0' NOT NULL,
  "saldo_favor_ire" numeric(14,2) DEFAULT '0' NOT NULL,

  "alertas" text,
  "tenant_slug" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS liq_ire_periodo_idx ON liquidaciones_ire (periodo_fiscal_id);
CREATE INDEX IF NOT EXISTS liq_ire_tenant_idx ON liquidaciones_ire (tenant_slug);
