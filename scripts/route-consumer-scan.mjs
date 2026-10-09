#!/usr/bin/env node
/**
 * T-63 — Guard sistémico de rutas sin consumidor (cierre de T-47/T-48).
 *
 * T-47 halló 255 rutas que nadie invoca y 6 rotas de origen; T-48 las arregló
 * y las blindó con tests. Este script evita que el problema vuelva a crecer:
 * cruza el inventario REAL de rutas (app arrancada vía scripts/dump-routes.ts,
 * la única fuente fiable por los `prefix` anidados de Fastify) contra los
 * literales de URL del código, con dos techos:
 *
 *   1. sinConsumidor — la ruta no aparece en web/src, mobile/src,
 *      src/shared/public, scripts/ ni en el backend no-ruta (src sin routes/).
 *      Es la clase "D/E" de T-47: superficie muerta que nadie ejercita.
 *
 *   2. sinTest — la ruta no aparece ni en tests/ ni en web/e2e (specs de
 *      Playwright). Es la causa raíz estructural del hallazgo de T-47:
 *      "código que compila, tipa y se registra, pero que nadie ejecuta".
 *
 * El número NO debe crecer: los techos viven en
 * tests/contract/route-consumer-guard.test.ts y en el gate de CI
 * (.github/workflows/ci.yml). Bajarlos con cada fix, jamás subirlos.
 *
 * El matching es por PATH (no por método): si un test ejercita GET /x/:id,
 * el POST hermano sigue siendo un riesgo, pero el guard mide superficie sin
 * consumidor, no cobertura por verbo — para eso está el tercer gate, T-61.
 *
 *   3. T-61 — cobertura de COMPORTAMIENTO sobre las rutas críticas
 *      (/workshop, /inventory, /billing) contada por PAR (método, URL):
 *      cuántos pares de escritura ejercita al menos un test. Piso
 *      `BEHAVIOR_COVERAGE_FLOOR` (80%).
 *
 * Uso:
 *   node scripts/route-consumer-scan.mjs                  # resumen humano
 *   node scripts/route-consumer-scan.mjs --json           # JSON completo
 *   node scripts/route-consumer-scan.mjs --max-orphan N --max-untested N
 *                                                         # gate de CI (exit 1 si excede)
 *   node scripts/route-consumer-scan.mjs --min-behavior 80
 *                                                         # gate T-61 (exit 1 si baja)
 *
 * @module scripts/route-consumer-scan
 */

import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Directorios que pueden consumir rutas (excluye definiciones de rutas). */
const CONSUMER_DIRS = ["web/src", "mobile/src", "src/shared/public", "scripts", "src"];
/** Directorios cuya presencia define "la ruta está probada". */
const TEST_DIRS = ["tests", "web/e2e"];

// ── T-61 — rutas críticas y cobertura de comportamiento por verbo ────────
/**
 * Rutas críticas de T-61 (criterio ≥80%): las de ESCRITURA de los módulos
 * transaccionales del taller — `/workshop/*` (órdenes, clientes, vehículos,
 * servicios), `/inventory/*` (repuestos, stock, herramientas) y `/billing/*`
 * (cobros). Es lo que un usuario mueve y lo que corrompe datos si falla.
 *
 * La métrica es por PAR (método, URL): POST y DELETE de la misma ruta
 * cuentan como dos. Coincide con la nota de este mismo script: el matching
 * por path mide superficie, la cobertura por verbo es T-61.
 */
const CRITICAL_PREFIXES = ["/workshop", "/inventory", "/billing"];

/** Fracción mínima de pares (método, URL) con test de comportamiento. */
export const BEHAVIOR_COVERAGE_FLOOR = 0.8;

