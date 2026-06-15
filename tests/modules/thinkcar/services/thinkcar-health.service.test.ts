/**
 * Thinkcar Health Service — Unit Tests
 *
 * @module tests/modules/thinkcar/services/thinkcar-health.test
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSuccess,
  recordError,
  getAllHealth,
  getChannelHealth,
  resetChannelHealth,
} from "../../../../src/modules/thinkcar/services/thinkcar-health.service.js";

describe("Thinkcar Ingestion Health", () => {
  beforeEach(() => {
    resetChannelHealth("usb");
    resetChannelHealth("email");
    resetChannelHealth("bluetooth");
  });

  describe("recordSuccess", () => {
    it("updates lastSuccessAt and resets consecutiveFailures", () => {
      recordError("usb", "error 1");
      recordError("usb", "error 2");
      const before = getChannelHealth("usb");
      expect(before.consecutiveFailures).toBe(2);
      expect(before.isHealthy).toBe(true); // still < 3

      recordSuccess("usb");
      const after = getChannelHealth("usb");
      expect(after.consecutiveFailures).toBe(0);
      expect(after.lastSuccessAt).not.toBeNull();
      expect(after.totalProcessed).toBe(1);
    });
  });

  describe("recordError", () => {
    it("increments consecutiveFailures and totalErrors", () => {
      recordError("email", "connection failed");
      const h = getChannelHealth("email");
      expect(h.consecutiveFailures).toBe(1);
      expect(h.totalErrors).toBe(1);
      expect(h.lastErrorMessage).toBe("connection failed");
      expect(h.lastErrorAt).not.toBeNull();
    });

    it("marks unhealthy after 3 consecutive failures", () => {
      recordError("bluetooth", "fail 1");
      expect(getChannelHealth("bluetooth").isHealthy).toBe(true);

      recordError("bluetooth", "fail 2");
      expect(getChannelHealth("bluetooth").isHealthy).toBe(true);

      recordError("bluetooth", "fail 3");
      expect(getChannelHealth("bluetooth").isHealthy).toBe(false);
    });
  });

  describe("resetChannelHealth", () => {
    it("restores defaults for the channel", () => {
      recordError("usb", "some error");
      recordSuccess("usb");
      resetChannelHealth("usb");

      const h = getChannelHealth("usb");
      expect(h.consecutiveFailures).toBe(0);
      expect(h.lastSuccessAt).toBeNull();
      expect(h.lastErrorAt).toBeNull();
      expect(h.totalProcessed).toBe(0);
      expect(h.totalErrors).toBe(0);
      expect(h.isHealthy).toBe(true);
    });
  });

  describe("getAllHealth", () => {
    it("returns 3 channels", () => {
      const all = getAllHealth();
      expect(all).toHaveLength(3);
      const channels = all.map((h) => h.channel).sort();
      expect(channels).toEqual(["bluetooth", "email", "usb"]);
    });
  });

  describe("getChannelHealth", () => {
    it("returns a copy, not the same reference", () => {
      const h1 = getChannelHealth("usb");
      const h2 = getChannelHealth("usb");
      expect(h1).not.toBe(h2); // different references
    });
  });
});
