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
import { eq, desc, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import type { Client, NewClient } from "../../../shared/database/schema/clients.js";

/**
 * Lists all clients for a tenant, ordered by creation date descending.
 *
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns Array of client DTOs
 */
export async function listClients(tenantSlug?: string): Promise<Client[]> {
  const conditions = [];
  if (tenantSlug) {
    conditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  return db()
    .select()
    .from(clients)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(clients.createdAt));
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
  const [existing] = await db()
    .select({ id: clients.id })
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

  return updated!;
}

/**
 * Deletes a client with tenant isolation.
 * For soft-delete scenarios, use update with a status flag.
 *
 * @param id - Client UUID
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @throws {NotFoundError} If the client does not exist or tenant mismatch
 */
export async function deleteClient(id: string, tenantSlug?: string): Promise<{ deleted: boolean }> {
  const conditions = [eq(clients.id, id)];
  if (tenantSlug) {
    conditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  const [existing] = await db()
    .select({ id: clients.id })
    .from(clients)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Cliente con ID ${id} no encontrado o no pertenece al taller`);
  }

  const delConditions = [eq(clients.id, id)];
  if (tenantSlug) {
    delConditions.push(eq(clients.tenantSlug, tenantSlug));
  }
  await db()
    .delete(clients)
    .where(and(...delConditions));

  return { deleted: true };
}