/** @param {string} path @returns {boolean} */
export function isCriticalRoute(path) {
  return CRITICAL_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

const EXTS = /\.(ts|tsx|js|jsx|mjs)$/;
/** Definiciones de rutas: ahí los literales URL son documentación, no consumo. */
const ROUTE_DEF_RE = /(^|\/)(routes|migrations|schema)(\/|$)|\/routes\.ts$|\/app\.ts$/;

/**
 * Exclusiones del triaje de clase D (Docs/T47_INVENTARIO_RUTAS_SIN_CONSUMIDOR.md,
 * 2026-09-28): rutas con consumidor legítimo que el escáner no puede ver — API
 * pública para clientes externos (portal, SSO, webhooks entrantes, IA, api-keys)
 * o disparadas por cron/eventos internos. La ausencia de consumidor de UI es
 * correcta, no superficie muerta.
 *
 * Semántica: salen SOLO de `withoutConsumer` (y por tanto de la clase D);
 * siguen contando en `withoutTest` — un webhook externo necesita test igual,
 * y la pata "escritura sin test" (backlog T-61) tampoco las perdona.
 *
 * Reglas: patrón exacto, o prefijo terminado en `*` (matchea startswith).
 * NO excluir rutas del balde "legado/duplicado" (`intelligence/parse-dtc`,
 * `thinkcar/*`, `fleet/contracts*`): deben seguir visibles hasta eliminarse.
 */
const EXCLUDED = [
  // Externas — documentar como API pública
  "/portal/auth/pin",
  "/portal/feedback",
  "/sso/*", // authorize, discover, logout, validate-domain
  "/2fa/verify",
  "/email/send*", // send, send-estimate, send-reminder
  "/email/billing/*", // webhooks del proveedor de suscripciones (4)
  "/intelligence/ocr/*", // cedula, jobs/:id, plate
  "/intelligence/dtc/*", // diagnose, parse, parse-file
  "/intelligence/decode-safety",
  "/intelligence/safety/protocol",
  "/api-keys*", // colección, :id, :id/usage
  // SIFEN (DNIT) — emisión electrónica saliente al DKCC. Emitir/firmar/
  // consultar-lote se invocan desde el flujo de facturación bajo flag
  // fiscal y su "consumidor" es la red externa, no la UI (Docs/T47 Sprint 112).
  "/finance/sifen/emitir",
  "/finance/sifen/firmar",
  "/finance/sifen/consultar-lote",
  // Internas por diseño — cron/hook/evento o administración interna
  "/fleet/billing/run",
  "/scheduling/cron/reminders",
  "/whatsapp/queue/process",
  "/whatsapp/followups/auto",
  "/whatsapp/followups/process",
  "/enterprise/data-retention/cleanup",
  "/marketing/sequences/run",
  "/whatsapp/templates/preview",
  "/crm/retry",
  "/finance/contabilidad/cron/*", // cierre-mensual
  "/workshop/cron/*", // mantenimientos-recordatorios
];

/** @param {string} path @returns {boolean} */
function isExcluded(path) {
  return EXCLUDED.some((pat) =>
    pat.endsWith("*") ? path.startsWith(pat.slice(0, -1)) : path === pat,
  );
}

/** Literal de string, por tipo de comilla (clases de carácter, sin backreference:
 *  el patrón `(?:\\.|(?!\1).)*\1` retrocede de forma cuadrática y cuelga el scan). */
const STRING_LIT_RE = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

function walk(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full, { throwIfNoEntry: false });
    if (st?.isDirectory()) walk(full, out);
    else if (st && EXTS.test(entry)) out.push(full);
  }
  return out;
}

/** Literales que empiezan por "/", normalizados: sin query/hash y `${…}` → `*`. */
function extractUrlStrings(file) {
  const text = readFileSync(file, "utf8");
  const urls = [];
  STRING_LIT_RE.lastIndex = 0;
  let m;
  while ((m = STRING_LIT_RE.exec(text))) {
    let raw = m[1] ?? m[2] ?? m[3] ?? "";
    if (!raw.startsWith("/")) continue;
    raw = raw.split("?")[0].split("#")[0];
    raw = raw.replace(/\$\{[^}]*\}/g, "*");
    if (raw.length > 1) urls.push(raw);
  }
  return urls;
}

function collectUrls(dirs, excludeRe) {
  const urls = [];
  const files = [];
  for (const dir of dirs) {
    for (const f of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, f).replaceAll("\\", "/");
      if (excludeRe && excludeRe.test(rel)) continue;
      files.push(f);
    }
  }
  for (const f of files) urls.push(...extractUrlStrings(f));
  return urls;
}

/**
 * Extrae los literales de un objeto equilibrado `{ … }`, saltando strings
 * (para que una llave dentro de un payload no corte el balanceo).
 *
 * @param {string} text
 * @returns {string[]} contenido de cada objeto literal
 */
function objectLiterals(text) {
  const out = [];
  const n = text.length;
  for (let i = 0; i < n; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < n; j++) {
      const c = text[j];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          out.push(text.slice(i, j + 1));
          break;
        }
      } else if (c === "'" || c === '"' || c === "`") {
        const q = c;
        for (let k = j + 1; k < n; k++) {
          if (text[k] === "\\") { k++; continue; }
          if (text[k] === q) { j = k; break; }
        }
      }
    }
  }
  return out;
}

