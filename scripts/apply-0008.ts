import { getDb, closeDb } from "../src/shared/database/connection.js";

async function run() {
  const sql = getDb();
  const filename = "0008_fiscal_forms.sql";

  const [existing] = await sql`SELECT id FROM public.migrations WHERE filename = ${filename}`;
  if (existing) {
    console.log(`Migration ${filename} already applied.`);
    await closeDb();
    return;
  }

  // Create ENUMs (IF NOT EXISTS handled)
  const enums = [
    `CREATE TYPE "public"."formulario_tipo" AS ENUM('FORM_120_IVA','FORM_500_IRE','FORM_501_IRE_SIMPLE','FORM_502_IRE_RESIMPLE','FORM_520_IDU','FORM_130_ISC','FORM_515_INR')`,
    `CREATE TYPE "public"."liquidacion_estado" AS ENUM('BORRADOR','PRESENTADO','PAGADO','RECTIFICADO')`,
  ];
  for (const e of enums) {
    try { await sql.unsafe(e); console.log("  [OK] ENUM created"); }
    catch (err: any) {
      if (err.message?.includes("already exists")) console.log("  [SKIP] ENUM exists");
      else throw err;
    }
  }

  // Create tables
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "periodos_fiscales" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "formulario" "formulario_tipo" NOT NULL,
      "anho" integer NOT NULL,
      "mes" integer DEFAULT 0 NOT NULL,
      "estado" "liquidacion_estado" DEFAULT 'BORRADOR' NOT NULL,
      "tenant_slug" text NOT NULL,
      "fecha_presentacion" timestamptz,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT "periodo_fiscal_unique" UNIQUE("formulario","anho","mes","tenant_slug")
    )
  `);
  console.log("  [OK] periodos_fiscales created");

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "liquidaciones_iva" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "periodo_fiscal_id" uuid NOT NULL REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE,
      "ventas_gravada_10" numeric(14,2) DEFAULT '0' NOT NULL,
      "ventas_iva_10" numeric(14,2) DEFAULT '0' NOT NULL,
      "ventas_gravada_5" numeric(14,2) DEFAULT '0' NOT NULL,
      "ventas_iva_5" numeric(14,2) DEFAULT '0' NOT NULL,
      "ventas_exenta" numeric(14,2) DEFAULT '0' NOT NULL,
      "ventas_total" numeric(14,2) DEFAULT '0' NOT NULL,
      "compras_gravada_10" numeric(14,2) DEFAULT '0' NOT NULL,
      "compras_iva_10" numeric(14,2) DEFAULT '0' NOT NULL,
      "compras_gravada_5" numeric(14,2) DEFAULT '0' NOT NULL,
      "compras_iva_5" numeric(14,2) DEFAULT '0' NOT NULL,
      "compras_otras" numeric(14,2) DEFAULT '0' NOT NULL,
      "compras_total" numeric(14,2) DEFAULT '0' NOT NULL,
      "iva_debito" numeric(14,2) DEFAULT '0' NOT NULL,
      "iva_credito" numeric(14,2) DEFAULT '0' NOT NULL,
      "iva_a_pagar" numeric(14,2) DEFAULT '0' NOT NULL,
      "saldo_favor" numeric(14,2) DEFAULT '0' NOT NULL,
      "prorrateo_indice" numeric(5,4),
      "saldo_arrastre" numeric(14,2) DEFAULT '0' NOT NULL,
      "alertas" text,
      "tenant_slug" text NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL
    )
  `);
  console.log("  [OK] liquidaciones_iva created");

  // Indexes
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS periodos_fiscales_tenant_idx ON periodos_fiscales (tenant_slug)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS periodos_fiscales_form_idx ON periodos_fiscales (formulario)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_iva_periodo_idx ON liquidaciones_iva (periodo_fiscal_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_iva_tenant_idx ON liquidaciones_iva (tenant_slug)`);
  console.log("  [OK] indexes created");

  await sql`INSERT INTO public.migrations (filename) VALUES (${filename})`;
  console.log(`\nMigration ${filename} applied successfully.`);
  await closeDb();
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
