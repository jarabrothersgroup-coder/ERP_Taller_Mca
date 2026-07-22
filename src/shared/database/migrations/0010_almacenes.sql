-- Migration 0010: Multi-almacén / Multi-warehouse support
-- Sprint 84 — P0-3

-- 1. Create almacenes table
CREATE TABLE IF NOT EXISTS almacenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  responsable TEXT,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS almacenes_tenant_codigo_idx ON almacenes (tenant_slug, codigo);

-- 2. Add almacen_id to repuestos
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS almacen_id UUID REFERENCES almacenes(id) ON DELETE SET NULL;

-- 3. Add almacen_id to stock_movements (origen y destino para transferencias)
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS almacen_origen_id UUID REFERENCES almacenes(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS almacen_destino_id UUID REFERENCES almacenes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sm_almacen_origen_idx ON stock_movements (almacen_origen_id);
CREATE INDEX IF NOT EXISTS sm_almacen_destino_idx ON stock_movements (almacen_destino_id);

-- 4. Create transferencias table
CREATE TABLE IF NOT EXISTS transferencias_almacen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repuesto_id UUID NOT NULL REFERENCES repuestos(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  almacen_origen_id UUID REFERENCES almacenes(id) ON DELETE SET NULL,
  almacen_destino_id UUID NOT NULL REFERENCES almacenes(id) ON DELETE CASCADE,
  orden_trabajo_id UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'COMPLETADA',
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS transferencias_tenant_idx ON transferencias_almacen (tenant_slug);
CREATE INDEX IF NOT EXISTS transferencias_origen_idx ON transferencias_almacen (almacen_origen_id);
CREATE INDEX IF NOT EXISTS transferencias_destino_idx ON transferencias_almacen (almacen_destino_id);
