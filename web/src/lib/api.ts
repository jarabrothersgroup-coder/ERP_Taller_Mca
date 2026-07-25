/**
 * AutomotiveOS API Client — typed fetch wrapper for the Fastify backend.
 *
 * All requests are proxied through Next.js rewrites (next.config.mjs):
 *   /workshop/* → http://localhost:4000/workshop/*
 *   /inventory/* → http://localhost:4000/inventory/*
 *   /finance/*   → http://localhost:4000/finance/*
 *   /api/*       → http://localhost:4000/api/*
 *
 * Each request includes X-Tenant-Slug, Authorization (JWT), and Content-Type headers.
 * Functions fall back to mock data when the backend is unreachable.
 */

/* ── Types ──────────────────────────────────── */

/** Paginated list response from backend */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

/** Generic list params for paginated endpoints */
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  [key: string]: string | number | undefined;
}

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

/** Set the tenant slug from JWT user data or session */
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

/** Get the current JWT token from localStorage */
async function getAuthToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  try {
    return localStorage.getItem("auth_token") ?? undefined;
  } catch {
    return undefined;
  }
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Slug": getTenantSlug(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? body.message ?? "Error de red");
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/* ── Work Orders (Taller) ───────────────────── */

export const api = {
  /** Generic request method for CRM and other endpoints */
  request: <T>(url: string, options?: RequestInit) => request<T>(url, options),

  /* ── Clients CRUD ──────────────────────────── */

  listClients: (params?: ListParams) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<Client[]>(`/workshop/clientes${query ? `?${query}` : ""}`);
  },

  getClient: (id: string) => request<Client>(`/workshop/clientes/${id}`),

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

  updateClient: (id: string, body: Partial<{
    name: string;
    email: string;
    phone: string;
    ruc: string;
    address: string;
    notes: string;
  }>) =>
    request<Client>(`/workshop/clientes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteClient: (id: string) =>
    request<{ success: boolean }>(`/workshop/clientes/${id}`, {
      method: "DELETE",
    }),

  getClientHistory: (id: string) =>
    request<ClientHistory>(`/workshop/clientes/${id}/history`),

  /* ── Vehicles CRUD ─────────────────────────── */

  listVehicles: (params?: ListParams & { brand?: string; model?: string; engineType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.brand) qs.set("brand", params.brand);
    if (params?.model) qs.set("model", params.model);
    if (params?.engineType) qs.set("engineType", params.engineType);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<Vehicle[]>(`/workshop/vehiculos${query ? `?${query}` : ""}`);
  },

  getVehicle: (id: string) => request<Vehicle>(`/workshop/vehiculos/${id}`),

  createVehicle: (body: {
    clientId: string;
    plate?: string;
    vin?: string;
    brand: string;
    model: string;
    year?: number;
    engineType?: string;
    kilometraje?: number;
    color?: string;
    hvAlert?: boolean;
  }) =>
    request<Vehicle>("/workshop/vehiculos", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateVehicle: (id: string, body: Partial<{
    plate: string;
    vin: string;
    brand: string;
    model: string;
    year: number;
    engineType: string;
    kilometraje: number;
    color: string;
    hvAlert: boolean;
  }>) =>
    request<Vehicle>(`/workshop/vehiculos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteVehicle: (id: string) =>
    request<{ success: boolean }>(`/workshop/vehiculos/${id}`, {
      method: "DELETE",
    }),

  getVehicleHistory: (id: string) =>
    request<VehicleHistory>(`/workshop/vehiculos/${id}/history`),

  decodeVin: (vin: string) =>
    request<VinDecodeResult>(`/workshop/vehiculos/decode-vin?vin=${encodeURIComponent(vin)}`),

  /* ── Work Orders (Taller) ─────────────────── */

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

  getWorkOrder: (id: string) =>
    request<WorkOrder>(`/workshop/ordenes/${id}`),

  createWorkOrder: (body: {
    vehicleId: string;
    clientId: string;
    description?: string;
    hvAlert?: boolean;
    dtcCodes?: string[];
  }) =>
    request<WorkOrder>("/workshop/ordenes", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateWorkOrder: (id: string, body: Partial<{
    status: string;
    description: string;
    hvLockoutSigned: boolean;
  }>) =>
    request<WorkOrder>(`/workshop/ordenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  updateWorkOrderStatus: (id: string, status: string) =>
    request<WorkOrder>(`/workshop/ordenes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deleteWorkOrder: (id: string) =>
    request<{ success: boolean }>(`/workshop/ordenes/${id}`, {
      method: "DELETE",
    }),

  /* ── Ingresos (Check-in) ──────────────────── */

  listIngresos: (params?: ListParams) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<Ingreso[]>(`/workshop/ingresos${query ? `?${query}` : ""}`);
  },

  createIngreso: (body: {
    vehicleId: string;
    clienteId?: string;
    description?: string;
    descripcionTrabajo?: string;
    kilometraje?: number;
    crearOrden?: boolean;
  }) =>
    request<Ingreso>("/workshop/ingresos", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Inventory: Repuestos CRUD ─────────────── */

  listInventory: (params?: ListParams & { categoria?: string }) => {
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

  getInventoryItem: (id: string) =>
    request<InventoryItem>(`/inventory/repuestos/${id}`),

  createInventoryItem: (body: {
    codigo: string;
    descripcion: string;
    marca?: string;
    modelo?: string;
    categoria?: string;
    precioCosto?: number;
    precioVenta?: number;
    stockActual?: number;
    stockMinimo?: number;
    ubicacion?: string;
  }) =>
    request<InventoryItem>("/inventory/repuestos", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateInventoryItem: (id: string, body: Partial<{
    descripcion: string;
    marca: string;
    modelo: string;
    categoria: string;
    precioCosto: number;
    precioVenta: number;
    stockMinimo: number;
    ubicacion: string;
  }>) =>
    request<InventoryItem>(`/inventory/repuestos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteInventoryItem: (id: string) =>
    request<{ success: boolean }>(`/inventory/repuestos/${id}`, {
      method: "DELETE",
    }),

  /* ── Inventory: Stock Operations ───────────── */

  stockEntrada: (body: {
    repuestoId: string;
    cantidad: number;
    precioUnitario?: number;
    proveedor?: string;
    ordenTrabajoId?: string;
    notas?: string;
  }) =>
    request<StockMovement>("/inventory/stock/entrada", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  stockSalida: (body: {
    repuestoId: string;
    cantidad: number;
    ordenTrabajoId?: string;
    notas?: string;
  }) =>
    request<StockMovement>("/inventory/stock/salida", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listStockMovements: (params?: ListParams & { repuestoId?: string; tipo?: string }) => {
    const qs = new URLSearchParams();
    if (params?.repuestoId) qs.set("repuestoId", params.repuestoId);
    if (params?.tipo) qs.set("tipo", params.tipo);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<StockMovement[]>(`/inventory/stock-movements${query ? `?${query}` : ""}`);
  },

  /* ── Inventory: Herramientas CRUD ──────────── */

  listHerramientas: (params?: ListParams) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request<Herramienta[]>(`/inventory/herramientas${query ? `?${query}` : ""}`);
  },

  createHerramienta: (body: {
    codigo: string;
    descripcion: string;
    marca?: string;
    modelo?: string;
    categoria?: string;
    costoAdquisicion?: number;
    vidaUtilAnos?: number;
  }) =>
    request<Herramienta>("/inventory/herramientas", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Inventory: Tool Instances ─────────────── */

  listToolInstances: (params?: ListParams) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request<ToolInstance[]>(`/inventory/tool-instances${query ? `?${query}` : ""}`);
  },

  lendTool: (body: {
    toolInstanceId: string;
    ordenTrabajoId?: string;
    tecnicoId?: string;
    condicionSalida?: string;
    fechaEsperadaDevolucion?: string;
  }) =>
    request<ToolLoan>(`/inventory/tool-loans/lend`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  returnTool: (body: {
    loanId: string;
    condicionRetorno: string;
    requiereReparacion?: boolean;
    costoReparacion?: number;
    notas?: string;
  }) =>
    request<ToolLoan>(`/inventory/tool-loans/return`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Finance: Invoices ─────────────────────── */

  listInvoices: (params?: ListParams) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request<Invoice[]>(`/finance/invoices${query ? `?${query}` : ""}`);
  },

  getInvoice: (id: string) => request<Invoice>(`/finance/invoices/${id}`),

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

  /* ── Finance: Payments ─────────────────────── */

  registerPayment: (body: {
    facturaId: string;
    monto: number;
    medioPago: string;
    cuentaId?: string;
    notas?: string;
  }) =>
    request<Payment>("/finance/payments/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCxcPendientes: () =>
    request<CxCItem[]>("/finance/treasury/cxc-pendientes"),

  /* ── Finance: Treasury ─────────────────────── */

  listBankAccounts: (params?: ListParams) => {
    const qs = new URLSearchParams();
    const query = qs.toString();
    return request<BankAccount[]>(`/finance/treasury/cuentas${query ? `?${query}` : ""}`);
  },

  createBankAccount: (body: {
    codigo: string;
    nombre: string;
    tipo: string;
    moneda?: string;
    saldoInicial?: number;
  }) =>
    request<BankAccount>("/finance/treasury/cuentas", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listMovements: (params?: ListParams & { cuentaId?: string; tipo?: string }) => {
    const qs = new URLSearchParams();
    if (params?.cuentaId) qs.set("cuentaId", params.cuentaId);
    if (params?.tipo) qs.set("tipo", params.tipo);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<Movement[]>(`/finance/treasury/movimientos${query ? `?${query}` : ""}`);
  },

  createMovement: (body: {
    tipo: "INGRESO" | "EGRESO" | "TRANSFERENCIA";
    medioPago: string;
    cuentaId: string;
    monto: number;
    concepto: string;
    fecha?: string;
  }) =>
    request<Movement>("/finance/treasury/movimientos", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCxcPendientesTreasury: () =>
    request<CxCItem[]>("/finance/treasury/cxc-pendientes"),

  listCxPProveedoras: (params?: { estado?: string }) => {
    const qs = new URLSearchParams();
    if (params?.estado) qs.set("estado", params.estado);
    const query = qs.toString();
    return request<CxPItem[]>(`/finance/treasury/facturas-proveedor${query ? `?${query}` : ""}`);
  },

  pagarProveedor: (id: string, body: {
    monto: number;
    medioPago: string;
    cuentaId: string;
  }) =>
    request<{ success: boolean }>(`/finance/treasury/facturas-proveedor/${id}/pagar`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getFlujoCaja: () =>
    request<FlujoCaja>("/finance/treasury/flujo-caja"),

  /* ── Finance: Conciliación Bancaria ─────────── */

  startConciliacion: (body: {
    cuentaId: string;
    saldoBancario: number;
    fechaConciliacion: string;
    observaciones?: string;
  }) =>
    request<ConciliacionRecord>("/finance/treasury/conciliacion", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  cerrarConciliacion: (id: string, body: { saldoFinal: number }) =>
    request<ConciliacionRecord>(`/finance/treasury/conciliacion/${id}/cerrar`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listConciliaciones: (cuentaId: string) =>
    request<ConciliacionRecord[]>(`/finance/treasury/conciliacion/${cuentaId}`),

  /* ── Nómina / Payroll ────────────────────── */

  listMechanicProfiles: () =>
    request<MechanicProfileRecord[]>("/workshop/mechanic-profiles"),

  createMechanicProfile: (body: {
    profileId: string;
    category: string;
    baseSalary: number;
    commissionRate: number;
  }) =>
    request<MechanicProfileRecord>("/workshop/mechanic-profiles", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateMechanicProfile: (id: string, body: Partial<{
    category: string;
    baseSalary: number;
    commissionRate: number;
  }>) =>
    request<MechanicProfileRecord>(`/workshop/mechanic-profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listPayrollHistory: () =>
    request<PayrollSummaryRecord[]>("/api/v1/finance/payroll/history"),

  listCommissions: (month: number, year: number) =>
    request<CommissionRecordEntry[]>(`/api/v1/finance/payroll/commissions?month=${month}&year=${year}`),

  /* ── Finance: Accounting ───────────────────── */

  listCuentasContables: () =>
    request<CuentaContable[]>("/finance/contabilidad/cuentas"),

  createCuentaContable: (body: {
    codigo: string;
    nombre: string;
    tipo: string;
    parentId?: string;
    moneda?: string;
  }) =>
    request<CuentaContable>("/finance/contabilidad/cuentas", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listAsientos: (params?: ListParams & { desde?: string; hasta?: string }) => {
    const qs = new URLSearchParams();
    if (params?.desde) qs.set("desde", params.desde);
    if (params?.hasta) qs.set("hasta", params.hasta);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<AsientoContable[]>(`/finance/contabilidad/asientos${query ? `?${query}` : ""}`);
  },

  getBalanceGeneral: (fecha: string) =>
    request<BalanceGeneral>(`/finance/contabilidad/balance-general/${fecha}`),

  getEstadoResultados: (anho: number, mes: number, acumulado?: boolean) => {
    const qs = acumulado ? "?acumulado=true" : "";
    return request<EstadoResultados>(`/finance/contabilidad/estado-resultados/${anho}/${mes}${qs}`);
  },

  getCashFlowStatement: (anho: number, mes: number, acumulado?: boolean) => {
    const qs = acumulado ? "?acumulado=true" : "";
    return request<CashFlowStatement>(`/finance/contabilidad/flujo-efectivo/${anho}/${mes}${qs}`);
  },

  getEquityStatement: (anho: number, mes: number, acumulado?: boolean) => {
    const qs = acumulado ? "?acumulado=true" : "";
    return request<EquityStatement>(`/finance/contabilidad/evolucion-patrimonio/${anho}/${mes}${qs}`);
  },

  getFinancialNotes: (anho: number, mes: number, acumulado?: boolean) => {
    const qs = acumulado ? "?acumulado=true" : "";
    return request<FinancialNotesReport>(`/finance/contabilidad/notas-financieras/${anho}/${mes}${qs}`);
  },

  /* ── Finance: Presupuestos ─────────────────── */

  listPresupuestos: () => request<Presupuesto[]>("/finance/presupuestos"),

  getPresupuesto: (id: string) => request<Presupuesto>(`/finance/presupuestos/${id}`),

  aprobarPresupuesto: (id: string, body: { accion: "APROBAR" | "RECHAZAR"; metodoAprobacion?: "PORTAL" | "WHATSAPP" | "PRESENCIAL" }) =>
    request<{ success: boolean; presupuestoId: string; ordenTrabajoId?: string; estado: string; message: string }>(
      `/finance/presupuestos/${id}/aprobar`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  getPresupuestoComparativa: (id: string) =>
    request<PresupuestoComparativa>(`/finance/presupuestos/${id}/comparativa`),

  getPresupuestoAlertas: () => request<PresupuestoAlerta[]>("/finance/presupuestos/alertas"),

  /* ── Finance: Portal Payments ────────────── */

  createPortalPaymentLink: (facturaId: string, provider: "STRIPE" | "PAGOS_PY" = "STRIPE") =>
    request<{ facturaId: string; provider: string; paymentUrl: string }>(
      `/portal/invoices/${facturaId}/pay`,
      { method: "POST", body: JSON.stringify({ provider }) },
    ),

  /* ── Finance: Nómina ───────────────────────── */

  getBreakEven: () => request<BreakEvenData>("/api/v1/finance/dashboard/break-even"),

  calculatePayroll: (params?: { anho?: number; mes?: number }) => {
    const qs = new URLSearchParams();
    if (params?.anho) qs.set("anho", String(params.anho));
    if (params?.mes) qs.set("mes", String(params.mes));
    const query = qs.toString();
    return request<PayrollResult>(`/finance/payroll/calculate${query ? `?${query}` : ""}`);
  },

  /* ── Scheduling ────────────────────────────── */

  listAppointments: (params?: ListParams & { fecha?: string; estado?: string }) => {
    const qs = new URLSearchParams();
    if (params?.fecha) qs.set("fecha", params.fecha);
    if (params?.estado) qs.set("estado", params.estado);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<Appointment[]>(`/scheduling/appointments${query ? `?${query}` : ""}`);
  },

  createAppointment: (body: {
    clienteNombre: string;
    clientePhone: string;
    clienteEmail?: string;
    vehiculoChapa: string;
    vehiculoMarca: string;
    vehiculoModelo: string;
    fechaTurno: string;
    horaTurno: string;
    tipoServicio: string;
    diagnostico?: string;
  }) =>
    request<Appointment>("/scheduling/appointments", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAppointment: (id: string, body: Partial<{
    estado: string;
    fechaTurno: string;
    horaTurno: string;
    diagnostico: string;
  }>) =>
    request<Appointment>(`/scheduling/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  checkAvailability: (body: {
    fecha: string;
    hora: string;
    tipoServicio: string;
  }) =>
    request<{ available: boolean; alternatives?: string[] }>("/scheduling/check-availability", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  checkInAppointment: (id: string) =>
    request<{ success: boolean; ordenId: string }>(`/scheduling/check-in`, {
      method: "POST",
      body: JSON.stringify({ appointmentId: id }),
    }),

  /* ── WhatsApp ──────────────────────────────── */

  listWhatsAppMessages: (params?: ListParams) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<WhatsAppMessage[]>(`/whatsapp/log${query ? `?${query}` : ""}`);
  },

  sendWhatsAppMessage: (body: {
    phone: string;
    message: string;
  }) =>
    request<{ success: boolean }>("/whatsapp/send-text", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listWhatsAppTemplates: () =>
    request<WhatsAppTemplate[]>("/whatsapp/templates"),

  getWhatsAppStats: () =>
    request<WhatsAppStats>("/whatsapp/stats"),

  /* ── CRM ───────────────────────────────────── */

  syncCrm: (ordenId: string) =>
    request<{ success: boolean }>(`/crm/sync/${ordenId}`, { method: "POST" }),

  getCrmStatus: () => request<CrmStatus>("/crm/status"),

  /* ── DVI ───────────────────────────────────── */

  listDVInspections: (params?: { vehicleId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.vehicleId) qs.set("vehicleId", params.vehicleId);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<DVIInspection[]>(`/dvi${query ? `?${query}` : ""}`);
  },

  getDVIInspection: (id: string) => request<DVIInspection>(`/dvi/${id}`),

  createDVIInspection: (body: {
    ordenTrabajoId: string;
    observaciones?: string;
    inspector?: string;
  }) =>
    request<DVIInspection>("/dvi", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Thinkcar ──────────────────────────────── */

  listThinkcarImports: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<ThinkcarImport[]>(`/thinkcar/imports${query ? `?${query}` : ""}`);
  },

  getThinkcarHealth: () => request<ThinkcarHealth>("/thinkcar/health"),

  getThinkcarStats: () => request<ThinkcarStats>("/thinkcar/stats"),

  lookupDtc: (code: string) =>
    request<DtcLookup>(`/thinkcar/dtc/lookup/${encodeURIComponent(code)}`),

  ingestThinkcarUsb: () =>
    request<unknown>("/thinkcar/ingest/usb", { method: "POST" }),

  ingestThinkcarBluetooth: () =>
    request<{ processed: number; message: string }>("/thinkcar/ingest/bluetooth", {
      method: "POST",
    }),

  /* ── Marketing ─────────────────────────────── */

  listCampaigns: () => request<MarketingCampaign[]>("/marketing/campaigns"),

  createCampaign: (body: {
    nombre: string;
    tipo: string;
    mensaje: string;
    segmento?: string;
  }) =>
    request<MarketingCampaign>("/marketing/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Fleet ─────────────────────────────────── */

  listFleets: () => request<Fleet[]>("/fleet"),

  createFleet: (body: {
    nombre: string;
    empresa: string;
    contacto: string;
    telefono: string;
    email?: string;
    ruc: string;
    contratoTipo?: string;
    descuentoPorcentaje?: number;
  }) =>
    request<Fleet>("/fleet", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Users/Profiles ────────────────────────── */

  listUsers: (params?: ListParams) => {
    const qs = new URLSearchParams();
    const query = qs.toString();
    return request<UserProfile[]>(`/api/profiles${query ? `?${query}` : ""}`);
  },

  createUser: (body: {
    name: string;
    email: string;
    role: string;
    password?: string;
  }) =>
    request<UserProfile>("/api/profiles", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateUser: (id: string, body: Partial<{
    name: string;
    role: string;
    active: boolean;
  }>) =>
    request<UserProfile>(`/api/profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/api/profiles/${id}`, {
      method: "DELETE",
    }),

  /* ── Config ────────────────────────────────── */

  getConfigSettings: () => request<ConfigSettings>("/api/config/settings"),

  updateConfigSettings: (body: Partial<ConfigSettings>) =>
    request<ConfigSettings>("/api/config/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  /* ── Label Printing ────────────────────────── */

  generateLabel: (body: { type: "repuesto" | "herramienta"; id: string; copies?: number }) =>
    request<{ success: boolean; label: string }>("/label-printing/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /* ── Backup ────────────────────────────────── */

  listBackups: () => request<BackupJob[]>("/backup/list"),

  executeBackup: () => request<{ success: boolean; jobId: string }>("/backup/execute", { method: "POST" }),

  /* ── Security HW ───────────────────────────── */

  getSecurityHWStatus: () => request<SecurityHWStatus>("/security/hw/status"),

  /* ── Analytics ─────────────────────────────── */

  getAnalyticsKpis: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return request<KpisResponse>(`/analytics/kpis${q ? `?${q}` : ""}`);
  },

  getAnalyticsTrends: (type: "revenue" | "ots", from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return request<{ trend: AnalyticsTrend[]; range: { from: string; to: string } }>(`/analytics/trends/${type}${q ? `?${q}` : ""}`);
  },

  getAnalyticsDistribution: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return request<{ distribution: AnalyticsDistribution[]; range: { from: string; to: string } }>(`/analytics/distribution${q ? `?${q}` : ""}`);
  },

  getTopMechanics: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const q = qs.toString();
    return request<{ mechanics: TopMechanic[]; range: { from: string; to: string } }>(`/analytics/mechanics${q ? `?${q}` : ""}`);
  },

  /* ── Notifications ─────────────────────────── */

  listNotifications: (params?: { limit?: number; unreadOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.unreadOnly) qs.set("unreadOnly", "true");
    const query = qs.toString();
    return request<Notification[]>(`/api/notifications${query ? `?${query}` : ""}`);
  },

  getNotificationCount: () =>
    request<{ count: number }>("/api/notifications/count"),

  markNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () =>
    request<{ success: boolean }>("/api/notifications/read-all", { method: "POST" }),

  /* ── Audit Log ─────────────────────────────── */

  listAuditLog: (params?: ListParams & { entidad?: string; accion?: string; desde?: string; hasta?: string }) => {
    const qs = new URLSearchParams();
    if (params?.entidad) qs.set("entidad", params.entidad);
    if (params?.accion) qs.set("accion", params.accion);
    if (params?.desde) qs.set("desde", params.desde);
    if (params?.hasta) qs.set("hasta", params.hasta);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<AuditEntry[]>(`/audit/log${query ? `?${query}` : ""}`);
  },

  /* ── Search ────────────────────────────────── */

  globalSearch: (q: string, limit?: number) => {
    const qs = new URLSearchParams({ q });
    if (limit) qs.set("limit", String(limit));
    return request<SearchResult[]>(`/api/v1/search?${qs.toString()}`);
  },

  /* ── Accounting Integration Dashboard ──────── */

  getIntegracionDashboard: () =>
    request<IntegracionDashboard>("/finance/contabilidad/integracion/resumen"),

  getModuleHealth: (modulo: string) =>
    request<ModuloHealth>(`/finance/contabilidad/integracion/check/${modulo}`),

  /* ── Health ────────────────────────────────── */

  getHealth: () => request<HealthStatus>("/health"),
  getHealthLive: () => request<{ status: string }>("/health/live"),
  getHealthModules: () => request<HealthModules>("/health/modules"),
};

/* ── Additional Types ──────────────────────── */

export interface ClientHistory {
  client: Client;
  vehicles: Vehicle[];
  ordenes: WorkOrder[];
  totalFacturado: number;
  totalOrdenes: number;
}

export interface Vehicle {
  id: string;
  clientId: string;
  plate: string | null;
  vin: string | null;
  brand: string;
  model: string;
  year: number | null;
  engineType: string;
  kilometraje: number | null;
  color: string | null;
  hvAlert: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleHistory {
  vehicle: Vehicle;
  owner: Client | null;
  ordenes: WorkOrder[];
  facturas: Invoice[];
  totalFacturado: number;
}

export interface VinDecodeResult {
  brand: string | null;
  model: string | null;
  year: number | null;
  engineType: string | null;
  country: string | null;
  plant: string | null;
}

export interface Ingreso {
  id: string;
  vehicleId: string;
  clienteId: string | null;
  description: string | null;
  kilometraje: number | null;
  status: string;
  createdAt: string;
}

export interface Herramienta {
  id: string;
  codigo: string;
  descripcion: string;
  marca: string | null;
  modelo: string | null;
  categoria: string | null;
  costoAdquisicion: number | null;
  vidaUtilAnos: number | null;
  metodoDepreciacion: string | null;
  costoReposicion: number | null;
  activo: boolean;
  createdAt: string;
}

export interface ToolInstance {
  id: string;
  herramientaId: string;
  numeroSerie: string;
  estadoActual: string;
  ubicacion: string | null;
  fechaAdquisicion: string | null;
  vidaUtilAnos: number | null;
  createdAt: string;
}

export interface ToolLoan {
  id: string;
  toolInstanceId: string;
  ordenTrabajoId: string | null;
  tecnicoId: string | null;
  condicionSalida: string;
  fechaEsperadaDevolucion: string | null;
  fechaDevolucion: string | null;
  condicionRetorno: string | null;
  requiereReparacion: boolean;
  costoReparacion: number | null;
  status: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  repuestoId: string;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  precioUnitario: number | null;
  proveedor: string | null;
  ordenTrabajoId: string | null;
  notas: string | null;
  tenantSlug: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  facturaId: string;
  monto: number;
  medioPago: string;
  cuentaId: string | null;
  notas: string | null;
  createdAt: string;
}

export interface CxCItem {
  id: string;
  facturaId: string;
  clienteNombre: string;
  total: number;
  saldoPendiente: number;
  fechaVencimiento: string;
  diasVencido: number;
}

export interface BankAccount {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  moneda: string;
  saldoInicial: number;
  saldoActual: number;
  activo: boolean;
  createdAt: string;
}

export interface Movement {
  id: string;
  tipo: "INGRESO" | "EGRESO" | "TRANSFERENCIA";
  medioPago: string;
  cuentaId: string;
  cuentaNombre: string;
  monto: number;
  concepto: string;
  fecha: string;
  conciliado: boolean;
  createdAt: string;
}

export interface CxPItem {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  nroFactura: string;
  total: number;
  saldoPendiente: number;
  iva: number;
  vencimiento: string;
  estadoPago: string;
}

export interface FlujoCaja {
  saldoActual: number;
  cxCobrar: number;
  cxPagar: number;
  proyeccion: { fecha: string; monto: number }[];
  alertaSobregiro: boolean;
}

export interface ConciliacionRecord {
  id: string;
  cuentaId: string;
  saldoBancario: number;
  saldoLibros: number | null;
  diferencia: number | null;
  estado: string;
  fechaConciliacion: string;
  saldoFinal: number | null;
  observaciones: string | null;
  createdAt: string;
}

export interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  parentId: string | null;
  aceptaMovimientos: boolean;
  activo: boolean;
  saldoInicial: string;
  moneda: string;
}

export interface AsientoContable {
  id: string;
  numero: number;
  fecha: string;
  descripcion: string;
  estado: string;
  modulo: string | null;
  documentoRef: string | null;
  totalDebe: number;
  totalHaber: number;
  tenantSlug: string;
  createdAt: string;
}

export interface BalanceGeneral {
  fecha: string;
  activo: { seccion: string; total: number; cuentas: { codigo: string; nombre: string; saldo: number }[] }[];
  pasivo: { seccion: string; total: number; cuentas: { codigo: string; nombre: string; saldo: number }[] }[];
  patrimonio: { seccion: string; total: number; cuentas: { codigo: string; nombre: string; saldo: number }[] }[];
  cuadrado: boolean;
}

export interface EstadoResultados {
  anho: number;
  mes: number;
  acumulado: boolean;
  ingresos: number;
  costos: number;
  gastos: number;
  utilidadBruta: number;
  utilidadNeta: number;
}

export interface PayrollResult {
  anho: number;
  mes: number;
  totalSueldos: number;
  totalComisiones: number;
  comisionsCreadas: number;
  umbralAlcanzado: boolean;
  breakevenPercentage: number;
}

export interface Appointment {
  id: string;
  clienteNombre: string;
  clientePhone: string;
  clienteEmail: string | null;
  vehiculoChapa: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  fechaTurno: string;
  horaTurno: string;
  tipoServicio: string;
  estado: string;
  diagnostico: string | null;
  tenantSlug: string;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  phoneNumber: string;
  template: string;
  messageText: string;
  status: "SENT" | "FAILED" | "PENDING";
  sentAt: string | null;
  tenantSlug: string;
}

export interface WhatsAppTemplate {
  key: string;
  name: string;
  body: string;
  category: string;
  active: boolean;
  variables: string[];
  triggerEvent: string | null;
}

export interface WhatsAppStats {
  totalEnviados: number;
  enviadosHoy: number;
  tasaExito: number;
  plantillasActivas: number;
}

export interface CrmStatus {
  connected: boolean;
  lastSync: string | null;
  syncedContacts: number;
  pendingSync: number;
}

export interface Fleet {
  id: string;
  nombre: string;
  empresa: string;
  contacto: string;
  telefono: string;
  email: string | null;
  ruc: string;
  contratoTipo: string;
  descuentoPorcentaje: number;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  activo: boolean;
  createdAt: string;
}

export interface ConfigSettings {
  companyName: string;
  companyRuc: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo: string | null;
  fiscalRegimen: string;
  timbrado: string;
  facturaInicio: string;
}

export interface DtcLookup {
  code: string;
  description: string;
  system: string;
  severity: string;
  possibleCauses: string[];
  recommendedActions: string[];
}

export interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  entityType: string | null;
  entityId: string | null;
  leido: boolean;
  priority: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: string;
  descripcion: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  createdAt: string;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  database: string;
  memory: { rss: number; heapUsed: number; heapTotal: number };
}

export interface HealthModules {
  database: string;
  memory: { rss: number; heapUsed: number; heapTotal: number };
  uptime: number;
  nodeVersion: string;
}

/** KPI metric with current/previous/change values for the ejecutivo dashboard */
export interface KpiMetric {
  current: number;
  previous: number;
  change: number;
}

/** Response shape for getAnalyticsKpis — used by the Ejecutivo dashboard */
export interface KpisResponse {
  revenue: KpiMetric;
  orderCount: KpiMetric;
  avgOrderValue: KpiMetric;
  completionRate: KpiMetric;
  range: { from: string; to: string };
}

export interface AnalyticsKpis {
  label: string;
  value: number;
  unit: string;
  change?: number;
  trend?: "up" | "down" | "flat";
}

export interface AnalyticsTrend {
  date: string;
  value: number;
}

export interface AnalyticsDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface TopMechanic {
  name: string;
  otCount: number;
  revenue: number;
}

export interface Presupuesto {
  id: string;
  periodo: string;
  descripcion: string | null;
  estado: string;
  clienteId: string | null;
  vehicleId: string | null;
  fechaEnvio: string | null;
  fechaAprobacion: string | null;
  ordenTrabajoId: string | null;
  metodoAprobacion: string | null;
  totalEstimado: string | null;
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

/* ── Accounting Integration Dashboard Types ── */

export interface IntegracionDashboardModulo {
  codigo: string;
  nombre: string;
  activo: boolean;
  mappings: number;
  version: string;
}

export interface IntegracionDashboard {
  modulosRegistrados: number;
  modulos: IntegracionDashboardModulo[];
  totalMappings: number;
  mappingsPorModulo: Record<string, number>;
  totalAsientosAutomaticos: number;
  asientosPorModulo: Record<string, number>;
  auditReciente: Array<{
    id?: string;
    createdAt?: string;
    accion?: string;
    action?: string;
    entidad?: string;
    entity?: string;
    usuario?: string;
    user?: string;
    usuarioEmail?: string;
  }>;
}

export interface ModuloHealthMapping {
  tipoEvento: string;
  debe: string;
  haber: string;
  descripcion: string;
  activo: boolean;
}

export interface ModuloHealth {
  modulo: string;
  registrado: boolean;
  configuracion: {
    nombre: string;
    descripcion: string;
    activo: boolean;
    version: string;
  } | null;
  mappingsDefinidos: number;
  mappings: ModuloHealthMapping[];
  salud: string;
}

/* ── Cash Flow Statement Types ─────────────── */

export interface CashFlowLine {
  concepto: string;
  monto: number;
  cuentaCodigo?: string;
  cuentaNombre?: string;
}

export interface CashFlowSection {
  titulo: string;
  lineas: CashFlowLine[];
  total: number;
}

export interface CashFlowStatement {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  operativas: CashFlowSection;
  inversion: CashFlowSection;
  financiamiento: CashFlowSection;
  variacionNeta: number;
  saldoInicial: number;
  saldoFinal: number;
  verificado: boolean;
}

/* ── Equity Statement Types ─────────────────── */

export interface EquityLine {
  concepto: string;
  cuentaCodigo: string;
  saldoInicial: number;
  movimientos: { incrementos: number; decrementos: number };
  cambioNeto: number;
  saldoFinal: number;
}

export interface EquityAccountGroup {
  tipoLabel: string;
  lineas: EquityLine[];
  totalInicial: number;
  totalFinal: number;
}

export interface EquityStatement {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  capital: EquityAccountGroup;
  reservas: EquityAccountGroup;
  resultados: EquityAccountGroup;
  totalPatrimonioInicial: number;
  totalPatrimonioFinal: number;
  variacionPeriodo: number;
  resultadoEjercicio: number;
}

/* ── Financial Notes Types ──────────────────── */

export interface FinancialNote {
  numero: number;
  titulo: string;
  contenido: string;
  detalle?: Record<string, string | number>[];
}

export interface FinancialNotesReport {
  periodo: { anho: number; mes: number };
  tipo: "MENSUAL" | "ACUMULADO";
  empresa: { nombre: string; ruc: string; regimenFiscal: string };
  notas: FinancialNote[];
  generadoEn: string;
}

/* ── Backup Types ──────────────────────────── */

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

/* ── Nómina / Payroll Types ──────────────────── */

export interface MechanicProfileRecord {
  id: string;
  profileId: string;
  category: string;
  baseSalary: number;
  commissionRate: string;
  createdAt: string;
  nombre: string | null;
}

export interface PayrollSummaryRecord {
  id: string;
  month: number;
  year: number;
  fixedExpensesTotal: number;
  payrollBaseTotal: number;
  netLaborRevenue: number;
  breakevenThreshold: number;
  breakevenHit: boolean;
  breakevenPercentage: string;
  createdAt: string;
}

export interface CommissionRecordEntry {
  id: string;
  tenantId: string;
  month: number;
  year: number;
  mechanicProfileId: string;
  ordenTrabajoId: string | null;
  laborAmount: string;
  commissionAmount: string;
  status: string;
  createdAt: string;
}
