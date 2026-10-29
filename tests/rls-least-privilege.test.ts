/**
 * S132-8 — Prueba de humo RLS con rol least-privilege (sin BYPASSRLS).
 *
 * Auditoría canónica 2026-10-28 · BD-3: con la app conectando como
 * superuser+BYPASSRLS, las ~90 policies fail-closed de 0019/0036/0037 son
 * inertes. Este test crea un rol temporal equivalente al `erp_app` de
 * scripts/create-app-role.sql (LOGIN, NOSUPERUSER, NOBYPASSRLS) y prueba el
 * comportamiento real de las policies ANTES del flip en producción:
 *
 *   1. Fail-closed: sin contexto de tenant, las tablas RLS devuelven 0 filas
 *   2. Aislamiento efectivo: contexto slug A ve sólo A; cruce imposible
 *   3. Escritura cross-tenant viola RLS (WITH CHECK → 42501)
 *   4. Update cross-tenant afecta 0 filas (USING oculta las filas ajenas)
 *   5. Política UUID (0037, subselect slug→id): efectiva con contexto slug
 *   6. Tablas pre-auth (profiles, billing_subscriptions, billing_invoices)
 *      sin RLS → visibles sin contexto: login y webhooks de Stripe no se
 *      rompen con el rol least-privilege (criterio de exclusión de 0019)
 *
 * Requiere un usuario superuser en DATABASE_URL (lo es en el container local
 * y en el servicio de CI: POSTGRES_USER crea superuser). Se omite con skip
 * si no hay DB o si el usuario no es superuser.
 *
 * NOTA DE TOOLCHAIN: usar `getDb()\`...\`` o `const s = getDb() as any;
 * s\`...\`` — NUNCA `getDb<T>\`...\``: el toolchain (esbuild) parsea el
 * generic como type-assertion sobre el template literal y compila
 * `getDb\`...\`` (getDb invocada COMO tag → devuelve el Sql en vez de las
 * filas). `smoke<T>\`...\`` sí funciona porque el generic erasa al mismo
 * tag correcto de la instancia Sql.
 *
 * @module tests/rls-least-privilege
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { getDb } from "../src/shared/database/connection.js";

const dbUrl = process.env.DATABASE_URL ?? "";
const parsed = dbUrl ? new URL(dbUrl) : null;

const ROLE = "erp_rls_smoke";
const ROLE_PASS = "rls_smoke_test_only";
const smokeUrl = parsed
  ? `postgresql://${ROLE}:${ROLE_PASS}@${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.slice(1)}?sslmode=disable`
  : "";

// Fixtures deterministas — tenants sintéticos ajenos a los del seed
const TENANT_A = { id: "0a000000-0000-4000-8000-00000000000a", slug: "rls-smoke-a" };
const TENANT_B = { id: "0b000000-0000-4000-8000-00000000000b", slug: "rls-smoke-b" };

/** Cliente único (max:1) — set_config de sesión debe aplicarse a TODAS las queries. */
let smoke: postgres.Sql | null = null;
let isSuperuser = false;

