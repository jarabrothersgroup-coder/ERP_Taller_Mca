/**
 * Verify migration 0015 was applied correctly.
 *
 * Usage:
 *   npx tsx scripts/verify-0015.ts
 *
 * @module scripts/verify-0015
 */

import { getDb, closeDb } from "../src/shared/database/connection.js";

async function verify() {
  const sql = getDb();

  console.log("🔍 Verifying migration 0015_treasury.sql...\n");

  // 1. Check tables exist
  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('cuentas_bancarias', 'movimientos_tesoreria', 'conciliacion_bancaria', 'facturas_proveedor')
    ORDER BY table_name
  `;

  console.log(`Tables created: ${tables.length}/4`);
  tables.forEach((t: any) => console.log(`  ✅ ${t.table_name}`));

  if (tables.length < 4) {
    console.error("❌ Not all treasury tables were created!");
  }

  // 2. Check new columns on facturas
  const columns = await sql`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'facturas'
      AND column_name IN ('estado_pago', 'saldo_pendiente', 'fecha_vencimiento')
    ORDER BY column_name
  `;

  console.log(`\nNew columns on facturas: ${columns.length}/3`);
  columns.forEach((c: any) => console.log(`  ✅ ${c.column_name} (${c.data_type})`));

  if (columns.length < 3) {
    console.error("❌ Not all facturas columns were added!");
  }

  // 3. Check indexes
  const indexes = await sql`
    SELECT indexname FROM pg_indexes 
    WHERE schemaname = 'public'
      AND indexname IN (
        'cuentas_bancarias_tenant_idx',
        'mov_tes_cuenta_idx',
        'conc_banc_cuenta_periodo_idx',
        'fact_prov_estado_idx',
        'facturas_estado_pago_idx',
        'facturas_vencimiento_idx'
      )
    ORDER BY indexname
  `;

  console.log(`\nKey indexes found: ${indexes.length}`);
  indexes.forEach((i: any) => console.log(`  ✅ ${i.indexname}`));

  // 4. Check migration record
  const [record] = await sql`
    SELECT id, filename, applied_at FROM public.migrations 
    WHERE filename = '0015_treasury.sql'
  `;

  if (record) {
    console.log(`\n✅ Migration recorded: ${record.filename} at ${record.applied_at}`);
  }

  console.log("\n✅ Verification complete.");
  await closeDb();
}

verify().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
