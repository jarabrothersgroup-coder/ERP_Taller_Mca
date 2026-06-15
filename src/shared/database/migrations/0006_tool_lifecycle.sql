-- ═══════════════════════════════════════════════════════════════════════════════════
-- Migration 0006: Tool Lifecycle Management
-- 
-- Adds individual tool asset tracking (tool_instances), service events,
-- depreciation tracking, and expands the control_herramientas system.
--
-- Changes:
--   1. New tables: tool_instances, tool_maintenance_events, tool_depreciation_entries
--   2. Expanded estado_control_herramienta enum (3 new return states)
--   3. New columns in herramientas (depreciation fields, removed stock counters)
--   4. New columns in control_herramientas (instance FK, return conditions, accounting)
--   5. Migration of existing tool checkout data where possible
-- ═══════════════════════════════════════════════════════════════════════════════════

-- ── 1. New Types ────────────────────────────────────────────────────────────

-- No new top-level enums needed; tool instance states are TEXT with CHECK constraint
-- managed at the application layer.

-- ── 2. Expand Existing Enum ─────────────────────────────────────────────────

ALTER TYPE "public"."estado_control_herramienta" 
  ADD VALUE IF NOT EXISTS 'Devuelto_Bueno';
ALTER TYPE "public"."estado_control_herramienta" 
  ADD VALUE IF NOT EXISTS 'Devuelto_Desgastado';
ALTER TYPE "public"."estado_control_herramienta" 
  ADD VALUE IF NOT EXISTS 'Devuelto_Danado';

-- ── 3. New Tables ────────────────────────────────────────────────────────────

-- ═══ tool_instances — Individual physical tool assets ═══
CREATE TABLE IF NOT EXISTS "tool_instances" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "herramienta_id"      uuid NOT NULL REFERENCES "herramientas"(id) ON DELETE RESTRICT,
  
  -- Physical identification
  "numero_serie"        text NOT NULL,
  "tag_rfid"            text,
  "codigo_barras"       text,
  "codigo_inventario"   text,
  
  -- Cost & valuation
  "costo_adquisicion"   numeric(12,2) NOT NULL DEFAULT '0',
  "fecha_adquisicion"   date NOT NULL,
  "valor_actual_libros" numeric(12,2) NOT NULL DEFAULT '0',
  "ultima_depreciacion" date,
  
  -- State machine
  "estado_actual"       text NOT NULL DEFAULT 'DISPONIBLE',
  "ubicacion_actual"    text,
  
  -- Calibration
  "requiere_calibracion"           boolean NOT NULL DEFAULT false,
  "ultima_calibracion"             date,
  "proxima_calibracion"            date,
  "dias_intervalo_calibracion"     numeric,
  
  -- Lifecycle
  "activa"              boolean NOT NULL DEFAULT true,
  "fecha_baja"          date,
  "motivo_baja"         text,
  "asiento_baja_id"     uuid REFERENCES "asientos_contables"(id),
  
  -- Current custodian (denormalised for fast queries)
  "tecnico_actual_id"         uuid REFERENCES "profiles"(id),
  "orden_trabajo_actual_id"   uuid,
  
  -- Accounting integration
  "categoria_contable_id" uuid REFERENCES "plan_cuentas"(id),
  
  -- Multi-tenant
  "tenant_slug"         text NOT NULL,
  
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now(),

  -- Unique constraints
  CONSTRAINT "tool_instances_herramienta_serie_unique" 
    UNIQUE ("herramienta_id", "numero_serie")
);

-- Indexes for tool_instances
CREATE INDEX IF NOT EXISTS "tool_instances_estado_idx" 
  ON "tool_instances"("estado_actual");
CREATE INDEX IF NOT EXISTS "tool_instances_tenant_estado_idx" 
  ON "tool_instances"("tenant_slug", "estado_actual");
CREATE INDEX IF NOT EXISTS "tool_instances_herramienta_idx" 
  ON "tool_instances"("herramienta_id");
CREATE INDEX IF NOT EXISTS "tool_instances_tecnico_idx" 
  ON "tool_instances"("tecnico_actual_id");
CREATE INDEX IF NOT EXISTS "tool_instances_prox_cal_idx" 
  ON "tool_instances"("proxima_calibracion");
