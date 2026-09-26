/**
 * Dump the Fastify route table as JSON.
 *
 * Fuente de verdad del contrato FE↔BE: en vez de re-derivar las rutas con
 * análisis estático (que no replica las `prefix` anidadas de Fastify), se
 * arranca la app real y se serializa su árbol de rutas.
 *
 * Uso:
 *   npx tsx scripts/dump-routes.ts <outfile.json>
 *
 * El proceso se autocierra con process.exit(0) porque el arranque levanta
 * crons (backup worker, whatsapp retry, …) que mantendrían vivo el event loop.
 *
 * Consumido por tests/contract/fe-be-contract.test.ts.
 *
 * @module scripts/dump-routes
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export interface RouteEntry {
  path: string;
  methods: string[];
}

/**
 * Parses the radix-tree text returned by `app.printRoutes({ commonPrefix:false })`.
 *
 * Cada línea tiene la forma `<indentación><├──|└──> <sufijo> (GET, POST)`,
 * donde la indentación avanza de a 4 caracteres. El path completo es la
 * concatenación de los sufijos de todos los niveles.
 *
 * @param tree - texto impreso por printRoutes
 * @returns rutas con sus métodos (HEAD omitido: Fastify lo agrega solo)
 */
export function parsePrintedRoutes(tree: string): RouteEntry[] {
  const stack: string[] = [];
  const routes: RouteEntry[] = [];

  for (const line of tree.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^((?:(?:│| )   )*)(?:├── |└── )(.*)$/);
    if (!m) continue;

    const depth = m[1].length / 4;
    let rest = m[2];
    let methods: string[] = [];

    const methodsMatch = rest.match(/\s\(([A-Z, ]+)\)\s*$/);
    if (methodsMatch) {
      methods = methodsMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s !== "HEAD");
      rest = rest.slice(0, methodsMatch.index);
    }

    stack.length = depth;
    stack[depth] = rest;
    routes.push({ path: stack.slice(0, depth + 1).join(""), methods });
  }

  return routes;
}

async function main(): Promise<void> {
  const outfile = process.argv[2];
  if (!outfile) {
    console.error("Uso: npx tsx scripts/dump-routes.ts <outfile.json>");
    process.exit(2);
  }

  process.env.NODE_ENV ??= "test";
  process.env.LOG_LEVEL ??= "silent";

  const { buildApp } = await import("../src/app.js");
  const app = await buildApp();
  const routes = parsePrintedRoutes(app.printRoutes({ commonPrefix: false }));
  writeFileSync(outfile, JSON.stringify(routes, null, 2));
  process.exit(0);
}

// Solo arranca la app si el script se ejecuta directamente (tsx scripts/…),
// nunca al importarlo desde un test.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error("dump-routes failed:", err);
    process.exit(1);
  });
}
