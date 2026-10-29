-- 0036_fiscal_tenant_slug.sql — columna tenant al núcleo fiscal (S132-6)
--
-- Auditoría canónica 2026-10-28 · Sala B-3 (CRÍTICO): fiscal_documentos,
-- fiscal_documento_detalles y sifen_sync_log NO tenían columna de tenant —
-- el taller se identificaba por `emisor_ruc`. El módulo más regulatorio del
-- sistema (DTE SIFEN V150, RG 90 Marangatu, Ley 1034/83) quedaba fuera del
-- aislamiento multi-tenant:
--   * una query de lectura sin filtro RUC cruzaba tenants (B-3: :60/:71/:96/
--     :105/:157/:489/:660/:673);
--   * `app.current_tenant` (slug) nunca comparaba contra emisor_ruc, así que
--     el RLS fail-closed de 0019 no cubría estas tablas (no tenían columna).
--
-- Solución (discriminador slug, consistente con sifen_contingencia_queue y con
-- el resto del esquema): tenant_slug NOT NULL + backfill desde
-- emisor_ruc → tenants.slug, índices por tenant y extensión del RLS
-- fail-closed de 0019 a las tres tablas. El código runtime (rutas y servicios
-- SIFEN/NC/contingencia/Form120) pasa a filtrar y escribir por tenantSlug.
--
-- Backfill condicional: si algún emisor_ruc no casa con ningún tenant
-- (datos huérfanos de entornos previos), las filas quedan NULL y OCULTAS
-- por el RLS fail-closed (NULL ≠ cualquier slug) — se emite un NOTICE en
-- lugar de romper la migración. En una BD fresca (CI) no hay filas y el
-- SET NOT NULL se aplica siempre.

-- ── 1. Columnas (nullable durante el backfill) ──────────────────────────

ALTER TABLE fiscal_documentos ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE fiscal_documento_detalles ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE sifen_sync_log ADD COLUMN IF NOT EXISTS tenant_slug text;

-- ── 2. Backfill desde emisor_ruc → tenants.slug ─────────────────────────

UPDATE fiscal_documentos fd
SET tenant_slug = t.slug
FROM tenants t
WHERE t.ruc = fd.emisor_ruc
  AND fd.tenant_slug IS NULL;

-- Hijos desde su documento padre (detalles y bitácora no tienen RUC)

UPDATE fiscal_documento_detalles d
SET tenant_slug = fd.tenant_slug
FROM fiscal_documentos fd
WHERE fd.id = d.documento_id
  AND d.tenant_slug IS NULL;

UPDATE sifen_sync_log l
SET tenant_slug = fd.tenant_slug
FROM fiscal_documentos fd
WHERE fd.id = l.documento_id
  AND l.tenant_slug IS NULL;

-- ── 3. NOT NULL condicional (sólo si no quedan huérfanos) ───────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscal_documentos WHERE tenant_slug IS NULL)
     AND NOT EXISTS (SELECT 1 FROM fiscal_documento_detalles WHERE tenant_slug IS NULL)
     AND NOT EXISTS (SELECT 1 FROM sifen_sync_log WHERE tenant_slug IS NULL) THEN
    ALTER TABLE fiscal_documentos ALTER COLUMN tenant_slug SET NOT NULL;
    ALTER TABLE fiscal_documento_detalles ALTER COLUMN tenant_slug SET NOT NULL;
    ALTER TABLE sifen_sync_log ALTER COLUMN tenant_slug SET NOT NULL;
  ELSE
    RAISE NOTICE '0036: quedan filas fiscales sin tenant (emisor_ruc sin match en tenants) — quedan ocultas por RLS fail-closed hasta ser asignadas';
  END IF;
END $$;

-- ── 4. Índices por tenant ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS fiscal_doc_tenant_idx ON fiscal_documentos (tenant_slug);
CREATE INDEX IF NOT EXISTS fiscal_detalle_tenant_idx ON fiscal_documento_detalles (tenant_slug);
CREATE INDEX IF NOT EXISTS sifen_log_tenant_idx ON sifen_sync_log (tenant_slug);

-- ── 5. Extensión del RLS fail-closed de 0019 a las tres tablas ──────────
-- Mismo patrón que 0019: policies comparan tenant_slug = current_tenant()
-- (slug). Mientras el rol de la app conecte con BYPASSRLS (deuda BD-3 →
-- S132-8) es defensa en profundidad; con el rol least-privilege pasa a ser
-- el aislamiento efectivo. FORCE ROW LEVEL SECURITY aplica las policies
-- también al owner de la tabla.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fiscal_documentos', 'fiscal_documento_detalles', 'sifen_sync_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL'
      ' USING (tenant_slug = public.current_tenant())'
      ' WITH CHECK (tenant_slug = public.current_tenant())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;
