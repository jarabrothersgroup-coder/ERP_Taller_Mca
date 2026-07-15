#!/usr/bin/env npx tsx
/**
 * SDK Generator — Generates TypeScript client from OpenAPI spec.
 *
 * Usage:
 *   npx tsx scripts/gen-sdk.ts [--output ./sdk] [--format esm|cjs]
 *
 * This script:
 *   1. Fetches the OpenAPI spec from the running server (or reads from file)
 *   2. Generates TypeScript types from the spec
 *   3. Creates a typed API client with method stubs
 *   4. Outputs to the specified directory
 *
 * @module scripts/gen-sdk
 */

import fs from "fs";
import path from "path";

// ─── Configuration ──────────────────────────────────────────────────────

const DEFAULT_OUTPUT = "./sdk";
const DEFAULT_FORMAT = "esm";
const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// ─── CLI Args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let outputDir = DEFAULT_OUTPUT;
let format: "esm" | "cjs" = DEFAULT_FORMAT;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output" && args[i + 1]) {
    outputDir = args[++i];
  }
  if (args[i] === "--format" && args[i + 1]) {
    format = args[++i] as "esm" | "cjs";
  }
}

// ─── Fetch OpenAPI Spec ─────────────────────────────────────────────────

async function fetchOpenApiSpec(): Promise<any> {
  // Try fetching from running server
  try {
    const response = await fetch(`${BASE_URL}/docs/json`);
    if (response.ok) {
      console.log(`✅ Fetched OpenAPI spec from ${BASE_URL}/docs/json`);
      return await response.json();
    }
  } catch {
    // Server not running, continue
  }

  // Try reading from file
  const specPath = path.join(process.cwd(), "openapi.json");
  if (fs.existsSync(specPath)) {
    console.log(`✅ Read OpenAPI spec from ${specPath}`);
    return JSON.parse(fs.readFileSync(specPath, "utf-8"));
  }

  console.error("❌ Could not find OpenAPI spec. Start the server or provide openapi.json");
  process.exit(1);
}

// ─── Generate Types ─────────────────────────────────────────────────────

function generateTypes(spec: any): string {
  const lines: string[] = [];

  lines.push("/**");
  lines.push(" * Auto-generated API types from OpenAPI spec.");
  lines.push(" * Do not edit manually — run `npx tsx scripts/gen-sdk.ts` to regenerate.");
  lines.push(" */");
  lines.push("");

  // Generate types from components/schemas
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas as Record<string, any>)) {
      lines.push(`/** ${schema.description || name} */`);
      lines.push(`export interface ${name} {`);

      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
          const tsType = mapJsonSchemaToTs(propSchema);
          const optional = !schema.required?.includes(prop) ? "?" : "";
          lines.push(`  ${prop}${optional}: ${tsType};`);
        }
      }

      lines.push("}");
      lines.push("");
    }
  } else {
    // No schemas defined in OpenAPI spec — generate placeholder
    lines.push("/** No schemas defined in OpenAPI spec. Add Swagger schema decorators to routes.");
    lines.push(" *  See: https://fastify.dev/docs/latest/Guides/Fluent-Schema/");
    lines.push(" */");
    lines.push("");
    lines.push("export type Placeholder = Record<string, any>;");
  }

  return lines.join("\n");
}

function mapJsonSchemaToTs(schema: any): string {
  if (schema.type === "string") return "string";
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array") {
    const itemType = schema.items ? mapJsonSchemaToTs(schema.items) : "any";
    return `${itemType}[]`;
  }
  if (schema.type === "object") return "Record<string, any>";
  if (schema.oneOf || schema.anyOf) return "any";
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    return refName || "any";
  }
  return "any";
}

// ─── Generate Client ────────────────────────────────────────────────────

