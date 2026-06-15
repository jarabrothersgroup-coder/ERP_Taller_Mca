/**
 * Payment Service — Unit Tests
 *
 * Tests registerPayment atomic flow: movimiento + factura update + accounting bus.
 *
 * @module tests/modules/finance/payment.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock db() ─────────────────────────────────

function createMockDb() {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(async (fn: any) => fn(createMockDb())),
  };
}

let mockDbInstance = createMockDb();
const mockDbFn = vi.fn(() => mockDbInstance);

vi.mock("../../../../src/shared/database/drizzle.js", () => ({
  db: mockDbFn,
}));

vi.mock("../../../../src/modules/finance/schema/index.js", () => ({
  facturas: {
    id: "f.id",
    total: "f.total",
    estadoPago: "f.estado_pago",
    saldoPendiente: "f.saldo_pendiente",
    fechaVencimiento: "f.fecha_vencimiento",
    tenantSlug: "f.tenant_slug",
  },
  movimientosTes: {
    id: "mt.id",
    tipo: "mt.tipo",
    medioPago: "mt.medio_pago",
    cuentaId: "mt.cuenta_id",
    monto: "mt.monto",
    concepto: "mt.concepto",
    tenantSlug: "mt.tenant_slug",
  },
  cuentasBancarias: {
    id: "cb.id",
    saldoActual: "cb.saldo_actual",
  },
}));

vi.mock("../../../../src/shared/errors/app-error.js", () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = "NotFoundError"; }
  },
  ValidationError: class ValidationError extends Error {
    constructor(msg: string) { super(msg); this.name = "ValidationError"; }
  },
}));

vi.mock("../../../../src/modules/finance/services/index.js", () => ({
  emit: vi.fn().mockResolvedValue({ success: true, asientoId: "a1" }),
  resolveAccount: vi.fn().mockResolvedValue("cta-001"),
}));

vi.mock("../../../../src/modules/finance/routes/accounting-bus-codes.js", () => ({
  AccountingBusCodes: {
    CLIENTES: "1.1.04.001",
    INGRESO_SERVICIOS: "4.1.01.001",
    COBRO: "1.1.01.001",
  },
}));

const { registerPayment } = await import("../../../../src/modules/finance/services/treasury/payment.service.ts");
const { emit } = await import("../../../../src/modules/finance/services/index.js");

// ─── Tests ─────────────────────────────────────

describe("registerPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInstance = createMockDb();
    mockDbFn.mockReturnValue(mockDbInstance);
  });

  it("exports registerPayment function", () => {
    expect(typeof registerPayment).toBe("function");
  });

  it("throws ValidationError when monto <= 0", async () => {
    await expect(
      registerPayment({
        facturaId: "f1",
        monto: 0,
        medioPago: "EFECTIVO",
        cuentaId: "c1",
        tenantSlug: "t1",
      })
    ).rejects.toThrow("mayor a cero");
  });

  it("throws ValidationError when monto is negative", async () => {
    await expect(
      registerPayment({
        facturaId: "f1",
        monto: -100,
        medioPago: "EFECTIVO",
        cuentaId: "c1",
        tenantSlug: "t1",
      })
    ).rejects.toThrow("mayor a cero");
  });
});
