/**
 * add-checks.mjs — Add CHECK constraints to all Drizzle schema files.
 *
 * Scans every schema/*.ts file (except index.ts/relations.ts), identifies
 * numeric columns by naming convention, and adds Drizzle `check()` constraints.
 *
 * Handles:
 *   - Tables WITH and WITHOUT a third `(table) => ({...})` argument
 *   - Files with multiple pgTable calls
 *   - Files that already import `check` / `sql`
 *   - Edge: one-line pgTable calls, mixed formatting
 *
 * Usage: node scripts/add-checks.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";

// ─── Column naming → constraint rules ─────────────────────────────

/**
 * A rule describes:
 *   - test(name): whether this rule applies
 *   - except(name): optional exclusion  
 *   - constraint(sqlTable, jsName): returns the Drizzle check() call
 */
const RULES = [
  // ── Monetary / stock / counters → >= 0 ───────────────────────
  {
    test: (n) =>
      /^(total|subtotal|monto|precio|precioCosto|costoPromedio|precioVenta|saldoPendiente|saldo|debe|haber|baseImponible|valor[A-Z]|valor$|ingreso|ingresos[A-Z]|gasto|gastos[A-Z]|impuesto|impuestos[A-Z]|retencion|retenciones[A-Z]|anticipo|anticipos[A-Z]|donacion|donaciones[A-Z]|deduccion|deducciones[A-Z]|reserva|reservas[A-Z]|credito|creditos[A-Z]|comision[A-Z]|commissionAmount|laborAmount|costo[A-Z]|descuento[A-Z]|capital[A-Z]|costos[A-Z]|compras[A-Z]|ventas[A-Z]|renta[A-Z])$/i.test(n) ||
      /^(stock|stockActual|stockMinimo|stockMaximo|cantidad|cantidad[A-Z]|existencia|existencia[A-Z]|puntoReorden|loteEconomico|unidades)$/i.test(n) ||
      /^(fileSize|duracionMs|retencionDias|maxBackups|ancho[A-Z]|alto[A-Z]|dpi)$/i.test(n) ||
      // catch numeric: total*, monto*, precio*, costo*, cantidad*, stock*
      /^(total|monto|precio|costo|cantidad|stock)[A-Z]/.test(n),
    except: (n) =>
      /^(utilidad|diferencia|variacion|ajuste|resultado|margen)/i.test(n),
    constraint: (t, col) =>
      `    ${col}Check: check("${t}_${col}_check", sql\`\$\{table.${col}\} >= 0\`)`,
  },

  // ── Percentage / rate → BETWEEN 0 AND 100 ────────────────────
  {
    test: (n) =>
      /^(commissionRate|commission_rate)$/i.test(n) ||
      /^tasa/i.test(n) ||
      /^porcentaje/i.test(n) ||
      /iva$/i.test(n) ||
      /ivaPct$/i.test(n) ||
      /^prorrateo/i.test(n),
    constraint: (t, col) =>
      `    ${col}Check: check("${t}_${col}_check", sql\`\$\{table.${col}\} BETWEEN 0 AND 100\`)`,
  },

  // ── Rating → 1-5 ────────────────────────────────────────────
  {
    test: (n) => /^rating$/i.test(n) || /^puntuacion$/i.test(n),
    constraint: (t, col) =>
      `    ${col}Check: check("${t}_${col}_check", sql\`\$\{table.${col}\} BETWEEN 1 AND 5\`)`,
  },

  // ── Hours 0-23, Minutes 0-59, Day-of-week 1-7, Day-of-month 1-31 ──
  {
    test: (n) => /^horaEjecucion$/i.test(n),
    constraint: (t, col) =>
      `    ${col}Check: check("${t}_${col}_check", sql\`\$\{table.${col}\} >= 0 AND \$\{table.${col}\} <= 23\`)`,
  },
  {
    test: (n) => /^minutoEjecucion$/i.test(n),
    constraint: (t, col) =>
      `    ${col}Check: check("${t}_${col}_check", sql\`\$\{table.${col}\} >= 0 AND \$\{table.${col}\} <= 59\`)`,
  },
  {
    test: (n) => /^diaSemana$/i.test(n),
    constraint: (t, col) =>
      `    ${col}Check: check("${t}_${col}_check", sql\`\$\{table.${col}\} >= 1 AND \$\{table.${col}\} <= 7\`)`,
  },
  {
    test: (n) => /^diaMes$/i.test(n),
    constraint: (t, col) =>
      `    ${col}Check: check("${t}_${col}_check", sql\`\$\{table.${col}\} >= 1 AND \$\{table.${col}\} <= 31\`)`,
  },
];

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Parse the arguments of a pgTable(...) call starting at startIdx.
 * Returns array of argument strings (raw text between commas at depth=1, braceDepth=0).
 */
