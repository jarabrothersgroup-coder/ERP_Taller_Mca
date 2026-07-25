-- Migration 0012: Cycle Count (Conteo Cíclico de Inventario)
-- Crea las tablas necesarias para realizar tomas de inventario físico
-- con ajuste automático de stock y pista de auditoría.

-- ─── cycle_counts ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  almacen_id UUID NOT NULL REFERENCES almacenes(id),
  estado TEXT NOT NULL DEFAULT 'ABIERTO'
    CHECK (estado IN ('ABIERTO', 'EN_PROGRESO', 'COMPLETADO', 'AJUSTADO')),
  observaciones TEXT,
  creado_por UUID REFERENCES profiles(id),
  tenant_slug TEXT NOT NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cycle_cnt_tenant_idx ON cycle_counts(tenant_slug);
CREATE INDEX IF NOT EXISTS cycle_cnt_estado_idx ON cycle_counts(estado);
CREATE INDEX IF NOT EXISTS cycle_cnt_almacen_idx ON cycle_counts(almacen_id);

-- ─── cycle_count_items ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cycle_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  repuesto_id UUID NOT NULL REFERENCES repuestos(id),
  stock_sistema INTEGER NOT NULL,
  stock_real INTEGER NOT NULL,
  diferencia INTEGER NOT NULL DEFAULT 0,
  ajustado BOOLEAN NOT NULL DEFAULT FALSE,
  movimiento_ajuste_id UUID,
  observaciones TEXT,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cycle_cnt_item_cnt_idx ON cycle_count_items(cycle_count_id);
CREATE INDEX IF NOT EXISTS cycle_cnt_item_rep_idx ON cycle_count_items(repuesto_id);
CREATE INDEX IF NOT EXISTS cycle_cnt_item_tenant_idx ON cycle_count_items(tenant_slug);

-- ─── RLS policies (same pattern as other tenant-isolated tables) ──
ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cycle_counts_tenant_isolation ON cycle_counts
  USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), ''));

CREATE POLICY cycle_count_items_tenant_isolation ON cycle_count_items
  USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), ''));
