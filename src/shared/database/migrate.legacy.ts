/**
 * Multi-Tenant database schema migrator.
 *
 * Creates the base PostgreSQL schema for AutomotiveOS Cloud ERP:
 *   - `public` schema: platform-level tables (tenants registry, migrations)
 *   - `tenant_*` schemas: per-tenant isolated data (clients, vehicles, work orders, inventory)
 *
 * Run with: `npx tsx src/shared/database/migrate.ts`
 *
 * @module shared/database/migrate
 */

import { getDb, closeDb } from "./connection.js";

const PLATFORM_SCHEMA = `
-- =============================================
-- Platform-level schema (shared across all tenants)
-- =============================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  schema_name   TEXT NOT NULL UNIQUE,
  ruc           TEXT,                          -- RUC (Paraguay tax ID)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.migrations (
  id            SERIAL PRIMARY KEY,
  filename      TEXT NOT NULL UNIQUE,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const TENANT_TABLES = `
-- =============================================
-- Per-tenant tables (clients, vehicles, work orders, inventory, fiscal)
-- =============================================

CREATE TABLE IF NOT EXISTS clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  ruc           TEXT,                          -- RUC for invoicing
  address       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plate         TEXT,
  vin           TEXT,                          -- Chassis number
  brand         TEXT NOT NULL,
  model         TEXT NOT NULL,
  year          SMALLINT,
  engine_type   TEXT NOT NULL DEFAULT 'combustion'
                CHECK (engine_type IN ('combustion', 'hybrid', 'electric')),
  -- EV/HEV High Voltage safety fields
  hv_battery_voltage   REAL,                  -- High voltage battery nominal voltage (V)
  hv_safety_disabled   BOOLEAN DEFAULT false, -- True after HV safety disconnect
  dtc_codes            TEXT[],                -- Stored diagnostic trouble codes
  notes                TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  description   TEXT,
  diagnosis     TEXT,                          -- LLM-assisted diagnosis notes
  dtc_codes     TEXT[],                        -- DTC codes scanned
  hv_alert      BOOLEAN DEFAULT false,        -- High voltage safety alert flag
  total_cost    NUMERIC(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  sku           TEXT UNIQUE,
  barcode       TEXT UNIQUE,                   -- QR / barcode for scanning
  quantity      INTEGER NOT NULL DEFAULT 0,
  unit_price    NUMERIC(10,2) DEFAULT 0,
  min_stock     INTEGER DEFAULT 0,
  category      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_checkouts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id       UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  mechanic_id   TEXT NOT NULL,                 -- Mechanic credential ID
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  checked_out   TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fiscal_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  dte_type      TEXT NOT NULL DEFAULT 'factura',
  cdc           TEXT,                          -- SIFEN Control Code
  xml_body      TEXT,                          -- Signed XML for DNIT
  ku_de_pdf_url TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/**
 * Applies all pending migrations to the database.
 * Creates platform schema and tenant table templates.
 */
export async function runMigrations(): Promise<void> {
  const db = getDb();

  console.log("📦 Running AutomotiveOS migrations...\n");

  // Step 1: Create platform-level schema
  console.log("   Creating platform-level tables (public schema)...");
  await db.unsafe(PLATFORM_SCHEMA);
  console.log("   ✅  Platform tables ready (tenants, migrations).\n");

  // Step 2: Create tenant table templates (they will be cloned per tenant)
  // We create them in a dedicated template schema for easy cloning
  console.log("   Creating tenant table templates...");
  await db.unsafe(`CREATE SCHEMA IF NOT EXISTS _tenant_template`);
  await db.unsafe(`SET search_path TO _tenant_template`);
  await db.unsafe(TENANT_TABLES);
  await db.unsafe(`SET search_path TO public`);
  console.log("   ✅  Tenant table templates ready.\n");

  console.log("✅  All migrations applied successfully.");
}

/**
 * Creates an isolated schema for a new tenant, cloning the template tables.
 *
 * @param tenantSlug - URL-safe slug for the tenant (e.g. "taller-el-chero")
 * @returns The generated schema name
 */
export async function createTenantSchema(tenantSlug: string): Promise<string> {
  const db = getDb();
  const schemaName = `tenant_${tenantSlug.replace(/[^a-zA-Z0-9_]/g, "_")}`;

  // Clone template schema for tenant isolation
  await db.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.clients    AS TABLE _tenant_template.clients    WITH NO DATA;
    CREATE TABLE IF NOT EXISTS ${schemaName}.vehicles   AS TABLE _tenant_template.vehicles   WITH NO DATA;
    CREATE TABLE IF NOT EXISTS ${schemaName}.work_orders AS TABLE _tenant_template.work_orders WITH NO DATA;
    CREATE TABLE IF NOT EXISTS ${schemaName}.inventory_items AS TABLE _tenant_template.inventory_items WITH NO DATA;
    CREATE TABLE IF NOT EXISTS ${schemaName}.tool_checkouts  AS TABLE _tenant_template.tool_checkouts  WITH NO DATA;
    CREATE TABLE IF NOT EXISTS ${schemaName}.fiscal_documents AS TABLE _tenant_template.fiscal_documents WITH NO DATA;
  `);

  // Register tenant in the platform table
  await db`
    INSERT INTO public.tenants (name, slug, schema_name)
    VALUES (${tenantSlug}, ${tenantSlug}, ${schemaName})
    ON CONFLICT (slug) DO NOTHING
  `;

  console.log(`   🏗️  Tenant schema created: ${schemaName}`);
  return schemaName;
}

// Run directly
async function main(): Promise<void> {
  try {
    await runMigrations();
  } finally {
    await closeDb();
  }
}

const isMain = process.argv[1]?.endsWith("migrate.ts");
if (isMain) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
