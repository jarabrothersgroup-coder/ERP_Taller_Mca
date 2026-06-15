import { runMigrations, createTenantSchema } from "../src/shared/database/migrate.js";
import { closeDb } from "../src/shared/database/connection.js";

const slug = process.argv[2];
const name = process.argv[3] || slug;

if (!slug) {
  console.error("Uso: npx tsx scripts/seed-tenant.ts <tenant-slug> [tenant-name]");
  console.error("");
  console.error("Ejemplos:");
  console.error("  npx tsx scripts/seed-tenant.ts taller-el-chero");
  console.error('  npx tsx scripts/seed-tenant.ts jara-brothers "Jara Brothers Group"');
  process.exit(1);
}

try {
  await runMigrations();
  await createTenantSchema(slug);
  console.log(`\n✅ Tenant "${name}" registrado con slug "${slug}".`);
  console.log(`   Usa el header: X-Tenant-Slug: ${slug}`);
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await closeDb();
}
