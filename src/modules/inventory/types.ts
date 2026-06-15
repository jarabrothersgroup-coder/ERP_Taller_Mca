/**
 * Inventory module — shared types & DTOs.
 *
 * Request/response schemas for the inventory Fastify endpoints.
 * All types are fully typed for compile-time safety.
 *
 * @module inventory/types
 */

// ─── Repuestos (Spare Parts) ──────────────────

/** POST /inventory/repuestos request body */
export interface CreateRepuestoRequest {
  codigo: string;
  codigoBarras?: string | null;
  descripcion: string;
  marca?: string | null;
  modelo?: string | null;
  categoria?: string | null;
  precioCosto?: string | number | null;
  precioVenta?: string | number | null;
  stockActual?: number;
  stockMinimo?: number;
  stockMaximo?: number | null;
  puntoReorden?: number | null;
  proveedorPreferidoId?: string | null;
  loteEconomico?: number | null;
  ubicacion?: string | null;
  unidadMedida?: string;
  proveedor?: string | null;
  compatibleCon?: string | null;
  activo?: boolean;
  imagenUrl?: string | null;
}

/** PATCH /inventory/repuestos/:id request body */
export interface UpdateRepuestoRequest {
  codigo?: string;
  codigoBarras?: string | null;
  descripcion?: string;
  marca?: string | null;
  modelo?: string | null;
  categoria?: string | null;
  precioCosto?: string | number | null;
  precioVenta?: string | number | null;
  stockActual?: number;
  stockMinimo?: number;
  stockMaximo?: number | null;
  puntoReorden?: number | null;
  proveedorPreferidoId?: string | null;
  loteEconomico?: number | null;
  ubicacion?: string | null;
  unidadMedida?: string;
  proveedor?: string | null;
  compatibleCon?: string | null;
  activo?: boolean;
  imagenUrl?: string | null;
}

/** POST /inventory/repuestos/salida request body */
export interface SalidaStockRequest {
  /** Repuesto ID */
  repuestoId: string;
  /** Quantity to remove from stock */
  cantidad: number;
  /** Reason for stock output (e.g. "Venta", "Uso en OT", "Ajuste") */
  motivo: string;
  /** Optional work order ID if the part is used in a repair */
  ordenTrabajoId?: string | null;
  /** Optional centro de costo (cost center) for analytical accounting */
  centroCostoId?: string | null;
  /** Optional notes */
  observaciones?: string | null;
}

/** POST /inventory/repuestos/:id/ingreso request body */
export interface IngresoStockRequest {
  /** Quantity to add to stock */
  cantidad: number;
  /** Reason for stock input (e.g. "Compra", "Devolución", "Ajuste") */
  motivo: string;
  /** Unit cost for PPP recalculation (required for "Compra" motivo) */
  costoUnitario?: number | null;
  /** Optional notes */
  observaciones?: string | null;
}

/** Response after stock operation */
export interface StockMovimientoResponse {
  /** The repuesto with updated stock */
  repuesto: {
    id: string;
    codigo: string;
    descripcion: string;
    stockActual: number;
    stockAnterior: number;
  };
  /** Stock movement record (now persisted in DB) */
  movimiento: {
    id: string;
    tipo: "entrada" | "salida";
    cantidad: number;
    motivo: string;
    ordenTrabajoId: string | null;
    costoUnitario: number | null;
  };
}

// ─── Herramientas (Tools — Catalog SKU) ────────

/** POST /inventory/herramientas request body */
export interface CreateHerramientaRequest {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacion?: string | null;
  requiereCalibracion?: boolean;
  tieneSerialIndividual?: boolean;
  vidaUtilAnos?: number | null;
  metodoDepreciacion?: string;
  costoReposicion?: number | string | null;
  categoriaContableId?: string | null;
  activo?: boolean;
  imagenUrl?: string | null;
}

/** PATCH /inventory/herramientas/:id request body */
export interface UpdateHerramientaRequest {
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  categoria?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacion?: string | null;
  requiereCalibracion?: boolean;
  tieneSerialIndividual?: boolean;
  vidaUtilAnos?: number | null;
  metodoDepreciacion?: string;
  costoReposicion?: number | string | null;
  categoriaContableId?: string | null;
  activo?: boolean;
  imagenUrl?: string | null;
}

