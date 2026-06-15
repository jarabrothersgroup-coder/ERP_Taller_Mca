import { getDb } from './src/shared/database/connection.js';
const sql = getDb();

// List all tenant schemas
const schemas = await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' OR schema_name = '_tenant_template'`;
console.log('Schemas:', schemas.map(s => s.schema_name).join(', '));

// Check if tenants table has data
const tenants = await sql`SELECT * FROM public.tenants`;
console.log('\nTenants:', JSON.stringify(tenants, null, 2));
process.exit(0);
