-- Migration 0014: Performance Indexes
-- Sprint 96 — Adds missing indexes for common query patterns
--
-- Identified via query pattern analysis:
--   - asientos_contables.tenant_slug: all multi-tenant accounting queries
--   - asientos_detalle.centro_costo_id: budget analysis (presupuestos_items JOIN)
--   - asientos_detalle.orden_trabajo_id_linea: workshop cost tracking
--   - facturas.created_at: monthly/period aggregate queries
--   - ordenes_trabajo.created_at: dashboard time-series queries
--   - clients.tenant_slug: multi-tenant client queries
--   - vehiculos.tenant_slug: multi-tenant vehicle queries

-- Note: CONCURRENTLY is NOT used here because CREATE INDEX CONCURRENTLY
-- cannot run inside a PL/pgSQL DO block. For this DB size (< 300 rows),
-- the lock time is negligible.

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN

  -- =============================================================
  -- 1. Accounting indexes
  -- =============================================================

  -- asientos_contables.tenant_slug
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='asientos_contables' AND column_name='tenant_slug'
  ) INTO col_exists;
  IF col_exists THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='asientos_tenant_slug_idx') THEN
      CREATE INDEX asientos_tenant_slug_idx ON asientos_contables (tenant_slug);
      RAISE NOTICE 'Created asientos_tenant_slug_idx';
    END IF;
  END IF;

  -- asientos_detalle.centro_costo_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='asientos_detalle' AND column_name='centro_costo_id'
  ) INTO col_exists;
  IF col_exists THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='asientos_detalle_centro_costo_idx') THEN
      CREATE INDEX asientos_detalle_centro_costo_idx ON asientos_detalle (centro_costo_id);
      RAISE NOTICE 'Created asientos_detalle_centro_costo_idx';
    END IF;
  END IF;

  -- asientos_detalle.orden_trabajo_id_linea
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='asientos_detalle' AND column_name='orden_trabajo_id_linea'
  ) INTO col_exists;
  IF col_exists THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='asientos_detalle_ot_linea_idx') THEN
      CREATE INDEX asientos_detalle_ot_linea_idx ON asientos_detalle (orden_trabajo_id_linea);
      RAISE NOTICE 'Created asientos_detalle_ot_linea_idx';
    END IF;
  END IF;

  -- =============================================================
  -- 2. Facturas — monthly aggregate queries
  -- =============================================================

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='facturas_created_at_idx') THEN
    CREATE INDEX facturas_created_at_idx ON facturas (created_at);
    RAISE NOTICE 'Created facturas_created_at_idx';
  END IF;

  -- =============================================================
  -- 3. Ordenes Trabajo — dashboard time-series
  -- =============================================================

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ordenes_trabajo_created_at_idx') THEN
    CREATE INDEX ordenes_trabajo_created_at_idx ON ordenes_trabajo (created_at);
    RAISE NOTICE 'Created ordenes_trabajo_created_at_idx';
  END IF;

  -- =============================================================
  -- 4. Clients — multi-tenant queries
  -- =============================================================

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clients' AND column_name='tenant_slug'
  ) INTO col_exists;
  IF col_exists THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='clients_tenant_slug_idx') THEN
      CREATE INDEX clients_tenant_slug_idx ON clients (tenant_slug);
      RAISE NOTICE 'Created clients_tenant_slug_idx';
    END IF;
  END IF;

  -- =============================================================
  -- 5. Vehiculos — multi-tenant queries
  -- =============================================================

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='vehiculos' AND column_name='tenant_slug'
  ) INTO col_exists;
  IF col_exists THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='vehiculos_tenant_slug_idx') THEN
      CREATE INDEX vehiculos_tenant_slug_idx ON vehiculos (tenant_slug);
      RAISE NOTICE 'Created vehiculos_tenant_slug_idx';
    END IF;
  END IF;

  -- =============================================================
  -- 6. Presupuestos — date-range queries
  -- =============================================================

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='presupuestos' AND column_name='created_at'
  ) INTO col_exists;
  IF col_exists THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='presupuestos_created_at_idx') THEN
      CREATE INDEX presupuestos_created_at_idx ON presupuestos (created_at);
      RAISE NOTICE 'Created presupuestos_created_at_idx';
    END IF;
  END IF;

  RAISE NOTICE 'Migration 0014 complete — all performance indexes created';
END $$;
