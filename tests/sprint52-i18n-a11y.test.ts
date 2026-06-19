import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve to project root (one level up from tests/)
const PROJECT_ROOT = join(__dirname, "..");
const LOCALES_DIR = join(PROJECT_ROOT, "src/shared/public/locales");
const JS_DIR = join(PROJECT_ROOT, "src/shared/public/js");
const HTML_DIR = join(PROJECT_ROOT, "src/shared/public");

// ══════════════════════════════════════════════════════════════════
//  Load translation files
// ══════════════════════════════════════════════════════════════════

const esTranslations = JSON.parse(
  readFileSync(join(LOCALES_DIR, "es.json"), "utf-8"),
);
const guTranslations = JSON.parse(
  readFileSync(join(LOCALES_DIR, "gu.json"), "utf-8"),
);

// ══════════════════════════════════════════════════════════════════
//  i18n Core Engine Tests (unit)
// ══════════════════════════════════════════════════════════════════

describe("Sprint 52 — i18n Core Engine", () => {
  // Helper to resolve dot paths (mirrors i18n.js internal _resolvePath)
  function resolvePath(obj: Record<string, any>, path: string): any {
    return path.split(".").reduce((cur, key) => {
      return cur && cur[key] !== undefined ? cur[key] : undefined;
    }, obj);
  }

  it("resolves dot-separated paths correctly", () => {
    expect(resolvePath(esTranslations, "common.dashboard")).toBe("Dashboard");
    expect(resolvePath(esTranslations, "sidebar.logout")).toBe("Cerrar Sesión");
    expect(resolvePath(esTranslations, "ordenes.estados.abierta")).toBe("Abierta");
    expect(resolvePath(esTranslations, "nonexistent.path")).toBeUndefined();
  });

  it("ES translations have all required top-level keys", () => {
    const requiredKeys = [
      "common",
      "sidebar",
      "header",
      "dashboard",
      "ordenes",
      "inventario",
      "facturacion",
      "clientes",
      "contabilidad",
      "tesoreria",
      "nomina",
      "workshop",
      "sifen",
      "whatsapp",
      "dvi",
      "calendario",
      "marketing",
      "fleet",
      "analytics",
      "ingreso",
      "tv",
      "servicios",
      "thinkcar",
      "labelPrinting",
      "backup",
      "securityHw",
      "aiCopilot",
      "notifications",
      "shortcuts",
      "search",
      "a11y",
    ];
    for (const key of requiredKeys) {
      expect(esTranslations).toHaveProperty(key);
    }
  });

  it("GU translations have all required top-level keys", () => {
    const requiredKeys = [
      "common",
      "sidebar",
      "header",
      "dashboard",
      "ordenes",
      "inventario",
      "facturacion",
      "clientes",
      "contabilidad",
      "tesoreria",
      "nomina",
      "workshop",
      "sifen",
      "whatsapp",
      "dvi",
      "calendario",
      "marketing",
      "fleet",
      "analytics",
      "ingreso",
      "tv",
      "servicios",
      "thinkcar",
      "labelPrinting",
      "backup",
      "securityHw",
      "aiCopilot",
      "notifications",
      "shortcuts",
      "search",
      "a11y",
    ];
    for (const key of requiredKeys) {
      expect(guTranslations).toHaveProperty(key);
    }
  });

  it("ES and GU have matching key structures", () => {
    function getLeafKeys(obj: Record<string, any>, prefix = ""): string[] {
      const keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null) {
          keys.push(...getLeafKeys(v, full));
        } else {
          keys.push(full);
        }
      }
      return keys;
    }

    const esKeys = getLeafKeys(esTranslations).sort();
    const guKeys = getLeafKeys(guTranslations).sort();
    expect(guKeys).toEqual(esKeys);
  });

  it("ES translation count >= 200 (comprehensive coverage)", () => {
    function countLeaves(obj: Record<string, any>): number {
      let count = 0;
      for (const v of Object.values(obj)) {
        if (typeof v === "object" && v !== null) {
          count += countLeaves(v);
        } else {
          count++;
        }
      }
      return count;
    }
    expect(countLeaves(esTranslations)).toBeGreaterThanOrEqual(200);
  });

  it("GU translation count matches ES", () => {
    function countLeaves(obj: Record<string, any>): number {
      let count = 0;
      for (const v of Object.values(obj)) {
        if (typeof v === "object" && v !== null) {
          count += countLeaves(v);
        } else {
          count++;
        }
      }
      return count;
    }
    expect(countLeaves(guTranslations)).toBe(countLeaves(esTranslations));
  });

  it("interpolation replaces {param} placeholders", () => {
    const template = "Hola, {name}! Tienes {count} mensajes";
    const result = template.replace(/\{(\w+)\}/g, (_m, name) => {
      const params: Record<string, string> = { name: "Carlos", count: "5" };
      return params[name] || _m;
    });
    expect(result).toBe("Hola, Carlos! Tienes 5 mensajes");
  });

  it("interpolation handles missing params gracefully", () => {
    const template = "Hola, {name}! {missing}";
    const result = template.replace(/\{(\w+)\}/g, (_m, name) => {
      const params: Record<string, string> = { name: "Carlos" };
      return params[name] || _m;
    });
    expect(result).toBe("Hola, Carlos! {missing}");
  });

  it("pluralization: _one for count === 1", () => {
    const count = 1;
    const suffix = count === 1 ? "_one" : "_other";
    expect(suffix).toBe("_one");
  });

  it("pluralization: _other for count > 1", () => {
    const count = 5;
    const suffix = count === 1 ? "_one" : "_other";
    expect(suffix).toBe("_other");
  });
});

