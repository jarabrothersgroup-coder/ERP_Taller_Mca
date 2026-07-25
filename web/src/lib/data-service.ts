/**
 * Data Service Layer — bridges the real Fastify API with the frontend UI.
 *
 * Every fetch function:
 *   1. Tries the real API with a 4-second timeout
 *   2. Falls back to mock data (from the page's own mock generators)
 *   3. Maps backend response shapes to UI-friendly shapes
 *   4. Passes X-Tenant-Slug header for multi-tenant isolation
 *
 * @module lib/data-service
 */

/* ── Types ──────────────────────────────────── */

type OrderStatus = "pending" | "budgeted" | "in_progress" | "quality" | "ready" | "completed" | "cancelled";

export interface UIMappedWorkOrder {
  id: string;
  client: string;
  vehicle: string;
  plate: string;
  year: number;
  service: string;
  status: OrderStatus;
  technician: string;
  deadline: string;
  estimatedCost: number;
  createdAt: string;
  notes?: string;
}

export interface UIMappedInventoryItem {
  id: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  stock: number;
  minStock: number;
  price: number;
  location: string;
  status: "ok" | "low" | "critical";
}

export interface UIMappedInvoice {
  id: string;
  numero: string;
  cliente: string;
  ordenId: string;
  tipo: "MANUAL" | "ELECTRONICA";
  total: number;
  estado: string;
  estadoPago: string;
  fechaEmision: string;
  fechaVencimiento: string;
  sifenStatus: string;
}

/* ── Tenant slug resolution ────────────────── */

/**
 * Returns the tenant slug for API requests.
 * Priority:
 *   1. Explicitly passed parameter
 *   2. Stored from session (set by UI components)
 *   3. Fallback to "demo"
 */
import { getTenantSlug as getApiTenantSlug, setTenantSlug as setApiTenantSlug } from "@/lib/api";

/** Store the tenant slug from the user's session for use in API calls */
export function setTenantSlug(slug: string): void {
  setApiTenantSlug(slug);
}

function getTenantSlug(override?: string): string {
  return override ?? getApiTenantSlug();
}

/* ── Fetch with fallback ────────────────────── */

/**
 * Whether mock data fallback is enabled.
 * Set NEXT_PUBLIC_ENABLE_MOCKS=true for development only.
 * In production, API errors are thrown instead of falling back to mock data.
 */
const ENABLE_MOCKS = process.env["NEXT_PUBLIC_ENABLE_MOCKS"] === "true";

/**
 * Tries an API call. Behavior depends on environment:
 *
 * - **Development** (NEXT_PUBLIC_ENABLE_MOCKS=true): Falls back to mock data on error
 * - **Production** (default): Throws errors — no silent mock fallback
 *
 * @param apiCall - Function that calls the real API
 * @param mockData - Fallback data factory (only used in dev mode)
 * @param timeoutMs - Timeout in ms (default 4000)
 */
async function fetchOrMock<T>(
  apiCall: (tenantSlug: string, authToken?: string) => Promise<T>,
  mockData: () => T,
  timeoutMs = 4000,
  tenantSlug?: string,
): Promise<{ data: T; source: "api" | "mock" }> {
  try {
    const slug = getTenantSlug(tenantSlug);
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") ?? undefined : undefined;
    const result = await Promise.race([
      apiCall(slug, token),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeoutMs),
      ),
    ]);
    return { data: result, source: "api" };
  } catch (err) {
    if (ENABLE_MOCKS) {
      // Dev mode: fall back to mock data
      console.warn(
        "[data-service] API unavailable, falling back to mock data:",
        err instanceof Error ? err.message : err,
      );
      return { data: mockData(), source: "mock" };
    }

    // Production mode: re-throw — callers must handle API errors
    throw err;
  }
}

/* ── Work Order Mapper ──────────────────────── */

/**
 * Maps a backend work order (from GET /workshop/ordenes) to the UI shape.
 */
