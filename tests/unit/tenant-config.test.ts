import { describe, it, expect, afterEach } from "vitest";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  getSettings,
  saveSettings,
  invalidateCache,
} from "../../src/modules/config/services/TenantConfigService.js";

const CONFIG_DIR = join(process.cwd(), "config");

async function removeTenantFile(slug: string) {
  try {
    await unlink(join(CONFIG_DIR, `tenant_settings.${slug}.json`));
  } catch {
    /* ignore */
  }
}

afterEach(() => {
  invalidateCache();
});

describe("TenantConfigService", () => {
  it("returns defaults when no config file exists", async () => {
    invalidateCache();
    const settings = await getSettings();
    expect(settings.companyName).toBe("Jara Brothers Group");
    expect(settings.rucOrTaxId).toBe("80000000-1");
    expect(settings.address).toContain("Coronel Oviedo");
  });

  it("merges partial updates on the global file", async () => {
    invalidateCache();
    const updated = await saveSettings({ phone: "+595 981 123 456" });
    expect(updated.phone).toBe("+595 981 123 456");
    expect(updated.companyName).toBe("Jara Brothers Group");
  });

  it("isolates settings per tenant (one tenant does not overwrite another)", async () => {
    invalidateCache();
    const slugA = "taller-a-test";
    const slugB = "taller-b-test";
    await removeTenantFile(slugA);
    await removeTenantFile(slugB);

    const savedA = await saveSettings({ companyName: "Taller A SA" }, slugA);
    expect(savedA.companyName).toBe("Taller A SA");

    // Tenant B must still see the global default, not A's settings
    const settingsB = await getSettings(slugB);
    expect(settingsB.companyName).toBe("Jara Brothers Group");

    // Tenant A re-read keeps its own identity
    const settingsA = await getSettings(slugA);
    expect(settingsA.companyName).toBe("Taller A SA");

    // Global file untouched by tenant writes
    const global = await getSettings();
    expect(global.companyName).toBe("Jara Brothers Group");

    await removeTenantFile(slugA);
    await removeTenantFile(slugB);
    invalidateCache();
  });
});
