-- Migration 0015: Treasury Module (Tesorería, CxC, CxP, Flujo de Caja)
--
-- Sprint 7 — Gestión de liquidez en tiempo real.
-- Tablas en schema `public` (compartido multi-tenant):
--   1. cuentas_bancarias       — Cuentas de efectivo/bancos/billeteras
--   2. movimientos_tesoreria   — Ingresos/egresos/transferencias/ajustes
--   3. conciliacion_bancaria   — Conciliación mensual por cuenta
--   4. facturas_proveedor      — Cuentas por pagar
--   5. Campos adicionales en facturas (estado_pago, saldo_pendiente, fecha_vencimiento)
--
-- Dependencies: requires plan_cuentas and asientos_contables tables (0013+).

-- ─── Enums ───────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "tipo_cuenta_bancaria" AS ENUM (
    'CAJA_FISICA', 'CTA_CTE', 'CAJA_AHORRO', 'BILLETERA_DIGITAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "tipo_movimiento_tes" AS ENUM (
    'INGRESO', 'EGRESO', 'TRANSFERENCIA', 'AJUSTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "medio_pago" AS ENUM (
    'EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA_DEBITO', 'TARJETA_CREDITO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "estado_pago" AS ENUM (
    'PENDIENTE', 'PARCIAL', 'PAGA', 'ANULADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 1. cuentas_bancarias ────────────────────────

CREATE TABLE IF NOT EXISTS "cuentas_bancarias" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "codigo"          TEXT NOT NULL,
  "nombre"          TEXT NOT NULL,
  "tipo"            TEXT NOT NULL,
  "moneda"          TEXT NOT NULL DEFAULT 'PYG',
  "saldo_inicial"   NUMERIC NOT NULL DEFAULT 0,
  "saldo_actual"    NUMERIC NOT NULL DEFAULT 0,
  "numero_cuenta"   TEXT,
  "banco"           TEXT,
  "activo"          BOOLEAN NOT NULL DEFAULT true,
  "tenant_slug"     TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cuentas_bancarias_tenant_idx"
  ON "cuentas_bancarias" ("tenant_slug");
CREATE INDEX IF NOT EXISTS "cuentas_bancarias_activo_idx"
  ON "cuentas_bancarias" ("activo");
CREATE UNIQUE INDEX IF NOT EXISTS "cuentas_bancarias_codigo_tenant_idx"
  ON "cuentas_bancarias" ("codigo", "tenant_slug");

COMMENT ON TABLE "cuentas_bancarias" IS 'Cuentas bancarias, cajas y billeteras digitales del taller';

-- ─── 2. movimientos_tesoreria ────────────────────

CREATE TABLE IF NOT EXISTS "movimientos_tesoreria" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tipo"                TEXT NOT NULL,
  "medio_pago"          TEXT NOT NULL,
  "cuenta_id"           UUID NOT NULL REFERENCES "cuentas_bancarias"("id"),
  "cuenta_contable_id"  UUID REFERENCES "plan_cuentas"("id"),
  "monto"               NUMERIC NOT NULL,
  "moneda"              TEXT NOT NULL DEFAULT 'PYG',
  "tipo_cambio"         NUMERIC NOT NULL DEFAULT 1,
  "fecha"               TIMESTAMPTZ NOT NULL,
  "fecha_valor"         TIMESTAMPTZ,
  "concepto"            TEXT NOT NULL,
  "referencia_tipo"     TEXT,
  "referencia_id"       TEXT,
  "conciliado"          BOOLEAN NOT NULL DEFAULT false,
  "fecha_conciliacion"  TIMESTAMPTZ,
  "asiento_id"          UUID REFERENCES "asientos_contables"("id"),
  "tenant_slug"         TEXT NOT NULL,
  "created_by"          TEXT,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mov_tes_tenant_idx"
  ON "movimientos_tesoreria" ("tenant_slug");
CREATE INDEX IF NOT EXISTS "mov_tes_cuenta_idx"
  ON "movimientos_tesoreria" ("cuenta_id");
CREATE INDEX IF NOT EXISTS "mov_tes_fecha_idx"
  ON "movimientos_tesoreria" ("fecha");
CREATE INDEX IF NOT EXISTS "mov_tes_tipo_idx"
  ON "movimientos_tesoreria" ("tipo");
CREATE INDEX IF NOT EXISTS "mov_tes_conciliado_idx"
  ON "movimientos_tesoreria" ("conciliado");
CREATE INDEX IF NOT EXISTS "mov_tes_referencia_idx"
  ON "movimientos_tesoreria" ("referencia_tipo", "referencia_id");

COMMENT ON TABLE "movimientos_tesoreria" IS 'Movimientos de tesorería: ingresos, egresos, transferencias, ajustes';

-- ─── 3. conciliacion_bancaria ────────────────────

CREATE TABLE IF NOT EXISTS "conciliacion_bancaria" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cuenta_id"     UUID NOT NULL REFERENCES "cuentas_bancarias"("id"),
  "periodo"       TEXT NOT NULL,
  "saldo_libros"  NUMERIC NOT NULL,
  "saldo_banco"   NUMERIC NOT NULL,
  "diferencia"    NUMERIC NOT NULL,
  "conciliado"    BOOLEAN NOT NULL DEFAULT false,
  "tenant_slug"   TEXT NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "conc_banc_tenant_idx"
  ON "conciliacion_bancaria" ("tenant_slug");
CREATE INDEX IF NOT EXISTS "conc_banc_cuenta_periodo_idx"
  ON "conciliacion_bancaria" ("cuenta_id", "periodo");
CREATE INDEX IF NOT EXISTS "conc_banc_conciliado_idx"
  ON "conciliacion_bancaria" ("conciliado");

COMMENT ON TABLE "conciliacion_bancaria" IS 'Conciliación bancaria mensual: compara saldo libros vs extracto';

-- ─── 4. facturas_proveedor ───────────────────────

CREATE TABLE IF NOT EXISTS "facturas_proveedor" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "proveedor_id"        UUID,
  "nro_factura"         TEXT NOT NULL,
  "tipo_doc"            TEXT NOT NULL DEFAULT 'FACTURA',
  "total"               NUMERIC NOT NULL,
  "saldo_pendiente"     NUMERIC,
  "iva_monto"           NUMERIC,
  "base_imponible"      NUMERIC,
  "fecha_emision"       TIMESTAMPTZ NOT NULL,
  "fecha_vencimiento"   TIMESTAMPTZ NOT NULL,
  "estado_pago"         TEXT NOT NULL DEFAULT 'PENDIENTE',
  "concepto"            TEXT,
  "cuenta_contable_id"  UUID REFERENCES "plan_cuentas"("id"),
  "orden_trabajo_id"    TEXT,
  "tenant_slug"         TEXT NOT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "fact_prov_tenant_idx"
  ON "facturas_proveedor" ("tenant_slug");
CREATE INDEX IF NOT EXISTS "fact_prov_estado_idx"
  ON "facturas_proveedor" ("estado_pago");
CREATE INDEX IF NOT EXISTS "fact_prov_vencimiento_idx"
  ON "facturas_proveedor" ("fecha_vencimiento");
CREATE INDEX IF NOT EXISTS "fact_prov_proveedor_idx"
  ON "facturas_proveedor" ("proveedor_id");

COMMENT ON TABLE "facturas_proveedor" IS 'Facturas de proveedor pendientes de pago (Cuentas por Pagar)';

-- ─── 5. Campos adicionales en facturas (para CxC) ──

ALTER TABLE "facturas"
  ADD COLUMN IF NOT EXISTS "estado_pago" TEXT DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS "saldo_pendiente" NUMERIC,
  ADD COLUMN IF NOT EXISTS "fecha_vencimiento" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "facturas_estado_pago_idx"
  ON "facturas" ("estado_pago");
CREATE INDEX IF NOT EXISTS "facturas_vencimiento_idx"
  ON "facturas" ("fecha_vencimiento");

COMMENT ON COLUMN "facturas"."estado_pago" IS 'Estado de cobro: PENDIENTE | PARCIAL | PAGA | ANULADA';
COMMENT ON COLUMN "facturas"."saldo_pendiente" IS 'Saldo pendiente de cobro (0 si está PAGA)';
COMMENT ON COLUMN "facturas"."fecha_vencimiento" IS 'Fecha límite de pago';