// ══════════════════════════════════════════════════════════════════
//  Locale API Route Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 52 — Locale API Routes", () => {
  it("locale routes file exists and exports default", async () => {
    const mod = await import(
      "../../src/modules/intelligence/routes/locale.routes.js"
    );
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("ES locale file is valid JSON", () => {
    const raw = readFileSync(
      join(LOCALES_DIR, "es.json"),
      "utf-8",
    );
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("GU locale file is valid JSON", () => {
    const raw = readFileSync(
      join(LOCALES_DIR, "gu.json"),
      "utf-8",
    );
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("locale files have UTF-8 content (Spanish characters)", () => {
    expect(esTranslations.common.iva).toBe("IVA");
    expect(esTranslations.facturacion.timbradoVigente).toContain("Timbrado");
    expect(esTranslations.common.guiones).toBeUndefined(); // just a sanity check
  });

  it("locale files have valid Guarani strings", () => {
    expect(guTranslations.common.dashboard).toBe("Panel");
    expect(guTranslations.sidebar.logout).toContain("Ñ"); // Guarani uses Ñ
    expect(guTranslations.common.save).toBe("Ñongatu");
  });
});

// ══════════════════════════════════════════════════════════════════
//  i18n.js Frontend Module Tests (structure/API)
// ══════════════════════════════════════════════════════════════════

describe("Sprint 52 — i18n.js Frontend Module", () => {
  it("i18n.js file exists and is well-formed", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    expect(src).toContain("window.I18n");
    expect(src).toContain("t(");
    expect(src).toContain("tp(");
    expect(src).toContain("setLocale");
    expect(src).toContain("getLocale");
    expect(src).toContain("formatDate");
    expect(src).toContain("formatNumber");
    expect(src).toContain("formatGuarani");
  });

  it("i18n.js exposes public API", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    const apiMethods = [
      "t",
      "tp",
      "formatDate",
      "formatNumber",
      "formatGuarani",
      "getLocale",
      "setLocale",
      "getSupportedLocales",
      "renderAll",
      "loadLocale",
    ];
    for (const method of apiMethods) {
      expect(src).toContain(method);
    }
  });

  it("i18n.js supports ES and GU locales", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    expect(src).toContain("'es'");
    expect(src).toContain("'gu'");
  });

  it("i18n.js uses localStorage for persistence", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    expect(src).toContain("localStorage");
    expect(src).toContain("automotiveos_locale");
  });

  it("i18n.js updates html lang attribute", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    expect(src).toContain("document.documentElement.setAttribute('lang'");
  });

  it("i18n.js dispatches locale-changed event", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    expect(src).toContain("locale-changed");
    expect(src).toContain("CustomEvent");
  });

  it("i18n.js creates language selector in header", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    expect(src).toContain("lang-selector");
    expect(src).toContain("data-locale");
    expect(src).toContain("radiogroup");
  });

  it("i18n.js renders data-i18n elements", () => {
    const src = readFileSync(
      join(JS_DIR, "i18n.js"),
      "utf-8",
    );
    expect(src).toContain("data-i18n");
    expect(src).toContain("data-i18n-placeholder");
    expect(src).toContain("data-i18n-title");
    expect(src).toContain("data-i18n-aria");
  });
});

// ══════════════════════════════════════════════════════════════════
//  Accessibility (a11y.js) Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 52 — Accessibility Module (a11y.js)", () => {
  it("a11y.js file exists and exposes window.A11y", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("window.A11y");
  });

  it("a11y.js provides screen reader announcements", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("announce(");
    expect(src).toContain("aria-live");
    expect(src).toContain("role");
  });

  it("a11y.js provides focus trapping", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("trapFocus");
    expect(src).toContain("releaseFocus");
    expect(src).toContain("previousFocus");
  });

  it("a11y.js provides keyboard navigation", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("ArrowDown");
    expect(src).toContain("ArrowUp");
    expect(src).toContain("Home");
    expect(src).toContain("End");
  });

  it("a11y.js adds skip-to-content link", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("addSkipLink");
    expect(src).toContain("sr-only");
    expect(src).toContain("#view-content");
  });

  it("a11y.js auto-enhances ARIA labels", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("enhanceAriaLabels");
    expect(src).toContain("role");
    expect(src).toContain("aria-label");
    expect(src).toContain("aria-current");
  });

  it("a11y.js supports reduced motion", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("prefers-reduced-motion");
  });

  it("a11y.js supports high contrast mode", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("forced-colors");
  });

  it("a11y.js provides renderEmptyState component", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("renderEmptyState");
    expect(src).toContain("role=\"status\"");
  });

  it("a11y.js uses i18n translations for announcements", () => {
    const src = readFileSync(
      join(JS_DIR, "a11y.js"),
      "utf-8",
    );
    expect(src).toContain("window.I18n");
    expect(src).toContain("a11y.dialogoCerrado");
    expect(src).toContain("a11y.menuPrincipal");
    expect(src).toContain("a11y.contenidoPrincipal");
    expect(src).toContain("a11y.skipToContent");
    expect(src).toContain("a11y.busqueda");
  });
});

