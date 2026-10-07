/**
 * T-00 — Test de contrato FE ↔ BE (auditoría 2026-09-25, Fase 0).
 *
 * Comprueba que lo que la UI (web/, mobile/ y el SPA legacy de
 * src/shared/public) le pide al backend existe realmente en el backend:
 *
 *  1. Toda ruta invocada desde la FE corresponde a una ruta Fastify.
 *  2. El método HTTP invocado está soportado por esa ruta.
 *  3. Toda llamada de web/src queda cubierta por un rewrite de Next
 *     (sin rewrite, Next responde el HTML de la página → 404 silencioso).
 *  4. Ninguna ruta del backend duplica su raíz (/crm/crm/…), que es la
 *     clase de bug que rompió CRM, Scheduling y Billing en Sprint 102.
 *
 * El mapa de rutas se obtiene arrancando la app real (scripts/dump-routes.ts)
 * en un proceso hijo: es la única forma fiable de replicar los `prefix`
 * anidados de Fastify. El hijo se autocierra para no dejar crons corriendo.
 *
 * @module tests/contract/fe-be-contract
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface RouteEntry {
  path: string;
  methods: string[];
}

interface FeCall {
  file: string;
  line: number;
  /** path normalizado: sin query, con `${…}` colapsado a comodines `*` */
  raw: string;
  method: string;
  /** el path venía de un template literal dinámico */
  dynamic: boolean;
  /** el path se construye por concatenación (`"/x/" + id`) */
  concatenated: boolean;
}

/* ── 1. Extracción de llamadas de la FE ─────────────────────────────── */

/**
 * Matchea `fetch("…")`, `request("…")`, `api.request("…")`,
 * `api.post("…")`, `client.get("…")`, etc. — es decir, sólo sitios donde
 * hay una llamada HTTP real, no links ni `router.push`.
 */
const CALL_SITE =
  /(?:\bfetch|\brequest|\bapi\.request|\bapi\.(?:get|post|patch|put|delete)|\bclient\.(?:get|post|patch|put|delete|request)|\.(?:request|get|post|patch|put|del))\s*(?:<[^>()]*>)?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gs;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/**
 * Reemplaza cada `${…}` (llaves balanceadas, respetando comillas) por un
 * comodín `*` que ocupa su propio segmento de path, de modo que
 * `` `/workshop/clientes${query ? `?${query}` : ""}` `` termine en
 * `/workshop/clientes/*` y no en `…clientes*`.
 */
