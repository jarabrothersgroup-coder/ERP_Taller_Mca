import { getDb, closeDb } from "../src/shared/database/connection.js";

async function run() {
  const sql = getDb();
  const filename = "0010_liquidaciones_idu.sql";

  const [existing] = await sql`SELECT id FROM public.migrations WHERE filename = ${filename}`;
  if (existing) {
    console.log(`Migration ${filename} already applied.`);
    await closeDb();
    return;
  }

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "liquidaciones_idu" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "periodo_fiscal_id" uuid NOT NULL REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE,
      "liquidacion_ire_id" uuid REFERENCES "liquidaciones_ire"("id") ON DELETE SET NULL,

      "renta_neta_base" numeric(14,2) DEFAULT '0' NOT NULL,
      "impuesto_ire_pagado" numeric(14,2) DEFAULT '0' NOT NULL,
      "reserva_legal_base" numeric(14,2) DEFAULT '0' NOT NULL,

      "utilidad_distribuible" numeric(14,2) DEFAULT '0' NOT NULL,
      "porcentaje_distribuido" numeric(5,4) DEFAULT '1.0000' NOT NULL,
      "utilidad_efectiva" numeric(14,2) DEFAULT '0' NOT NULL,

      "impuesto_idu" numeric(14,2) DEFAULT '0' NOT NULL,
      "retenciones_idu" numeric(14,2) DEFAULT '0' NOT NULL,
      "saldo_pagar_idu" numeric(14,2) DEFAULT '0' NOT NULL,
      "saldo_favor_idu" numeric(14,2) DEFAULT '0' NOT NULL,

      "alertas" text,
      "tenant_slug" text NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL
    )
  `);
  console.log("  [OK] liquidaciones_idu table created");

  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_idu_periodo_idx ON liquidaciones_idu (periodo_fiscal_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_idu_tenant_idx ON liquidaciones_idu (tenant_slug)`);
  console.log("  [OK] indexes created");

  await sql`INSERT INTO public.migrations (filename) VALUES (${filename})`;
  console.log(`\nMigration ${filename} applied successfully.`);
  await closeDb();
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
