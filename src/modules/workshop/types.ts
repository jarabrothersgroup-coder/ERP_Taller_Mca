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

// ─── Checklist de Recepción (P1.1) ─────────

export interface PanelState {
  estado: "BUENO" | "RAYADO" | "ABOLLADO" | "ROTO" | "ABOLLADO_RAYADO";
  fotoUrl?: string;
  observaciones?: string;
}

export interface RecepcionChecklist {
  panels: {
    capot: PanelState;
    paragolpesDel: PanelState;
    paragolpesTras: PanelState;
    puertaDelIzq: PanelState;
    puertaDelDer: PanelState;
    puertaTrasIzq: PanelState;
    puertaTrasDer: PanelState;
    maletero: PanelState;
    techo: PanelState;
    espejoIzq: PanelState;
    espejoDer: PanelState;
  };
  neumaticos: {
    delIzq: string;
    delDer: string;
    trasIzq: string;
    trasDer: string;
    repuesto: string;
  };
  nivelCombustibleExacto: number;  // 0.0 - 1.0
  kilometrajeFoto: boolean;
  accesorios: {
    gato: boolean;
    triangulos: boolean;
    extintor: boolean;
    ruedaRepuesto: boolean;
    herramientas: boolean;
    manual: boolean;
    radioCodigo?: string;
    otros: string[];
  };
  observacionesCliente?: string;
  firmaCliente?: string;  // Base64
  firmaClienteNombre?: string;
}

export interface FirmaRetiro {
  firma: string;  // Base64
  nombre: string;
}

// ─── Orden Detail (P1.2) ────────────────────

export interface OrdenDetailResponse {
  id: string;
  vehicleId: string;
  clientId: string;
  description: string | null;
  diagnosis: string | null;
  status: string;
  hvAlert: boolean;
  hvLockoutSigned: boolean;
  dtcCodes: string[] | null;
  totalCost: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  vehiculo: string | null;
  plate: string | null;
  cliente: string | null;
  clienteEmail: string | null;
  clientePhone: string | null;
  // Servicios + repuestos + terceros
  servicios: OrdenServicioItem[];
  repuestos: OrdenRepuestoItem[];
  trabajosTerceros: TrabajoTerceroItem[];
  // Checklist + firma
  checklist: RecepcionChecklist | null;
  firmaRetiro: string | null;
  firmaRetiroNombre: string | null;
  // DVI asociado
  dviInspections: DVIItem[];
  // Timeline
  timeline: TimelineEntry[];
}

export interface OrdenServicioItem {
  id: string;
  servicioId: string;
  servicioNombre: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  duracionEstimada: number | null;
  duracionReal: number | null;
  tecnicoId: string | null;
}

export interface OrdenRepuestoItem {
  id: string;
  repuestoId: string | null;
  repuestoNombre: string;
  codigo: string | null;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
}

export interface TrabajoTerceroItem {
  id: string;
  proveedor: string;
  descripcion: string;
  costo: string;
  estado: string;
  fechaInicio: string | null;
  fechaFin: string | null;
}

export interface DVIItem {
  id: string;
  estado: string;
  fechaCreacion: string;
  healthScore: number | null;
}

export interface TimelineEntry {
  fecha: string;
  estado: string;
  usuario: string;
  descripcion: string;
}

// ─── Presupuesto → OT (P1.3) ────────────────

export interface PresupuestoAprobacion {
  presupuestoId: string;
  accion: "APROBAR" | "RECHAZAR";
  metodoAprobacion: "PORTAL" | "WHATSAPP" | "PRESENCIAL";
  firmaCliente?: string;
  notas?: string;
}

export interface PresupuestoAprobadoResponse {
  success: boolean;
  presupuestoId: string;
  ordenTrabajoId?: string;
  estado: string;
  message: string;
}

// ─── Error response ───────────────────────────

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}
