/**
 * Per-tenant email uniqueness — migration 0021.
 *
 * Verifies the multi-tenant design fix:
 *   - The SAME email may exist in DIFFERENT tenants (e.g. an accountant that
 *     manages two workshops).
 *   - The SAME email can NEVER be inserted twice in the SAME tenant
 *     (the DB constraint `profiles_tenant_id_email_unique UNIQUE (tenant_id, email)`
 *     raises 23505).
 *
 * DB-backed: requires a real PostgreSQL with migrations applied (the constraint
 * lives in the database, so a mocked db() cannot verify it). Skipped when
 * DATABASE_URL is not set.
 *
 * Run with: DATABASE_URL="postgresql://..." npx vitest run tests/unit/profiles-email-unique.test.ts
 *
 * @module tests/unit/profiles-email-unique
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { randomUUID } from "node:crypto";
import { tenants, profiles } from "../../src/shared/database/schema/index.js";
import { eq } from "drizzle-orm";

const DB_REQUIRED = "Requiere DATABASE_URL con la migración 0021 aplicada";

const dbAvailable = !!process.env["DATABASE_URL"];

let sql: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

// Tenants created by this test (cleaned up in afterAll).
const createdTenantIds: string[] = [];
const createdProfileIds: string[] = [];

async function createTenant(slug: string): Promise<string> {
  const [tenant] = await db!.insert(tenants).values({
    name: `Test ${slug}`,
    slug,
    schemaName: `tenant_${slug}`,
    ruc: "80000000-1",
  }).returning({ id: tenants.id });
  createdTenantIds.push(tenant!.id);
  return tenant!.id;
}

describe("profiles: email único por tenant (migración 0021)", () => {
  beforeAll(async () => {
    if (!dbAvailable) return;
    sql = postgres(process.env["DATABASE_URL"]!, {
      max: 1,
      connect_timeout: 5,
      ssl: process.env["DATABASE_URL"]!.includes("sslmode=disable")
        ? false
        : { rejectUnauthorized: false },
    });
    db = drizzle(sql, { schema: undefined });
  });

  afterAll(async () => {
    if (!db || !sql) return;
    // Cleanup: profiles first (FK tenant_id), then the test tenants.
    for (const id of createdProfileIds) {
      await db!.delete(profiles).where(eq(profiles.id, id)).catch(() => {});
    }
    for (const id of createdTenantIds) {
      await db!.delete(tenants).where(eq(tenants.id, id)).catch(() => {});
    }
    await sql!.end({ timeout: 3 });
  });

  it.skipIf(!dbAvailable)(DB_REQUIRED, async () => {
    // Sanity: the constraint exists (migration 0021 applied).
    const [row] = await sql!<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.profiles'::regclass
        AND conname = 'profiles_tenant_id_email_unique'
    `;
    expect(row).toBeDefined();
  });

  it.skipIf(!dbAvailable)(
    "permite el MISMO email en tenants distintos (multi-tenant)",
    async () => {
      const slugA = `uniq-a-${randomUUID().slice(0, 8)}`;
      const slugB = `uniq-b-${randomUUID().slice(0, 8)}`;
      const tenantA = await createTenant(slugA);
      const tenantB = await createTenant(slugB);
      const email = `shared-${randomUUID().slice(0, 8)}@demo.com`;

      // Insert into tenant A — must succeed.
      const [pA] = await db!.insert(profiles).values({
        tenantId: tenantA,
        email,
        fullName: "Tenant A",
        role: "admin",
      }).returning({ id: profiles.id });
      createdProfileIds.push(pA!.id);

      // Same email into tenant B — must ALSO succeed (the point of 0021).
      const [pB] = await db!.insert(profiles).values({
        tenantId: tenantB,
        email,
        fullName: "Tenant B",
        role: "admin",
      }).returning({ id: profiles.id });
      createdProfileIds.push(pB!.id);

      expect(pA!.id).not.toBe(pB!.id);
    },
  );

  it.skipIf(!dbAvailable)(
    "BLOQUEA el mismo email en el MISMO tenant (23505)",
    async () => {
      const slug = `uniq-c-${randomUUID().slice(0, 8)}`;
      const tenantId = await createTenant(slug);
      const email = `dup-${randomUUID().slice(0, 8)}@demo.com`;

      const [first] = await db!.insert(profiles).values({
        tenantId,
        email,
        fullName: "First",
        role: "admin",
      }).returning({ id: profiles.id });
      createdProfileIds.push(first!.id);

      // Second insert with the same (tenant_id, email) → unique violation.
      // postgres.js wraps the driver error in `cause` (which carries `code`).
      await expect(
        db!.insert(profiles).values({
          tenantId,
          email,
          fullName: "Duplicate",
          role: "admin",
        }),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: "23505" }),
      });
    },
  );

  it.skipIf(!dbAvailable)(
    "bloquea solo DENTRO del tenant (no afecta otro tenant)",
    async () => {
      const slug = `uniq-d-${randomUUID().slice(0, 8)}`;
      const tenantId = await createTenant(slug);
      const email = `blocked-${randomUUID().slice(0, 8)}@demo.com`;

      const [p] = await db!.insert(profiles).values({
        tenantId,
        email,
        fullName: "Only",
        role: "admin",
      }).returning({ id: profiles.id });
      createdProfileIds.push(p!.id);

      // Same email in a DIFFERENT tenant is fine (covered above), so ensure
      // the failure is specifically tied to the (tenant_id, email) pair and
      // not a global uniqueness re-introduced by accident.
      const slug2 = `uniq-e-${randomUUID().slice(0, 8)}`;
      const tenant2 = await createTenant(slug2);
      const [p2] = await db!.insert(profiles).values({
        tenantId: tenant2,
        email,
        fullName: "Other",
        role: "admin",
      }).returning({ id: profiles.id });
      createdProfileIds.push(p2!.id);
      expect(p2!.id).toBeDefined();
    },
  );
});
