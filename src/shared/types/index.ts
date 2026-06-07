/**
 * Shared TypeScript types and interfaces for AutomotiveOS Cloud ERP.
 *
 * @module shared/types
 */

// ─── Tenant ──────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
  ruc: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Client ──────────────────────────────────
export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ruc: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Vehicle ─────────────────────────────────
export type EngineType = "combustion" | "hybrid" | "electric";

export interface Vehicle {
  id: string;
  clientId: string;
  plate: string | null;
  vin: string | null;
  brand: string;
  model: string;
  year: number | null;
  engineType: EngineType;
  /** High-voltage battery nominal voltage (V) — for EV/HEV */
  hvBatteryVoltage: number | null;
  /** True after HV safety disconnect procedure */
  hvSafetyDisabled: boolean;
  /** Stored diagnostic trouble codes */
  dtcCodes: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Work Order ──────────────────────────────
export type WorkOrderStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface WorkOrder {
  id: string;
  vehicleId: string;
  clientId: string;
  status: WorkOrderStatus;
  description: string | null;
  diagnosis: string | null;
  dtcCodes: string[];
  hvAlert: boolean;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Inventory ───────────────────────────────
export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  minStock: number;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolCheckout {
  id: string;
  toolId: string;
  mechanicId: string;
  workOrderId: string | null;
  checkedOut: Date;
  checkedIn: Date | null;
}

// ─── Fiscal (SIFEN/DNIT) ────────────────────
export type FiscalDocumentStatus = "draft" | "sent" | "approved" | "rejected";

export interface FiscalDocument {
  id: string;
  workOrderId: string | null;
  dteType: string;
  cdc: string | null;
  xmlBody: string | null;
  kuDePdfUrl: string | null;
  status: FiscalDocumentStatus;
  createdAt: Date;
}

// ─── API ─────────────────────────────────────
export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  uptime: number;
  database: "connected" | "disconnected";
  version: string;
  memory: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