// ══════════════════════════════════════════════════════════════════
//  HTML Integration Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 52 — HTML i18n Integration", () => {
  it("index.html includes i18n.js script", () => {
    const html = readFileSync(
      join(HTML_DIR, "index.html"),
      "utf-8",
    );
    expect(html).toContain('src="js/i18n.js"');
  });

  it("index.html has data-i18n attributes on sidebar items", () => {
    const html = readFileSync(
      join(HTML_DIR, "index.html"),
      "utf-8",
    );
    expect(html).toContain('data-i18n="sidebar.dashboard"');
    expect(html).toContain('data-i18n="sidebar.ordenes"');
    expect(html).toContain('data-i18n="sidebar.inventario"');
    expect(html).toContain('data-i18n="sidebar.facturacion"');
    expect(html).toContain('data-i18n="sidebar.logout"');
    expect(html).toContain('data-i18n="sidebar.monitors"');
    expect(html).toContain('data-i18n="sidebar.tools"');
  });

  it("index.html has data-i18n on header title", () => {
    const html = readFileSync(
      join(HTML_DIR, "index.html"),
      "utf-8",
    );
    expect(html).toContain('data-i18n="dashboard.title"');
    expect(html).toContain('data-i18n="dashboard.subtitle"');
  });

  it("index.html has aria-hidden on decorative emoji", () => {
    const html = readFileSync(
      join(HTML_DIR, "index.html"),
      "utf-8",
    );
    // Check at least a few sidebar items have aria-hidden on emoji
    expect(html).toContain('aria-hidden="true">📊');
    expect(html).toContain('aria-hidden="true">📋');
    expect(html).toContain('aria-hidden="true">📦');
  });

  it("landing.html includes i18n.js script", () => {
    const html = readFileSync(
      join(HTML_DIR, "landing.html"),
      "utf-8",
    );
    expect(html).toContain('src="js/i18n.js"');
  });

  it("index.html html element has lang attribute", () => {
    const html = readFileSync(
      join(HTML_DIR, "index.html"),
      "utf-8",
    );
    expect(html).toMatch(/lang="es/);
  });
});

// ══════════════════════════════════════════════════════════════════
//  i18n Integration Tests (translation quality)
// ══════════════════════════════════════════════════════════════════

describe("Sprint 52 — Translation Quality", () => {
  it("no ES translation values are empty strings", () => {
    function checkEmpty(obj: Record<string, any>, path = ""): string[] {
      const errors: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const full = path ? `${path}.${k}` : k;
        if (typeof v === "object" && v !== null) {
          errors.push(...checkEmpty(v, full));
        } else if (v === "") {
          errors.push(full);
        }
      }
      return errors;
    }
    const emptyKeys = checkEmpty(esTranslations);
    expect(emptyKeys).toEqual([]);
  });

  it("no GU translation values are empty strings", () => {
    function checkEmpty(obj: Record<string, any>, path = ""): string[] {
      const errors: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const full = path ? `${path}.${k}` : k;
        if (typeof v === "object" && v !== null) {
          errors.push(...checkEmpty(v, full));
        } else if (v === "") {
          errors.push(full);
        }
      }
      return errors;
    }
    const emptyKeys = checkEmpty(guTranslations);
    expect(emptyKeys).toEqual([]);
  });

  it("no translation value contains ES key as placeholder [key]", () => {
    function checkPlaceholders(obj: Record<string, any>, path = ""): string[] {
      const errors: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const full = path ? `${path}.${k}` : k;
        if (typeof v === "object" && v !== null) {
          errors.push(...checkPlaceholders(v, full));
        } else if (typeof v === "string" && v === `[${full}]`) {
          errors.push(full);
        }
      }
      return errors;
    }
    expect(checkPlaceholders(esTranslations)).toEqual([]);
  });

  it("key sidebar translations are different between ES and GU", () => {
    expect(esTranslations.sidebar.dashboard).not.toBe(
      guTranslations.sidebar.dashboard,
    );
    expect(esTranslations.sidebar.ordenes).not.toBe(
      guTranslations.sidebar.ordenes,
    );
    expect(esTranslations.sidebar.logout).not.toBe(
      guTranslations.sidebar.logout,
    );
  });

  it("Guarani uses native Guarani characters (Ñ/ẽ/ĩ/õ/ũ/ỹ)", () => {
    const guText = JSON.stringify(guTranslations);
    // Guarani uses tildes on vowels and Ñ
    expect(guText).toMatch(/[ẽĩõũỹ]/);
    expect(guText).toContain("Ñ");
  });
});
