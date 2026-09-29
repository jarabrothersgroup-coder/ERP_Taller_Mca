/**
 * Client Service — CRUD operations for workshop clients/vehicle owners.
 *
 * Follows existing patterns: Drizzle ORM with db() singleton,
 * DTO-only returns (no ORM entity trees), N+1 prevention.
 *
 * @module workshop/services/client-service
 */

import { db } from "../../../shared/database/drizzle.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { eq, desc, and, count, ilike, or } from "drizzle-orm";
import { ConflictError, NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { ordenesTrabajo } from "../schema/index.js";
import { logEntityAudit } from "../../finance/services/accounting/audit-log.service.js";
import type { Client, NewClient } from "../../../shared/database/schema/clients.js";

/** Filtros + paginación de `listClients` (T-54) */
export interface ListClientsParams {
  /** Búsqueda por nombre, email, teléfono o RUC (ILIKE, case-insensitive) */
  search?: string;
  /** Página 1-based */
  page?: number;
  /** Filas por página (1-100) */
  limit?: number;
  tenantSlug?: string;
}

/** Envoltorio paginado — misma convención que /inventory/repuestos */
export interface PaginatedClients {
  items: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Límite duro de filas por página (evita que un pageSize enorme reviente la RAM) */
export const CLIENTS_MAX_LIMIT = 100;

/**
 * Lists clients for a tenant, paginated on the server (T-54).
 *
 * La paginación va en el servidor porque el listado de clientes crece con el
 * taller: traerlo entero para pintar 10 filas en el cliente es lo que
 * provocaba el corte silencioso en listas de 100+.
 *
 * @param params - Filtros (`search`, `page`, `limit`) + `tenantSlug`
 * @returns `{ items, total, page, limit, totalPages }` con la página pedida
 */
export async function listClients(params: ListClientsParams = {}): Promise<PaginatedClients> {
  const { search, tenantSlug } = params;
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const limit = Math.min(CLIENTS_MAX_LIMIT, Math.max(1, Math.trunc(params.limit ?? 20)));
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (tenantSlug) {
    conditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(clients.name, pattern),
        ilike(clients.email, pattern),
        ilike(clients.phone, pattern),
        ilike(clients.ruc, pattern),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // ── count + data en dos queries sobre el mismo WHERE (sin N+1) ──
  // El count reutiliza `where`, que ya incluye el filtro de tenantSlug y de
  // búsqueda: el total nunca puede ser más amplio que las filas devueltas.
  const [totalRow] = await db()
    .select({ total: count() })
    .from(clients)
    .where(where);
  const total = Number(totalRow?.total ?? 0);

  const items = await db()
    .select()
    .from(clients)
    .where(where)
    .orderBy(desc(clients.createdAt))
    .limit(limit)
    .offset(offset);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Gets a single client by ID with tenant isolation.
 *
 * @param id - Client UUID
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The client DTO
 * @throws {NotFoundError} If the client does not exist
 */
export async function getClient(id: string, tenantSlug?: string): Promise<Client> {
  const conditions = [eq(clients.id, id)];
  if (tenantSlug) {
    conditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  const [client] = await db()
    .select()
    .from(clients)
    .where(and(...conditions))
    .limit(1);

  if (!client) {
    throw new NotFoundError(`Cliente con ID ${id} no encontrado`);
  }

  return client;
}

/**
 * Creates a new client (vehicle owner) with tenant assignment.
 *
 * @param data - Client creation payload
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The created client DTO
 * @throws {ValidationError} If the name is empty
 */
export async function createClient(
  data: Record<string, unknown>,
  tenantSlug?: string,
): Promise<Client> {
  const name = data["name"];
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ValidationError("El nombre del cliente es obligatorio", {
      name: ["Debe ser un texto no vacío"],
    });
  }

  const insertData: NewClient = {
    name: name.trim(),
    email: typeof data["email"] === "string" ? data["email"].trim() || null : null,
    phone: typeof data["phone"] === "string" ? data["phone"].trim() || null : null,
    ruc: typeof data["ruc"] === "string" ? data["ruc"].trim() || null : null,
    address: typeof data["address"] === "string" ? data["address"].trim() || null : null,
    notes: typeof data["notes"] === "string" ? data["notes"].trim() || null : null,
    tenantSlug: tenantSlug ?? "default",
  };

  const [client] = await db()
    .insert(clients)
    .values(insertData)
    .returning();

  await logEntityAudit({
    tenantSlug: insertData.tenantSlug,
    accion: "CREATE",
    entidad: "clients",
    entidadId: client.id,
    valorNuevo: client as unknown as Record<string, unknown>,
    descripcion: `Cliente creado: ${client.name}`,
  });

  return client;
}

/**
 * Updates an existing client with tenant isolation.
 *
 * @param id - Client UUID
 * @param data - Fields to update
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The updated client DTO
 * @throws {NotFoundError} If the client does not exist or tenant mismatch
 */
export async function updateClient(
  id: string,
  data: Record<string, unknown>,
  tenantSlug?: string,
): Promise<Client> {
  const conditions = [eq(clients.id, id)];
  if (tenantSlug) {
    conditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  // Full row: it becomes `valorAnterior` of the T-33 audit entry.
  const [existing] = await db()
    .select()
    .from(clients)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Cliente con ID ${id} no encontrado o no pertenece al taller`);
  }

  const updateData: Partial<NewClient> = {};

  if (data["name"] !== undefined) {
    const name = data["name"];
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new ValidationError("El nombre del cliente no puede estar vacío", {
        name: ["Debe ser un texto no vacío"],
      });
    }
    updateData.name = name.trim();
  }

  if (data["email"] !== undefined) {
    updateData.email = typeof data["email"] === "string" ? data["email"].trim() || null : null;
  }
  if (data["phone"] !== undefined) {
    updateData.phone = typeof data["phone"] === "string" ? data["phone"].trim() || null : null;
  }
  if (data["ruc"] !== undefined) {
    updateData.ruc = typeof data["ruc"] === "string" ? data["ruc"].trim() || null : null;
  }
  if (data["address"] !== undefined) {
    updateData.address = typeof data["address"] === "string" ? data["address"].trim() || null : null;
  }
  if (data["notes"] !== undefined) {
    updateData.notes = typeof data["notes"] === "string" ? data["notes"].trim() || null : null;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError("No hay campos válidos para actualizar");
  }

  // Touch updatedAt
  updateData.updatedAt = new Date();

  const updateConditions = [eq(clients.id, id)];
  if (tenantSlug) {
    updateConditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  const [updated] = await db()
    .update(clients)
    .set(updateData)
    .where(and(...updateConditions))
    .returning();

  await logEntityAudit({
    tenantSlug: tenantSlug ?? "default",
    accion: "UPDATE",
    entidad: "clients",
    entidadId: id,
    valorAnterior: existing as unknown as Record<string, unknown>,
    valorNuevo: updated as unknown as Record<string, unknown>,
    descripcion: `Cliente actualizado: ${Object.keys(updateData).join(", ")}`,
  });

  return updated!;
}

/**
 * Deletes a client with tenant isolation.
 * For soft-delete scenarios, use update with a status flag.
 *
 * T-34 (CRM-01): a client with workshop history cannot be deleted. Every
 * invoice references a work order (`facturas.orden_id`, FK ON DELETE RESTRICT
 * added by migration 0026), so refusing deletion whenever the client owns
 * work orders also protects the fiscal trail from orphaning.
 *
 * @param id - Client UUID
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @throws {NotFoundError} If the client does not exist or tenant mismatch
 * @throws {ConflictError} If the client still owns work orders / invoices
 */
export async function deleteClient(id: string, tenantSlug?: string): Promise<{ deleted: boolean }> {
  const conditions = [eq(clients.id, id)];
  if (tenantSlug) {
    conditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  // Full row: it becomes `valorAnterior` of the T-33 audit entry.
  const [existing] = await db()
    .select()
    .from(clients)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Cliente con ID ${id} no encontrado o no pertenece al taller`);
  }

  // ── T-34 (CRM-01): guard referencial antes del borrado ──
  // Filtro de tenant inline (visible para scripts/audit-tenant-filters.mjs).
  const [ordenes] = await db()
    .select({ total: count() })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.clientId, id),
        ...(tenantSlug ? [eq(ordenesTrabajo.tenantSlug, tenantSlug)] : []),
      ),
    )
    .limit(1);

  if (ordenes && Number(ordenes.total) > 0) {
    throw new ConflictError(
      `No se puede eliminar el cliente: posee ${ordenes.total} orden(es) de trabajo ` +
      `con facturas asociadas. Anule o archive las órdenes antes de borrar el cliente.`,
    );
  }

  const delConditions = [eq(clients.id, id)];
  if (tenantSlug) {
    delConditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  await db()
    .delete(clients)
    .where(and(...delConditions));

  await logEntityAudit({
    tenantSlug: tenantSlug ?? "default",
    accion: "DELETE",
    entidad: "clients",
    entidadId: id,
    valorAnterior: existing as unknown as Record<string, unknown>,
    descripcion: `Cliente eliminado: ${existing.name ?? id}`,
  });

  return { deleted: true };
}
