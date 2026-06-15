import { getDb, closeDb } from "../src/shared/database/connection.js";

async function run() {
  const sql = getDb();
  const filename = "0011_fiscal_isc_inr.sql";

  const [existing] = await sql`SELECT id FROM public.migrations WHERE filename = ${filename}`;
  if (existing) {
    console.log(`Migration ${filename} already applied.`);
    await closeDb();
    return;
  }

  // ── ISC (Form 130) ──
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "liquidaciones_isc" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "periodo_fiscal_id" uuid NOT NULL REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE,
      "rubro" text NOT NULL,
      "cantidad" numeric(14,2) DEFAULT '0' NOT NULL,
      "unidad_medida" text DEFAULT 'UNIDAD' NOT NULL,
      "base_imponible" numeric(14,2) DEFAULT '0' NOT NULL,
      "tasa_aplicada" numeric(5,2) DEFAULT '0' NOT NULL,
      "tipo_tasa" text DEFAULT 'PORCENTUAL' NOT NULL,
      "impuesto_isc" numeric(14,2) DEFAULT '0' NOT NULL,
      "creditos_isc" numeric(14,2) DEFAULT '0' NOT NULL,
      "saldo_pagar_isc" numeric(14,2) DEFAULT '0' NOT NULL,
      "alertas" text,
      "tenant_slug" text NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL
    )
  `);
  console.log("  [OK] liquidaciones_isc created");

  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_isc_periodo_idx ON liquidaciones_isc (periodo_fiscal_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_isc_tenant_idx ON liquidaciones_isc (tenant_slug)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_isc_rubro_idx ON liquidaciones_isc (rubro)`);
  console.log("  [OK] ISC indexes created");

  // ── IDU migration: add new columns if missing ──
  await sql.unsafe(`
    DO $$ BEGIN
      ALTER TABLE liquidaciones_idu ADD COLUMN IF NOT EXISTS tipo_beneficiario text NOT NULL DEFAULT 'RESIDENTE';
      ALTER TABLE liquidaciones_idu ADD COLUMN IF NOT EXISTS tasa_aplicada numeric(5,4) NOT NULL DEFAULT '0.0800';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END $$;
  `);
  console.log("  [OK] IDU columns updated");

  // ── INR (Form 515) ──
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "liquidaciones_inr" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "periodo_fiscal_id" uuid NOT NULL REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE,
      "tipo_renta" text NOT NULL,
      "beneficiario_nombre" text DEFAULT '' NOT NULL,
      "beneficiario_pais" text DEFAULT '' NOT NULL,
      "monto_bruto" numeric(14,2) DEFAULT '0' NOT NULL,
      "tasa_retencion" numeric(5,2) DEFAULT '0' NOT NULL,
      "impuesto_inr" numeric(14,2) DEFAULT '0' NOT NULL,
      "saldo_pagar_inr" numeric(14,2) DEFAULT '0' NOT NULL,
      "alertas" text,
      "tenant_slug" text NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL
    )
  `);
  console.log("  [OK] liquidaciones_inr created");

  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_inr_periodo_idx ON liquidaciones_inr (periodo_fiscal_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_inr_tenant_idx ON liquidaciones_inr (tenant_slug)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_inr_renta_idx ON liquidaciones_inr (tipo_renta)`);
  console.log("  [OK] INR indexes created");

  await sql`INSERT INTO public.migrations (filename) VALUES (${filename})`;
  console.log(`\nMigration ${filename} applied successfully.`);
  await closeDb();
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
