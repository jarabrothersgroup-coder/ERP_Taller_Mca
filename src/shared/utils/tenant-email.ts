/**
 * Billing utility — Resolve tenant admin email.
 *
 * Shared by:
 *   - billing-notifications.service.ts (webhook-triggered emails)
 *   - billing-email.routes.ts (API-triggered emails)
 *
 * Resolves email from tenant context: admin → manager → any profile.
 *
 * @module shared/utils/tenant-email
 */

import { eq, and, isNotNull, sql } from "drizzle-orm";
import { db } from "../database/drizzle.js";
import { tenants } from "../database/schema/tenants.js";
import { profiles } from "../database/schema/profiles.js";

/**
 * Resolve admin email from tenant slug.
 * Prefers admin role, then manager, then any profile.
 *
 * Uses a single query with ORDER BY for efficiency.
 */
export async function resolveTenantAdminEmail(tenantSlug: string): Promise<string | null> {
  // Get tenant ID from slug
  const [tenant] = await db()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);
  if (!tenant) return null;

  // Single query: order by role priority (admin=0, manager=1, any=2), skip inactive profiles and null emails
  const [profile] = await db()
    .select({ email: profiles.email })
    .from(profiles)
    .where(
      and(
        eq(profiles.tenantId, tenant.id),
        eq(profiles.isActive, true),
        isNotNull(profiles.email),
      ),
    )
    .orderBy(sql`CASE WHEN ${profiles.role} = 'admin' THEN 0 WHEN ${profiles.role} = 'manager' THEN 1 ELSE 2 END`)
    .limit(1);

  return profile?.email ?? null;
}
