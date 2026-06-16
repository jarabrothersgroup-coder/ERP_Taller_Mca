/**
 * Input Validation Schemas — Zod-based request validation.
 *
 * Replaces fragile Fastify JSON Schema with type-safe Zod validation.
 * All API inputs pass through these schemas before reaching services.
 *
 * @module shared/validation/schemas
 */

import { z } from "zod";

// ─── Common Patterns ───────────────────────────

const uuid = z.string().uuid("UUID inválido");
const slug = z
  .string()
  .min(1, "Slug requerido")
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "Slug solo puede contener letras, números, guiones y guiones bajos");
const email = z.string().email("Email inválido").max(255);
const phone = z.string().max(20).optional();
const ruc = z.string().max(20).optional();
const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Client Schemas ────────────────────────────

export const createClientSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  email: email.optional().or(z.literal("")),
  phone,
  ruc,
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ─── Vehicle Schemas ───────────────────────────

export const createVehicleSchema = z.object({
  clientId: uuid,
  brand: z.string().min(1, "Marca requerida").max(100),
  model: z.string().min(1, "Modelo requerido").max(100),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  vin: z.string().min(17, "VIN debe tener 17 caracteres").max(17).optional(),
  plate: z.string().max(20).optional(),
  engineType: z.enum(["Nafta", "Diesel", "HEV", "BEV", "PHEV"]).optional(),
  kilometraje: z.coerce.number().int().min(0).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().omit({ clientId: true });

// ─── Work Order Schemas ────────────────────────

export const createOrdenSchema = z.object({
  vehicleId: uuid,
  clientId: uuid,
  description: z.string().min(1, "Descripción requerida").max(2000),
  status: z.enum(["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"]).optional(),
});

export const updateOrdenSchema = z.object({
  description: z.string().max(2000).optional(),
  status: z.enum(["Presupuestado", "Aprobado", "En_Proceso", "Control_Calidad", "Listo"]).optional(),
  diagnosis: z.string().max(2000).optional(),
});

// ─── Order Items Schemas ───────────────────────

export const addServicioToOtSchema = z.object({
  servicioCatalogoId: uuid.optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(500),
  cantidad: z.coerce.number().int().min(1).max(999),
  precioUnitario: z.coerce.number().min(0, "Precio no puede ser negativo"),
});

export const addRepuestoToOtSchema = z.object({
  repuestoId: uuid.optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(500),
  cantidad: z.coerce.number().int().min(1).max(999),
  precioUnitario: z.coerce.number().min(0, "Precio no puede ser negativo"),
});

// ─── Invoice Schemas ───────────────────────────

export const issueInvoiceSchema = z.object({
  ordenId: uuid,
  tipoFacturacion: z.enum(["MANUAL", "ELECTRONICA"]),
  numeroFacturaManual: z.string().max(30).optional(),
  ivaExento: z.boolean().optional(),
});

export const registerPaymentSchema = z.object({
  facturaId: uuid,
  monto: z.coerce.number().positive("Monto debe ser mayor a 0"),
  medioPago: z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "QR", "CHEQUE"]),
  cuentaId: uuid.optional(),
  referencia: z.string().max(100).optional(),
});

// ─── Treasury Schemas ──────────────────────────

export const createCuentaBancariaSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(1).max(200),
  tipo: z.enum(["CORRIENTE", "AHORRO", "CAJA"]),
  moneda: z.enum(["PYG", "USD"]).default("PYG"),
  saldoInicial: z.coerce.number().min(0).default(0),
});

export const registrarMovimientoSchema = z.object({
  cuentaId: uuid,
  tipo: z.enum(["INGRESO", "EGRESO", "TRANSFERENCIA"]),
  monto: z.coerce.number().positive("Monto debe ser mayor a 0"),
  medioPago: z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "QR", "CHEQUE", "DEPOSITO"]),
  concepto: z.string().min(1, "Concepto requerido").max(500),
  cuentaContableId: uuid.optional(),
  destinoCuentaId: uuid.optional(), // For transfers
});

// ─── Notification Schemas ──────────────────────

export const createNotificacionSchema = z.object({
  tipo: z.string().min(1).max(50),
  titulo: z.string().min(1).max(200),
  mensaje: z.string().min(1).max(1000),
  entityType: z.string().max(50).optional(),
  entityId: uuid.optional(),
});

// ─── Budget Schemas ────────────────────────────

export const createPresupuestoSchema = z.object({
  periodo: z.string().min(1, "Periodo requerido").max(20),
  centroCostoId: uuid.optional(),
  montoPresupuestado: z.coerce.number().min(0),
  categoria: z.string().max(100).optional(),
});

// ─── Search Schemas ────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(1, "Query requerido").max(100).trim(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// ─── Auth Schemas ──────────────────────────────

export const loginSchema = z.object({
  tenantSlug: slug,
  email: email,
  password: z.string().min(1, "Contraseña requerida").max(128).optional(),
});

export const profileSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  role: z.enum(["user", "mechanic", "manager", "admin"]).optional(),
  isActive: z.boolean().optional(),
});

// ─── Export Helpers ─────────────────────────────

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type CreateOrdenInput = z.infer<typeof createOrdenSchema>;
export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * Validate request body against a Zod schema.
 * Returns { success, data, errors } for use in route handlers.
 */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}
