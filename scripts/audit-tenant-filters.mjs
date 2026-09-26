#!/usr/bin/env node
/**
 * Auditoría de filtros de tenant — T-21d / SEG-02 (decisión (b): app-filtered).
 *
 * Escanea el código runtime y produce un inventario de las consultas sobre
 * tablas multi-tenant cuya sentencia NO menciona un filtro de tenant
 * (`tenantSlug` / `tenant_slug` / `tenantId` / `tenant_id` / `current_tenant`).
 *
 * Enfoque deliberadamente simple y determinista (sin AST):
 *   1. Tablas tenant = bloques `export const X = pgTable(...)` que declaran
 *      la columna `tenantSlug:` (o `tenantId:`).
 *   2. Sitios = ocurrencias de `.from(T)` / `.update(T)` / `.insert(T)` /
 *      `.delete(T)` sobre esas tablas en todo `src/` (recursivo; excluye
 *      schema/, migraciones, jobs/ y *.d.ts).
 *   3. Cada sitio se extiende a su sentencia (desde el `;` anterior hasta el
 *      `;` siguiente) y se marca "sin tenant" si la sentencia no menciona
 *      ninguna de las claves de tenant.
 *
 * Uso:
 *   node scripts/audit-tenant-filters.mjs            # resumen humano
 *   node scripts/audit-tenant-filters.mjs --json     # JSON completo
 *   node scripts/audit-tenant-filters.mjs --max N    # exit 1 si sinTenant > N
 *
 * El techo vigente vive en tests/tenant-filter-audit.test.ts (CEILING).
 * El número NO debe crecer: cada fix lo baja.
 *
 * @module scripts/audit-tenant-filters
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const TENANT_KEY_RE = /\btenantSlug\b|\btenant_slug\b|\btenantId\b|\btenant_id\b|\bcurrent_tenant\b/;
const EXPORT_CONST_RE = /export\s+const\s+([A-Za-z0-9_$]+)\s*=/g;

/** Recursively list .ts files under dir, skipping schema/ and declaration files. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // schema/ is kept (table definitions are needed for discovery) but is
      // excluded later from the query scan; migrations are never runtime code.
      if (entry === "migrations") continue;
      walk(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Extract `export const X = pgTable(...)` blocks and keep those with a tenant column. */
function collectTenantTables(files) {
  const tables = new Set();
  for (const file of files) {
    if (!file.includes("schema")) continue; // table definitions live under schema dirs
    const text = readFileSync(file, "utf8");
    const starts = [];
    EXPORT_CONST_RE.lastIndex = 0;
    let m;
    while ((m = EXPORT_CONST_RE.exec(text)) !== null) starts.push({ name: m[1], at: m.index });
    for (let i = 0; i < starts.length; i++) {
      const end = i + 1 < starts.length ? starts[i + 1].at : text.length;
      const block = text.slice(starts[i].at, end);
      if (/pgTable\s*\(/.test(block) && /\btenantSlug\s*:|\btenantId\s*:/.test(block)) {
        tables.add(starts[i].name);
      }
    }
  }
  return tables;
}

/** Extend a match position to its full statement (previous `;` → next `;`). */
function statementAround(text, pos) {
  let start = text.lastIndexOf(";", pos);
  start = start === -1 ? 0 : start + 1;
  let end = text.indexOf(";", pos);
  end = end === -1 ? text.length : end + 1;
  return { start, end };
}

function lineOf(text, pos) {
  let line = 1;
  for (let i = 0; i < pos; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Run the audit.
 * @param {string} [root] - Repo root (defaults to this script's repo).
 * @returns {{tables: number, sites: number, withTenant: number, withoutTenant: number, byFile: Record<string, number>, items: Array<{file: string, line: number, table: string, kind: string, snippet: string}>}}
 */
export function runAudit(root = SRC) {
  const all = walk(root);
  const tables = collectTenantTables(all);
  const items = [];
  let sites = 0;

  for (const file of all) {
    if (file.includes("schema")) continue; // definitions, not queries
    const text = readFileSync(file, "utf8");
    for (const table of tables) {
      for (const kind of ["from", "update", "insert", "delete"]) {
        const needle = `.${kind}(${table})`;
        let idx = 0;
        while ((idx = text.indexOf(needle, idx)) !== -1) {
          sites++;
          const stmt = statementAround(text, idx);
          const chunk = text.slice(stmt.start, stmt.end);
          if (!TENANT_KEY_RE.test(chunk)) {
            const snippet = chunk.replace(/\s+/g, " ").trim().slice(0, 140);
            items.push({
              file: relative(root, file),
              line: lineOf(text, idx),
              table,
              kind,
              snippet,
            });
          }
          idx += needle.length;
        }
      }
    }
  }

  const byFile = {};
  for (const it of items) byFile[it.file] = (byFile[it.file] ?? 0) + 1;

  return {
    tables: tables.size,
    sites,
    withTenant: sites - items.length,
    withoutTenant: items.length,
    byFile,
    items,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const json = process.argv.includes("--json");
  const maxIdx = process.argv.indexOf("--max");
  const max = maxIdx !== -1 ? Number(process.argv[maxIdx + 1]) : null;

  const r = runAudit();

  if (json) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(
      `tenant tables: ${r.tables} · query sites: ${r.sites} · with tenant: ${r.withTenant} · WITHOUT tenant: ${r.withoutTenant}`,
    );
    const worst = Object.entries(r.byFile).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [file, count] of worst) console.log(`  ${String(count).padStart(4)}  ${file}`);
  }

  if (max !== null && Number.isFinite(max) && r.withoutTenant > max) {
    console.error(`FAIL: withoutTenant=${r.withoutTenant} > ceiling ${max}`);
    process.exit(1);
  }
}
