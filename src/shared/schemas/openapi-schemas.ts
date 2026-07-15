/**
 * Shared OpenAPI Schemas — Reusable type definitions for Swagger + SDK generation.
 *
 * These schemas are referenced by route decorators via `schema: { response: { 200: ... } }`
 * and appear in the OpenAPI spec's `components.schemas` section for SDK generation.
 *
 * @module shared/schemas/openapi-schemas
 */

/** Pagination query params */
export const PaginationQuerySchema = {
  type: "object",
  properties: {
    limit: { type: "number", description: "Max results per page (default 50)", default: 50 },
    offset: { type: "number", description: "Results to skip (default 0)", default: 0 },
  },
};

/** Error response schema */
export const ErrorResponseSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string", description: "Error code" },
    message: { type: "string", description: "Human-readable error message" },
    details: { type: "object", description: "Error details (field-level validation errors)" },
  },
};

/** Client entity schema */
export const ClientSchema = {
  type: "object",
  required: ["id", "nombre", "ruc"],
  properties: {
    id: { type: "string", format: "uuid" },
    nombre: { type: "string", description: "Client name" },
    ruc: { type: "string", description: "Paraguayan tax ID (RUC)" },
    email: { type: "string", format: "email" },
    telefono: { type: "string" },
    direccion: { type: "string" },
    tenantSlug: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** Vehicle entity schema */
export const VehicleSchema = {
  type: "object",
  required: ["id", "marca", "modelo", "placa"],
  properties: {
    id: { type: "string", format: "uuid" },
    marca: { type: "string", description: "Brand" },
    modelo: { type: "string", description: "Model" },
    anio: { type: "number", description: "Year" },
    placa: { type: "string", description: "License plate" },
    vin: { type: "string", description: "Vehicle Identification Number" },
    color: { type: "string" },
    kilometraje: { type: "number", description: "Current odometer reading" },
    clienteId: { type: "string", format: "uuid" },
    tenantSlug: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** Work Order (Orden de Trabajo) schema */
export const OrdenTrabajoSchema = {
  type: "object",
  required: ["id", "numero", "estado"],
  properties: {
    id: { type: "string", format: "uuid" },
    numero: { type: "string", description: "OT sequential number" },
    estado: {
      type: "string",
      enum: ["PENDIENTE", "EN_PROCESO", "ESPERANDO_REPUESTOS", "FINALIZADO", "CANCELADO"],
      description: "Order status",
    },
    vehiculoId: { type: "string", format: "uuid" },
    clienteId: { type: "string", format: "uuid" },
    diagnostico: { type: "string", description: "Initial diagnosis" },
    mecanicoAsignado: { type: "string", description: "Assigned mechanic email" },
    fechaIngreso: { type: "string", format: "date-time" },
    fechaEstimada: { type: "string", format: "date-time" },
    fechaFinalizacion: { type: "string", format: "date-time" },
    totalEstimado: { type: "number", description: "Estimated total (PYG)" },
    totalFinal: { type: "number", description: "Final total (PYG)" },
    tenantSlug: { type: "string" },
  },
};

/** Invoice (Factura) schema */
export const FacturaSchema = {
  type: "object",
  required: ["id", "numero", "estado"],
  properties: {
    id: { type: "string", format: "uuid" },
    numero: { type: "string", description: "Invoice sequential number" },
    estado: {
      type: "string",
      enum: ["BORRADOR", "EMITIDA", "ENVIADA_SIFEN", "FIRMADA", "ANULADA"],
    },
    clienteId: { type: "string", format: "uuid" },
    ordenTrabajoId: { type: "string", format: "uuid" },
    subtotal: { type: "number" },
    iva: { type: "number" },
    total: { type: "number" },
    fechaEmision: { type: "string", format: "date-time" },
    tenantSlug: { type: "string" },
  },
};

/** Inventory Item (Repuesto) schema */
export const RepuestoSchema = {
  type: "object",
  required: ["id", "codigo", "nombre"],
  properties: {
    id: { type: "string", format: "uuid" },
    codigo: { type: "string", description: "SKU / part number" },
    nombre: { type: "string", description: "Part name" },
    descripcion: { type: "string" },
    categoria: { type: "string" },
    marca: { type: "string", description: "Brand" },
    stockActual: { type: "number", description: "Current stock quantity" },
    stockMinimo: { type: "number", description: "Reorder threshold" },
    precioCompra: { type: "number", description: "Purchase price (PYG)" },
    precioVenta: { type: "number", description: "Sale price (PYG)" },
    ubicacion: { type: "string", description: "Physical location / bin" },
    tenantSlug: { type: "string" },
  },
};

/** Notification schema */
export const NotificationSchema = {
  type: "object",
  required: ["id", "tipo", "titulo", "mensaje"],
  properties: {
    id: { type: "string", format: "uuid" },
    tipo: {
      type: "string",
      enum: ["INVENTARIO", "COBRO", "OT", "SEGURIDAD", "SISTEMA"],
      description: "Notification type",
    },
    titulo: { type: "string", description: "Title" },
    mensaje: { type: "string", description: "Message body" },
    priority: {
      type: "string",
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
    },
    leido: { type: "boolean", default: false },
    entityType: { type: "string" },
    entityId: { type: "string" },
    actionUrl: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** API Key schema */
export const ApiKeySchema = {
  type: "object",
  required: ["id", "name", "keyPrefix", "scopes"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", description: "Human-readable key name" },
    keyPrefix: { type: "string", description: "Last 4 chars for display" },
    scopes: {
      type: "array",
      items: { type: "string" },
      description: "Allowed API scopes",
    },
    rateLimit: { type: "number", nullable: true },
    dailyLimit: { type: "number", nullable: true },
    ipWhitelist: {
      type: "array",
      items: { type: "string" },
    },
    isActive: { type: "boolean" },
    lastUsedAt: { type: "string", format: "date-time", nullable: true },
    usageCount: { type: "number" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** Health check response schema */
export const HealthResponseSchema = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["ok", "degraded", "error"] },
    uptime: { type: "number", description: "Server uptime in seconds" },
    memory: {
      type: "object",
      properties: {
        rss: { type: "number", description: "Resident Set Size in bytes" },
        heapUsed: { type: "number" },
        heapTotal: { type: "number" },
      },
    },
    database: { type: "string", enum: ["connected", "disconnected"] },
    timestamp: { type: "string", format: "date-time" },
  },
};
