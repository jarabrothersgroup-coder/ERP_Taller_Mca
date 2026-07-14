/**
 * Seed billing plans for the AutomotiveOS SaaS platform.
 *
 * Usage:
 *   npx tsx scripts/seed-billing-plans.ts
 *
 * Creates 3 tiers: STARTER, PRO, ENTERPRISE with Paraguayan Guarani pricing.
 * Safe to run multiple times (upserts by plan code).
 */

import { eq } from "drizzle-orm";
import { db } from "../src/shared/database/drizzle.js";
import { plans } from "../src/modules/billing/schema/plans.js";

const SEED_PLANS = [
  {
    code: "STARTER",
    name: "Taller Básico",
    description: "Para talleres pequeños (1-3 bahías). Incluye taller, facturación y WhatsApp.",
    priceMonthlyPyg: 350_000,      // ~$50 USD
    priceAnnualPyg: 3_500_000,     // ~$500 USD (2 months free)
    maxUsers: 3,
    maxBranches: 1,
    features: {
      sifen: true,
      accounting: true,
      whatsapp: true,
      analytics: false,
      fleet: false,
      clientPortal: false,
      apiAccess: false,
      prioritySupport: false,
    },
    sortOrder: 1,
  },
  {
    code: "PRO",
    name: "Taller Profesional",
    description: "Para talleres medianos (4-8 bahías). Analytics, flotas y portal de clientes.",
    priceMonthlyPyg: 700_000,      // ~$100 USD
    priceAnnualPyg: 7_000_000,     // ~$1000 USD (2 months free)
    maxUsers: 15,
    maxBranches: 2,
    features: {
      sifen: true,
      accounting: true,
      whatsapp: true,
      analytics: true,
      fleet: true,
      clientPortal: true,
      apiAccess: false,
      prioritySupport: false,
    },
    sortOrder: 2,
  },
  {
    code: "ENTERPRISE",
    name: "Multi-Taller Enterprise",
    description: "Para cadenas y franquicias (10+ bahías). API, soporte prioritario, SSO.",
    priceMonthlyPyg: 1_750_000,    // ~$250 USD
    priceAnnualPyg: 17_500_000,    // ~$2500 USD (2 months free)
    maxUsers: 999,
    maxBranches: 99,
    features: {
      sifen: true,
      accounting: true,
      whatsapp: true,
      analytics: true,
      fleet: true,
      clientPortal: true,
      apiAccess: true,
      prioritySupport: true,
    },
    sortOrder: 3,
  },
] as const;

async function seedPlans() {
  console.log("💳 Seeding billing plans...\n");

  for (const plan of SEED_PLANS) {
    const existing = await db()
      .select()
      .from(plans)
      .where(eq(plans.code, plan.code))
      .limit(1);

    if (existing.length > 0) {
      // Update existing plan
      await db()
        .update(plans)
        .set({
          name: plan.name,
          description: plan.description,
          priceMonthlyPyg: plan.priceMonthlyPyg,
          priceAnnualPyg: plan.priceAnnualPyg,
          maxUsers: plan.maxUsers,
          maxBranches: plan.maxBranches,
          features: plan.features,
          sortOrder: plan.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(plans.code, plan.code));
      console.log(`  ✏️  ${plan.code} — updated`);
    } else {
      // Insert new plan
      await db().insert(plans).values({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceMonthlyPyg: plan.priceMonthlyPyg,
        priceAnnualPyg: plan.priceAnnualPyg,
        maxUsers: plan.maxUsers,
        maxBranches: plan.maxBranches,
        features: plan.features,
        sortOrder: plan.sortOrder,
      });
      console.log(`  ✅ ${plan.code} — created`);
    }
  }

  // Display summary
  const allPlans = await db().select().from(plans).orderBy(plans.sortOrder);
  console.log(`\n📋 ${allPlans.length} billing plans active:`);
  for (const p of allPlans) {
    console.log(`   ${p.code}: ${p.name} — ₲${p.priceMonthlyPyg.toLocaleString("es-PY")}/mes`);
  }
}

seedPlans()
  .then(() => {
    console.log("\n✅ Billing plans seeded successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed to seed billing plans:", err);
    process.exit(1);
  });
