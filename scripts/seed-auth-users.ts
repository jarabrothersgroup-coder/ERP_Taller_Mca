/**
 * Seed script: Test users for NextAuth authentication.
 *
 * Creates user profiles (admin, manager, mechanic) for a given tenant slug.
 * These users can log in via the NextAuth.js sign-in page.
 *
 * Usage: npx tsx scripts/seed-auth-users.ts <tenant_slug>
 *
 * Default credentials for demo:
 *   admin@demo.com   / admin123   (admin role)
 *   manager@demo.com / admin123   (manager role)
 *   mechanic@demo.com / admin123  (mechanic role)
 *
 * @module scripts/seed-auth-users
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import { tenants, profiles } from "../src/shared/database/schema/index.js";
import { hashPassword } from "../src/modules/config/services/auth-utils.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-auth-users.ts <tenant_slug>");
  console.error("");
  console.error("Examples:");
  console.error("  npx tsx scripts/seed-auth-users.ts demo");
  console.error("  npx tsx scripts/seed-auth-users.ts taller-el-chero");
  process.exit(1);
}

interface UserDef {
  email: string;
  fullName: string;
  role: "admin" | "manager" | "mechanic" | "user";
  password: string;
}

const USERS: UserDef[] = [
  {
    email: "admin@demo.com",
    fullName: "Admin Demo",
    role: "admin",
    password: "admin123",
  },
  {
    email: "manager@demo.com",
    fullName: "Gerente Demo",
    role: "manager",
    password: "admin123",
  },
  {
    email: "mechanic@demo.com",
    fullName: "Mecánico Demo",
    role: "mechanic",
    password: "admin123",
  },
];

async function main() {
  console.log(`🔐 Seeding auth users for tenant: ${TENANT_SLUG}\n`);

  // Find tenant
  const [tenant] = await db()
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);

  if (!tenant) {
    console.error(`❌ Tenant "${TENANT_SLUG}" not found.`);
    console.error("   Run `npx tsx scripts/seed-tenant.ts <slug>` first to create the tenant.");
    process.exit(1);
  }

  console.log(`   📋 Tenant: ${tenant.name} (${tenant.slug})`);

  // Get existing profiles for this tenant
  const existing = await db()
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.tenantId, tenant.id));
  const existingEmails = new Set(existing.map((p) => p.email));

  let inserted = 0;
  let skipped = 0;

  for (const user of USERS) {
    if (existingEmails.has(user.email)) {
      console.log(`   ⏭️  Skipping ${user.email} (already exists)`);
      skipped++;
      continue;
    }

    const passwordHash = hashPassword(user.password);

    await db().insert(profiles).values({
      tenantId: tenant.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      passwordHash,
      isActive: true,
    });

    console.log(`   ✅  Created ${user.email} (${user.role}) — password: ${user.password}`);
    inserted++;
  }

  console.log(`\n🔐 Auth seed complete! ${inserted} inserted, ${skipped} skipped.`);
  console.log(`\n📝 Credenciales de prueba:`);
  console.log(`   Admin:    admin@demo.com / admin123`);
  console.log(`   Manager:  manager@demo.com / admin123`);
  console.log(`   Mechanic: mechanic@demo.com / admin123`);
  console.log(`\n   Tenant slug: ${TENANT_SLUG}`);
  console.log(`   URL login:   http://localhost:3000/sign-in`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
