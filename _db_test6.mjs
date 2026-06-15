import { getDb } from './src/shared/database/connection.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './src/shared/database/schema/index.js';

const sql = getDb();
await sql`SET search_path TO tenant_taller_el_chero, public`;

const db = drizzle(sql, { schema, logger: false });

// Test findFirst
try {
  const res = await db.query.clients.findFirst();
  console.log('DRIZZLE findFirst OK:', res?.name);
} catch(e) {
  console.error('DRIZZLE findFirst ERROR:', e.message);
}

// Test insert via Drizzle
try {
  const { clients } = schema;
  const res = await db.insert(clients).values({
    name: 'Test Drizzle',
    tenantSlug: 'taller_el_chero',
  }).returning();
  console.log('DRIZZLE INSERT OK:', res[0]?.name, res[0]?.id);
} catch(e) {
  console.error('DRIZZLE INSERT ERROR:', e.message);
}

process.exit(0);