CREATE INDEX IF NOT EXISTS "tool_instances_activa_idx" 
  ON "tool_instances"("activa");

-- Unique indexes for optional identifiers
CREATE UNIQUE INDEX IF NOT EXISTS "tool_instances_rfid_unique" 
  ON "tool_instances"("tag_rfid") WHERE "tag_rfid" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tool_instances_barcode_unique" 
  ON "tool_instances"("codigo_barras") WHERE "codigo_barras" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tool_instances_inventario_unique" 
  ON "tool_instances"("codigo_inventario") WHERE "codigo_inventario" IS NOT NULL;

-- ═══ tool_maintenance_events — Calibration, repair, PM records ═══
CREATE TABLE IF NOT EXISTS "tool_maintenance_events" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tool_instance_id"      uuid NOT NULL REFERENCES "tool_instances"(id) ON DELETE CASCADE,
  "tipo"                  text NOT NULL,
  "estado"                text NOT NULL DEFAULT 'PROGRAMADO',
  "fecha_inicio"          timestamptz NOT NULL DEFAULT now(),
  "fecha_fin"             timestamptz,
  "proveedor"             text,
  "numero_orden_externa"  text,
  "costo"                 numeric(12,2),
  "asiento_costo_id"      uuid REFERENCES "asientos_contables"(id),
  "resultado"             text,
  "certificado_url"       text,
  "observaciones"         text,
  "realizada_por_id"      uuid REFERENCES "profiles"(id),
  "tenant_slug"           text NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tool_maint_instance_idx" 
  ON "tool_maintenance_events"("tool_instance_id");
CREATE INDEX IF NOT EXISTS "tool_maint_tipo_idx" 
  ON "tool_maintenance_events"("tipo");
CREATE INDEX IF NOT EXISTS "tool_maint_estado_idx" 
  ON "tool_maintenance_events"("estado");
CREATE INDEX IF NOT EXISTS "tool_maint_fecha_idx" 
  ON "tool_maintenance_events"("fecha_inicio");
CREATE INDEX IF NOT EXISTS "tool_maint_tenant_idx" 
  ON "tool_maintenance_events"("tenant_slug");

-- ═══ tool_depreciation_entries — Monthly depreciation trail ═══
CREATE TABLE IF NOT EXISTS "tool_depreciation_entries" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tool_instance_id"      uuid NOT NULL REFERENCES "tool_instances"(id) ON DELETE CASCADE,
  "fecha"                 date NOT NULL,
  "periodo"               text NOT NULL,
  "valor_inicial"         numeric(12,2) NOT NULL,
  "valor_final"           numeric(12,2) NOT NULL,
  "monto_depreciacion"    numeric(12,2) NOT NULL,
  "asiento_id"            uuid REFERENCES "asientos_contables"(id),
  "tenant_slug"           text NOT NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tool_depr_instance_idx" 
  ON "tool_depreciation_entries"("tool_instance_id");
CREATE INDEX IF NOT EXISTS "tool_depr_periodo_idx" 
  ON "tool_depreciation_entries"("periodo");
CREATE INDEX IF NOT EXISTS "tool_depr_fecha_idx" 
  ON "tool_depreciation_entries"("fecha");
CREATE INDEX IF NOT EXISTS "tool_depr_tenant_idx" 
  ON "tool_depreciation_entries"("tenant_slug");

-- ── 4. Alter Existing Tables ──────────────────────────────────────────────

-- ═══ herramientas — Add depreciation/accounting fields ═══
ALTER TABLE "herramientas" 
  ADD COLUMN IF NOT EXISTS "tiene_serial_individual" boolean NOT NULL DEFAULT true;
ALTER TABLE "herramientas" 
  ADD COLUMN IF NOT EXISTS "vida_util_anos" integer;
ALTER TABLE "herramientas" 
  ADD COLUMN IF NOT EXISTS "metodo_depreciacion" text NOT NULL DEFAULT 'LINEA_RECTA';
ALTER TABLE "herramientas" 
  ADD COLUMN IF NOT EXISTS "costo_reposicion" numeric(12,2);
ALTER TABLE "herramientas" 
  ADD COLUMN IF NOT EXISTS "categoria_contable_id" uuid REFERENCES "plan_cuentas"(id);