function mapWorkOrderFromApi(apiOrder: Record<string, unknown>, index: number): UIMappedWorkOrder {
  const statusMap: Record<string, OrderStatus> = {
    Presupuestado: "budgeted",
    Aprobado: "in_progress",
    En_Proceso: "in_progress",
    Control_Calidad: "quality",
    Listo: "ready",
  };

  const uiStatus = statusMap[apiOrder.status as string] ?? "pending";

  // Use the joined fields from the backend query
  const clientName = (apiOrder.cliente as string) || `Cliente #${index + 1}`;
  const vehicleName = (apiOrder.vehiculo as string) || `Vehículo #${index + 1}`;
  const plate = (apiOrder.plate as string) || `ABC ${String(100 + index).slice(0, 3)}`;

  return {
    id: apiOrder.id as string,
    client: clientName,
    vehicle: vehicleName,
    plate,
    year: 2024,
    service: (apiOrder.description as string) || "Sin descripción",
    status: uiStatus,
    technician: "Sin asignar",
    deadline: "Pendiente",
    estimatedCost: 0,
    createdAt: new Date((apiOrder.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
    notes: undefined,
  };
}

/* ── Inventory Item Mapper ──────────────────── */

/**
 * Maps a backend inventory item to the UI shape.
 */
function mapInventoryFromApi(apiItem: Record<string, unknown>): UIMappedInventoryItem {
  const stock = Number(apiItem.stockActual ?? 0);
  const minStock = Number(apiItem.stockMinimo ?? 0);
  const status: UIMappedInventoryItem["status"] =
    stock === 0 ? "critical" : stock <= minStock ? "low" : "ok";

  return {
    id: apiItem.id as string,
    code: (apiItem.codigo as string) || `PZ-${String(Math.floor(Math.random() * 9000 + 1000))}`,
    name: (apiItem.descripcion as string) || "Producto sin nombre",
    category: (apiItem.categoria as string) || "General",
    brand: (apiItem.marca as string) || "Genérica",
    stock,
    minStock,
    price: Number(apiItem.precioVenta ?? 0),
    location: (apiItem.ubicacion as string) || "Sin ubicación",
    status,
  };
}

/* ── Invoice Mapper ─────────────────────────── */

const statusMapFR: Record<string, string> = {
  PENDIENTE: "PENDIENTE",
  PAGADA: "PAGADA",
  VENCIDA: "VENCIDA",
  ANULADA: "ANULADA",
  APROBADO_DNIT: "APROBADO_DNIT",
  EMITIDA: "APROBADO_DNIT",
};

/**
 * Maps a backend invoice to the UI shape.
 */
function mapInvoiceFromApi(apiInvoice: Record<string, unknown>): UIMappedInvoice {
  const total = Number(apiInvoice.total ?? 0);
  const sifenStatus = apiInvoice.sifenStatus as string;
  const estado = statusMapFR[sifenStatus] || "PENDIENTE";

  return {
    id: apiInvoice.id as string,
    numero: (apiInvoice.numeroFacturaManual as string) || apiInvoice.id?.toString().slice(0, 12) || "S/N",
    cliente: "Cliente",
    ordenId: (apiInvoice.ordenId as string) || "N/A",
    tipo: (apiInvoice.tipo as "MANUAL" | "ELECTRONICA") || "ELECTRONICA",
    total,
    estado,
    estadoPago: (apiInvoice.estadoPago as string) || "PENDIENTE",
    fechaEmision: new Date((apiInvoice.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
    fechaVencimiento: (apiInvoice.fechaVencimiento as string)
      ? new Date(apiInvoice.fechaVencimiento as string).toLocaleDateString("es-PY")
      : "Sin vencer",
    sifenStatus,
  };
}

/* ── Client Mapper ─────────────────────────── */

export interface UIMappedClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ruc: string | null;
  address: string | null;
  createdAt: string;
}

/**
 * Maps a backend client (from GET /workshop/clientes) to the UI shape.
 */
function mapClientFromApi(apiClient: Record<string, unknown>): UIMappedClient {
  return {
    id: apiClient.id as string,
    name: apiClient.name as string,
    email: (apiClient.email as string) ?? null,
    phone: (apiClient.phone as string) ?? null,
    ruc: (apiClient.ruc as string) ?? null,
    address: (apiClient.address as string) ?? null,
    createdAt: new Date((apiClient.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
  };
}

/* ── Accounting Account Mapper ───────────────── */

export interface UIMappedAccount {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nivel: number;
  aceptaMovimientos: boolean;
  activo: boolean;
  saldoInicial: string;
  moneda: string;
}

/**
 * Maps a backend accounting account to the UI shape.
 */
function mapAccountFromApi(apiAccount: Record<string, unknown>): UIMappedAccount {
  return {
    id: apiAccount.id as string,
    codigo: apiAccount.codigo as string,
    nombre: apiAccount.nombre as string,
    tipo: apiAccount.tipo as string,
    nivel: (apiAccount.nivel as number) ?? 1,
    aceptaMovimientos: (apiAccount.aceptaMovimientos as boolean) ?? true,
    activo: (apiAccount.activo as boolean) ?? true,
    saldoInicial: (apiAccount.saldoInicial as string) ?? "0",
    moneda: (apiAccount.moneda as string) ?? "PYG",
  };
}

/**
 * Fetches accounting accounts from the API with fallback to mock data.
 */
export async function fetchAccounts(
  getMockAccounts: () => UIMappedAccount[],
  tenantSlug?: string,
): Promise<UIMappedAccount[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/finance/contabilidad/cuentas", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapAccountFromApi);
    },
    getMockAccounts,
  );
  if (source === "api") console.log("[data-service] Using live API data for accounts");
  return data;
}

/* ── Vehicle Mapper ─────────────────────────── */

export interface UIMappedVehicle {
  id: string;
  plate: string | null;
  vin: string | null;
  brand: string;
  model: string;
  year: number | null;
  engineType: string;
  kilometraje: number | null;
  clientId: string;
  createdAt: string;
}

/**
 * Maps a backend vehicle (from GET /workshop/vehiculos) to the UI shape.
 */
function mapVehicleFromApi(apiVehicle: Record<string, unknown>): UIMappedVehicle {
  return {
    id: apiVehicle.id as string,
    plate: (apiVehicle.plate as string) ?? null,
    vin: (apiVehicle.vin as string) ?? null,
    brand: apiVehicle.brand as string,
    model: apiVehicle.model as string,
    year: (apiVehicle.year as number) ?? null,
    engineType: (apiVehicle.engineType as string) ?? "Nafta",
    kilometraje: (apiVehicle.kilometraje as number) ?? null,
    clientId: apiVehicle.clientId as string,
    createdAt: new Date((apiVehicle.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
  };
}

/**
 * Fetches vehicles from the API with fallback to mock data.
 *
 * @param getMockVehicles - Factory function returning mock UIMappedVehicle[]
 * @param tenantSlug - Optional tenant slug
 */
export async function fetchVehicles(
  getMockVehicles: () => UIMappedVehicle[],
  tenantSlug?: string,
): Promise<UIMappedVehicle[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/workshop/vehiculos", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapVehicleFromApi);
    },
    getMockVehicles,
  );

  if (source === "api") {
    console.log("[data-service] Using live API data for vehicles");
  }
  return data;
}

/* ── Treasury: Bank Account Mapper ──────────── */

export interface UIMappedBankAccount {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  moneda: string;
  saldoInicial: number;
  saldoActual: number;
  activo: boolean;
  createdAt?: string;
}

function mapBankAccountFromApi(api: Record<string, unknown>): UIMappedBankAccount {
  return {
    id: api.id as string,
    codigo: (api.codigo as string) || "",
    nombre: api.nombre as string,
    tipo: (api.tipo as string) || "CORRIENTE",
    moneda: (api.moneda as string) || "PYG",
    saldoInicial: Number(api.saldoInicial ?? 0),
    saldoActual: Number(api.saldoActual ?? 0),
    activo: (api.activo as boolean) ?? true,
    createdAt: api.createdAt as string | undefined,
  };
}

/**
 * Fetches bank accounts from the API with fallback to mock data.
 */
export async function fetchBankAccounts(
  getMockAccounts: () => UIMappedBankAccount[],
  tenantSlug?: string,
): Promise<UIMappedBankAccount[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/finance/treasury/cuentas", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapBankAccountFromApi);
    },
    getMockAccounts,
  );
  if (source === "api") console.log("[data-service] Using live API data for bank accounts");
  return data;
}

/* ── Treasury: Movement Mapper ─────────────── */

export interface UIMappedMovement {
  id: string;
  tipo: "INGRESO" | "EGRESO" | "TRANSFERENCIA";
  medioPago: string;
  cuentaNombre: string;
  monto: number;
  concepto: string;
  fecha: string;
  conciliado: boolean;
}

function mapMovementFromApi(api: Record<string, unknown>): UIMappedMovement {
  return {
    id: api.id as string,
    tipo: (api.tipo as UIMappedMovement["tipo"]) || "INGRESO",
    medioPago: (api.medioPago as string) || "EFECTIVO",
    cuentaNombre: (api.cuentaNombre as string) || "",
    monto: Number(api.monto ?? 0),
    concepto: (api.concepto as string) || "",
    fecha: new Date((api.fecha as string) || Date.now()).toLocaleDateString("es-PY"),
    conciliado: (api.conciliado as boolean) ?? false,
  };
}

/**
 * Fetches treasury movements from the API with fallback to mock data.
 */
export async function fetchMovements(
  getMockMovements: () => UIMappedMovement[],
  tenantSlug?: string,
): Promise<UIMappedMovement[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/finance/treasury/movimientos", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapMovementFromApi);
    },
    getMockMovements,
  );
  if (source === "api") console.log("[data-service] Using live API data for movements");
  return data;
}