/**
 * Pares (método, URL) declarados en los tests: todo objeto literal que
 * declara `method: "X"` y `url: "/y"` juntos — cubre `app.inject({...})`
 * y las matrices data-driven (p. ej. security-role-matrix) sin depender del
 * orden de las propiedades (un regex method…url empareja el método de una
 * llamada con la URL de la siguiente y se come los objetos intermedios).
 *
 * @param {string} file
 * @returns {Array<[string, string]>}
 */
function extractBehaviorPairs(file) {
  const text = readFileSync(file, "utf8");
  const seen = new Set();
  const pairs = [];
  for (const obj of objectLiterals(text)) {
    const m = obj.match(/method\s*:\s*["']([A-Z]+)["']/);
    const u = obj.match(/url\s*:\s*([`"'])([^`"'\n]+)\1/);
    if (!m || !u) continue;
    const url = normalizeUrl(u[2]);
    if (!url) continue;
    const key = `${m[1]} ${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([m[1], url]);
  }
  return pairs;
}

/** Literal URL → forma comparable con el árbol de rutas (query/hash fuera, `${…}` → `*`). */
function normalizeUrl(raw) {
  let out = raw.split("?")[0].split("#")[0].replace(/\$\{[^}]*\}/g, "*");
  if (out.length <= 1) return "";
  return out;
}

/**
 * Cobertura T-61: pares (método, URL) de las rutas críticas que ejercita al
 * menos un test de comportamiento.
 *
 * @returns {Promise<{total: number, covered: number, ratio: number, gaps: Array<{path: string, method: string}>}>}
 */
export async function scanCriticalBehavior() {
  const routes = loadRoutes();

  const pairs = [];
  for (const dir of TEST_DIRS) {
    for (const f of walk(join(ROOT, dir))) pairs.push(...extractBehaviorPairs(f));
  }

  let total = 0;
  let covered = 0;
  const gaps = [];
  for (const route of routes) {
    if (!isCriticalRoute(route.path)) continue;
    const re = routeToRegex(route.path);
    for (const method of route.methods) {
      if (!WRITE_METHODS.has(method)) continue;
      total++;
      if (pairs.some(([m, u]) => m === method && re.test(u))) covered++;
      else gaps.push({ path: route.path, method });
    }
  }

  return { total, covered, ratio: total ? covered / total : 0, gaps };
}

/** Métodos que mutan datos: sobre ellos se mide la cobertura T-61. */
const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Ruta Fastify → regex, por segmentos. El radix tree fusiona nodos
 * paramétricos en la misma posición (`:id|:inspectionId`): todo segmento que
 * empiece por `:` es un parámetro, sin importar qué siga. `*` → `.*`.
 *
 * Historia: la versión que escapaba el path completo y luego convertía
 * `:param` con /\\:…/ nunca matcheaba (el escape no antepone backslash al
 * `:`), así que TODA ruta parametrizada contaba como sin consumidor.
 *
 * @param {string} path
 * @returns {RegExp}
 */
function routeToRegex(path) {
  const body = path
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) return "[^/]+";
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
    })
    .join("/");
  return new RegExp("^" + body + "$");
}

/** Arranca la app real y serializa su árbol de rutas (fuente de verdad).
 *  Memoizado: el guard llama a varios escaneos en la misma corrida y cada
 *  arranque de la app (crons incluidos) cuesta ~8 s. */
let routesCache = null;
function loadRoutes() {
  if (routesCache) return routesCache;
  const outfile = join(mkdtempSync(join(tmpdir(), "route-guard-")), "routes.json");
  const tsx = join(ROOT, "node_modules", ".bin", "tsx");
  execFileSync(tsx, [join(ROOT, "scripts", "dump-routes.ts"), outfile], {
    cwd: ROOT,
    stdio: "pipe",
    timeout: 120_000,
    env: { ...process.env, NODE_ENV: "test", LOG_LEVEL: "silent" },
  });
  const routes = JSON.parse(readFileSync(outfile, "utf8"));
  rmSync(dirname(outfile), { recursive: true, force: true });
  routesCache = routes;
  return routes;
}

/**
 * Ejecuta el escaneo completo.
 * @returns {Promise<{total: number, withoutConsumer: Array<{path: string, methods: string[]}>, withoutTest: Array<{path: string, methods: string[]}>, excluded: Array<{path: string, methods: string[]}>}>}
 */
export async function scanRouteConsumers() {
  const routes = loadRoutes();

  const consumerUrls = collectUrls(CONSUMER_DIRS, ROUTE_DEF_RE);
  const testUrls = collectUrls(TEST_DIRS, null);

  const withoutConsumer = [];
  const withoutTest = [];
  const excluded = [];
  for (const route of routes) {
    const re = routeToRegex(route.path);
    if (!testUrls.some((u) => re.test(u))) {
      withoutTest.push({ path: route.path, methods: route.methods });
    }
    // Triaje T-47: exclusión documentada ⇒ no es superficie muerta. Se reporta
    // aparte para que el guard valide que la lista no se pudra.
    if (isExcluded(route.path)) {
      excluded.push({ path: route.path, methods: route.methods });
      continue;
    }
    if (!consumerUrls.some((u) => re.test(u))) {
      withoutConsumer.push({ path: route.path, methods: route.methods });
    }
  }

  return { total: routes.length, withoutConsumer, withoutTest, excluded };
}

// ── CLI ──────────────────────────────────────────────────────────────────
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const json = process.argv.includes("--json");
  const orphanIdx = process.argv.indexOf("--max-orphan");
  const untestedIdx = process.argv.indexOf("--max-untested");
  const behaviorIdx = process.argv.indexOf("--min-behavior");
  const maxOrphan = orphanIdx !== -1 ? Number(process.argv[orphanIdx + 1]) : null;
  const maxUntested = untestedIdx !== -1 ? Number(process.argv[untestedIdx + 1]) : null;
  const minBehavior = behaviorIdx !== -1 ? Number(process.argv[behaviorIdx + 1]) : null;

  const r = await scanRouteConsumers();
  const b = await scanCriticalBehavior();

  if (json) {
    console.log(JSON.stringify({ ...r, behavior: b }, null, 2));
  } else {
    console.log(
      `rutas registradas: ${r.total} · sin consumidor: ${r.withoutConsumer.length} · sin test: ${r.withoutTest.length} · excluidas (triaje): ${r.excluded.length}`,
    );
    const top = (list, n) =>
      list
        .slice(0, n)
        .map((x) => `    ${x.methods.join(",").padEnd(12)} ${x.path}`)
        .join("\n");
    console.log(`  peores sin consumidor:\n${top(r.withoutConsumer, 12)}`);
    console.log(`  peores sin test:\n${top(r.withoutTest, 12)}`);
    if (r.excluded.length) {
      console.log(
        `  excluidas por triaje:\n${r.excluded.map((x) => `    ${x.methods.join(",").padEnd(12)} ${x.path}`).join("\n")}`,
      );
    }
    const pct = (b.total ? (b.covered / b.total) * 100 : 0).toFixed(1);
    console.log(
      `  T-61 comportamiento (rutas críticas /workshop+/inventory+/billing, por par método+URL): ${b.covered}/${b.total} = ${pct}% (piso ${BEHAVIOR_COVERAGE_FLOOR * 100}%)`,
    );
    if (b.gaps.length) {
      console.log(
        `  pares críticos sin test de comportamiento (${b.gaps.length}):\n` +
          b.gaps.map((g) => `    ${g.method.padEnd(7)} ${g.path}`).join("\n"),
      );
    }
  }

  let failed = false;
  if (maxOrphan !== null && Number.isFinite(maxOrphan) && r.withoutConsumer.length > maxOrphan) {
    console.error(`FAIL: sinConsumidor=${r.withoutConsumer.length} > techo ${maxOrphan}`);
    failed = true;
  }
  if (maxUntested !== null && Number.isFinite(maxUntested) && r.withoutTest.length > maxUntested) {
    console.error(`FAIL: sinTest=${r.withoutTest.length} > techo ${maxUntested}`);
    failed = true;
  }
  if (minBehavior !== null && Number.isFinite(minBehavior) && b.ratio * 100 < minBehavior) {
    console.error(
      `FAIL: cobertura T-61=${(b.ratio * 100).toFixed(1)}% < piso ${minBehavior}% — faltan ${b.gaps.length} pares método+URL con test de comportamiento`,
    );
    failed = true;
  }
  if (failed) process.exit(1);
}
