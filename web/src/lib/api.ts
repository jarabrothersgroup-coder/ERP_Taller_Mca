/**
 * AutomotiveOS API Client — typed fetch wrapper for the Fastify backend.
 *
 * All requests are proxied through Next.js rewrites (next.config.mjs):
 *   /workshop/* → http://localhost:4000/workshop/*
 *   /inventory/* → http://localhost:4000/inventory/*
 *   /finance/*   → http://localhost:4000/finance/*
 *   /api/*       → http://localhost:4000/api/*
 *
 * Each request includes X-Tenant-Slug and Content-Type headers.
 * Functions fall back to mock data when the backend is unreachable.
 */

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

export interface InventoryItem {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  descripcion: string;
  marca: string | null;
  modelo: string | null;
  categoria: string | null;
  precioCosto: string | null;
  precioVenta: string | null;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number | null;
  ubicacion: string | null;
  unidadMedida: string;
  proveedor: string | null;
  compatibleCon: string | null;
  activo: boolean;
  imagenUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Invoice {
  id: string;
  tenantSlug: string;
  ordenId: string;
  tipo: "MANUAL" | "ELECTRONICA";
  numeroFacturaManual: string | null;
  sifenCdc: string | null;
  sifenStatus: string;
  total: string;
  estadoPago: string;
  saldoPendiente: string;
  fechaVencimiento: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: InvoiceLineItem[];
  orden?: WorkOrder;
}

export interface InvoiceLineItem {
  id: string;
  facturaId: string;
  numeroLinea: number;
  tipoLinea: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  subtotal: string;
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

/* ── Tenant Slug Resolution ─────────────────── */

let _tenantSlug: string | undefined;

/** Set the tenant slug from Clerk user's organization or session */
export function setTenantSlug(slug: string): void {
  _tenantSlug = slug;
}

/** Get the current tenant slug, falling back to "demo" */
export function getTenantSlug(): string {
  return _tenantSlug ?? "demo";
}

/* ── API Client ─────────────────────────────── */

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": getTenantSlug(),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? body.message ?? "Error de red");
  }

  return res.json() as Promise<T>;
}

/* ── Work Orders (Taller) ───────────────────── */

