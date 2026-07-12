import type { CUentaRecord, MovimientoRecord, CxcRecord } from "./columns";

/* ── Mock Data ──────────────────────────────── */

const cuentasMock: CUentaRecord[] = [
  { id: "cta-1", codigo: "1.1.01.001", nombre: "Caja Chica", tipo: "CAJA", moneda: "PYG", saldoInicial: 2000000, saldoActual: 1850000, activo: true },
  { id: "cta-2", codigo: "1.1.01.002", nombre: "Banco Continental", tipo: "CORRIENTE", moneda: "PYG", saldoInicial: 25000000, saldoActual: 18750000, activo: true },
  { id: "cta-3", codigo: "1.1.01.003", nombre: "Paypy (Bco Itaú)", tipo: "CORRIENTE", moneda: "PYG", saldoInicial: 15000000, saldoActual: 22300000, activo: true },
  { id: "cta-4", codigo: "1.1.01.004", nombre: "Caja USD", tipo: "CAJA", moneda: "USD", saldoInicial: 1500, saldoActual: 1200, activo: true },
];

export function getMockCuentas(): CUentaRecord[] {
  return cuentasMock;
}

const tiposMovimiento = ["INGRESO", "EGRESO", "TRANSFERENCIA"] as const;
const mediosPago = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "TARJETA_CREDITO", "TARJETA_DEBITO"];
const conceptos = [
  "Cobro factura FAC-001",
  "Pago proveedor Proauto S.A.",
  "Transferencia a caja chica",
  "Venta contado - Servicio",
  "Compra de repuestos",
  "Pago de servicios (AND E)",
  "Retiro socio",
  "Depósito cliente",
  "Pago a cuenta IPS",
  "Cobro factura FAC-015",
];

export function getMockMovimientos(): MovimientoRecord[] {
  return Array.from({ length: 25 }, (_, i) => {
    const tipo = tiposMovimiento[i % 3];
    const monto = [850000, 450000, 1200000, 320000, 560000, 920000, 180000, 2500000, 750000, 480000][i % 10];
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const conciliado = i % 5 !== 0;

    return {
      id: `mov-${String(i + 1).padStart(4, "0")}`,
      tipo: tipo as MovimientoRecord["tipo"],
      medioPago: mediosPago[i % mediosPago.length],
      cuentaNombre: cuentasMock[i % cuentasMock.length].nombre,
      monto,
      concepto: conceptos[i % conceptos.length],
      fecha: date.toLocaleDateString("es-PY"),
      conciliado,
    };
  });
}

export function getMockCxc(): CxcRecord[] {
  const clientes = [
    "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
    "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez",
  ];
  return Array.from({ length: 12 }, (_, i) => {
    const total = [450000, 850000, 1200000, 320000, 2100000, 560000][i % 6];
    const saldo = [0, total, total * 0.5, total, 0, total * 0.75][i % 6];
    const daysAgo = [30, 15, 5, 45, 60, 10, 25, 50, 20, 35, 55, 40][i];
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    return {
      id: `cxc-${String(i + 1).padStart(3, "0")}`,
      cliente: clientes[i % clientes.length],
      factura: `FAC-${String(100 + i).padStart(4, "0")}`,
      total,
      saldo,
      vencimiento: date.toLocaleDateString("es-PY"),
      diasVencido: daysAgo,
    };
  });
}
