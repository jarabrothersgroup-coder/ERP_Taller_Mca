/**
 * AutomotiveOS Mobile — API Client
 *
 * Typed fetch wrapper for the Fastify backend.
 * Same endpoints as the web app, accessed via the configured backend URL.
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

const BASE_HEADERS = {
  "Content-Type": "application/json",
  "X-Tenant-Slug": "demo",
} as const;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${url}`, {
    ...options,
    headers: { ...BASE_HEADERS, ...options?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? "Error de red");
  }

  return res.json() as Promise<T>;
}

/* ── Types ──────────────────────────────────── */

export interface WorkOrder {
  id: string;
  vehicleId: string;
  clientId: string;
  description: string | null;
  status: string;
  hvAlert: boolean;
  hvLockoutSigned: boolean;
  dtcCodes: string[] | null;
  createdAt: string;
  updatedAt: string;
  vehiculo: string | null;
  plate: string | null;
  cliente: string | null;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ruc: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  plate: string | null;
  vin: string | null;
  brand: string;
  model: string;
  year: number | null;
  engineType: string;
  kilometraje: number | null;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalIngresos: number;
  totalOrdenes: number;
  ordenesCompletadas: number;
  productividad: number;
  clientesAtendidos: number;
  margenBruto: number;
  ticketPromedio: number;
  mesActual: string;
}

export interface Appointment {
  id: string;
  clienteNombre: string;
  vehiculoChapa: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  clientePhone: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipoServicio: string;
  estado: string;
  notas: string | null;
  createdAt: string;
}

/* ── API Methods ────────────────────────────── */

export const api = {
  // Dashboard
  getDashboard: () => request<DashboardStats>("/intelligence/dashboard"),

  // Work Orders
  listWorkOrders: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<WorkOrder[]>(`/workshop/ordenes${query ? `?${query}` : ""}`);
  },

  getWorkOrder: (id: string) => request<WorkOrder>(`/workshop/ordenes/${id}`),

  // Clients
  listClients: () => request<Client[]>("/workshop/clientes"),

  getClient: (id: string) => request<Client>(`/workshop/clientes/${id}`),

  // Vehicles
  listVehicles: () => request<Vehicle[]>("/workshop/vehiculos"),

  getVehicle: (id: string) => request<Vehicle>(`/workshop/vehiculos/${id}`),

  // Appointments
  listAppointments: () => request<Appointment[]>("/scheduling/citas"),

  // Mutations
  createWorkOrder: (data: { vehicleId: string; clientId: string; description?: string; status?: string }) =>
    request<WorkOrder>("/workshop/ordenes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateWorkOrderStatus: (id: string, data: { status: string }) =>
    request<WorkOrder>(`/workshop/ordenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  createClient: (data: { name: string; email?: string; phone?: string; ruc?: string }) =>
    request<Client>("/workshop/clientes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createVehicle: (data: { clientId: string; brand: string; model: string; plate?: string; year?: number; engineType: string; vin?: string }) =>
    request<Vehicle>("/workshop/vehiculos", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
