import { describe, it, expect } from "vitest";

describe("Work order HV lockout logic", () => {
  const ORDEN_HV = {
    hvAlert: true,
    hvLockoutSigned: false,
    status: "En_Proceso",
  };

  const ORDEN_NO_HV = {
    hvAlert: false,
    hvLockoutSigned: false,
    status: "En_Proceso",
  };

  it("blocks completion when HV alert active and lockout unsigned", () => {
    const canComplete = !(ORDEN_HV.hvAlert && !ORDEN_HV.hvLockoutSigned);
    expect(canComplete).toBe(false);
  });

  it("allows completion when HV alert active and lockout signed", () => {
    const orden = { ...ORDEN_HV, hvLockoutSigned: true };
    const canComplete = !(orden.hvAlert && !orden.hvLockoutSigned);
    expect(canComplete).toBe(true);
  });

  it("allows completion when no HV alert", () => {
    const canComplete = !(ORDEN_NO_HV.hvAlert && !ORDEN_NO_HV.hvLockoutSigned);
    expect(canComplete).toBe(true);
  });
});
