/**
 * Billing module — migration SQL.
 *
 * Creates billing tables for SaaS subscription management.
 * Run with: psql $DATABASE_URL -f migration.sql
 *
 * @module billing/migration
 */

export const migration = `
-- Billing Plans (global, seeded)
CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly_pyg INTEGER NOT NULL,
  price_annual_pyg INTEGER,
  stripe_price_id_monthly TEXT,
  stripe_price_id_annual TEXT,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_branches INTEGER NOT NULL DEFAULT 1,
  features JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions (one per tenant)
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan_id UUID NOT NULL REFERENCES billing_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  interval TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  active_users INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscription Invoices (billing history)
CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stripe_invoice_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  amount_pyg INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PYG',
  status TEXT NOT NULL DEFAULT 'pending',
  period_label TEXT,
  pdf_url TEXT,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant ON billing_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_stripe ON billing_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant ON billing_invoices(tenant_id);

-- Seed default plans
INSERT INTO billing_plans (code, name, description, price_monthly_pyg, price_annual_pyg, max_users, max_branches, features, sort_order)
VALUES
  ('STARTER', 'Staller', 'Ideal para talleres pequeños', 150000, 1500000, 3, 1, '{"sifen": true, "accounting": false, "whatsapp": false, "analytics": false}', 1),
  ('PRO', 'Profesional', 'Para talleres en crecimiento', 350000, 3500000, 10, 3, '{"sifen": true, "accounting": true, "whatsapp": true, "analytics": true, "fleet": false, "clientPortal": true}', 2),
  ('ENTERPRISE', 'Empresa', 'Solución completa sin límites', 650000, 6500000, 50, 10, '{"sifen": true, "accounting": true, "whatsapp": true, "analytics": true, "fleet": true, "clientPortal": true, "apiAccess": true, "prioritySupport": true}', 3)
ON CONFLICT (code) DO NOTHING;
`;
