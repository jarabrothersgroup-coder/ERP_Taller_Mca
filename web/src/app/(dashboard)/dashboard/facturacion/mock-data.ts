import type { UIMappedInvoice } from "@/lib/data-service";

const clients = [
  "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
  "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez",
  "Sofía Medina", "Diego Acosta",
];

export function getMockInvoices(): UIMappedInvoice[] {
  return Array.from({ length: 32 }, (_, i) => {
    const statuses: UIMappedInvoice["estado"][] = [
      "PENDIENTE", "PAGADA", "VENCIDA", "APROBADO_DNIT",
      "MANUAL_CONVERT_QUEUE", "PENDIENTE", "PAGADA", "ANULADA",
    ];
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 30);
    const totalAmount = [450000, 850000, 1250000, 320000, 2100000, 560000, 980000, 1750000][i % 8];
    return {
      id: `FAC-${String(100 + i).padStart(4, "0")}`,
      numero: `001-001-${String(1000000 + i).slice(0, 7)}`,
      cliente: clients[i % clients.length],
      ordenId: `OT-${String(100 + i).padStart(3, "0")}`,
      tipo: i % 2 === 0 ? "ELECTRONICA" : "MANUAL",
      total: totalAmount,
      estado: statuses[i % statuses.length],
      estadoPago: statuses[i % statuses.length] === "PAGADA" ? "PAGADA" : "PENDIENTE",
      fechaEmision: date.toLocaleDateString("es-PY"),
      fechaVencimiento: dueDate.toLocaleDateString("es-PY"),
      sifenStatus: statuses[i % statuses.length],
    };
  });
}
