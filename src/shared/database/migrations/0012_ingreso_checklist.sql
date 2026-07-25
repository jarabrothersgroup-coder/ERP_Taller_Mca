-- Migration 0012: Ingreso Checklist + Presupuesto Extendido
-- P1.1: Checklist de recepción estructurado con firmas
-- P1.3: Presupuesto extensiones para flujo de aprobación

-- ═══════════════════════════════════════════════════════════════
-- 1. Ingreso Checklist — Recepción estructurada
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ingreso_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingreso_id UUID NOT NULL REFERENCES ingresos(id) ON DELETE CASCADE,
  
  -- Estado exterior por panel (JSON)
  panels JSONB NOT NULL DEFAULT '{}',
  
  -- Estado de neumáticos (JSON)
  neumaticos JSONB NOT NULL DEFAULT '{}',
  
  -- Nivel de combustible exacto (0.0 - 1.0)
  nivel_combustible_exacto NUMERIC(3,2),
  
  -- Kilometraje con foto
  kilometraje_foto BOOLEAN NOT NULL DEFAULT false,
  
  -- Accesorios presentes (JSON)
  accesorios JSONB NOT NULL DEFAULT '{}',
  
  -- Observaciones del cliente
  observaciones_cliente TEXT,
  
  -- Firma digital del cliente al recibir (Base64)
  firma_cliente TEXT,
  firma_cliente_nombre TEXT,
  firma_cliente_timestamp TIMESTAMPTZ,
  cliente_conforme BOOLEAN NOT NULL DEFAULT false,
  
  -- Firma digital al retirar
  firma_retiro TEXT,
  firma_retiro_nombre TEXT,
  firma_retiro_timestamp TIMESTAMPTZ,
  
  -- Metadata
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingreso_checklist_ingreso_idx ON ingreso_checklist (ingreso_id);
CREATE INDEX IF NOT EXISTS ingreso_checklist_tenant_idx ON ingreso_checklist (tenant_slug);

-- ═══════════════════════════════════════════════════════════════
-- 2. Presupuesto — Extensiones para flujo de aprobación (P1.3)
-- ═══════════════════════════════════════════════════════════════

-- Agregar columnas a presupuestos existentes
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS fecha_envio TIMESTAMPTZ;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMPTZ;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS orden_trabajo_id UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS metodo_aprobacion TEXT;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS total_estimado NUMERIC(14,2);

CREATE INDEX IF NOT EXISTS presupuestos_cliente_idx ON presupuestos (cliente_id);
CREATE INDEX IF NOT EXISTS presupuestos_vehicle_idx ON presupuestos (vehicle_id);
CREATE INDEX IF NOT EXISTS presupuestos_estado_idx ON presupuestos (estado);

-- ═══════════════════════════════════════════════════════════════
-- 3. OT — Firma de retiro (P1.2)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS firma_retiro TEXT;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS firma_retiro_nombre TEXT;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS firma_retiro_timestamp TIMESTAMPTZ;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS sucursal_id UUID;