// ─── Tool Instances (Individual Assets) ───────

/** POST /inventory/tool-instances request body */
export interface CreateToolInstanceRequest {
  herramientaId: string;
  numeroSerie: string;
  tagRfid?: string | null;
  codigoBarras?: string | null;
  codigoInventario?: string | null;
  costoAdquisicion: string | number;
  fechaAdquisicion: string;
  requiereCalibracion?: boolean;
  diasIntervaloCalibracion?: number | null;
  ubicacionActual?: string | null;
  categoriaContableId?: string | null;
}

/** PATCH /inventory/tool-instances/:id request body */
export interface UpdateToolInstanceRequest {
  tagRfid?: string | null;
  codigoBarras?: string | null;
  codigoInventario?: string | null;
  ubicacionActual?: string | null;
  requiereCalibracion?: boolean;
  diasIntervaloCalibracion?: number | null;
  activa?: boolean;
  categoriaContableId?: string | null;
}

/** POST /inventory/tool-instances/:id/calibrate request body */
export interface CalibrateToolRequest {
  fechaInicio?: string;
  observaciones?: string;
}

/** POST /inventory/tool-instances/:id/complete-calibration request body */
export interface CompleteCalibrationRequest {
  resultado: string;
  certificadoUrl?: string | null;
  costo?: number | string | null;
  proximaCalibracion: string;
  observaciones?: string;
}

/** POST /inventory/tool-instances/:id/decommission request body */
export interface DecommissionToolRequest {
  motivoBaja: string;
  fechaBaja?: string;
  observaciones?: string;
}

// ─── Tool Loans (Check-out / Check-in) ─────────

/** POST /inventory/tool-loans/lend request body */
export interface LendToolRequest {
  /** Specific tool instance UUID */
  toolInstanceId: string;
  /** Work order UUID */
  ordenTrabajoId: string;
  /** Mechanic profile UUID */
  mecanicoId: string;
  /** Expected return date (for overdue alerts) */
  fechaEsperadaDevolucion?: string | null;
  /** Condition at checkout */
  condicionSalida?: string | null;
  /** Optional notes */
  observaciones?: string | null;
}

/** POST /inventory/tool-loans/:id/return request body */
export interface ReturnToolRequest {
  /** Condition at return time */
  condicionRetorno: 'BUENO' | 'DESGASTADO' | 'DANADO' | 'EXTRAVIADO';
  /** Estimated repair cost (required if DANADO) */
  costoReparacion?: number | string | null;
  /** Optional notes */
  observaciones?: string | null;
}

/** Response after tool checkout */
export interface LendToolResponse {
  loan: {
    id: string;
    toolInstanceId: string;
    herramientaId: string;
    herramientaNombre: string;
    herramientaCodigo: string;
    toolNumeroSerie: string;
    ordenTrabajoId: string;
    mecanicoId: string;
    mecanicoNombre: string;
    fechaAsignacion: string;
    estado: string;
  };
}

/** Response after tool return */
export interface ReturnToolResponse {
  loan: {
    id: string;
    toolInstanceId: string;
    herramientaNombre: string;
    herramientaCodigo: string;
    ordenTrabajoId: string;
    mecanicoNombre: string;
    fechaAsignacion: string;
    fechaDevolucion: string;
    condicionRetorno: string;
    estado: string;
    costoReparacion: string | null;
    observaciones: string | null;
    asientoGenerado: boolean;
  };
}

// ─── Tool Maintenance / Service Events ─────────

/** POST /inventory/tool-service-events request body */
export interface CreateServiceEventRequest {
  toolInstanceId: string;
  tipo: 'CALIBRACION_PROGRAMADA' | 'CALIBRACION_EXTRAORDINARIA' | 'REPARACION' | 'MANTENIMIENTO_PREVENTIVO' | 'INSPECCION';
  fechaInicio?: string;
  proveedor?: string | null;
  numeroOrdenExterna?: string | null;
  costo?: number | string | null;
  observaciones?: string | null;
}

