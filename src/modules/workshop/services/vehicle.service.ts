/**
 * Vehicle Service — CRUD operations for workshop vehicles.
 *
 * Follows existing patterns: Drizzle ORM with db() singleton,
 * DTO-only returns, N+1 prevention via PK-index queries.
 * Supports HEV/BEV high-voltage safety fields.
 *
 * @module workshop/services/vehicle-service
 */

import { db } from "../../../shared/database/drizzle.js";
import { vehiculos } from "../schema/index.js";
import { clients } from "../../../shared/database/schema/clients.js";
import { eq, desc, ilike, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import type { Vehiculo, NewVehiculo, TipoMotor } from "../schema/index.js";

const VALID_ENGINE_TYPES: TipoMotor[] = ["Nafta", "Diésel", "HEV", "BEV"];

/**
 * Lists vehicles with optional search filters and mandatory tenant isolation.
 *
 * @param filters - Optional filters (clientId, brand, model, plate, vin, engineType)
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns Array of vehicle DTOs ordered by creation date descending
 */
export async function listVehicles(
  filters?: {
    clientId?: string;
    brand?: string;
    model?: string;
    plate?: string;
    vin?: string;
    engineType?: string;
    limit?: number;
    offset?: number;
  },
  tenantSlug?: string,
): Promise<Vehiculo[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  // Multi-tenant isolation — mandatory filter
  if (tenantSlug) {
    conditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }

  if (filters?.clientId) {
    conditions.push(eq(vehiculos.clientId, filters.clientId));
  }
  if (filters?.brand) {
    conditions.push(ilike(vehiculos.brand, `%${filters.brand}%`));
  }
  if (filters?.model) {
    conditions.push(ilike(vehiculos.model, `%${filters.model}%`));
  }
  if (filters?.plate) {
    conditions.push(ilike(vehiculos.plate, `%${filters.plate}%`));
  }
  if (filters?.vin) {
    conditions.push(ilike(vehiculos.vin, `%${filters.vin}%`));
  }
  if (filters?.engineType) {
    conditions.push(eq(vehiculos.engineType, filters.engineType as TipoMotor));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  return db()
    .select()
    .from(vehiculos)
    .where(where)
    .orderBy(desc(vehiculos.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Gets a single vehicle by ID with tenant isolation.
 *
 * @param id - Vehicle UUID
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The vehicle DTO
 * @throws {NotFoundError} If the vehicle does not exist
 */
export async function getVehicle(id: string, tenantSlug?: string): Promise<Vehiculo> {
  const conditions = [eq(vehiculos.id, id)];
  if (tenantSlug) {
    conditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }
  const [vehicle] = await db()
    .select()
    .from(vehiculos)
    .where(and(...conditions))
    .limit(1);

  if (!vehicle) {
    throw new NotFoundError(`Vehículo con ID ${id} no encontrado`);
  }

  return vehicle;
}

/**
 * Creates a new vehicle record with tenant isolation.
 *
 * @param data - Vehicle creation payload
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The created vehicle DTO
 * @throws {ValidationError} If required fields are missing or invalid
 */
export async function createVehicle(
  data: Record<string, unknown>,
  tenantSlug?: string,
): Promise<Vehiculo> {
  const brand = data["brand"];
  const model = data["model"];
  const clientId = data["clientId"];

  if (!brand || typeof brand !== "string" || brand.trim().length === 0) {
    throw new ValidationError("La marca del vehículo es obligatoria", {
      brand: ["Debe ser un texto no vacío"],
    });
  }
  if (!model || typeof model !== "string" || model.trim().length === 0) {
    throw new ValidationError("El modelo del vehículo es obligatorio", {
      model: ["Debe ser un texto no vacío"],
    });
  }
  if (!clientId || typeof clientId !== "string") {
    throw new ValidationError("El ID del cliente es obligatorio", {
      clientId: ["Debe ser un UUID válido"],
    });
  }

  // Validate client exists
  const [client] = await db()
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    throw new NotFoundError(`Cliente con ID ${clientId} no encontrado`);
  }

  // Validate engine type
  const engineType = data["engineType"];
  if (engineType !== undefined && engineType !== null) {
    if (!VALID_ENGINE_TYPES.includes(engineType as TipoMotor)) {
      throw new ValidationError(
        `Tipo de motor inválido: ${engineType}. Valores válidos: ${VALID_ENGINE_TYPES.join(", ")}`,
        { engineType: ["Tipo de motor no reconocido"] },
      );
    }
  }

  const insertData: NewVehiculo = {
    clientId,
    brand: brand.trim(),
    model: model.trim(),
    plate: typeof data["plate"] === "string" ? data["plate"].trim() || null : null,
    vin: typeof data["vin"] === "string" ? data["vin"].trim() || null : null,
    year: typeof data["year"] === "number" ? data["year"] : null,
    engineType: (engineType as TipoMotor) ?? "Nafta",
    kilometraje: typeof data["kilometraje"] === "number" ? data["kilometraje"] : null,
    hvBatteryVoltage: typeof data["hvBatteryVoltage"] === "number" ? data["hvBatteryVoltage"] : null,
    hvSafetyDisabled: typeof data["hvSafetyDisabled"] === "boolean" ? data["hvSafetyDisabled"] : false,
    dtcCodes: Array.isArray(data["dtcCodes"]) ? (data["dtcCodes"] as string[]) : null,
    notes: typeof data["notes"] === "string" ? data["notes"].trim() || null : null,
    tenantSlug: tenantSlug ?? "default",
  };

  const [vehicle] = await db()
    .insert(vehiculos)
    .values(insertData)
    .returning();

  return vehicle;
}

/**
 * Updates an existing vehicle with tenant isolation.
 *
 * @param id - Vehicle UUID
 * @param data - Fields to update
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @returns The updated vehicle DTO
 * @throws {NotFoundError} If the vehicle does not exist or tenant mismatch
 * @throws {ValidationError} If engine type is invalid
 */
export async function updateVehicle(
  id: string,
  data: Record<string, unknown>,
  tenantSlug?: string,
): Promise<Vehiculo> {
  const conditions = [eq(vehiculos.id, id)];
  if (tenantSlug) {
    conditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }
  const [existing] = await db()
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Vehículo con ID ${id} no encontrado o no pertenece al taller`);
  }

  const updateData: Partial<NewVehiculo> = {};

  if (data["clientId"] !== undefined) {
    const cid = data["clientId"] as string;
    const [client] = await db()
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, cid))
      .limit(1);
    if (!client) {
      throw new NotFoundError(`Cliente con ID ${cid} no encontrado`);
    }
    updateData.clientId = cid;
  }

  if (data["brand"] !== undefined) {
    updateData.brand = (data["brand"] as string).trim();
  }
  if (data["model"] !== undefined) {
    updateData.model = (data["model"] as string).trim();
  }
  if (data["plate"] !== undefined) {
    updateData.plate = typeof data["plate"] === "string" ? (data["plate"] as string).trim() || null : null;
  }
  if (data["vin"] !== undefined) {
    updateData.vin = typeof data["vin"] === "string" ? (data["vin"] as string).trim() || null : null;
  }
  if (data["year"] !== undefined) {
    updateData.year = data["year"] as number;
  }
  if (data["engineType"] !== undefined) {
    const et = data["engineType"] as string;
    if (!VALID_ENGINE_TYPES.includes(et as TipoMotor)) {
      throw new ValidationError(
        `Tipo de motor inválido: ${et}. Valores válidos: ${VALID_ENGINE_TYPES.join(", ")}`,
      );
    }
    updateData.engineType = et as TipoMotor;
  }
  if (data["kilometraje"] !== undefined) {
    updateData.kilometraje = data["kilometraje"] as number;
  }
  if (data["hvBatteryVoltage"] !== undefined) {
    updateData.hvBatteryVoltage = data["hvBatteryVoltage"] as number;
  }
  if (data["hvSafetyDisabled"] !== undefined) {
    updateData.hvSafetyDisabled = data["hvSafetyDisabled"] as boolean;
  }
  if (data["dtcCodes"] !== undefined) {
    updateData.dtcCodes = data["dtcCodes"] as string[];
  }
  if (data["notes"] !== undefined) {
    updateData.notes = typeof data["notes"] === "string" ? (data["notes"] as string).trim() || null : null;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError("No hay campos válidos para actualizar");
  }

  updateData.updatedAt = new Date();

  const updateConditions = [eq(vehiculos.id, id)];
  if (tenantSlug) {
    updateConditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }
  const [updated] = await db()
    .update(vehiculos)
    .set(updateData)
    .where(and(...updateConditions))
    .returning();

  return updated!;
}

/**
 * Deletes a vehicle record with tenant isolation.
 *
 * @param id - Vehicle UUID
 * @param tenantSlug - Tenant slug for multi-tenant isolation
 * @throws {NotFoundError} If the vehicle does not exist or tenant mismatch
 */
export async function deleteVehicle(id: string, tenantSlug?: string): Promise<{ deleted: boolean }> {
  const conditions = [eq(vehiculos.id, id)];
  if (tenantSlug) {
    conditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }
  const [existing] = await db()
    .select({ id: vehiculos.id })
    .from(vehiculos)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Vehículo con ID ${id} no encontrado o no pertenece al taller`);
  }

  const delConditions = [eq(vehiculos.id, id)];
  if (tenantSlug) {
    delConditions.push(eq(vehiculos.tenantSlug, tenantSlug));
  }
  await db()
    .delete(vehiculos)
    .where(and(...delConditions));

  return { deleted: true };
}
