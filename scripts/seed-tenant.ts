/// <reference types="node" />
// Canonical (Architecture A): flat single schema, tenant_slug isolation.
// No per-tenant PostgreSQL schema is created — isolation is by `tenant_slug`.
//
// Database migrations are applied SEPARATELY via drizzle-kit:
//   DATABASE_URL="postgresql://…" npx drizzle-kit migrate
//
// This script only REGISTERS a new tenant (a `tenants` row + its
// `tenant_config` row). It does NOT create schemas or run migrations.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { tenants } from "../src/shared/database/schema/tenants.js";
import { tenantConfig } from "../src/modules/tenants/schema/tenant-config.js";

const slug = process.argv[2];
const name = process.argv[3] || slug;
const ruc = process.argv[4] || "";

if (!slug) {
  console.error("Uso: npx tsx scripts/seed-tenant.ts <tenant-slug> [tenant-name] [ruc]");
  console.error("");
  console.error("Ejemplos:");
  console.error("  npx tsx scripts/seed-tenant.ts taller-el-chero");
  console.error('  npx tsx scripts/seed-tenant.ts jara-brothers "Jara Brothers Group" 80012345');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL no está definido en el entorno.");
  console.error('  Exportalo antes de ejecutar, p.ej.:');
  console.error('  DATABASE_URL="postgresql://user:pass@host:5432/db" npx tsx scripts/seed-tenant.ts …');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

try {
  await db
    .insert(tenants)
    .values({ name, slug, schemaName: `tenant_${slug}`, ruc, isActive: true })
    .onConflictDoNothing({ target: tenants.slug });

  await db
    .insert(tenantConfig)
    .values({ tenantSlug: slug, ruc })
    .onConflictDoNothing({ target: tenantConfig.tenantSlug });

  console.log(`\n✅ Tenant "${name}" registrado con slug "${slug}".`);
  console.error(`   Usa el header: X-Tenant-Slug: ${slug}`);
} catch (err) {
  console.error("Error al registrar tenant:", err);
  process.exit(1);
} finally {
  await client.end();
}
