import { describe, it, expect } from "vitest";
import { parseDtcError } from "../../src/modules/intelligence/services/vehicle-intelligence.service.js";

describe("DTC parser", () => {
  it("detects P0AA6 as critical HV isolation fault", () => {
    const result = parseDtcError("P0AA6");
    expect(result.severity).toContain("CRÍTICA");
    expect(result.action.toLowerCase()).toContain("aislamiento");
  });

  it("returns standard for unknown codes", () => {
    const result = parseDtcError("P1234");
    expect(result.severity).toBe("ESTÁNDAR");
    expect(result.action).toBeTruthy();
  });

  it("handles empty string", () => {
    const result = parseDtcError("");
    expect(result.severity).toBe("ESTÁNDAR");
  });
});