/** PATCH /inventory/tool-service-events/:id request body */
export interface UpdateServiceEventRequest {
  estado?: 'PROGRAMADO' | 'EN_PROCESO' | 'COMPLETADO' | 'CANCELADO';
  fechaFin?: string | null;
  costo?: number | string | null;
  resultado?: string | null;
  certificadoUrl?: string | null;
  proveedor?: string | null;
  observaciones?: string | null;
}

// ─── Tool Depreciation ─────────────────────────

/** POST /inventory/tools/depreciation/calculate request body */
export interface CalculateDepreciationRequest {
  periodo?: string;   // "YYYY-MM" — defaults to current month
  anho?: number;
  mes?: number;
}

/** Response after depreciation calculation */
export interface DepreciationCalculationResponse {
  entriesCreated: number;
  totalDepreciation: string;
  asientoId: string | null;
  periodo: string;
}

// ─── Legacy Compatibility ──────────────────────
// The following types are kept for backward compatibility but
// are DEPRECATED. Use LendToolRequest / ReturnToolRequest instead.

/** @deprecated Use LendToolRequest — specifiy toolInstanceId instead of herramientaId */
export interface PrestarHerramientaRequest {
  /** Tool UUID (catalog SKU) */
  herramientaId: string;
  /** Work order UUID */
  ordenTrabajoId: string;
  /** Mechanic profile UUID */
  mecanicoId: string;
  /** Optional notes */
  observaciones?: string | null;
}

/** @deprecated Use ReturnToolRequest */
export interface DevolverHerramientaRequest {
  /** Return condition notes */
  observaciones?: string | null;
  /** Estado: Devuelto, Perdido, or Dañado */
  estado?: "Devuelto" | "Perdido" | "Dañado";
}

/** @deprecated Use LendToolResponse */
export interface PrestarHerramientaResponse {
  control: {
    id: string;
    herramientaId: string;
    herramientaNombre: string;
    ordenTrabajoId: string;
    mecanicoId: string;
    mecanicoNombre: string;
    fechaAsignacion: string;
    estado: string;
  };
}

/** @deprecated Use ReturnToolResponse */
export interface DevolverHerramientaResponse {
  control: {
    id: string;
    herramientaId: string;
    herramientaNombre: string;
    ordenTrabajoId: string;
    mecanicoId: string;
    mecanicoNombre: string;
    fechaAsignacion: string;
    fechaDevolucion: string;
    estado: string;
    observaciones: string | null;
  };
}

// ─── Common ───────────────────────────────────

/** Query params for listing endpoints */
export interface ListQuery {
  /** Search term for codigo, codigo_barras, descripcion, nombre */
  search?: string;
  /** Filter by categoria */
  categoria?: string;
  /** Filter by active status */
  activo?: string;
  /** Pagination: page number (1-based) */
  page?: string;
  /** Pagination: items per page */
  limit?: string;
}

/** Error response */
export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

// ─── Stock Movements ───────────────────────────

/** Query params for GET /inventory/stock-movements */
export interface StockMovementsQuery {
  repuestoId?: string;
  tipo?: string;
  ordenTrabajoId?: string;
  page?: string;
  limit?: string;
}

// ─── Purchase Orders ───────────────────────────

/** POST /inventory/purchase-orders request body */
export interface CreatePurchaseOrderRequest {
  numero: string;
  proveedor: string;
  fechaEsperada?: string | null;
  notas?: string | null;
  items: CreatePurchaseOrderItemRequest[];
}

export interface CreatePurchaseOrderItemRequest {
  repuestoId: string;
  cantidad: number;
  costoUnitario: number;
}

/** POST /inventory/purchase-orders/:id/receive request body */
export interface ReceivePurchaseOrderRequest {
  items: Array<{
    itemId: string;
    cantidadRecibida: number;
  }>;
}

// ─── Reorder Alerts ────────────────────────────

/** Query params for GET /inventory/reorder-alerts */
export interface ReorderAlertsQuery {
  estado?: string;
  page?: string;
  limit?: string;
}

// ─── Inventory Accounts Map ────────────────────

/** POST /inventory/accounts-map request body */
export interface CreateAccountsMapRequest {
  categoria: string;
  cuentaInventarioId: string;
  cuentaGastoId: string;
  cuentaProveedorId?: string | null;
}