describe.skipIf(!parsed)("S132-8 · RLS efectivo bajo rol least-privilege", () => {
  beforeAll(async () => {
    const owner = getDb();
    const [{ rolsuper }] = await owner<{ rolsuper: boolean }[]>`SELECT rolsuper FROM pg_roles WHERE rolname = CURRENT_USER`;
    isSuperuser = rolsuper;
    if (!isSuperuser) return;

    // Rol temporal equivalente a erp_app (idempotente ante corridas abortadas:
    // DROP OWNED BY revoca todos los grants del rol previo — schema/tables/
    // functions — sin los cuales DROP ROLE falla por dependencias)
    await owner.unsafe(`DROP OWNED BY ${ROLE}`).catch(() => {});
    await owner`DROP ROLE IF EXISTS ${owner(ROLE)}`;
    await owner.unsafe(`CREATE ROLE ${ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${ROLE_PASS}'`);
    await owner.unsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
    await owner.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE}`);
    await owner.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`);
    await owner`GRANT EXECUTE ON FUNCTION public.current_tenant() TO ${owner(ROLE)}`;

    // Fixtures: 2 tenants + docs fiscales (A×2, B×1) + fixed_expenses UUID (A×1, B×1)
    await owner`
      INSERT INTO tenants (id, name, slug, schema_name) VALUES
        (${TENANT_A.id}::uuid, 'RLS Smoke A', ${TENANT_A.slug}, 'rls_smoke_a'),
        (${TENANT_B.id}::uuid, 'RLS Smoke B', ${TENANT_B.slug}, 'rls_smoke_b')
      ON CONFLICT (slug) DO NOTHING`;
    await owner`
      INSERT INTO fiscal_documentos (tenant_slug, emisor_ruc, emisor_razon_social, cliente_id, receptor_ruc, receptor_razon_social, serie, numero)
      SELECT ${TENANT_A.slug}, '80011111-2', 'RLS Smoke', gen_random_uuid(), '1234567-8', 'Cliente', 'A', s.n::text
      FROM generate_series(1, 2) AS s(n)`;
    await owner`
      INSERT INTO fiscal_documentos (tenant_slug, emisor_ruc, emisor_razon_social, cliente_id, receptor_ruc, receptor_razon_social, serie, numero)
      VALUES (${TENANT_B.slug}, '80022222-3', 'RLS Smoke', gen_random_uuid(), '8765432-1', 'Cliente', 'B', '1')`;
    await owner`
      INSERT INTO fixed_expenses (tenant_id, month, year, description, amount, category) VALUES
        (${TENANT_A.id}::uuid, 10, 2026, 'rls-smoke-a', 100, 'OTROS'),
        (${TENANT_B.id}::uuid, 10, 2026, 'rls-smoke-b', 200, 'OTROS')`;

    // Cliente dedicado del rol smoke — UNA conexión para que set_config de
    // sesión persista entre queries (patrón T-21d: nunca sobre el pool shared)
    smoke = postgres(smokeUrl, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  }, 30_000);

  afterAll(async () => {
    const owner = getDb();
    if (isSuperuser) {
      // Cerrar la conexión del rol ANTES de dropearlo (si no: role in use)
      if ( smoke) await smoke.end({ timeout: 5 });
      smoke = null;
      await owner`DELETE FROM fiscal_documentos WHERE tenant_slug IN (${TENANT_A.slug}, ${TENANT_B.slug})`;
      await owner`DELETE FROM tenants WHERE slug IN (${TENANT_A.slug}, ${TENANT_B.slug})`; // cascades fixed_expenses
      // DROP OWNED BY revoca de una vez schema/tables/sequences/functions —
      // un REVOKE parcial deja dependencias que impiden DROP ROLE
      await owner.unsafe(`DROP OWNED BY ${ROLE}`);
      await owner`DROP ROLE IF EXISTS ${owner(ROLE)}`;
    }
  }, 30_000);

  it("rol smoke existe, es NOBYPASSRLS y no superuser", async () => {
    if (!isSuperuser) return;
    const owner = getDb() as any;
    const [r] = await owner`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = ${ROLE}`;
    expect(r.rolsuper).toBe(false);
    expect(r.rolbypassrls).toBe(false);
  });

  it("fail-closed: sin contexto de tenant, fiscal_documentos devuelve 0 filas", async () => {
    if (!isSuperuser || !smoke) return;
    const [{ total: asRole }] = await smoke<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM fiscal_documentos`;
    const [{ total: asOwner }] = await (getDb() as any)`
      SELECT COUNT(*)::int AS total FROM fiscal_documentos WHERE tenant_slug IN (${TENANT_A.slug}, ${TENANT_B.slug})`;
    expect(asRole).toBe(0);
    expect(asOwner).toBe(3);
  });

  it("contexto slug A: sólo ve los docs de A (aislamiento efectivo)", async () => {
    if (!isSuperuser || !smoke) return;
    await smoke`SELECT set_config('app.current_tenant', ${TENANT_A.slug}, false)`;
    const rows = await smoke<{ tenant_slug: string }[]>`SELECT tenant_slug FROM fiscal_documentos`;
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.tenant_slug))).toEqual(new Set([TENANT_A.slug]));
  });

  it("contexto slug B: no ve ningún doc de A", async () => {
    if (!isSuperuser || !smoke) return;
    await smoke`SELECT set_config('app.current_tenant', ${TENANT_B.slug}, false)`;
    const rows = await smoke<{ tenant_slug: string }[]>`SELECT tenant_slug FROM fiscal_documentos`;
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_slug).toBe(TENANT_B.slug);
  });

  it("INSERT cross-tenant viola RLS (WITH CHECK → error)", async () => {
    if (!isSuperuser || !smoke) return;
    await smoke`SELECT set_config('app.current_tenant', ${TENANT_B.slug}, false)`;
    await expect(
      smoke`
        INSERT INTO fiscal_documentos (tenant_slug, emisor_ruc, emisor_razon_social, cliente_id, receptor_ruc, receptor_razon_social, serie, numero)
        VALUES (${TENANT_A.slug}, '80011111-2', 'X', gen_random_uuid(), '1', 'X', 'HACK', '1')`,
    ).rejects.toThrow(/row-level security/i);
  });

  it("UPDATE cross-tenant afecta 0 filas (USING oculta las ajenas)", async () => {
    if (!isSuperuser || !smoke) return;
    await smoke`SELECT set_config('app.current_tenant', ${TENANT_B.slug}, false)`;
    const res = await smoke`
      UPDATE fiscal_documentos SET estado = 'ANULADO' WHERE tenant_slug = ${TENANT_A.slug}`;
    expect(res.count).toBe(0);
    // y los docs de A siguen intactos
    const [{ estado }] = await (getDb() as any)`
      SELECT estado FROM fiscal_documentos WHERE tenant_slug = ${TENANT_A.slug} LIMIT 1`;
    expect(estado).not.toBe("ANULADO");
  });

  it("política UUID (0037 subselect slug→id): efectiva con contexto slug", async () => {
    if (!isSuperuser || !smoke) return;
    // sin contexto → fail-closed
    await smoke`SELECT set_config('app.current_tenant', '', false)`;
    const [{ total: none }] = await smoke<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM fixed_expenses`;
    expect(none).toBe(0);
    // con contexto A → sólo la fila de A (subselect resuelve slug→uuid)
    await smoke`SELECT set_config('app.current_tenant', ${TENANT_A.slug}, false)`;
    const rows = await smoke<{ description: string }[]>`SELECT description FROM fixed_expenses`;
    expect(rows.map((r) => r.description)).toEqual(["rls-smoke-a"]);
  });

  it("tablas pre-auth sin RLS (profiles/billing): visibles sin contexto — webhooks y login intactos", async () => {
    if (!isSuperuser || !smoke) return;
    const rlsOff = await (getDb() as any)`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r' AND NOT c.relrowsecurity
        AND c.relname IN ('profiles', 'billing_subscriptions', 'billing_invoices')`;
    expect(rlsOff.map((r) => r.relname).sort()).toEqual(["billing_invoices", "billing_subscriptions", "profiles"]);
    // el rol least-privilege las consulta sin error (0 filas en CI fresca está bien)
    await smoke`SELECT COUNT(*)::int AS total FROM profiles`;
    await smoke`SELECT COUNT(*)::int AS total FROM billing_subscriptions`;
    await smoke`SELECT COUNT(*)::int AS total FROM billing_invoices`;
  });
});
