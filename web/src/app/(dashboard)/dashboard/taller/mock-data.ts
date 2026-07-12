import type { WorkOrder } from "./types";
import { technicians } from "./status-config";
import type { UIMappedWorkOrder } from "@/lib/data-service";

export const mockOrders: WorkOrder[] = Array.from({ length: 35 }, (_, i) => {
  const statuses: WorkOrder["status"][] = ["pending", "budgeted", "in_progress", "quality", "ready", "completed"];
  const status = statuses[i % statuses.length];
  const clients = ["María González", "Pedro López", "Juan Pérez", "Lucía Fernández", "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez"];
  const vehicles = ["Toyota Corolla", "Hyundai Tucson", "Kia Sportage", "VW Gol", "Chevrolet Onix", "Ford Ranger", "Nissan Frontier", "Suzuki Swift"];
  const services = ["Cambio de Aceite + Filtros", "Revisión de Frenos", "Alineación y Balanceo", "Diagnóstico Motor", "Cambio de Embrague", "Servicio de A/C", "Distribución", "Suspensión"];
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id: `OT-${String(100 + i).padStart(3, "0")}`,
    client: clients[i % clients.length],
    vehicle: vehicles[i % vehicles.length],
    plate: `ABC ${String(100 + i).slice(0, 3)}`,
    year: [2020, 2021, 2022, 2023, 2024][i % 5],
    service: services[i % services.length],
    status,
    technician: technicians[i % technicians.length],
    deadline: daysAgo < 1 ? "Hoy" : daysAgo < 2 ? "Mañana" : `${daysAgo} días`,
    estimatedCost: [450000, 850000, 120000, 250000, 1800000, 350000, 650000, 420000][i % 8],
    createdAt: date.toLocaleDateString("es-PY"),
    notes: i % 4 === 0 ? "Cliente solicita presupuesto antes de autorizar" : undefined,
  };
});

export function getMockOrders(): UIMappedWorkOrder[] {
  return mockOrders as unknown as UIMappedWorkOrder[];
}
