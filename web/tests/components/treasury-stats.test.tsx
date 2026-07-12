import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TreasuryStats } from "@/app/(dashboard)/dashboard/tesoreria/stats";
import type { CUentaRecord, MovimientoRecord, CxcRecord } from "@/app/(dashboard)/dashboard/tesoreria/columns";

const mockCuentas: CUentaRecord[] = [
  { id: "1", codigo: "1.1.01.001", nombre: "Banco Atlas", tipo: "BANCO", moneda: "PYG", saldoInicial: 5000000, saldoActual: 8500000, activo: true },
  { id: "2", codigo: "1.1.01.002", nombre: "Caja chica", tipo: "CAJA", moneda: "PYG", saldoInicial: 500000, saldoActual: 250000, activo: true },
  { id: "3", codigo: "1.1.01.003", nombre: "Banco Familiar USD", tipo: "BANCO", moneda: "USD", saldoInicial: 1000, saldoActual: 3500, activo: true },
];

const mockMovimientos: MovimientoRecord[] = [
  { id: "1", fecha: "10/7/2026", tipo: "INGRESO", concepto: "Cobro OT", cuentaNombre: "Banco Atlas", monto: 2500000, medioPago: "TRANSFERENCIA", conciliado: true },
  { id: "2", fecha: "10/7/2026", tipo: "EGRESO", concepto: "Compra repuestos", cuentaNombre: "Banco Atlas", monto: 850000, medioPago: "TARJETA", conciliado: false },
  { id: "3", fecha: "9/7/2026", tipo: "INGRESO", concepto: "Cobro efectivo", cuentaNombre: "Caja chica", monto: 150000, medioPago: "EFECTIVO", conciliado: true },
];

const mockCxc: CxcRecord[] = [
  { id: "1", cliente: "Juan Pérez", factura: "FC-001-001", total: 1500000, saldo: 1500000, vencimiento: "2026-07-15", diasVencido: 26 },
  { id: "2", cliente: "María López", factura: "FC-001-002", total: 2800000, saldo: 2800000, vencimiento: "2026-06-20", diasVencido: 52 },
  { id: "3", cliente: "Carlos Ruiz", factura: "FC-001-003", total: 950000, saldo: 0, vencimiento: "2026-08-01", diasVencido: 0 },
];

describe("TreasuryStats", () => {
  it("renders stat cards with correct labels", () => {
    render(<TreasuryStats cuentas={mockCuentas} movimientos={mockMovimientos} cxc={mockCxc} />);

    expect(screen.getByText("Cuentas Activas")).toBeInTheDocument();
    expect(screen.getByText("Saldo Total (PYG)")).toBeInTheDocument();
    expect(screen.getByText("Movimientos")).toBeInTheDocument();
    expect(screen.getByText("CxC Pendiente")).toBeInTheDocument();
  });

  it("calculates total PYG balance correctly", () => {
    render(<TreasuryStats cuentas={mockCuentas} movimientos={mockMovimientos} cxc={mockCxc} />);

    // 8,500,000 + 250,000 = 8,750,000 → "₲ 8.8M"
    expect(screen.getByText(/8\.8M/)).toBeInTheDocument();
  });

  it("shows USD total when USD accounts exist", () => {
    render(<TreasuryStats cuentas={mockCuentas} movimientos={mockMovimientos} cxc={mockCxc} />);
    expect(screen.getByText(/\$.*3.500.*USD/)).toBeInTheDocument();
  });

  it("shows CxC pendiente amount", () => {
    render(<TreasuryStats cuentas={mockCuentas} movimientos={mockMovimientos} cxc={mockCxc} />);
    // 1,500,000 + 2,800,000 = 4,300,000 → "₲ 4.3M"
    expect(screen.getByText(/4\.3M/)).toBeInTheDocument();
  });

  it("shows zero with empty data", () => {
    render(<TreasuryStats cuentas={[]} movimientos={[]} cxc={[]} />);
    // Multiple cards show "0" when data is empty
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