function collapseTemplates(str: string): string {
  let out = "";
  let i = 0;
  while (i < str.length) {
    if (str[i] === "$" && str[i + 1] === "{") {
      let depth = 0;
      let quote: string | null = null;
      let j = i + 1;
      for (; j < str.length; j++) {
        const c = str[j];
        if (quote) {
          if (c === quote) quote = null;
          else if (c === "\\") j++;
          continue;
        }
        if (c === '"' || c === "'" || c === "`") {
          quote = c;
          continue;
        }
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      out += out && !out.endsWith("/") ? "/*" : "*";
      i = j + 1;
      continue;
    }
    out += str[i++];
  }
  return out;
}

/**
 * Determina el método HTTP a partir del callee (`.post(…)`) o de las
 * opciones (`{ method: "DELETE" }`), escaneando el argumento posterior al
 * literal de URL con balanceo de llaves/paréntesis.
 */
function detectMethod(src: string, afterLiteral: number, matched: string): string {
  const calleeName = matched.trim().replace(/\(.*/, "");
  let method: string | null = null;
  const fromCallee = /\.(post|patch|put|delete|del)$/i.exec(calleeName);
  if (fromCallee) method = fromCallee[1];
  else if (/^(post|patch|put|delete|del)$/i.test(calleeName)) method = calleeName;

  let depth = 1;
  let quote: string | null = null;
  let i = afterLiteral;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\") i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) break;
    } else if (c === "}" || c === "]") depth--;
  }
  const options = src.slice(afterLiteral, i);
  const fromOptions = /\bmethod\s*:\s*["'`]([A-Za-z]+)["'`]/.exec(options);
  if (fromOptions) method = fromOptions[1];

  if (!method) return "GET";
  const normalized = method.toLowerCase();
  return normalized === "del" ? "DELETE" : normalized.toUpperCase();
}

/** Extrae las llamadas HTTP de un directorio de la FE. */
function extractFeCalls(dirs: string[]): FeCall[] {
  const calls: FeCall[] = [];
  for (const dir of dirs) {
    for (const file of walk(path.join(ROOT, dir))) {
      const src = fs.readFileSync(file, "utf8");
      CALL_SITE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = CALL_SITE.exec(src))) {
        let raw = m[2];
        if (!raw.startsWith("/")) continue;

        const wasDynamic = m[1] === "`" || raw.includes("${");
        const concatenated = /^\s*\+/.test(
          src.slice(m.index + m[0].length, m.index + m[0].length + 40),
        );
        const method = detectMethod(src, m.index + m[0].length, m[0]);

        raw = raw.split("?")[0].split("#")[0];
        const collapsed = collapseTemplates(raw);
        // sólo paths con raíz de API: descarta links, rutas de Next, etc.
        const rootSegment = "/" + collapsed.split("/")[1];
        if (!API_ROOTS.test(rootSegment)) continue;

        calls.push({
          file: path.relative(ROOT, file),
          line: src.slice(0, m.index).split("\n").length,
          raw: collapsed,
          method,
          dynamic: wasDynamic,
          concatenated,
        });
      }
    }
  }
  return calls;
}

/** Raíces de API que el backend puede servir (se amplía en beforeAll). */
let API_ROOTS = /^$/;

/* ── 2. Matching contra el backend ──────────────────────────────────── */

function segments(p: string): string[] {
  return p.split("/").filter((s) => s.length > 0);
}

interface Hit {
  route: RouteEntry;
  exact: boolean;
}

