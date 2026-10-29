-- 0037_rls_tenant_uuid.sql — policies para tablas tenant_id (S132-7)
--
-- Auditoría canónica 2026-10-28 · Sala B-2/B-3: el RLS de 0019 excluyó
-- profiles, commission_records, fixed_expenses y payroll_summary porque
-- su discriminador es tenant_id (UUID) mientras app.current_tenant lleva
-- el SLUG — comparar tenant_id::text = current_tenant() jamás matchea y
-- bloquearía la tabla completa.
--
-- Política única de discriminador (S132-7):
--   * CANÓNICO hacia adelante: `tenant_slug` (texto) — es lo que hablan el
--     middleware (resolveTenant → app.current_tenant), ~95 tablas y las
--     policies de 0019/0036. Las 4 tablas heredadas tenant_id NO se
--     convierten (profiles es la tabla más unida del sistema); se les da
--     RLS efectivo comparando por subselect slug→id, que resuelve el UUID
--     con el MISMO contexto slug (sin lookup extra por request; la
--     subconsulta es incorrelada y tenants es una tabla diminuta).
--
-- Exclusión documentada: `profiles` queda FUERA (app-filtered) — es la
-- tabla de arranque pre-auth del login (POST /api/auth/login consulta
-- profiles sin contexto de tenant en algunos flujos); un RLS fail-closed
-- ahí rompería el login bajo S132-8 (rol sin BYPASSRLS). Mismo criterio
-- que facturas / cuentas_bancarias / movimientos_tesoreria en 0019.
--
-- Con el rol actual (erp_user + BYPASSRLS) las policies son inertes —
-- defensa en profundidad que se vuelve efectiva con el rol least-privilege
-- de S132-8.

-- ── Policies UUID vía subselect slug→id ─────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['commission_records', 'fixed_expenses', 'payroll_summary']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL'
      ' USING (tenant_id = (SELECT tn.id FROM tenants tn WHERE tn.slug = public.current_tenant()))'
      ' WITH CHECK (tenant_id = (SELECT tn.id FROM tenants tn WHERE tn.slug = public.current_tenant()))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;
