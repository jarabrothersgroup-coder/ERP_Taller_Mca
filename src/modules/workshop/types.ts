/**
 * Workshop module — shared types & DTOs.
 *
 * Request/response schemas for the workshop Fastify endpoints.
 * All types are fully typed for compile-time safety.
 *
 * @module workshop/types
 */

// ─── Ingreso (Check-in) ───────────────────────

/** POST /workshop/ingresos request body */
export interface CreateIngresoRequest {
  /** Vehicle UUID */
  vehicleId: string;
  /** Odometer reading (km) */
  kilometraje?: number | null;
  /** Fuel level description */
  nivelCombustible?: string | null;
  /** Exterior condition notes */
  estadoExterior?: string | null;
  /** Additional observations */
  observaciones?: string | null;
  /** Optional: create a work order simultaneously */
  crearOrden?: boolean;
  /** Work description (required if crearOrden is true) */
  descripcionTrabajo?: string | null;
}

/** Response after creating an ingreso */
export interface CreateIngresoResponse {
  /** The created check-in record */
  ingreso: {
    id: string;
    vehicleId: string;
    ordenTrabajoId: string | null;
    fechaIngreso: string;
    kilometraje: number | null;
    nivelCombustible: string | null;
    estadoExterior: string | null;
    observaciones: string | null;
  };
  /** The work order created (if crearOrden was true) */
  ordenTrabajo?: {
    id: string;
    status: string;
  } | null;
}

// ─── Trabajo de Tercero ───────────────────────

/** POST /workshop/ordenes/:id/trabajos-terceros request body */
export interface CreateTrabajoTerceroRequest {
  /** Vendor / supplier name */
  proveedor: string;
  /** Description of the outsourced work */
  descripcion: string;
  /** Cost charged by the third party */
  costo: string | number;
  /** Start date (ISO 8601) */
  fechaInicio?: string | null;
  /** Expected completion date (ISO 8601) */
  fechaFin?: string | null;
}

/** Response after creating a trabajo tercero */
export interface CreateTrabajoTerceroResponse {
  /** The created third-party work record */
  trabajoTercero: {
    id: string;
    ordenTrabajoId: string;
    proveedor: string;
    descripcion: string;
    costo: string;
    estado: string;
    fechaInicio: string | null;
    fechaFin: string | null;
  };
}

// ─── Error response ───────────────────────────

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}
