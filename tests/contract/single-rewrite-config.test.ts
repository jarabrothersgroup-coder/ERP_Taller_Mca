/**
 * T-01 — Config única de rewrites (auditoría 2026-09-25, Fase 0).
 *
 * Antes había tres fuentes de verdad parciales y contradictorias:
 *   - `next.config.mjs` en la raíz (2 rewrites, obsoleto)
 *   - `web/next.config.mjs` (26 rewrites, el real)
 *   - `vercel.json` (9 rewrites apuntando a localhost:4000 + CORS `*`)
 *
 * Ahora sólo existe `web/next.config.mjs`. Este test impide que vuelvan a
 * divergir: si alguien reintroduce un next.config en la raíz, o rewrites/CORS
 * en vercel.json, el suite se pone en rojo.
 *
 * @module tests/contract/single-rewrite-config
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("T-01 config única de rewrites", () => {
  it("no existe un next.config en la raíz del repo", () => {
    const stale = ["next.config.mjs", "next.config.js", "next.config.ts"].filter(
      (f) => fs.existsSync(path.join(ROOT, f)),
    );
    expect(
      stale,
      `Config(s) obsoleta(s) en la raíz: ${stale.join(", ")}. ` +
        "La única fuente de verdad es web/next.config.mjs.",
    ).toHaveLength(0);
  });

  it("vercel.json no define rewrites propios ni CORS con comodín", () => {
    const vercel = readJson("vercel.json");

    expect(
      vercel.rewrites,
      "vercel.json no debe declarar rewrites: los define web/next.config.mjs " +
        "y duplicarlos genera destinos divergentes (localhost:3000 vs :4000).",
    ).toBeUndefined();

    const serialized = JSON.stringify(vercel);
    expect(
      serialized,
      "vercel.json no debe forzar Access-Control-Allow-Origin: * (SEG-05): " +
        "el CORS lo resuelve el backend con CORS_ORIGIN.",
    ).not.toContain("Access-Control-Allow-Origin");
  });

  it("web/next.config.mjs sigue siendo una config de rewrites completa", async () => {
    const config = (await import(
      pathToFileURL(path.join(ROOT, "web", "next.config.mjs")).href
    )) as { default: { rewrites(): Promise<{ source: string; destination: string }[]> } };

    const rewrites = await config.default.rewrites();
    expect(rewrites.length).toBeGreaterThanOrEqual(20);

    // Todo rewrite debe apuntar al backend (mismo path), nunca a un path de Next.
    const broken = rewrites.filter((r) => !r.destination.includes(r.source.split("/")[1]));
    expect(broken, `Rewrites con destino sospechoso: ${JSON.stringify(broken)}`).toHaveLength(
      0,
    );
  });
});
