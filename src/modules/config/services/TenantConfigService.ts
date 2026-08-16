import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_DIR = join(process.cwd(), "config");
const CONFIG_PATH = join(CONFIG_DIR, "tenant_settings.json");
const UPLOAD_DIR = join(process.cwd(), "assets", "uploads");
const GLOBAL_LOGO_NAME = "company_logo.png";

/**
 * Per-tenant settings path: `config/tenant_settings.<slug>.json`.
 * Falls back to the legacy global `config/tenant_settings.json` when the
 * tenant-specific file doesn't exist yet.
 */
function settingsPathFor(tenantSlug?: string): string {
  return tenantSlug
    ? join(CONFIG_DIR, `tenant_settings.${tenantSlug}.json`)
    : CONFIG_PATH;
}

function logoPathFor(tenantSlug?: string): string {
  return tenantSlug
    ? join(UPLOAD_DIR, `logo.${tenantSlug}.png`)
    : join(UPLOAD_DIR, GLOBAL_LOGO_NAME);
}

export interface TenantSettings {
  companyName: string;
  rucOrTaxId: string;
  address: string;
  phone: string;
  email: string;
  logoPath: string;
  currentUser: {
    name: string;
    role: string;
    signatureToken: string;
  };
}

const DEFAULTS: TenantSettings = {
  companyName: "Jara Brothers Group",
  rucOrTaxId: "80000000-1",
  address: "Coronel Oviedo, Paraguay",
  phone: "+595 981 000 000",
  email: "soporte@jarabrothers.com",
  logoPath: "assets/uploads/company_logo.png",
  currentUser: {
    name: "Jara",
    role: "Ingeniero de Diagnóstico / Administrador",
    signatureToken: "USER_SIG_01",
  },
};

/** Per-tenant cache — keyed by slug (`_global` for the legacy global file). */
const cache = new Map<string, TenantSettings | null>();

function cacheKey(tenantSlug?: string): string {
  return tenantSlug ?? "_global";
}

/**
 * Reads settings for a tenant (or global when no slug given).
 *
 * Resolution order:
 *   1. `config/tenant_settings.<slug>.json` (per-tenant)
 *   2. `config/tenant_settings.json` (legacy global — backward compat)
 *   3. DEFAULTS
 */
export async function getSettings(tenantSlug?: string): Promise<TenantSettings> {
  const key = cacheKey(tenantSlug);
  if (cache.has(key)) return cache.get(key)!;

  const candidates = tenantSlug
    ? [settingsPathFor(tenantSlug), CONFIG_PATH]
    : [CONFIG_PATH];

  for (const path of candidates) {
    try {
      const data = await readFile(path, "utf-8");
      const parsed = JSON.parse(data) as TenantSettings;
      cache.set(key, parsed);
      return parsed;
    } catch {
      // Try next candidate
    }
  }

  cache.set(key, DEFAULTS);
  return DEFAULTS;
}

/**
 * Persists settings for a tenant (or global when no slug given).
 * Writes to the per-tenant file so one tenant's identity never
 * overwrites another's.
 */
export async function saveSettings(
  partial: Partial<TenantSettings>,
  tenantSlug?: string,
): Promise<TenantSettings> {
  const current = await getSettings(tenantSlug);
  const updated = { ...current, ...partial };
  const path = settingsPathFor(tenantSlug);
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(updated, null, 2), "utf-8");
  cache.set(cacheKey(tenantSlug), updated);
  return updated;
}

/**
 * Returns the tenant's logo as a base64 data URL.
 *
 * Resolution order:
 *   1. `assets/uploads/logo.<slug>.png` (per-tenant)
 *   2. `assets/uploads/company_logo.png` (legacy global)
 *   3. Transparent 1x1 GIF
 */
export async function getLogoBase64(tenantSlug?: string): Promise<string> {
  const candidates = tenantSlug
    ? [logoPathFor(tenantSlug), join(UPLOAD_DIR, GLOBAL_LOGO_NAME)]
    : [join(UPLOAD_DIR, GLOBAL_LOGO_NAME)];

  for (const path of candidates) {
    try {
      const buffer = await readFile(path);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      // Try next candidate
    }
  }

  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}

/**
 * Invalidates the cache for one tenant (or all when called without args).
 */
export function invalidateCache(tenantSlug?: string): void {
  if (tenantSlug) {
    cache.delete(tenantSlug);
  } else {
    cache.clear();
  }
}