/* ── Analytics Dashboard Mapper ─────────────── */

export interface UIMappedAnalyticsData {
  totalIngresos: number;
  totalOrdenes: number;
  ordenesCompletadas: number;
  productividad: number;
  clientesAtendidos: number;
  margenBruto: number;
  ticketPromedio: number;
  mesActual: string;
}

function mapAnalyticsFromApi(api: Record<string, unknown>): UIMappedAnalyticsData {
  return {
    totalIngresos: Number(api.totalIngresos ?? 0),
    totalOrdenes: Number(api.totalOrdenes ?? 0),
    ordenesCompletadas: Number(api.ordenesCompletadas ?? 0),
    productividad: Number(api.productividad ?? 0),
    clientesAtendidos: Number(api.clientesAtendidos ?? 0),
    margenBruto: Number(api.margenBruto ?? 0),
    ticketPromedio: Number(api.ticketPromedio ?? 0),
    mesActual: (api.mesActual as string) || new Date().toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
  };
}

/**
 * Fetches analytics dashboard data from the API with fallback to mock data.
 */
export async function fetchAnalyticsDashboard(
  getMockData: () => UIMappedAnalyticsData,
  tenantSlug?: string,
): Promise<UIMappedAnalyticsData> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/workshop/analytics/dashboard", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown> = await res.json();
      return mapAnalyticsFromApi(json);
    },
    getMockData,
  );
  if (source === "api") console.log("[data-service] Using live API data for analytics");
  return data;
}