function generateClient(spec: any): string {
  const lines: string[] = [];

  lines.push("/**");
  lines.push(" * Auto-generated API client from OpenAPI spec.");
  lines.push(" * Do not edit manually — run `npx tsx scripts/gen-sdk.ts` to regenerate.");
  lines.push(" */");
  lines.push("");
  lines.push("import type * as Types from './types.js';");
  lines.push("");
  lines.push("export interface ClientConfig {");
  lines.push("  baseUrl: string;");
  lines.push("  tenantSlug?: string;");
  lines.push("  apiKey?: string;");
  lines.push("  headers?: Record<string, string>;");
  lines.push("}");
  lines.push("");
  lines.push("export class AutomotiveOSClient {");
  lines.push("  private config: ClientConfig;");
  lines.push("");
  lines.push("  constructor(config: ClientConfig) {");
  lines.push("    this.config = config;");
  lines.push("  }");
  lines.push("");
  lines.push("  private async request<T>(");
  lines.push("    method: string,");
  lines.push("    path: string,");
  lines.push("    body?: any,");
  lines.push("    params?: Record<string, string>,");
  lines.push("  ): Promise<T> {");
  lines.push("    const url = new URL(path, this.config.baseUrl);");
  lines.push("");
  lines.push("    if (params) {");
  lines.push("      for (const [key, value] of Object.entries(params)) {");
  lines.push("        url.searchParams.set(key, value);");
  lines.push("      }");
  lines.push("    }");
  lines.push("");
  lines.push("    const headers: Record<string, string> = {");
  lines.push("      'Content-Type': 'application/json',");
  lines.push("      ...this.config.headers,");
  lines.push("    };");
  lines.push("");
  lines.push("    if (this.config.tenantSlug) {");
  lines.push("      headers['X-Tenant-Slug'] = this.config.tenantSlug;");
  lines.push("    }");
  lines.push("");
  lines.push("    if (this.config.apiKey) {");
  lines.push("      headers['Authorization'] = `Bearer ${this.config.apiKey}`;");
  lines.push("    }");
  lines.push("");
  lines.push("    const response = await fetch(url.toString(), {");
  lines.push("      method,");
  lines.push("      headers,");
  lines.push("      body: body ? JSON.stringify(body) : undefined,");
  lines.push("    });");
  lines.push("");
  lines.push("    if (!response.ok) {");
  lines.push("      const error = await response.json().catch(() => ({}));");
  lines.push("      throw new Error(error.message || `HTTP ${response.status}`);");
  lines.push("    }");
  lines.push("");
  lines.push("    return response.json();");
  lines.push("  }");
  lines.push("");

  // Generate method stubs from paths
  if (spec.paths) {
    for (const [pathStr, methods] of Object.entries(spec.paths as Record<string, any>)) {
      for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          const operationId = operation.operationId || generateOperationId(method, pathStr);
          const params = extractParams(pathStr, operation, method);

          lines.push(`  /** ${operation.summary || operation.description || operationId} */`);
          lines.push(`  async ${operationId}(${params.declaration}): Promise<any> {`);

          if (params.hasBody && method !== "get") {
            lines.push(`    return this.request('${method.toUpperCase()}', '${pathStr}', body${params.queryStr ? `, params` : ""});`);
          } else {
            lines.push(`    return this.request('${method.toUpperCase()}', '${pathStr}'${params.queryStr ? `, undefined, params` : ""});`);
          }

          lines.push("  }");
          lines.push("");
        }
      }
    }
  }

  lines.push("}");

  // Export factory function
  lines.push("");
  lines.push("/** Create a new API client instance. */");
  lines.push("export function createClient(config: ClientConfig): AutomotiveOSClient {");
  lines.push("  return new AutomotiveOSClient(config);");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function generateOperationId(method: string, path: string): string {
  const segments = path.split("/").filter(Boolean);
  const name = segments
    .map((s, i) => {
      if (s.startsWith(":") || s.startsWith("{")) {
        const paramName = s.replace(/[:{}]/g, "");
        return `By${paramName.charAt(0).toUpperCase() + paramName.slice(1)}`;
      }
      return s.charAt(0).toUpperCase() + s.slice(1);
    })
    .join("");

  return `${method}${name}`;
}

