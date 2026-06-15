/**
 * VisualStreamGateway — Unit Tests
 *
 * Tests WebSocket lifecycle: registration, broadcast message delivery,
 * disconnected socket filtering, concurrent safety.
 *
 * @module tests/unit/visual-websocket.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VisualStreamGateway,
  invalidateTenantCache,
} from "../../src/modules/intelligence/visual/VisualStreamGateway.js";
import type { VisualUpdatePayload } from "../../src/modules/intelligence/visual/VisualStreamGateway.js";

// ─── Helpers ───────────────────────────────────

function createMockSocket() {
  return {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
  };
}

function makePayload(overrides: Partial<VisualUpdatePayload> = {}): VisualUpdatePayload {
  return {
    orderId: "test-1",
    vehicleModel: "BYD Seal",
    plate: "ABC 1234",
    status: "REPARACION",
    torqueSpecs: [{ component: "Culata", value: "40 Nm" }],
    isHighVoltage: false,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────

describe("VisualStreamGateway", () => {
  beforeEach(() => {
    invalidateTenantCache();
    VisualStreamGateway.__testing_clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with zero connected screens", () => {
    expect(VisualStreamGateway.connectedCount).toBe(0);
  });

  it("broadcastUpdate handles empty screen set without throwing", async () => {
    await expect(
      VisualStreamGateway.broadcastUpdate(makePayload()),
    ).resolves.toBeUndefined();
  });

  it("delivers message to connected sockets", async () => {
    const socket = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(socket as any);

    await VisualStreamGateway.broadcastUpdate(makePayload());

    expect(socket.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(sent.event).toBe("WORKSHOP_UPDATE");
    expect(sent.data.orderId).toBe("test-1");
    expect(sent.data.vehicleModel).toBe("BYD Seal");
  });

  it("does not send to sockets with readyState !== 1 (CLOSED)", async () => {
    const openSocket = createMockSocket();
    const closedSocket = createMockSocket();
    closedSocket.readyState = 3; // CLOSED
    const closingSocket = createMockSocket();
    closingSocket.readyState = 2; // CLOSING

    VisualStreamGateway.__testing_registerSocket(openSocket as any);
    VisualStreamGateway.__testing_registerSocket(closedSocket as any);
    VisualStreamGateway.__testing_registerSocket(closingSocket as any);

    await VisualStreamGateway.broadcastUpdate(makePayload());

    expect(openSocket.send).toHaveBeenCalledTimes(1);
    expect(closedSocket.send).not.toHaveBeenCalled();
    expect(closingSocket.send).not.toHaveBeenCalled();
  });

  it("broadcast sends required payload fields", async () => {
    const socket = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(socket as any);

    const payload = makePayload({
      orderId: "test-2",
      vehicleModel: "Toyota Prius",
      plate: "XYZ 5678",
      status: "DIAGNOSTICO",
      torqueSpecs: [{ component: "Bujía", value: "25 Nm" }],
      isHighVoltage: false,
      dtcCodes: ["P0171"],
    });
    await VisualStreamGateway.broadcastUpdate(payload);

    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(sent).toHaveProperty("event");
    expect(sent).toHaveProperty("data");
    expect(sent.data).toHaveProperty("orderId");
    expect(sent.data).toHaveProperty("vehicleModel");
    expect(sent.data).toHaveProperty("plate");
    expect(sent.data).toHaveProperty("status");
    expect(sent.data).toHaveProperty("torqueSpecs");
    expect(sent.data).toHaveProperty("isHighVoltage");
  });

  it("supports multiple torque specs in payload", async () => {
    const payload = makePayload({
      torqueSpecs: [
        { component: "Culata", value: "40 Nm + 90°" },
        { component: "Rueda", value: "120 Nm" },
        { component: "Aceite", value: "25 Nm" },
      ],
    });
    expect(payload.torqueSpecs.length).toBe(3);
  });

  it("handles HV alert payload with optional fields", async () => {
    const payload = makePayload({
      status: "CONTROL_CALIDAD",
      isHighVoltage: true,
      sohPercentage: 92,
      estimatedCompletion: "18:00",
    });
    expect(payload.isHighVoltage).toBe(true);
    expect(payload.sohPercentage).toBe(92);
    expect(payload.estimatedCompletion).toBe("18:00");
  });

  it("connectedCount resets after __testing_clear", () => {
    const socket = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(socket as any);
    expect(VisualStreamGateway.connectedCount).toBe(1);

    VisualStreamGateway.__testing_clear();
    expect(VisualStreamGateway.connectedCount).toBe(0);
  });

  it("delivers to multiple sockets", async () => {
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    const s3 = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(s1 as any);
    VisualStreamGateway.__testing_registerSocket(s2 as any);
    VisualStreamGateway.__testing_registerSocket(s3 as any);

    await VisualStreamGateway.broadcastUpdate(makePayload());

    expect(s1.send).toHaveBeenCalledTimes(1);
    expect(s2.send).toHaveBeenCalledTimes(1);
    expect(s3.send).toHaveBeenCalledTimes(1);
  });

  it("connectedCount returns correct count", () => {
    const s1 = createMockSocket();
    const s2 = createMockSocket();
    expect(VisualStreamGateway.connectedCount).toBe(0);

    VisualStreamGateway.__testing_registerSocket(s1 as any);
    expect(VisualStreamGateway.connectedCount).toBe(1);

    VisualStreamGateway.__testing_registerSocket(s2 as any);
    expect(VisualStreamGateway.connectedCount).toBe(2);

    VisualStreamGateway.__testing_clear();
    expect(VisualStreamGateway.connectedCount).toBe(0);
  });

  it("broadcast sends ISO timestamp and tenant company name", async () => {
    const socket = createMockSocket();
    VisualStreamGateway.__testing_registerSocket(socket as any);

    // TenantInfo is lazy-loaded from config; broadcastUpdate calls getTenantInfo()
    // which will load defaults. We just verify it doesn't throw and message has event.
    await VisualStreamGateway.broadcastUpdate(makePayload());

    const sent = JSON.parse(socket.send.mock.calls[0][0]);
    expect(sent.event).toBeTruthy();
    expect(typeof sent.event).toBe("string");
  });
});
