/**
 * AutomotiveOS Mobile — API Client
 *
 * Typed fetch wrapper for the Fastify backend.
 * Same endpoints as the web app, accessed via the configured backend URL.
 * Injects the per-tenant slug + JWT from the secure session at request time.
 */

import { getSession } from "../auth/session";

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
export { BACKEND_URL };

/**
 * Envelope paginado que devuelve el backend en los listados server-side (T-54).
 * Mismo contrato que `web/src/lib/api.ts` (`PaginatedResponse`).
 */
export interface PaginatedItems<T> {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

/** Desenvuelve `{ items, … }`; tolera un array plano por compatibilidad. */
function unwrapItems<T>(res: PaginatedItems<T> | T[]): T[] {
  return Array.isArray(res) ? res : (res.items ?? []);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const session = await getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  // Tenant resolution: explicit slug from session, else fall back to header/env.
  if (session?.slug) {
    headers["X-Tenant-Slug"] = session.slug;
  } else if (process.env.EXPO_PUBLIC_TENANT_SLUG) {
    headers["X-Tenant-Slug"] = process.env.EXPO_PUBLIC_TENANT_SLUG;
  } else {
    headers["X-Tenant-Slug"] = "demo";
  }

  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }

  const res = await fetch(`${BACKEND_URL}${url}`, {
    ...options,
    headers,
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

/* ── DVI Types ─────────────────────────────── */

export interface DVIInspection {
  id: string;
  ordenTrabajoId: string;
  healthScore: number;
  condicionGeneral: string;
  observaciones: string | null;
  inspector: string | null;
  compartidoWhatsApp: boolean;
  compartidoAt: string | null;
  healthScoreUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Accounting Types ─────────────────────────── */

export interface BalanceCuenta {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  saldoInicial: number;
  totalDebe: number;
  totalHaber: number;
  saldoActual: number;
  cuentaPadreId: string | null;
}

export interface BalanceGrupo {
  codigo: string;
  nombre: string;
  nivel: number;
  saldo: number;
  subcuentas: BalanceCuenta[];
}

export interface BalanceSeccion {
  tipo: string;
  label: string;
  total: number;
  grupos: BalanceGrupo[];
  cuentasDirectas: BalanceCuenta[];
}

export interface BalanceGeneral {
  fecha: string;
  activo: BalanceSeccion;
  pasivo: BalanceSeccion;
  patrimonio: BalanceSeccion;
  totalActivo: number;
  totalPasivoPatrimonio: number;
  diferencia: number;
  balanceado: boolean;
}

export interface PnLCuenta {
  cuentaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  totalDebe: number;
  totalHaber: number;
  saldo: number;
}

export interface PnLGrupo {
  codigo: string;
  nombre: string;
  saldo: number;
  cuentas: PnLCuenta[];
}

export interface PnLSeccion {
  total: number;
  grupos: PnLGrupo[];
  cuentas: PnLCuenta[];
}

export interface EstadoResultados {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  ingresos: PnLSeccion;
  costos: PnLSeccion;
  gastos: PnLSeccion;
  utilidadBruta: number;
  utilidadNeta: number;
}

export interface RG90Report {
  periodo: { anho: number; mes: number };
  totalRegistros: number;
  totalVentas?: string;
  formato: "JSON" | "TXT" | "CSV";
  entries: Record<string, any>[];
  contenido?: string;
}

/* ── API Methods ────────────────────────────── */

export interface LoginResult {
  ok: boolean;
  token: string;
  profile: { id: string; email: string; full_name: string; role: string; is_active: boolean };
  tenant: { name: string; slug: string; ruc: string };
}

export const api = {
  // Auth
  login: (tenantSlug: string, email: string, password: string) =>
    request<LoginResult>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ tenantSlug, email, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  // Dashboard — workshop KPIs (nested payload mapped to the flat mobile stats)
  getDashboard: () =>
    request<{
      ordenes?: { totalMes?: number; completadasHoy?: number };
      finanzas?: { ingresosMes?: number };
      taller?: { facturacionPromedioOT?: number };
    }>("/workshop/analytics/dashboard").then((k) => ({
      totalIngresos: Number(k.finanzas?.ingresosMes ?? 0),
      totalOrdenes: Number(k.ordenes?.totalMes ?? 0),
      ordenesCompletadas: Number(k.ordenes?.completadasHoy ?? 0),
      productividad: 0,
      clientesAtendidos: 0,
      margenBruto: 0,
      ticketPromedio: Number(k.taller?.facturacionPromedioOT ?? 0),
      mesActual: new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
    })),

  // Accounting Reports
  getBalanceGeneral: (fecha: string) => request<BalanceGeneral>(`/finance/contabilidad/balance-general/${fecha}`),
  getEstadoResultados: (anho: number, mes: number, acumulado?: boolean) => {
    const params = new URLSearchParams();
    if (acumulado !== undefined) params.set("acumulado", String(acumulado));
    const query = params.toString();
    const base = `/finance/contabilidad/estado-resultados/${anho}/${mes}`;
    return request<EstadoResultados>(query ? `${base}?${query}` : base);
  },
  getRG90Report: (tipo: "VENTAS" | "COMPRAS" | "RETENCIONES", anho: number, mes: number, formato?: "JSON" | "TXT" | "CSV") => {
    const params = new URLSearchParams();
    if (formato) params.set("formato", formato);
    const query = params.toString();
    const base = `/finance/rg90/${tipo.toLowerCase()}/${anho}/${mes}`;
    return request<RG90Report>(query ? `${base}?${query}` : base);
  },

  // Work Orders
  // T-54: el backend pagina y filtra en el servidor y devuelve un envelope
  // `{ items, total, page, limit, totalPages }`; la app consume `items`.
  listWorkOrders: (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<PaginatedItems<WorkOrder>>(`/workshop/ordenes${query ? `?${query}` : ""}`).then(
      unwrapItems,
    );
  },

  getWorkOrder: (id: string) => request<WorkOrder>(`/workshop/ordenes/${id}`),

  // Clients — T-54: envelope paginado, la app consume `items`
  listClients: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<PaginatedItems<Client>>(`/workshop/clientes${query ? `?${query}` : ""}`).then(
      unwrapItems,
    );
  },

  getClient: (id: string) => request<Client>(`/workshop/clientes/${id}`),

  // Vehicles — T-54: envelope paginado, la app consume `items`
  listVehicles: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<PaginatedItems<Vehicle>>(`/workshop/vehiculos${query ? `?${query}` : ""}`).then(
      unwrapItems,
    );
  },

  getVehicle: (id: string) => request<Vehicle>(`/workshop/vehiculos/${id}`),

  // Appointments (backend returns a paginated { items, total, … } payload
  // keyed by fechaTurno/horaTurno — mapped to the mobile UI contract)
  listAppointments: () =>
    request<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
      "/scheduling/appointments",
    ).then((res) => {
      const rows = Array.isArray(res) ? res : (res.items ?? []);
      return rows.map((a) => {
        const dur = Number(a.duracionHoras ?? 1);
        const [hh, mm] = String(a.horaTurno ?? "00:00").split(":").map(Number);
        const endMin = ((hh || 0) * 60 + (mm || 0) + dur * 60) % (24 * 60);
        const horaFin =
          a.horaFin ??
          `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
        return {
          ...a,
          fecha: a.fecha ?? a.fechaTurno,
          horaInicio: a.horaInicio ?? a.horaTurno,
          horaFin,
          notas: a.notas ?? a.observaciones ?? null,
        } as unknown as Appointment;
      });
    }),

  // Mutations
  createWorkOrder: (data: { vehicleId: string; clientId: string; description?: string; status?: string }) =>
    request<WorkOrder>("/workshop/ordenes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // HV Safety lockout signing (mandatory before EV/HEV work completion)
  signHvLockout: (ordenId: string, mechanicId: string) =>
    request<WorkOrder>(`/workshop/ordenes/${ordenId}/sign-lockout`, {
      method: "POST",
      body: JSON.stringify({ mechanicId }),
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

  // ── Mobile push tokens (Sprint 78) ──────────
  registerPushToken: (data: { deviceId: string; pushToken: string; platform?: "ios" | "android" | "web"; profileEmail?: string }) =>
    request<{ ok: boolean; id: string; updated: boolean }>("/mobile/push-token", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  unregisterPushToken: (deviceId: string) =>
    request<{ ok: boolean }>("/mobile/push-token", {
      method: "DELETE",
      body: JSON.stringify({ deviceId }),
    }),

  listPushTokens: () =>
    request<{ tokens: Array<{ id: string; deviceId: string; platform: string; profileEmail: string | null; createdAt: string }> }>("/mobile/push-tokens"),

  // ── DVI Inspection (Sprint 82) ──────────────
  listDVIInspections: (params?: { vehicleId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.vehicleId) qs.set("vehicleId", params.vehicleId);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<DVIInspection[]>(`/dvi${query ? `?${query}` : ""}`);
  },

  createDVIInspection: (data: { ordenTrabajoId: string; fotos?: string[]; notas?: string }) =>
    request<DVIInspection>("/dvi", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Barcode / Stock (Sprint 82) ─────────────
  lookupByBarcode: async (barcode: string) => {
    // There is no dedicated barcode route — reuse the list endpoint, whose
    // `search` matches codigo / codigo_barras / descripcion (ILIKE).
    const res = await request<{ items?: any[] }>(
      `/inventory/repuestos?search=${encodeURIComponent(barcode)}&limit=10`,
    );
    const items = res.items ?? [];
    const repuesto =
      items.find((i) => i.codigo === barcode || i.codigoBarras === barcode) ??
      items[0];
    if (!repuesto) throw new Error("Producto no encontrado");
    return { repuesto };
  },

  recordStockMovement: async (data: {
    repuestoId: string;
    tipo: "ENTRADA" | "SALIDA";
    cantidad: number;
    notas?: string;
  }): Promise<{ success: boolean }> => {
    const observaciones = data.notas ? { observaciones: data.notas } : {};
    if (data.tipo === "ENTRADA") {
      await request(`/inventory/repuestos/${data.repuestoId}/ingreso`, {
        method: "POST",
        body: JSON.stringify({
          cantidad: data.cantidad,
          motivo: "Ajuste",
          ...observaciones,
        }),
      });
    } else {
      await request("/inventory/repuestos/salida", {
        method: "POST",
        body: JSON.stringify({
          repuestoId: data.repuestoId,
          cantidad: data.cantidad,
          motivo: "Ajuste",
          ...observaciones,
        }),
      });
    }
    return { success: true };
  },

  // ── Notifications (Sprint 82) ──────────────────
  listNotifications: (params?: { leido?: boolean; tipo?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.leido !== undefined) qs.set("leido", String(params.leido));
    if (params?.tipo) qs.set("tipo", params.tipo);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<any[]>(`/api/notifications${query ? `?${query}` : ""}`);
  },

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>("/api/notifications/read-all", { method: "POST" }),

  getUnreadNotificationCount: () =>
    request<{ count: number }>("/api/notifications/count"),

  // ── Thinkcar / OBD2 (Sprint 82) ─────────────
  listThinkcarImports: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<{ data: any[]; total: number }>(`/thinkcar/imports${query ? `?${query}` : ""}`);
  },

  lookupDtcCode: (code: string) =>
    request<any>(`/thinkcar/dtc/lookup/${encodeURIComponent(code)}`),

  submitMobileDtc: (data: { dtcCodes: string[]; dtcDescriptions?: any[]; vehicleId?: string; ordenTrabajoId?: string; notas?: string }) =>
    request<{ ok: boolean; id: string }>("/thinkcar/mobile-dtc", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  linkThinkcarImport: (id: string, data: { ordenTrabajoId?: string; vin?: string }) =>
    request<{ ok: boolean }>(`/thinkcar/imports/${id}/link`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listThinkcarPending: () =>
    request<{ data: any[]; total: number }>("/thinkcar/pending"),
};