/* ── Users (Profiles) Mapper ───────────────── */

export interface UIMappedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "mechanic" | "user";
  activo: boolean;
  createdAt: string;
}

function mapUserFromApi(api: Record<string, unknown>): UIMappedUser {
  return {
    id: api.id as string,
    name: (api.name as string) || (api.nombre as string) || "",
    email: (api.email as string) || "",
    role: (api.role as UIMappedUser["role"]) || (api.rol as UIMappedUser["role"]) || "user",
    activo: (api.activo as boolean) ?? (api.active as boolean) ?? true,
    createdAt: new Date((api.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
  };
}

/**
 * Fetches users/profiles from the API with fallback to mock data.
 */
export async function fetchUsers(
  getMockUsers: () => UIMappedUser[],
  tenantSlug?: string,
): Promise<UIMappedUser[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/api/profiles", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapUserFromApi);
    },
    getMockUsers,
  );
  if (source === "api") console.log("[data-service] Using live API data for users");
  return data;
}

/* ── Scheduling: Appointment Mapper ─────────── */

export interface UIMappedAppointment {
  id: string;
  clienteNombre: string;
  clientePhone: string;
  clienteEmail: string | null;
  vehiculoChapa: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  fechaTurno: string;
  horaTurno: string;
  tipoServicio: "RAPIDO" | "PESADO";
  estado: "RESERVADO" | "CONFIRMADO" | "PROCESADO_EN_ERP" | "AUSENTE" | "CANCELADO";
  createdAt: string;
}

function mapAppointmentFromApi(api: Record<string, unknown>): UIMappedAppointment {
  return {
    id: api.id as string,
    clienteNombre: (api.clienteNombre as string) || "",
    clientePhone: (api.clientePhone as string) || "",
    clienteEmail: (api.clienteEmail as string) ?? null,
    vehiculoChapa: (api.vehiculoChapa as string) || "",
    vehiculoMarca: (api.vehiculoMarca as string) || "",
    vehiculoModelo: (api.vehiculoModelo as string) || "",
    fechaTurno: api.fechaTurno as string,
    horaTurno: api.horaTurno as string,
    tipoServicio: (api.tipoServicio as UIMappedAppointment["tipoServicio"]) || "RAPIDO",
    estado: (api.estado as UIMappedAppointment["estado"]) || "RESERVADO",
    createdAt: new Date((api.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
  };
}

/**
 * Fetches appointments from the API with fallback to mock data.
 */
export async function fetchAppointments(
  getMockAppointments: () => UIMappedAppointment[],
  tenantSlug?: string,
): Promise<UIMappedAppointment[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/scheduling/appointments", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapAppointmentFromApi);
    },
    getMockAppointments,
  );
  if (source === "api") console.log("[data-service] Using live API data for appointments");
  return data;
}

