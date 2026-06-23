/**
 * Generate migration SQL from CHECK constraints in Drizzle schema files.
 *
 * Reads all schema/*.ts files, extracts `check("name", sql\`condition\`)` calls
 * from pgTable() config blocks, and produces ALTER TABLE ADD CONSTRAINT statements.
 *
 * Translates Drizzle's `sql\`${table.col} >= 0\`` to proper PostgreSQL
 * quoted column names like `"table_name"."column_name" >= 0`.
 *
 * Usage: node scripts/extract-checks.mjs
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** All module schema directories */
const schemaDirs = [
  "src/shared/database/schema",
  "src/modules/workshop/schema",
  "src/modules/inventory/schema",
  "src/modules/finance/schema",
  "src/modules/thinkcar/schema",
  "src/modules/tenants/schema",
  "src/modules/backup/schema",
  "src/modules/config/schema",
  "src/modules/crm/schema",
  "src/modules/dvi/schema",
  "src/modules/intelligence/schema",
  "src/modules/label-printing/schema",
  "src/modules/scheduling/schema",
  "src/modules/security-hw/schema",
  "src/modules/whatsapp/schema",
];

// ─── Helpers ────────────────────────────────────

/** camelCase → snake_case */
function toSnake(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Parse a schema file and extract:
 * - All pgTable() declarations → (tableName, position)
 * - All column definitions → (propertyName, dbColumnName)
 * - All check() calls → (checkName, condition, position)
 */
function parseSchema(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // Collect pgTable declarations with their table names
  const tableRegex = /(?:const\s+\w+\s*=\s*)?pgTable\s*\(\s*"([^"]+)"/g;
  const tables = [];
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    tables.push({ name: match[1], index: match.index });
  }

  // Collect column definitions from each table
  // Pattern: propertyName: type("db_column_name", ...)
  const colRegex = /(\w+):\s*\w+\s*\(\s*"([^"]+)"/g;
  const columns = [];
  while ((match = colRegex.exec(content)) !== null) {
    const propName = match[1];     // e.g., "horaEjecucion"
    const dbName = match[2];       // e.g., "hora_ejecucion"
    const index = match.index;

    // Find which table this belongs to
    let tableName = "unknown";
    for (const t of tables) {
      if (t.index <= index) tableName = t.name;
    }

    columns.push({ tableName, propName, dbName });
  }

  // Collect check() calls
  const checkRegex = /check\s*\(\s*"([^"]+)"\s*,\s*(?:sql|sql)\s*`([^`]+)`\s*\)/g;
  const checks = [];
  while ((match = checkRegex.exec(content)) !== null) {
    const checkName = match[1];
    const condition = match[2].trim();
    const index = match.index;

    // Find which table this belongs to
    let tableName = "unknown";
    for (const t of tables) {
      if (t.index <= index) tableName = t.name;
    }

    checks.push({ tableName, checkName, condition });
  }

  return { tables, columns, checks };
}

/**
 * Translate `${table.propName}` references in a condition to
 * SQL quoted column references like `"table_name"."column_name"`.
 */
function translateCondition(condition, tableName, columnsForTable) {
  // Build a map: propName → dbColumnName
  const colMap = {};
  for (const c of columnsForTable) {
    colMap[c.propName] = c.dbName;
  }

  // Replace ${table.propName} with "table"."db_column"
  return condition.replace(/\$\{table\.(\w+)\}/g, (_, propName) => {
    const dbName = colMap[propName];
    if (dbName) {
      return `"${tableName}"."${dbName}"`;
    }
    // Fallback: try snake_case of the propName
    return `"${tableName}"."${toSnake(propName)}"`;
  });
}

// ─── Main ───────────────────────────────────────

const files = [];
for (const dir of schemaDirs) {
  const fullPath = join(root, dir);
  if (!existsSync(fullPath)) continue;
  for (const f of readdirSync(fullPath)) {
    if (f.endsWith(".ts") && !f.startsWith("index") && !f.startsWith("relations")) {
      files.push(join(fullPath, f));
    }
  }
}
files.sort();

console.error(`Scanning ${files.length} schema files...`);

let allChecks = [];
const allColumns = [];

for (const file of files) {
  const { tables, columns, checks } = parseSchema(file);
  allColumns.push(...columns);
  allChecks.push(...checks);
}

// Deduplicate by checkName
const seen = new Set();
const uniqueChecks = [];
for (const c of allChecks) {
  if (!seen.has(c.checkName)) {
    seen.add(c.checkName);
    uniqueChecks.push(c);
  }
}

// Group columns by table
const colMap = {};
for (const c of allColumns) {
  if (!colMap[c.tableName]) colMap[c.tableName] = [];
  colMap[c.tableName].push(c);
}

console.error(`\nUnique CHECK constraints: ${uniqueChecks.length}`);

// Group checks by table
const tableGroups = {};
for (const c of uniqueChecks) {
  if (!tableGroups[c.tableName]) tableGroups[c.tableName] = [];
  tableGroups[c.tableName].push(c);
}

// Generate SQL
let sql = `-- Migration 0024: Data integrity CHECK constraints
-- Auto-generated from Drizzle schema files
--
-- Adds CHECK constraints for monetary amounts, percentages, stock,
-- and domain ranges across all tables.
--

`;

for (const [tableName, checks] of Object.entries(tableGroups).sort()) {
  for (const c of checks) {
    const columnsForTable = colMap[c.tableName] || [];
    const translatedCondition = translateCondition(c.condition, c.tableName, columnsForTable);
    sql += `ALTER TABLE "${c.tableName}" ADD CONSTRAINT "${c.checkName}" CHECK (${translatedCondition});\n`;
  }
}

sql += `\n-- Migration complete — ${uniqueChecks.length} CHECK constraints added.\n`;

const outPath = join(root, "src/shared/database/migrations/0024_check_constraints.sql");
writeFileSync(outPath, sql, "utf8");
console.error(`Written to: ${outPath}`);

// Verify no dangling ${table.} references remain
const remaining = sql.match(/\$\{/g);
if (remaining) {
  console.error(`\n⚠ WARNING: ${remaining.length} unresolved template references found in SQL!`);
} else {
  console.error(`\n✓ All template references resolved to SQL column names.`);
}

// Stats
console.error(`\nBy table:`);
for (const [tableName, checks] of Object.entries(tableGroups).sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${tableName}: ${checks.length} constraints`);
}