export const api = {
  /** Generic request method for CRM and other endpoints */
  request: <T>(url: string, options?: RequestInit) => request<T>(url, options),

  /** List work orders with optional status filter & pagination */
  listWorkOrders: (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<WorkOrder[]>(`/workshop/ordenes${query ? `?${query}` : ""}`);
  },

  /** Get single work order by ID */
  getWorkOrder: (id: string) =>
    request<WorkOrder>(`/workshop/ordenes/${id}`),

  /** Update work order status */
  updateWorkOrderStatus: (id: string, status: string) =>
    request<WorkOrder>(`/workshop/ordenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  /* ── Inventory (Repuestos) ─────────────────── */

  /** List inventory items with search, filter & pagination */
  listInventory: (params?: {
    search?: string;
    categoria?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.categoria) qs.set("categoria", params.categoria);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<InventoryListResponse>(
      `/inventory/repuestos${query ? `?${query}` : ""}`,
    );
  },

  /** Get single inventory item by ID */
  getInventoryItem: (id: string) =>
    request<InventoryItem>(`/inventory/repuestos/${id}`),

  /* ── Invoices (Facturación) ────────────────── */

  /** List all invoices */
  listInvoices: () => request<Invoice[]>("/finance/invoices"),

  /** Get single invoice with line items */
  getInvoice: (id: string) => request<Invoice>(`/finance/invoices/${id}`),

  /** Issue a new invoice from a work order */
  issueInvoice: (body: {
    ordenId: string;
    tipoFacturacion: "MANUAL" | "ELECTRONICA";
    numeroFacturaManual?: string;
    ivaExento?: boolean;
  }) =>
    request<{ success: boolean; data: Invoice }>("/finance/invoices/issue", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Clients ───────────────────────────────── */

  /** List all clients */
  listClients: () => request<Client[]>("/workshop/clientes"),

  /** Create a new client */
  createClient: (body: {
    name: string;
    email?: string;
    phone?: string;
    ruc?: string;
    address?: string;
    notes?: string;
  }) =>
    request<Client>("/workshop/clientes", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── DVI (Digital Vehicle Inspection) ──────── */

  /** List DVI inspections */
  listDVInspections: (params?: { vehicleId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.vehicleId) qs.set("vehicleId", params.vehicleId);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<DVIInspection[]>(`/dvi${query ? `?${query}` : ""}`);
  },

  /** Get single DVI inspection */
  getDVIInspection: (id: string) => request<DVIInspection>(`/dvi/${id}`),

  /* ── Thinkcar ──────────────────────────────── */

  /** List Thinkcar imports */
  listThinkcarImports: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<ThinkcarImport[]>(`/thinkcar/imports${query ? `?${query}` : ""}`);
  },

  /** Thinkcar health status */
  getThinkcarHealth: () => request<ThinkcarHealth>("/thinkcar/health"),

  /** Thinkcar stats */
  getThinkcarStats: () => request<ThinkcarStats>("/thinkcar/stats"),

  /* ── Presupuestos (Budget) ─────────────────── */

  /** List budgets */
  listPresupuestos: () => request<Presupuesto[]>("/finance/presupuestos"),

  /** Get budget comparativa */
  getPresupuestoComparativa: (id: string) =>
    request<PresupuestoComparativa>(`/finance/presupuestos/${id}/comparativa`),

  /** Get budget alertas */
  getPresupuestoAlertas: () => request<PresupuestoAlerta[]>("/finance/presupuestos/alertas"),

  /* ── Nómina (Payroll) ──────────────────────── */

  /** Get break-even dashboard */
  getBreakEven: () => request<BreakEvenData>("/api/v1/finance/dashboard/break-even"),

  /* ── Marketing ─────────────────────────────── */

  /** List campaigns */
  listCampaigns: () => request<MarketingCampaign[]>("/marketing/campaigns"),

  /* ── Label Printing ────────────────────────── */

  /** Generate label */
  generateLabel: (body: { type: "repuesto" | "herramienta"; id: string; copies?: number }) =>
    request<{ success: boolean; label: string }>("/label-printing/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Backup ────────────────────────────────── */

  /** List backups */
  listBackups: () => request<BackupJob[]>("/backup/list"),

  /** Execute backup */
  executeBackup: () => request<{ success: boolean; jobId: string }>("/backup/execute", { method: "POST" }),

  /* ── Security HW ───────────────────────────── */

  /** HW security status */
  getSecurityHWStatus: () => request<SecurityHWStatus>("/security/hw/status"),
};

/* ── Additional Types ──────────────────────── */

export interface DVIInspection {
  id: string;
  vehicleId: string;
  technicianId: string;
  status: string;
  healthScore: number;
  items: unknown[];
  createdAt: string;
}

export interface ThinkcarImport {
  id: string;
  fileName: string;
  source: string;
  status: string;
  dtcCount: number;
  createdAt: string;
}

export interface ThinkcarHealth {
  usb: { isHealthy: boolean; lastSuccessAt: string | null; consecutiveFailures: number };
  email: { isHealthy: boolean; lastSuccessAt: string | null; consecutiveFailures: number };
  bluetooth: { isHealthy: boolean; lastSuccessAt: string | null; consecutiveFailures: number };
  allHealthy: boolean;
}

export interface ThinkcarStats {
  totalImports: number;
  pendingReview: number;
  dtcCount: number;
}

export interface Presupuesto {
  id: string;
  periodo: string;
  estado: string;
  montoPresupuestado: string;
  montoReal: string;
  tenantSlug: string;
  createdAt: string;
}

export interface PresupuestoComparativa {
  presupuestoId: string;
  items: { centroCostoId: string; categoria: string; presupuestado: number; real: number; desvio: number; estado: string }[];
}

export interface PresupuestoAlerta {
  id: string;
  presupuestoId: string;
  centroCostoId: string;
  categoria: string;
  desvioPorcentaje: number;
  severidad: string;
}

export interface BreakEvenData {
  percentage: number;
  currentRevenue: number;
  threshold: number;
  remaining: number;
}

export interface MarketingCampaign {
  id: string;
  nombre: string;
  tipo: string;
  status: string;
  enviados: number;
  aperturas: number;
  conversiones: number;
  createdAt: string;
}

export interface BackupJob {
  id: string;
  filename: string;
  size: number;
  status: string;
  createdAt: string;
}

export interface SecurityHWStatus {
  hwLockEnabled: boolean;
  fingerprint: string | null;
  usbTokens: number;
  lastValidation: string | null;
}