/* ── Config: Settings Mapper ───────────────── */

export interface UIMappedConfigSettings {
  companyName: string;
  companyRuc: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string | null;
  fiscalRegimen: string;
  timbrado: string;
  facturaInicio: string;
}

function mapConfigFromApi(api: Record<string, unknown>): UIMappedConfigSettings {
  return {
    companyName: (api.companyName as string) || (api.razon_social as string) || "",
    companyRuc: (api.companyRuc as string) || (api.ruc as string) || "",
    companyAddress: (api.companyAddress as string) || (api.direccion as string) || "",
    companyPhone: (api.companyPhone as string) || (api.telefono as string) || "",
    companyEmail: (api.companyEmail as string) || (api.email as string) || "",
    companyLogo: (api.companyLogo as string) || (api.logo as string) || null,
    fiscalRegimen: (api.fiscalRegimen as string) || "General",
    timbrado: (api.timbrado as string) || "",
    facturaInicio: (api.facturaInicio as string) || "001-001",
  };
}

/**
 * Fetches config/settings from the API with fallback to mock data.
 */
export async function fetchConfigSettings(
  getMockSettings: () => UIMappedConfigSettings,
  tenantSlug?: string,
): Promise<UIMappedConfigSettings> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/api/config/settings", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown> = await res.json();
      return mapConfigFromApi(json);
    },
    getMockSettings,
  );
  if (source === "api") console.log("[data-service] Using live API data for config");
  return data;
}

/* ── WhatsApp Messages Mapper ───────────────── */

export interface UIMappedWhatsAppMessage {
  id: string;
  clienteName: string;
  phoneNumber: string;
  template: string;
  messageText: string;
  status: "SENT" | "FAILED" | "PENDING";
  sentAt: string;
  hasAttachment: boolean;
  errorMessage?: string | null;
}

function mapWhatsAppMessageFromApi(api: Record<string, unknown>): UIMappedWhatsAppMessage {
  return {
    id: api.id as string,
    clienteName: (api.clienteName as string) || "",
    phoneNumber: (api.phoneNumber as string) || "",
    template: (api.template as string) || "CUSTOM",
    messageText: (api.messageText as string) || "",
    status: (api.status as UIMappedWhatsAppMessage["status"]) || "PENDING",
    sentAt: (api.sentAt as string)
      ? new Date(api.sentAt as string).toLocaleDateString("es-PY")
      : "—",
    hasAttachment: (api.hasAttachment as boolean) ?? false,
    errorMessage: api.errorMessage as string | null,
  };
}

/**
 * Fetches WhatsApp message logs from the API with fallback to mock data.
 */
export async function fetchWhatsAppMessages(
  getMockMessages: () => UIMappedWhatsAppMessage[],
  tenantSlug?: string,
): Promise<UIMappedWhatsAppMessage[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/whatsapp/log", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items: Record<string, unknown>[] = json.items ?? json;
      return items.map(mapWhatsAppMessageFromApi);
    },
    getMockMessages,
  );
  if (source === "api") console.log("[data-service] Using live API data for WhatsApp messages");
  return data;
}

/* ── Fleet Mapper ──────────────────────────── */

