import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_DIR = join(process.cwd(), "config");
const CONFIG_PATH = join(CONFIG_DIR, "tenant_settings.json");
const UPLOAD_DIR = join(process.cwd(), "assets", "uploads");

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

let cached: TenantSettings | null = null;

export async function getSettings(): Promise<TenantSettings> {
  if (cached) return cached;
  try {
    const data = await readFile(CONFIG_PATH, "utf-8");
    cached = JSON.parse(data) as TenantSettings;
    return cached;
  } catch {
    return DEFAULTS;
  }
}

export async function saveSettings(partial: Partial<TenantSettings>): Promise<TenantSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
  cached = updated;
  return updated;
}

export async function getLogoBase64(): Promise<string> {
  const logoPath = join(UPLOAD_DIR, "company_logo.png");
  try {
    const buffer = await readFile(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  }
}

export function invalidateCache(): void {
  cached = null;
}