function parsePgTableArgs(content, startIdx) {
  const args = [];
  let i = startIdx;
  let depth = 0;        // parenthesis nesting
  let braceDepth = 0;   // brace/curly nesting
  let bracketDepth = 0; // square bracket nesting
  let inString = false;
  let stringChar = null;
  let currentArg = "";

  // Skip to opening paren
  while (i < content.length && content[i] !== "(") i++;
  if (i >= content.length) return args;
  depth = 1; // inside pgTable opening paren
  i++;

  while (i < content.length && depth > 0) {
    const ch = content[i];

    // Handle strings
    if (inString) {
      currentArg += ch;
      if (ch === "\\") { i += 2; continue; }
      if (ch === stringChar) { inString = false; stringChar = null; }
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      currentArg += ch;
      i++;
      continue;
    }

    // Handle template literal expressions: ${...}
    // We don't need special handling since ${ inside ` also follows string rules

    // Track nesting depths
    if (ch === "(") { depth++; currentArg += ch; i++; continue; }
    if (ch === ")") {
      depth--;
      if (depth === 0) {
        // End of pgTable call
        if (currentArg.trim()) args.push(currentArg.trim());
        break;
      }
      currentArg += ch;
      i++;
      continue;
    }

    if (ch === "{") { braceDepth++; currentArg += ch; i++; continue; }
    if (ch === "}") { braceDepth--; currentArg += ch; i++; continue; }

    if (ch === "[") { bracketDepth++; currentArg += ch; i++; continue; }
    if (ch === "]") { bracketDepth--; currentArg += ch; i++; continue; }

    // Split on commas only at top level (not inside any nested parens/braces/brackets)
    if (ch === "," && depth === 1 && braceDepth === 0 && bracketDepth === 0) {
      args.push(currentArg.trim());
      currentArg = "";
      i++;
      continue;
    }

    currentArg += ch;
    i++;
  }

  return args;
}

/** Extract column definitions from a column block (the {...} containing columns) */
function extractColumns(colBlock) {
  const cols = [];

  // The colBlock is the raw text of the columns object including outer braces
  // Remove outer braces if present
  let inner = colBlock.trim();
  if (inner.startsWith("{")) inner = inner.slice(1);
  if (inner.endsWith("}")) inner = inner.slice(0, -1);

  const colRe =
    /(\w+):\s*(numeric|integer|decimal|real|doublePrecision|smallint|bigint)\s*\(/g;

  let m;
  while ((m = colRe.exec(inner)) !== null) {
    const jsName = m[1];
    // Skip false positives inside column definitions like { precision: 14, scale: 2 }
    // precision, scale, withTimezone, onDelete are SQL column definition parameters
    if (/^(precision|scale|withTimezone|onDelete)$/i.test(jsName)) continue;
    cols.push({ jsName });
  }

  return cols;
}

/** Check if a column name matches any rule */
function getConstraints(sqlTableName, cols) {
  const checks = [];

  for (const col of cols) {
    for (const rule of RULES) {
      if (rule.except && rule.except(col.jsName)) continue;
      if (rule.test(col.jsName)) {
        checks.push(rule.constraint(sqlTableName, col.jsName));
        break;
      }
    }
  }

  return checks;
}

/**
 * Find the config block inside a pgTable call and determine where to
 * insert CHECK constraints. Returns null if no third arg exists.
 */
function findThirdArgEnd(content, tableStartIdx) {
  // We need to find the closing ')' of the third argument's object
  // Strategy: find the (table) => ({ }) pattern
  const afterCols = content.indexOf("(table) => ({", tableStartIdx);
  if (afterCols === -1) return null;

  // Find the opening brace of the config object
  const objStart = content.indexOf("{", afterCols + 13);
  if (objStart === -1) return null;

  // Find the matching closing brace
  let braceDepth = 0;
  let inStr = false;
  let strCh = null;
  let lastLineStart = objStart;
  let leadingSpaces = "      ";

  for (let i = objStart; i < content.length; i++) {
    const c = content[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === strCh) { inStr = false; strCh = null; }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = true; strCh = c;
      continue;
    }
    if (c === "{") { braceDepth++; continue; }
    if (c === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        // Found the closing brace
        // Determine leading whitespace from the line
        const lineStart = content.lastIndexOf("\n", i) + 1;
        const linePrefix = content.slice(lineStart, i);
        const indentMatch = linePrefix.match(/^(\s*)/);
        if (indentMatch) leadingSpaces = indentMatch[1];

        return {
          closeBrace: i,
          leadingSpaces,
        };
      }
      continue;
    }
  }

  return null;
}

