-- create-app-role.sql — rol Postgres least-privilege para la app (S132-8)
--
-- Auditoría canónica 2026-10-28 · BD-3: la app conecta con `erp_user`, que en
-- los entornos gestionados (container local, servicio CI, probablemente Neon)
-- es SUPERUSER + BYPASSRLS. Con esas capacidades, todas las policies
-- fail-closed de 0019/0036/0037 son INERTES: el aislamiento efectivo es
-- únicamente el filtro de aplicación auditado por
-- scripts/audit-tenant-filters.mjs. Este script crea el rol de aplicación
-- que vuelve efectivo el RLS.
--
-- Uso (psql; requiere un usuario con CREATEROLE/superuser — erp_user lo es en
-- el container local y en el servicio de CI):
--
--   psql "$DATABASE_URL" -v app_password='<password-secreta>' \
--        -f scripts/create-app-role.sql
--
-- El password va por variable de psql (no hardcodeado en el archivo).
--
-- ── RUNBOOK de flip en producción (Neon) ──────────────────────────────────
--   1. En un console/superuser: ejecutar este archivo con un password fuerte
--      y guardarlo en el secret manager (NO en .env del repo).
--   2. Verificar con el smoke test: `npx vitest run tests/rls-least-privilege.test.ts`
--      (usa un rol temporal equivalente; correrlo apuntando DATABASE_URL a una
--      copia de staging con el rol es la prueba real).
--   3. Cambiar DATABASE_URL de la app (deploy) a usuario erp_app.
--   4. MANTENER erp_user para: migraciones (drizzle-kit), seeds y CRONS que
--      escriben sin contexto de request — ver limitación abajo.
--
-- ── Limitación operacional conocida (documentada, no bloqueante) ──────────
-- Con NOBYPASSRLS, cualquier proceso conectado como erp_app SIN contexto de
-- tenant (set_config('app.current_tenant', ...)) ve CERO filas en las ~90
-- tablas con RLS (fail-closed). Los crons/jobs que hoy corren con
-- DATABASE_URL escriben sobre esas tablas; si se apunta DATABASE_URL global a
-- erp_app deben: (a) setear contexto por tenant en cada iteración (patrón de
-- reenviarContingenciaGlobal), o (b) usar DATABASE_URL_JOB apuntando a
-- erp_user. El pool de la web (todas las rutas pasan por
-- transaction-context) sí setea contexto y queda aislado por policies.
--
-- Idempotente: re-ejecutable (DO/EXCEPTION duplicate_object, IF EXISTS,
-- GRANT repetible).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
    CREATE ROLE erp_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
    RAISE NOTICE 'Rol erp_app creado (LOGIN, NOBYPASSRLS)';
  ELSE
    RAISE NOTICE 'Rol erp_app ya existe — se refuerzan grants';
    -- Garantiza que un erp_app preexistente no tenga caps ocultas
    ALTER ROLE erp_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- Password sólo si se pasó -v app_password=... (si no, se omite y el rol queda
-- sin login hasta que se asigne — preferible a un password débil). `:{?var}`
-- comprueba existencia de la variable de psql; format+%L escapa el valor.
\if :{?app_password}
  SELECT format('ALTER ROLE erp_app PASSWORD %L', :'app_password') \gexec
  \echo 'erp_app: password asignada desde -v app_password'
\else
  \echo 'erp_app: app_password no definida — rol queda sin password (asignar antes del flip)'
\endif

-- Privilegios de esquema y objetos
GRANT USAGE ON SCHEMA public TO erp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app;

-- Funciones helper (RLS context, generadores, firmas)
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = false
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO erp_app', fn.sig);
  END LOOP;
END $$;

-- Tablas creadas DESPUÉS de este script (futuras migraciones)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO erp_app;

-- Verificación final
DO $$
DECLARE
  caps text;
BEGIN
  SELECT string_agg(rol, ', ' ORDER BY rol)
  INTO caps
  FROM pg_roles r
  CROSS JOIN LATERAL unnest(ARRAY[
    CASE WHEN r.rolsuper THEN 'SUPERUSER' END,
    CASE WHEN r.rolbypassrls THEN 'BYPASSRLS' END,
    CASE WHEN r.rolcreatedb THEN 'CREATEDB' END,
    CASE WHEN r.rolcreaterole THEN 'CREATEROLE' END
  ]) AS rol
  WHERE r.rolname = 'erp_app' AND rol IS NOT NULL;

  IF caps IS NULL THEN
    RAISE NOTICE 'erp_app OK: least-privilege (sin SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE)';
  ELSE
    RAISE WARNING 'erp_app tiene caps inesperadas: %', caps;
  END IF;
END $$;
