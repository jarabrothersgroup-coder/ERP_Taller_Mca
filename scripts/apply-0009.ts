import { getDb, closeDb } from "../src/shared/database/connection.js";

async function run() {
  const sql = getDb();
  const filename = "0009_liquidaciones_ire.sql";

  const [existing] = await sql`SELECT id FROM public.migrations WHERE filename = ${filename}`;
  if (existing) {
    console.log(`Migration ${filename} already applied.`);
    await closeDb();
    return;
  }

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "liquidaciones_ire" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "periodo_fiscal_id" uuid NOT NULL REFERENCES "periodos_fiscales"("id") ON DELETE CASCADE,

      "ingresos_servicios" numeric(14,2) DEFAULT '0' NOT NULL,
      "ingresos_bienes" numeric(14,2) DEFAULT '0' NOT NULL,
      "ingresos_no_operacionales" numeric(14,2) DEFAULT '0' NOT NULL,
      "ingresos_brutos" numeric(14,2) DEFAULT '0' NOT NULL,

      "costo_repuestos" numeric(14,2) DEFAULT '0' NOT NULL,
      "costo_mano_obra" numeric(14,2) DEFAULT '0' NOT NULL,
      "costos_indirectos" numeric(14,2) DEFAULT '0' NOT NULL,
      "total_costos" numeric(14,2) DEFAULT '0' NOT NULL,

      "gastos_administrativos" numeric(14,2) DEFAULT '0' NOT NULL,
      "gastos_ventas" numeric(14,2) DEFAULT '0' NOT NULL,
      "total_gastos" numeric(14,2) DEFAULT '0' NOT NULL,

      "donaciones" numeric(14,2) DEFAULT '0' NOT NULL,
      "otras_deducciones" numeric(14,2) DEFAULT '0' NOT NULL,

      "renta_neta" numeric(14,2) DEFAULT '0' NOT NULL,
      "impuesto_ire" numeric(14,2) DEFAULT '0' NOT NULL,
      "reserva_legal" numeric(14,2) DEFAULT '0' NOT NULL,
      "retenciones" numeric(14,2) DEFAULT '0' NOT NULL,
      "anticipos" numeric(14,2) DEFAULT '0' NOT NULL,
      "saldo_pagar" numeric(14,2) DEFAULT '0' NOT NULL,
      "saldo_favor_ire" numeric(14,2) DEFAULT '0' NOT NULL,

      "alertas" text,
      "tenant_slug" text NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL
    )
  `);
  console.log("  [OK] liquidaciones_ire table created");

  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_ire_periodo_idx ON liquidaciones_ire (periodo_fiscal_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS liq_ire_tenant_idx ON liquidaciones_ire (tenant_slug)`);
  console.log("  [OK] indexes created");

  await sql`INSERT INTO public.migrations (filename) VALUES (${filename})`;
  console.log(`\nMigration ${filename} applied successfully.`);
  await closeDb();
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