-- ═══ WARNING: stock_total and stock_disponible are kept for backward compat ═══
-- but are no longer managed by the application. They will be removed in a future
-- migration once all tools are migrated to tool_instances.
-- ALTER TABLE "herramientas" DROP COLUMN "stock_total";
-- ALTER TABLE "herramientas" DROP COLUMN "stock_disponible";

-- ═══ control_herramientas — Add instance FK and condition fields ═══
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "tool_instance_id" uuid REFERENCES "tool_instances"(id) ON DELETE RESTRICT;
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "fecha_esperada_devolucion" timestamptz;
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "condicion_salida" text;
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "condicion_retorno" text;
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "requiere_reparacion" boolean NOT NULL DEFAULT false;
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "costo_reparacion" numeric(12,2);
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "asiento_danio_id" uuid REFERENCES "asientos_contables"(id);
ALTER TABLE "control_herramientas" 
  ADD COLUMN IF NOT EXISTS "tenant_slug" text NOT NULL DEFAULT '';

-- New indexes for control_herramientas
CREATE INDEX IF NOT EXISTS "ctrl_herramientas_tool_instance_idx" 
  ON "control_herramientas"("tool_instance_id");
CREATE INDEX IF NOT EXISTS "ctrl_herramientas_active_loan_idx" 
  ON "control_herramientas"("fecha_devolucion", "tool_instance_id");
CREATE INDEX IF NOT EXISTS "ctrl_herramientas_tenant_idx" 
  ON "control_herramientas"("tenant_slug");

-- ── 5. Migrate Existing Checkout Data ─────────────────────────────────────

-- For existing control_herramientas rows that have a herramienta_id but no
-- tool_instance_id, create stub tool_instances based on the herramienta data.
-- This is a best-effort migration for legacy data.

DO $$
DECLARE
  ch_record RECORD;
  new_instance_id uuid;
  first_instance_for_sku boolean;
BEGIN
  FOR ch_record IN 
    SELECT ch.id, ch.herramienta_id, h.numero_serie, h.costo_reposicion, h.created_at
    FROM control_herramientas ch
    JOIN herramientas h ON h.id = ch.herramienta_id
    WHERE ch.tool_instance_id IS NULL
  LOOP
    -- Check if a tool_instance already exists for this herramienta_id
    SELECT EXISTS(
      SELECT 1 FROM tool_instances WHERE herramienta_id = ch_record.herramienta_id
    ) INTO first_instance_for_sku;
    
    IF NOT first_instance_for_sku THEN
      -- Create a stub tool_instance for the SKU
      INSERT INTO tool_instances (
        herramienta_id, numero_serie, costo_adquisicion, fecha_adquisicion,
        valor_actual_libros, estado_actual, activa, tenant_slug
      ) VALUES (
        ch_record.herramienta_id,
        COALESCE(ch_record.numero_serie, 'LEGACY-' || ch_record.herramienta_id),
        COALESCE(ch_record.costo_reposicion, '0'),
        COALESCE(ch_record.created_at::date, CURRENT_DATE),
        COALESCE(ch_record.costo_reposicion, '0'),
        'DISPONIBLE', true, 'taller-el-chero'
      )
      RETURNING id INTO new_instance_id;
    ELSE
      -- Use the first existing instance for this SKU
      SELECT id INTO new_instance_id 
      FROM tool_instances 
      WHERE herramienta_id = ch_record.herramienta_id 
      LIMIT 1;
    END IF;

    -- Update the control record to link to the instance
    UPDATE control_herramientas 
    SET tool_instance_id = new_instance_id
    WHERE id = ch_record.id;
  END LOOP;
END $$;

-- ── 6. Data Migration for Old Enum Values ─────────────────────────────────

-- Migrate old 'Devuelto' → 'Devuelto_Bueno'
UPDATE "control_herramientas" 
SET "estado" = 'Devuelto_Bueno' 
WHERE "estado" = 'Devuelto';

-- Migrate old 'Dañado' → 'Devuelto_Danado'
UPDATE "control_herramientas" 
SET "estado" = 'Devuelto_Danado' 
WHERE "estado" = 'Dañado';

-- ═══════════════════════════════════════════════════════════════════════════════════
-- Migration complete.
-- ═══════════════════════════════════════════════════════════════════════════════════
