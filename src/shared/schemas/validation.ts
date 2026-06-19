/**
 * Zod Validation Schemas — Request input validation for all routes.
 *
 * Provides type-safe validation for request bodies, params, and query strings.
 * Prevents invalid/malicious data from reaching route handlers.
 *
 * OWASP Top 10 2021 — A03:2021 Injection
 *
 * @module shared/schemas/validation
 */

import { z } from "zod";

// ─── Common schemas ──────────────────────────────

export const tenantSlugSchema = z
  .string()
  .min(1, "Tenant slug requerido")
  .max(50, "Tenant slug muy largo")
  .regex(/^[a-zA-Z0-9_-]+$/, "Tenant slug formato inválido");

export const emailSchema = z
  .string()
  .min(1, "Email requerido")
  .max(255, "Email muy largo")
  .email("Formato de email inválido");

export const passwordSchema = z
  .string()
  .min(8, "Contraseña debe tener al menos 8 caracteres")
  .max(128, "Contraseña muy larga");

export const idSchema = z
  .string()
  .uuid("ID formato inválido");

// ─── Auth schemas ─────────────────────────────────

export const loginBodySchema = z.object({
  tenantSlug: tenantSlugSchema,
  email: emailSchema,
  password: z.string().min(1, "Contraseña requerida").max(128),
});

export const logoutBodySchema = z.object({}).strict();

// ─── Client Portal schemas ────────────────────────

export const portalMagicLinkSchema = z.object({
  email: emailSchema,
});

export const portalPinSchema = z.object({
  clientId: idSchema,
  pin: z.string().length(6, "PIN debe tener 6 dígitos").regex(/^\d+$/, "PIN solo debe contener dígitos"),
});

export const portalFeedbackSchema = z.object({
  ordenId: idSchema,
  rating: z.number().int().min(1).max(5),
  comentarios: z.string().max(1000).optional(),
});

export const portalAppointmentSchema = z.object({
  vehicleId: idSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha formato inválido (YYYY-MM-DD)"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora formato inválido (HH:MM)"),
  motivo: z.string().min(1, "Motivo requerido").max(500),
});

// ─── Workshop schemas ─────────────────────────────

export const vehicleSchema = z.object({
  chapa: z.string().max(20).optional(),
  vin: z.string().min(17, "VIN debe tener 17 caracteres").max(17),
  marca: z.string().min(1).max(50),
  modelo: z.string().min(1).max(50),
  anio: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  clienteId: idSchema.optional(),
});

export const clienteSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  email: emailSchema.optional(),
  phone: z.string().max(20).optional(),
  ruc: z.string().max(20).optional(),
});

export const ordenTrabajoSchema = z.object({
  vehiculoId: idSchema,
  clienteId: idSchema.optional(),
  motivoIngreso: z.string().min(1, "Motivo requerido").max(500),
  descripcion: z.string().max(2000).optional(),
  diagnostico: z.string().max(2000).optional(),
});

// ─── Inventory schemas ────────────────────────────

export const repuestoSchema = z.object({
  codigo: z.string().max(50).optional(),
  descripcion: z.string().min(1, "Descripción requerida").max(500),
  marca: z.string().max(100).optional(),
  categoria: z.string().max(100).optional(),
  precioVenta: z.number().positive().optional(),
  precioCompra: z.number().positive().optional(),
  stockActual: z.number().int().min(0).optional(),
  puntoReorden: z.number().int().min(0).optional(),
});

export const bulkImportSchema = z.object({
  rows: z.array(z.object({
    codigo: z.string().max(50).optional(),
    descripcion: z.string().min(1).max(500),
    marca: z.string().max(100).optional(),
    categoria: z.string().max(100).optional(),
    precioVenta: z.number().positive().optional(),
    precioCompra: z.number().positive().optional(),
    stockActual: z.number().int().min(0).optional(),
    puntoReorden: z.number().int().min(0).optional(),
  })).min(1, "Al menos 1 fila requerida").max(1000, "Máximo 1000 filas por importación"),
});

// ─── Finance schemas ──────────────────────────────

export const invoiceSchema = z.object({
  ordenTrabajoId: idSchema,
  clienteId: idSchema,
  items: z.array(z.object({
    descripcion: z.string().min(1).max(500),
    cantidad: z.number().positive(),
    precioUnitario: z.number().positive(),
  })).min(1, "Al menos 1 item requerido"),
  total: z.number().positive(),
  observaciones: z.string().max(1000).optional(),
});

// ─── Query parameter schemas ──────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Validation helper ────────────────────────────

/**
 * Validate request body against a Zod schema.
 * Returns validated data or throws ValidationError.
 */
export function validateBody<T extends z.ZodType>(
  body: unknown,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const { ValidationError } = require("../errors/app-error.js") as typeof import("../errors/app-error.js");
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!details[path]) details[path] = [];
      details[path].push(issue.message);
    }
    throw new ValidationError("Datos de entrada inválidos", details);
  }
  return result.data;
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery<T extends z.ZodType>(
  query: unknown,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    const { ValidationError } = require("../errors/app-error.js") as typeof import("../errors/app-error.js");
    throw new ValidationError("Parámetros de consulta inválidos");
  }
  return result.data;
}
