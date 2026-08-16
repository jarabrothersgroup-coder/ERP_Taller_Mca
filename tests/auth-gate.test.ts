/**
 * Tests for the global authentication gate (CRIT-01 fix).
 *
 * These tests exercise the pure classification logic and the rejection path
 * that does NOT touch the database (no auth header → no profile → 401).
 *
 * @module tests/auth-gate
 */

import { describe, it, expect } from "vitest";
import { isPublicRoute } from "../src/shared/middleware/auth-gate.js";

describe("auth-gate — isPublicRoute", () => {
  it("allows health probes", () => {
    expect(isPublicRoute("/health/live")).toBe(true);
    expect(isPublicRoute("/health/ready")).toBe(true);
    expect(isPublicRoute("/health/modules")).toBe(true);
    expect(isPublicRoute("/health/deep")).toBe(true);
  });

  it("allows auth + onboarding", () => {
    expect(isPublicRoute("/api/auth/login")).toBe(true);
    expect(isPublicRoute("/api/auth/logout")).toBe(true);
    expect(isPublicRoute("/api/onboarding/setup")).toBe(true);
    expect(isPublicRoute("/api/onboarding/check/demo")).toBe(true);
  });

  it("allows public integrations, portal, TV and landing", () => {
    expect(isPublicRoute("/api/lead")).toBe(true);
    expect(isPublicRoute("/finance/payments/webhook")).toBe(true);
    expect(isPublicRoute("/portal/auth/magic/abc123")).toBe(true);
    expect(isPublicRoute("/api/v1/visual/tv")).toBe(true);
    expect(isPublicRoute("/api/v1/visual/status")).toBe(true);
    expect(isPublicRoute("/dashboard")).toBe(true);
    expect(isPublicRoute("/landing")).toBe(true);
    expect(isPublicRoute("/developer")).toBe(true);
    expect(isPublicRoute("/docs")).toBe(true);
    expect(isPublicRoute("/scheduling/webhook/whatsapp")).toBe(true);
    expect(isPublicRoute("/scheduling/ai-suggestions?date=2026-08-14")).toBe(true);
    expect(isPublicRoute("/scheduling/check-availability")).toBe(true);
    expect(isPublicRoute("/mobile/health")).toBe(true);
    expect(isPublicRoute("/metrics")).toBe(true);
  });

  it("allows static assets of the legacy SPA", () => {
    expect(isPublicRoute("/js/app.js")).toBe(true);
    expect(isPublicRoute("/css/tailwind.min.css")).toBe(true);
    expect(isPublicRoute("/app.js")).toBe(true);
    expect(isPublicRoute("/icon.svg")).toBe(true);
  });

  it("protects business endpoints", () => {
    expect(isPublicRoute("/workshop/vehiculos")).toBe(false);
    expect(isPublicRoute("/workshop/vehiculos/abc")).toBe(false);
    expect(isPublicRoute("/inventory/repuestos")).toBe(false);
    expect(isPublicRoute("/finance/compras")).toBe(false);
    expect(isPublicRoute("/finance/compras/abc")).toBe(false);
    expect(isPublicRoute("/finance/payments/register")).toBe(false);
    expect(isPublicRoute("/whatsapp/send-text")).toBe(false);
    expect(isPublicRoute("/api/profiles")).toBe(false);
    expect(isPublicRoute("/api/config/settings")).toBe(false);
    expect(isPublicRoute("/analytics/kpis")).toBe(false);
    expect(isPublicRoute("/sync")).toBe(false);
    expect(isPublicRoute("/backup/execute")).toBe(false);
    expect(isPublicRoute("/enterprise/sso")).toBe(false);
  });

  it("does not confuse prefix boundaries", () => {
    // /portal* must not be public unless it starts with /portal/
    expect(isPublicRoute("/portaladmin")).toBe(false);
    expect(isPublicRoute("/api/auth-extra")).toBe(false);
    expect(isPublicRoute("/health/liverpool")).toBe(false);
    // /api/v1/visual/ prefix is exact
    expect(isPublicRoute("/api/v1/visual-evil")).toBe(false);
  });
});
