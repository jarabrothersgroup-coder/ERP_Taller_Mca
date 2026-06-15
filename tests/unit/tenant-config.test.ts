import { describe, it, expect } from "vitest";
import { getSettings, saveSettings, invalidateCache } from "../../src/modules/config/services/TenantConfigService.js";

describe("TenantConfigService", () => {
  it("returns defaults when no config file exists", async () => {
    invalidateCache();
    const settings = await getSettings();
    expect(settings.companyName).toBe("Jara Brothers Group");
    expect(settings.rucOrTaxId).toBe("80000000-1");
    expect(settings.address).toContain("Coronel Oviedo");
  });

  it("merges partial updates", async () => {
    invalidateCache();
    const updated = await saveSettings({ phone: "+595 981 123 456" });
    expect(updated.phone).toBe("+595 981 123 456");
    expect(updated.companyName).toBe("Jara Brothers Group");
  });
});
