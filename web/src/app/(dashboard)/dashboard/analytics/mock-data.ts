import type { UIMappedAnalyticsData } from "@/lib/data-service";

export interface TopService {
  id: string;
  nombre: string;
  cantidad: number;
  ingresos: number;
  popularidad: number;
}

export interface TopClient {
  id: string;
  nombre: string;
  vehiculos: number;
  ordenes: number;
  ingresos: number;
  ultimaVisita: string;
}

export interface ProductividadData {
  mes: string;
  ordenesAtendidas: number;
  horasTrabajadas: number;
  eficiencia: number;
  ingresosPorMecanico: number;
}

export function getMockAnalytics(): UIMappedAnalyticsData {
  return {
    totalIngresos: 28650000,
    totalOrdenes: 42,
    ordenesCompletadas: 28,
    productividad: 76,
    clientesAtendidos: 24,
    margenBruto: 58.3,
    ticketPromedio: 682143,
    mesActual: new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
  };
}

export const topServiciosMock: TopService[] = [
  { id: "svc-1", nombre: "Cambio de Aceite + Filtros", cantidad: 28, ingresos: 2380000, popularidad: 100 },
  { id: "svc-2", nombre: "Revisión de Frenos", cantidad: 22, ingresos: 3740000, popularidad: 79 },
  { id: "svc-3", nombre: "Alineación y Balanceo", cantidad: 18, ingresos: 1440000, popularidad: 64 },
  { id: "svc-4", nombre: "Diagnóstico Motor", cantidad: 15, ingresos: 2250000, popularidad: 54 },
  { id: "svc-5", nombre: "Cambio de Embrague", cantidad: 8, ingresos: 4800000, popularidad: 29 },
  { id: "svc-6", nombre: "Servicio de A/C", cantidad: 12, ingresos: 1800000, popularidad: 43 },
  { id: "svc-7", nombre: "Distribución (Correa + Bomba)", cantidad: 6, ingresos: 3900000, popularidad: 21 },
  { id: "svc-8", nombre: "Suspensión", cantidad: 9, ingresos: 2700000, popularidad: 32 },
];

export const topClientesMock: TopClient[] = [
  { id: "cli-1", nombre: "Flota Gómez S.A.", vehiculos: 8, ordenes: 15, ingresos: 5200000, ultimaVisita: "05/07/2026" },
  { id: "cli-2", nombre: "Transporte Norte", vehiculos: 12, ordenes: 22, ingresos: 8900000, ultimaVisita: "03/07/2026" },
  { id: "cli-3", nombre: "María González", vehiculos: 2, ordenes: 6, ingresos: 1850000, ultimaVisita: "28/06/2026" },
  { id: "cli-4", nombre: "Taller Mecánico Ortiz", vehiculos: 5, ordenes: 11, ingresos: 3400000, ultimaVisita: "25/06/2026" },
  { id: "cli-5", nombre: "Pedro López", vehiculos: 3, ordenes: 8, ingresos: 2100000, ultimaVisita: "20/06/2026" },
  { id: "cli-6", nombre: "Taxi Express", vehiculos: 15, ordenes: 28, ingresos: 10500000, ultimaVisita: "18/06/2026" },
  { id: "cli-7", nombre: "Lucía Fernández", vehiculos: 1, ordenes: 4, ingresos: 920000, ultimaVisita: "15/06/2026" },
  { id: "cli-8", nombre: "Distribuidora del Sur", vehiculos: 6, ordenes: 9, ingresos: 4100000, ultimaVisita: "12/06/2026" },
];

export const productividadMock: ProductividadData[] = [
  { mes: "Ene", ordenesAtendidas: 22, horasTrabajadas: 320, eficiencia: 68, ingresosPorMecanico: 3400000 },
  { mes: "Feb", ordenesAtendidas: 25, horasTrabajadas: 340, eficiencia: 72, ingresosPorMecanico: 3800000 },
  { mes: "Mar", ordenesAtendidas: 28, horasTrabajadas: 360, eficiencia: 75, ingresosPorMecanico: 4100000 },
  { mes: "Abr", ordenesAtendidas: 30, horasTrabajadas: 380, eficiencia: 78, ingresosPorMecanico: 4500000 },
  { mes: "May", ordenesAtendidas: 35, horasTrabajadas: 400, eficiencia: 82, ingresosPorMecanico: 5200000 },
  { mes: "Jun", ordenesAtendidas: 38, horasTrabajadas: 420, eficiencia: 85, ingresosPorMecanico: 5800000 },
  { mes: "Jul", ordenesAtendidas: 42, horasTrabajadas: 440, eficiencia: 76, ingresosPorMecanico: 6200000 },
];