/** Check if a table config already has check() constraints */
function hasExistingChecks(content, tableStartIdx) {
  const configStart = content.indexOf("(table) => ({", tableStartIdx);
  if (configStart === -1) return null;

  // Check if any check( appears in the config
  const configContent = content.slice(configStart);
  return configContent.includes("check(");
}

// ─── File transformation ───────────────────────────────────────

function transformFile(filePath) {
  let content = readFileSync(filePath, "utf-8");
  const orig = content;

  // ── Find all pgTable calls ─────────────────────────────────
  const tableCalls = [];

  const tableStartRe = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(/g;
  let match;

  while ((match = tableStartRe.exec(content)) !== null) {
    const tableJSName = match[1];
    const callStart = match.index + match[0].length - 1; // point to '('

    // Parse arguments properly
    const args = parsePgTableArgs(content, match.index + match[0].length - 1);

    if (args.length < 2) {
      console.warn(`  ⚠ ${filePath}: ${tableJSName} — <2 args, skipping`);
      continue;
    }

    // Extract SQL table name from first arg (strip quotes)
    const sqlTableName = args[0].replace(/["']/g, "").trim();
    const colBlock = args[1];
    const hasConfig = args.length >= 3;

    // Extract column info
    const cols = extractColumns(colBlock);

    // Generate needed CHECK constraints
    const checks = getConstraints(sqlTableName, cols);

    if (checks.length === 0) continue;

    tableCalls.push({
      tableJSName,
      sqlTableName,
      hasConfig,
      checks,
      matchStart: match.index,
    });
  }

  if (tableCalls.length === 0) return false;

  // ── Phase 1: Add imports (modifies content, so we re-scan after) ──
  const needsCheckImport = !/import\s*\{[^}]*\bcheck\b[^}]*\}\s*from\s*["']drizzle-orm\/pg-core["']/.test(content);
  const needsSqlImport = !/import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*["']drizzle-orm["']/.test(content);

  if (needsCheckImport) {
    content = content.replace(
      /(import\s*\{)([^}]*)(\}\s*from\s*["']drizzle-orm\/pg-core["'])/,
      (match, open, middle, close) => {
        if (/\bcheck\b/.test(middle)) return match;
        const items = middle.split(",").map((s) => s.trim()).filter(Boolean);
        const idx = items.findIndex((s) => s.startsWith("pgTable"));
        items.splice(idx + 1, 0, "check");
        return `${open} ${items.join(", ")} ${close}`;
      },
    );
  }

  if (needsSqlImport) {
    const existingDrizzleImport = /import\s*\{[^}]*\}\s*from\s*["']drizzle-orm["']/.test(content);
    if (existingDrizzleImport) {
      content = content.replace(
        /(import\s*\{)([^}]*)(\}\s*from\s*["']drizzle-orm["'])/,
        (match, open, middle, close) => {
          if (/\bsql\b/.test(middle)) return match;
          const items = middle.split(",").map((s) => s.trim()).filter(Boolean);
          items.push("sql");
          return `${open} ${items.join(", ")} ${close}`;
        },
      );
    } else {
      const pgCoreImports = content.matchAll(/import.*from\s*["']drizzle-orm\/pg-core["']/g);
      let lastMatch;
      for (const m of pgCoreImports) lastMatch = m;
      if (lastMatch) {
        const insertPos = content.indexOf("\n", lastMatch.index) + 1;
        content =
          content.slice(0, insertPos) +
          `import { sql } from "drizzle-orm";\n` +
          content.slice(insertPos);
      }
    }
  }

  // ── Phase 2: Re-scan modified content for pgTable calls ──
  // (positions may have shifted after import additions)
  const updatedCalls = [];
  const updatedTableRe = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(/g;

  while ((match = updatedTableRe.exec(content)) !== null) {
    const jsName = match[1];
    const callStart = match.index + match[0].length - 1;
    const args = parsePgTableArgs(content, callStart);
    if (args.length < 2) continue;

    const sqlName = args[0].replace(/["']/g, "").trim();
    const colBlock = args[1];
    const hasConfig = args.length >= 3;
    const cols = extractColumns(colBlock);
    const checks = getConstraints(sqlName, cols);
    if (checks.length === 0) continue;

    updatedCalls.push({ tableJSName: jsName, sqlTableName: sqlName, hasConfig, checks, matchStart: match.index });
  }

  // ── Phase 3: Add CHECK constraints ──
  for (const table of updatedCalls) {
    const checkLines = table.checks.join(",\n");

    if (!table.hasConfig) {
      // No third arg — find closing paren and insert config block
      const closeParen = findPgTableClose(content, table.matchStart);
      if (closeParen === -1) {
        console.warn(`  ⚠ ${filePath}: ${table.tableJSName} — can't find close paren`);
        continue;
      }

      const indent = getColumnIndent(content, table.matchStart);
      const insertText = `,\n${indent}(table) => ({\n${indent}  ${checkLines},\n${indent})`;
      content = content.slice(0, closeParen) + insertText + content.slice(closeParen);
    } else {
      // Has config already — add checks inside it
      const configStr = "(table) => ({";
      const objStart = content.indexOf(configStr, table.matchStart);
      if (objStart === -1) {
        console.warn(`  ⚠ ${filePath}: ${table.tableJSName} — can't find config`);
        continue;
      }

      // Find the closing brace of the config object
      let braceDepth = 0;
      let inStr = false;
      let strCh = null;
      let closeBrace = -1;
      let lastLinePrefix = "      ";

      for (let i = content.indexOf("{", objStart); i < content.length && closeBrace === -1; i++) {
        const c = content[i];
        if (inStr) {
          if (c === "\\") { i++; continue; }
          if (c === strCh) { inStr = false; strCh = null; }
          continue;
        }
        if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
        if (c === "{") { braceDepth++; continue; }
        if (c === "}") {
          braceDepth--;
          if (braceDepth === 0) {
            closeBrace = i;
            const lineStart = content.lastIndexOf("\n", i) + 1;
            const prefix = content.slice(lineStart, i);
            const indentMatch = prefix.match(/^(\s*)/);
            if (indentMatch) lastLinePrefix = indentMatch[1];
          }
        }
      }

      if (closeBrace === -1) {
        console.warn(`  ⚠ ${filePath}: ${table.tableJSName} — can't find config close brace`);
        continue;
      }

      // Determine the correct indent from existing config entries (or default)
      const configBlock = content.slice(objStart, closeBrace);
      const indentMatch = configBlock.match(/\n(\s+)\w/);
      const configIndent = indentMatch ? indentMatch[1] : "    ";

      // Check if any check() already exists in this config
      const hasChecks = configBlock.includes("check(");

      if (hasChecks) {
        console.log(`  ~ ${filePath} — ${table.tableJSName}: checks exist, appending`);
        // Find last check and append after it
        let lastCheckEnd = -1;
        const checkPat = /\bcheck\(/g;
        let cm;
        while ((cm = checkPat.exec(content)) !== null && cm.index < closeBrace) {
          let cd = 0;
          for (let k = cm.index; k < closeBrace + 10 && k < content.length; k++) {
            if (content[k] === "(") cd++;
            if (content[k] === ")") {
              cd--;
              if (cd === 0) {
                lastCheckEnd = k + 1;
                while (lastCheckEnd < content.length && /[,\s]/.test(content[lastCheckEnd])) lastCheckEnd++;
                break;
              }
            }
          }
        }

        if (lastCheckEnd !== -1) {
          const insertText = `,\n${configIndent}${checkLines}`;
          content = content.slice(0, lastCheckEnd) + insertText + content.slice(lastCheckEnd);
        }
      } else {
        // No checks yet — insert at end of config object
        const insertText = `\n${configIndent}${checkLines},\n  `;
        content = content.slice(0, closeBrace) + insertText + content.slice(closeBrace);
      }
    }
  }

  // Deduplicate check names (safety)
  content = deduplicateChecks(content);

  if (content !== orig) {
    writeFileSync(filePath, content);
    return true;
  }

  return false;
}

/** Find the position of the closing `)` for the pgTable call */
function findPgTableClose(content, startIdx) {
  let i = startIdx;
  while (i < content.length && content[i] !== "(") i++;
  if (i >= content.length) return -1;

  let depth = 0;
  let inStr = false;
  let strCh = null;

  for (let j = i; j < content.length; j++) {
    const c = content[j];
    if (inStr) {
      if (c === "\\") { j++; continue; }
      if (c === strCh) { inStr = false; strCh = null; }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
    if (c === "(") { depth++; continue; }
    if (c === ")") {
      depth--;
      if (depth === 0) return j;
      continue;
    }
  }
  return -1;
}

/** Get the indentation of column definitions (used for new config block) */
function getColumnIndent(content, tableStartIdx) {
  // Find the columns block and look at its indent
  const colStart = content.indexOf("{\n", tableStartIdx);
  if (colStart === -1) return "  ".repeat(2);
  const afterBrace = colStart + 2;
  const lineEnd = content.indexOf("\n", afterBrace);
  if (lineEnd === -1) return "  ".repeat(2);
  const line = content.slice(afterBrace, lineEnd);
  const m = line.match(/^(\s+)/);
  return m ? m[1] : "    ";
}

/** Find the last check() end position in the config block */
function findLastCheckEnd(content, tableStartIdx) {
  const configStart = content.indexOf("(table) => ({", tableStartIdx);
  if (configStart === -1) return -1;

  let idx = configStart;
  let lastEnd = -1;

  const checkRe = /\bcheck\(\n?/g;
  let m;
  while ((m = checkRe.exec(content)) !== null) {
    if (m.index < configStart) continue;
    if (m.index > configStart + 5000) break;

    // Find the closing paren of this check
    let cdepth = 0;
    let startOfCheck = m.index;
    // Find the opening paren after "check"
    let openParen = content.indexOf("(", startOfCheck);
    if (openParen === -1) continue;

    for (let k = openParen; k < content.length; k++) {
      const c = content[k];
      if (c === "(") cdepth++;
      if (c === ")") {
        cdepth--;
        if (cdepth === 0) {
          // Found the end of this check()
          let endPos = k + 1;
          // Check for trailing comma
          while (endPos < content.length && (content[endPos] === "," || content[endPos] === "\n" || content[endPos] === " " || content[endPos] === "\r")) {
            if (content[endPos] === ",") {
              lastEnd = endPos + 1;
            }
            endPos++;
            if (endPos < content.length && content[endPos] !== " " && content[endPos] !== "\n" && content[endPos] !== "\r" && content[endPos] !== ",") {
              break;
            }
          }
          if (lastEnd === -1) lastEnd = k + 1;
          break;
        }
      }
    }
  }
  return lastEnd;
}

/** Get indentation from the config block */
function getConfigIndent(content, tableStartIdx) {
  const configStart = content.indexOf("(table) => ({", tableStartIdx);
  if (configStart === -1) return "      ";
  // Look at the line of the first entry inside config
  const objOpen = content.indexOf("{", configStart);
  if (objOpen === -1) return "      ";
  const after = objOpen + 1;
  // Find the next non-empty line
  let j = after;
  while (j < content.length && (content[j] === "\n" || content[j] === "\r" || content[j] === " ")) j++;
  if (j >= content.length) return "      ";
  // Find the start of this line
  const lineStart = content.lastIndexOf("\n", j) + 1;
  const line = content.slice(lineStart, content.indexOf("\n", lineStart));
  const m = line.match(/^(\s+)/);
  return m ? m[1] : "      ";
}

/** Remove duplicate check constraint definitions */
function deduplicateChecks(content) {
  // Simple dedup: remove duplicate "xxxCheck: check(" lines
  const seen = new Set();
  return content.split("\n").filter((line) => {
    const m = line.match(/^\s*(\w+Check):\s*check\(/);
    if (!m) return true;
    if (seen.has(m[1])) return false;
    seen.add(m[1]);
    return true;
  }).join("\n");
}

// ─── Main ────────────────────────────────────────────────────────

const files = globSync("src/**/schema/*.ts", {
  ignore: ["**/index.ts", "**/relations.ts"],
});

console.log(`Found ${files.length} schema files to process.`);
let changed = 0;
let errors = [];

for (const file of files) {
  try {
    const didChange = transformFile(file);
    if (didChange) {
      console.log(`  ✏ ${file} — modified`);
      changed++;
    }
  } catch (err) {
    console.error(`  ❌ ${file}: ${err.message}`);
    errors.push({ file, err });
  }
}

console.log(`\nDone. ${changed}/${files.length} files modified.`);
if (errors.length > 0) {
  console.log(`Errors: ${errors.length}`);
  for (const e of errors) {
    console.log(`  ${e.file}: ${e.err.message}`);
  }
}