export interface UIMappedFleet {
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

function mapFleetFromApi(api: Record<string, unknown>): UIMappedFleet {
  return {
    id: api.id as string,
    nombre: (api.nombre as string) || "",
    empresa: (api.empresa as string) || "",
    contacto: (api.contacto as string) || "",
    telefono: (api.telefono as string) || "",
    email: (api.email as string) ?? null,
    ruc: (api.ruc as string) || "",
    contratoTipo: (api.contratoTipo as string) || "MENSUAL",
    descuentoPorcentaje: Number(api.descuentoPorcentaje ?? 0),
    createdAt: new Date((api.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
  };
}

/**
 * Fetches fleets from the API with fallback to mock data.
 */
export async function fetchFleets(
  getMockFleets: () => UIMappedFleet[],
  tenantSlug?: string,
): Promise<UIMappedFleet[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/fleet", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapFleetFromApi);
    },
    getMockFleets,
  );
  if (source === "api") console.log("[data-service] Using live API data for fleets");
  return data;
}

/* ── Audit Log Mapper ──────────────────────── */

export interface UIMappedAuditEntry {
  id: string;
  usuario: string;
  accion: string;
  entidad: string;
  entidadId: string;
  descripcion: string;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  createdAt: string;
}

function mapAuditFromApi(api: Record<string, unknown>): UIMappedAuditEntry {
  return {
    id: api.id as string,
    usuario: (api.usuario as string) || (api.userEmail as string) || (api.createdBy as string) || "",
    accion: (api.accion as string) || (api.action as string) || "",
    entidad: (api.entidad as string) || (api.entity as string) || (api.entityType as string) || "",
    entidadId: (api.entidadId as string) || (api.entityId as string) || "",
    descripcion: (api.descripcion as string) || (api.description as string) || "",
    valorAnterior: (api.valorAnterior as string) ?? (api.oldValue as string) ?? null,
    valorNuevo: (api.valorNuevo as string) ?? (api.newValue as string) ?? null,
    createdAt: new Date((api.createdAt as string) || Date.now()).toLocaleDateString("es-PY"),
  };
}

/**
 * Fetches audit log entries from the API with fallback to mock data.
 */
export async function fetchAuditLog(
  getMockEntries: () => UIMappedAuditEntry[],
  tenantSlug?: string,
): Promise<UIMappedAuditEntry[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/audit/log", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapAuditFromApi);
    },
    getMockEntries,
  );
  if (source === "api") console.log("[data-service] Using live API data for audit log");
  return data;
}

/* ── Public API ─────────────────────────────── */

/**
 * Fetches clients from the API with fallback to mock data.
 *
 * @param getMockClients - Factory function returning mock UIMappedClient[]
 * @param tenantSlug - Optional tenant slug (defaults to session or "demo")
 * @returns Mapped clients ready for the UI
 */
export async function fetchClients(
  getMockClients: () => UIMappedClient[],
  tenantSlug?: string,
): Promise<UIMappedClient[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/workshop/clientes", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapClientFromApi);
    },
    getMockClients,
  );

  if (source === "api") {
    console.log("[data-service] Using live API data for clients");
  }
  return data;
}

/**
 * Fetches work orders from the API with fallback to mock data.
 *
 * @param getMockOrders - Factory function returning mock UIMappedWorkOrder[]
 * @param tenantSlug - Optional tenant slug (defaults to session or "demo")
 * @returns Mapped work orders ready for the UI
 */
export async function fetchWorkOrders(
  getMockOrders: () => UIMappedWorkOrder[],
  tenantSlug?: string,
): Promise<UIMappedWorkOrder[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/workshop/ordenes", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map((item, i) => mapWorkOrderFromApi(item, i));
    },
    getMockOrders,
  );

  if (source === "api") {
    console.log("[data-service] Using live API data for work orders");
  }
  return data;
}

/**
 * Fetches inventory items from the API with fallback to mock data.
 *
 * @param getMockInventory - Factory function returning mock UIMappedInventoryItem[]
 * @param tenantSlug - Optional tenant slug (defaults to session or "demo")
 * @returns Mapped inventory items ready for the UI
 */
export async function fetchInventoryItems(
  getMockInventory: () => UIMappedInventoryItem[],
  tenantSlug?: string,
): Promise<UIMappedInventoryItem[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/inventory/repuestos?limit=100", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items: Record<string, unknown>[] = json.items ?? json;
      return items.map(mapInventoryFromApi);
    },
    getMockInventory,
  );

  if (source === "api") {
    console.log("[data-service] Using live API data for inventory");
  }
  return data;
}

/**
 * Fetches invoices from the API with fallback to mock data.
 *
 * @param getMockInvoices - Factory function returning mock UIMappedInvoice[]
 * @param tenantSlug - Optional tenant slug (defaults to session or "demo")
 * @returns Mapped invoices ready for the UI
 */
export async function fetchInvoices(
  getMockInvoices: () => UIMappedInvoice[],
  tenantSlug?: string,
): Promise<UIMappedInvoice[]> {
  const { data, source } = await fetchOrMock(
    async (slug, token) => {
      const res = await fetch("/finance/invoices", {
        headers: { "X-Tenant-Slug": slug, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Record<string, unknown>[] = await res.json();
      return json.map(mapInvoiceFromApi);
    },
    getMockInvoices,
  );

  if (source === "api") {
    console.log("[data-service] Using live API data for invoices");
  }
  return data;
}
