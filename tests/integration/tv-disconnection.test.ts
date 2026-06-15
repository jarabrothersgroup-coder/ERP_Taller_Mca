/**
 * TV Disconnection Resilience — Unit Tests
 *
 * Tests VisualStreamGateway behavior under edge cases:
 * - Closed/closing sockets
 * - Rapid concurrent broadcasts
 * - Concurrent cache invalidation
 *
 * @module tests/integration/tv-disconnection.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  VisualStreamGateway,
  invalidateTenantCache,
} from "../../src/modules/intelligence/visual/VisualStreamGateway.js";

function createMockSocket() {
  return {
    readyState: 1, // OPEN
    send: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
  };
}

describe("TV disconnection resilience", () => {
  beforeEach(() => {
    invalidateTenantCache();
    VisualStreamGateway.__testing_clear();
  });

  it("broadcastUpdate handles closed sockets without throwing", async () => {
    const closedSocket = {
      readyState: 3, // CLOSED
      send: vi.fn(),
      ping: vi.fn(),
      on: vi.fn(),
    };
    const closingSocket = {
      readyState: 2, // CLOSING
      send: vi.fn(),
      ping: vi.fn(),
      on: vi.fn(),
    };
    const openSocket = createMockSocket();

    VisualStreamGateway.__testing_registerSocket(closedSocket as any);
    VisualStreamGateway.__testing_registerSocket(closingSocket as any);
    VisualStreamGateway.__testing_registerSocket(openSocket as any);

    await expect(
      VisualStreamGateway.broadcastUpdate({
        orderId: "disc-test-1",
        vehicleModel: "Test",
        plate: "TST 0001",
        status: "REPARACION",
        torqueSpecs: [{ component: "X", value: "10 Nm" }],
        isHighVoltage: false,
      }),
    ).resolves.toBeUndefined();

    // Only open socket should receive the message
    expect(openSocket.send).toHaveBeenCalledTimes(1);
    expect(closedSocket.send).not.toHaveBeenCalled();
    expect(closingSocket.send).not.toHaveBeenCalled();
  });

  it("multiple rapid broadcasts do not cause errors", async () => {
    const socket = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(socket as any);

    const promises = Array.from({ length: 10 }, (_, i) =>
      VisualStreamGateway.broadcastUpdate({
        orderId: `rapid-${i}`,
        vehicleModel: "Rapid Test",
        plate: "RPD 0001",
        status: "DIAGNOSTICO",
        torqueSpecs: [],
        isHighVoltage: false,
      }),
    );

    await expect(Promise.all(promises)).resolves.toBeDefined();
    expect(socket.send).toHaveBeenCalledTimes(10);
  });

  it("broadcastUpdate with zero torque specs does not throw", async () => {
    const socket = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(socket as any);

    await expect(
      VisualStreamGateway.broadcastUpdate({
        orderId: "no-torque",
        vehicleModel: "No Torque",
        plate: "NTQ 0001",
        status: "CONTROL_CALIDAD",
        torqueSpecs: [],
        isHighVoltage: false,
      }),
    ).resolves.toBeUndefined();
  });

  it("concurrent invalidateTenantCache calls handled safely", async () => {
    expect(() => {
      for (let i = 0; i < 100; i++) invalidateTenantCache();
    }).not.toThrow();
  });

  it("broadcast after all sockets disconnect does not throw", async () => {
    const socket = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(socket as any);
    VisualStreamGateway.__testing_clear();

    await expect(
      VisualStreamGateway.broadcastUpdate({
        orderId: "no-sockets",
        vehicleModel: "Test",
        plate: "TST 0001",
        status: "REPARACION",
        torqueSpecs: [],
        isHighVoltage: false,
      }),
    ).resolves.toBeUndefined();
  });

  it("broadcast to empty set at startup does not throw", async () => {
    await expect(
      VisualStreamGateway.broadcastUpdate({
        orderId: "startup-test",
        vehicleModel: "Test",
        plate: "TST 0001",
        status: "REPARACION",
        torqueSpecs: [{ component: "Test", value: "10 Nm" }],
        isHighVoltage: false,
      }),
    ).resolves.toBeUndefined();
  });
});