function extractParams(pathStr: string, operation: any, httpMethod?: string): {
  declaration: string;
  hasBody: boolean;
  queryStr: string;
} {
  const pathParams = (pathStr.match(/\{(\w+)\}/g) || []).map((m: string) => m.replace(/[{}]/g, ""));
  const queryParams =
    operation.parameters?.filter((p: any) => p.in === "query").map((p: any) => p.name) || [];
  const hasBody = ["post", "put", "patch"].includes(httpMethod || operation.method || "");

  const params: string[] = [];

  for (const p of pathParams) {
    params.push(`${p}: string`);
  }

  if (hasBody) {
    params.push("body?: any");
  }

  if (queryParams.length > 0) {
    params.push(`params?: { ${queryParams.map((q: string) => `${q}?: string`).join("; ")} }`);
  }

  return {
    declaration: params.join(", "),
    hasBody,
    queryStr: queryParams.length > 0 ? "params" : "",
  };
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log("🔧 AutomotiveOS SDK Generator");
  console.log(`   Output: ${outputDir}`);
  console.log(`   Format: ${format}`);
  console.log("");

  // Fetch spec
  const spec = await fetchOpenApiSpec();

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate types
  console.log("📝 Generating TypeScript types...");
  const types = generateTypes(spec);
  fs.writeFileSync(path.join(outputDir, "types.ts"), types);
  console.log(`   ✅ types.ts (${types.split("\n").length} lines)`);

  // Generate client
  console.log("📝 Generating API client...");
  const client = generateClient(spec);
  fs.writeFileSync(path.join(outputDir, "client.ts"), client);
  console.log(`   ✅ client.ts (${client.split("\n").length} lines)`);

  // Generate index
  console.log("📝 Generating index...");
  const index = `export { AutomotiveOSClient, createClient } from './client.js';
export type { ClientConfig } from './client.js';
export * from './types.js';
`;
  fs.writeFileSync(path.join(outputDir, "index.ts"), index);
  console.log(`   ✅ index.ts`);

  // Generate package.json for SDK
  const pkgJson = {
    name: "@automotiveos/sdk",
    version: spec.info?.version || "1.0.0",
    description: "TypeScript SDK for AutomotiveOS Cloud ERP API",
    main: format === "esm" ? "index.js" : "index.cjs",
    types: "index.d.ts",
    type: format === "esm" ? "module" : "commonjs",
    exports: {
      ".": {
        types: "./index.d.ts",
        default: format === "esm" ? "./index.js" : "./index.cjs",
      },
    },
    files: ["*.ts", "*.js", "*.d.ts", "*.cjs"],
    scripts: {
      build: "tsc",
    },
  };
  fs.writeFileSync(path.join(outputDir, "package.json"), JSON.stringify(pkgJson, null, 2));
  console.log(`   ✅ package.json`);

  // Generate README
  const readme = `# @automotiveos/sdk

TypeScript SDK for AutomotiveOS Cloud ERP API.

## Installation

\`\`\`bash
npm install @automotiveos/sdk
\`\`\`

## Usage

\`\`\`typescript
import { createClient } from '@automotiveos/sdk';

const client = createClient({
  baseUrl: 'http://localhost:3000',
  tenantSlug: 'taller_oviedo',
  apiKey: 'aos_live_...',
});

// List clients
const clients = await client.getWorkshopClientes();

// Create a vehicle
const vehicle = await client.postWorkshopVehiculos({
  brand: 'Toyota',
  model: 'Corolla',
  plate: 'ABC1234',
});

// List orders
const orders = await client.getWorkshopOrdenes({ status: 'En_Proceso' });
\`\`\`

## API Reference

See [Swagger UI](http://localhost:3000/docs) for full API documentation.
`;

  fs.writeFileSync(path.join(outputDir, "README.md"), readme);
  console.log(`   ✅ README.md`);

  console.log("");
  console.log("✅ SDK generated successfully!");
  console.log(`   Run \`cd ${outputDir} && npm install && npm run build\` to compile.`);
}

main().catch((err) => {
  console.error("❌ SDK generation failed:", err);
  process.exit(1);
});