function matchBackend(
  routes: RouteEntry[],
  target: string,
  allowDynamic: boolean,
): Hit[] {
  const t = segments(target);
  // Los comodines finales de un template dinámico significan "un segmento
  // extra o la query": sólo restringen el prefijo.
  while (t.length && t[t.length - 1] === "*" && allowDynamic) t.pop();

  const hits: Hit[] = [];
  for (const route of routes) {
    const b = segments(route.path);
    const exact = b.length === t.length;
    if (!exact && !(allowDynamic && b.length > t.length)) continue;

    let ok = true;
    for (let i = 0; i < t.length; i++) {
      const a = t[i];
      const c = b[i];
      if (a === "*" || c === "*" || c.startsWith(":")) continue;
      if (a !== c) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push({ route, exact });
  }
  return hits.sort((x, y) => Number(y.exact) - Number(x.exact));
}

/* ── 3. Rewrites de Next ────────────────────────────────────────────── */

interface Rewrite {
  source: string;
}

/** Primer segmento de la source de un rewrite, p.ej. `/api/:path*` → `/api`. */
function rewriteRoot(source: string): string {
  return "/" + source.split("/")[1];
}

/* ── 4. Suite ───────────────────────────────────────────────────────── */

describe("T-00 contrato FE ↔ BE", () => {
  let routes: RouteEntry[] = [];
  let calls: FeCall[] = [];
  let rewriteRoots = new Set<string>();

  beforeAll(async () => {
    const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "contract-")), "routes.json");
    const tsx = path.join(ROOT, "node_modules", ".bin", "tsx");
    execFileSync(tsx, [path.join(ROOT, "scripts", "dump-routes.ts"), outfile], {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 120_000,
      env: { ...process.env, NODE_ENV: "test", LOG_LEVEL: "silent" },
    });
    routes = JSON.parse(fs.readFileSync(outfile, "utf8")) as RouteEntry[];
    fs.rmSync(path.dirname(outfile), { recursive: true, force: true });

    // Raíces de API: las de las rutas del backend + las de los rewrites.
    // next.config.mjs devuelve la forma por secciones de Next
    // ({ beforeFiles, afterFiles, fallback }) desde Sprint 105 — aplanar.
    const nextConfig = (await import(
      pathToFileURL(path.join(ROOT, "web", "next.config.mjs")).href
    )) as {
      default: {
        rewrites(): Promise<
          Rewrite[] | { beforeFiles?: Rewrite[]; afterFiles?: Rewrite[]; fallback?: Rewrite[] }
        >;
      };
    };
    const rawRewrites = await nextConfig.default.rewrites();
    const rewrites: Rewrite[] = Array.isArray(rawRewrites)
      ? rawRewrites
      : [
          ...(rawRewrites.beforeFiles ?? []),
          ...(rawRewrites.afterFiles ?? []),
          ...(rawRewrites.fallback ?? []),
        ];
    rewriteRoots = new Set(rewrites.map((r) => rewriteRoot(r.source)));

    const roots = new Set<string>([
      ...routes.map((r) => "/" + r.path.split("/")[1]),
      ...rewriteRoots,
    ]);
    API_ROOTS = new RegExp(
      `^(${[...roots].map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`,
    );

    calls = extractFeCalls(["web/src", "mobile/src", "src/shared/public"]);
  }, 120_000);

  it("carga el mapa de rutas y las llamadas de la FE", () => {
    expect(routes.length).toBeGreaterThan(200);
    expect(calls.length).toBeGreaterThan(100);
  });

  it("toda ruta invocada por la FE existe en el backend", () => {
    const broken = calls.filter(
      (c) => matchBackend(routes, c.raw, c.dynamic || c.concatenated).length === 0,
    );
    const detail = broken
      .map((c) => `    ${c.raw}  ←  ${c.file}:${c.line}`)
      .join("\n");
    expect(
      broken,
      `${broken.length} llamada(s) de la FE sin ruta en el backend:\n${detail}`,
    ).toHaveLength(0);
  });

  it("el método HTTP invocado por la FE está soportado por la ruta", () => {
    const broken: string[] = [];
    for (const c of calls) {
      const hits = matchBackend(routes, c.raw, c.dynamic || c.concatenated);
      if (hits.length === 0) continue; // lo cubre el test anterior
      if (hits.some((h) => h.route.methods.includes(c.method))) continue;
      broken.push(
        `    ${c.method} ${c.raw}  ←  ${c.file}:${c.line}  (BE: ${hits
          .map((h) => `${h.route.path} [${h.route.methods.join(",")}]`)
          .join(" | ")})`,
      );
    }
    expect(
      broken,
      `${broken.length} método(s) no soportado(s):\n${broken.join("\n")}`,
    ).toHaveLength(0);
  });

  it("toda llamada de web/src queda cubierta por un rewrite de Next", () => {
    const webCalls = calls.filter((c) => c.file.startsWith("web/"));
    const broken = webCalls.filter(
      (c) => !rewriteRoots.has("/" + c.raw.split("/")[1]),
    );
    const detail = broken
      .map((c) => `    ${c.raw}  ←  ${c.file}:${c.line}`)
      .join("\n");
    expect(
      broken,
      `${broken.length} llamada(s) de web/ sin rewrite (Next respondería la página):\n${detail}`,
    ).toHaveLength(0);
  });

  it("ninguna ruta del backend duplica su raíz (/crm/crm/…)", () => {
    const duplicated = routes.filter((r) => {
      const segs = segments(r.path);
      return segs.some((s, i) => i > 0 && s === segs[i - 1]);
    });
    const detail = duplicated.map((r) => `    ${r.path}`).join("\n");
    expect(
      duplicated,
      `${duplicated.length} ruta(s) con prefijo duplicado (registro con prefix + path absoluto):\n${detail}`,
    ).toHaveLength(0);
  });
});
