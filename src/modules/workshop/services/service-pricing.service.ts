/**
 * Service Pricing Service — CRUD for multi-dimensional pricing matrix.
 *
 * Manages:
 *   - service_categories
 *   - service_pricing_rules
 *   - service_brand_map
 *   - Reference data lookups (vehicle_types, fuel_types, mileage_intervals)
 *   - Pricing matrix resolution (service + vehicle + fuel + km → price)
 *
 * @module workshop/services/service-pricing.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  serviceCategories,
  servicePricingRules,
  serviceBrandMap,
  vehicleTypes,
  fuelTypes,
  mileageIntervals,
  type ServiceCategory,
  type ServicePricingRule,
  type ServiceBrandMap,
  type VehicleType,
  type FuelType,
  type MileageInterval,
} from "../schema/index.js";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError } from "../../../shared/errors/app-error.js";

// ─── Types ──────────────────────────────────────

export interface CreateCategoryInput {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  orden?: number;
}

export interface CreatePricingRuleInput {
  servicioId: string;
  vehicleTypeId: string;
  fuelTypeId?: string;
  mileageIntervalId?: string;
  precioVentaPyg: number;
  precioCostoPyg?: number;
  impuestoIvaPct?: number;
  tiempoEstimadoMin: number;
  complejidad?: string;
  activo?: boolean;
  tenantSlug: string;
}

export interface PricingMatrixQuery {
  servicioId: string;
  vehicleTypeId: string;
  fuelTypeId?: string;
  mileageIntervalId?: string;
  tenantSlug: string;
}

// ─── Categories ─────────────────────────────────

export async function listCategories(): Promise<ServiceCategory[]> {
  return db()
    .select()
    .from(serviceCategories)
    .orderBy(serviceCategories.orden, serviceCategories.nombre);
}

export async function getCategory(id: string): Promise<ServiceCategory> {
  const [row] = await db()
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.id, id))
    .limit(1);
  if (!row) throw new NotFoundError(`Categoría ${id} no encontrada`);
  return row;
}

export async function createCategory(
  data: CreateCategoryInput,
): Promise<ServiceCategory> {
  const [row] = await db()
    .insert(serviceCategories)
    .values({
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      icono: data.icono ?? null,
      color: data.color ?? null,
      orden: data.orden ?? 0,
    })
    .returning();
  return row;
}

export async function updateCategory(
  id: string,
  data: Partial<CreateCategoryInput>,
): Promise<ServiceCategory> {
  const [row] = await db()
    .update(serviceCategories)
    .set({
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}),
      ...(data.icono !== undefined ? { icono: data.icono } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.orden !== undefined ? { orden: data.orden } : {}),
    })
    .where(eq(serviceCategories.id, id))
    .returning();
  if (!row) throw new NotFoundError(`Categoría ${id} no encontrada`);
  return row;
}

export async function deleteCategory(
  id: string,
): Promise<{ deleted: boolean }> {
  const [row] = await db()
    .delete(serviceCategories)
    .where(eq(serviceCategories.id, id))
    .returning({ id: serviceCategories.id });
  if (!row) throw new NotFoundError(`Categoría ${id} no encontrada`);
  return { deleted: true };
}

// ─── Pricing Rules ──────────────────────────────

export interface PricingRuleListOptions {
  servicioId?: string;
  vehicleTypeId?: string;
  activo?: boolean;
  limit?: number;
  offset?: number;
}

export async function listPricingRules(
  opts: PricingRuleListOptions = {},
  tenantSlug?: string,
): Promise<ServicePricingRule[]> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (tenantSlug) conditions.push(eq(servicePricingRules.tenantSlug, tenantSlug));
  if (opts.servicioId) conditions.push(eq(servicePricingRules.servicioId, opts.servicioId));
  if (opts.vehicleTypeId) conditions.push(eq(servicePricingRules.vehicleTypeId, opts.vehicleTypeId));
  if (opts.activo !== undefined) conditions.push(eq(servicePricingRules.activo, opts.activo));

  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;

  return db()
    .select()
    .from(servicePricingRules)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(servicePricingRules.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPricingRule(
  id: string,
  tenantSlug?: string,
): Promise<ServicePricingRule> {
  const conditions = [eq(servicePricingRules.id, id)];
  if (tenantSlug) conditions.push(eq(servicePricingRules.tenantSlug, tenantSlug));

  const [row] = await db()
    .select()
    .from(servicePricingRules)
    .where(and(...conditions))
    .limit(1);

  if (!row) throw new NotFoundError(`Regla de precio ${id} no encontrada`);
  return row;
}

export async function createPricingRule(
  data: CreatePricingRuleInput,
): Promise<ServicePricingRule> {
  const [row] = await db()
    .insert(servicePricingRules)
    .values({
      servicioId: data.servicioId,
      vehicleTypeId: data.vehicleTypeId,
      fuelTypeId: data.fuelTypeId ?? null,
      mileageIntervalId: data.mileageIntervalId ?? null,
      precioVentaPyg: String(data.precioVentaPyg),
      precioCostoPyg: String(data.precioCostoPyg ?? 0),
      impuestoIvaPct: String(data.impuestoIvaPct ?? 10),
      tiempoEstimadoMin: data.tiempoEstimadoMin,
      complejidad: data.complejidad ?? "NORMAL",
      activo: data.activo ?? true,
      tenantSlug: data.tenantSlug,
    })
    .returning();
  return row;
}

export async function updatePricingRule(
  id: string,
  data: Partial<CreatePricingRuleInput>,
  tenantSlug?: string,
): Promise<ServicePricingRule> {
  const conditions = [eq(servicePricingRules.id, id)];
  if (tenantSlug) conditions.push(eq(servicePricingRules.tenantSlug, tenantSlug));

  const updateFields: Record<string, unknown> = {};
  if (data.servicioId !== undefined) updateFields.servicioId = data.servicioId;
  if (data.vehicleTypeId !== undefined) updateFields.vehicleTypeId = data.vehicleTypeId;
  if (data.fuelTypeId !== undefined) updateFields.fuelTypeId = data.fuelTypeId;
  if (data.mileageIntervalId !== undefined) updateFields.mileageIntervalId = data.mileageIntervalId;
  if (data.precioVentaPyg !== undefined) updateFields.precioVentaPyg = String(data.precioVentaPyg);
  if (data.precioCostoPyg !== undefined) updateFields.precioCostoPyg = String(data.precioCostoPyg);
  if (data.impuestoIvaPct !== undefined) updateFields.impuestoIvaPct = String(data.impuestoIvaPct);
  if (data.tiempoEstimadoMin !== undefined) updateFields.tiempoEstimadoMin = data.tiempoEstimadoMin;
  if (data.complejidad !== undefined) updateFields.complejidad = data.complejidad;
  if (data.activo !== undefined) updateFields.activo = data.activo;

  const [row] = await db()
    .update(servicePricingRules)
    .set(updateFields)
    .where(and(...conditions))
    .returning();

  if (!row) throw new NotFoundError(`Regla de precio ${id} no encontrada`);
  return row;
}

export async function deletePricingRule(
  id: string,
  tenantSlug?: string,
): Promise<{ deleted: boolean }> {
  const conditions = [eq(servicePricingRules.id, id)];
  if (tenantSlug) conditions.push(eq(servicePricingRules.tenantSlug, tenantSlug));

  const [row] = await db()
    .delete(servicePricingRules)
    .where(and(...conditions))
    .returning({ id: servicePricingRules.id });

  if (!row) throw new NotFoundError(`Regla de precio ${id} no encontrada`);
  return { deleted: true };
}

// ─── Pricing Matrix Resolution ──────────────────

/**
 * Resolve price for a given service + vehicle type + optional fuel/interval.
 * Returns the most specific match available.
 */
export async function resolvePricing(
  query: PricingMatrixQuery,
): Promise<ServicePricingRule | null> {
  // Try most specific match first (all 4 dimensions)
  if (query.fuelTypeId && query.mileageIntervalId) {
    const [row] = await db()
      .select()
      .from(servicePricingRules)
      .where(
        and(
          eq(servicePricingRules.servicioId, query.servicioId),
          eq(servicePricingRules.vehicleTypeId, query.vehicleTypeId),
          eq(servicePricingRules.fuelTypeId, query.fuelTypeId),
          eq(servicePricingRules.mileageIntervalId, query.mileageIntervalId),
          eq(servicePricingRules.activo, true),
          eq(servicePricingRules.tenantSlug, query.tenantSlug),
        ),
      )
      .limit(1);
    if (row) return row;
  }

  // Fallback: service + vehicle type only (ignoring fuel and interval)
  const [row] = await db()
    .select()
    .from(servicePricingRules)
    .where(
      and(
        eq(servicePricingRules.servicioId, query.servicioId),
        eq(servicePricingRules.vehicleTypeId, query.vehicleTypeId),
        eq(servicePricingRules.activo, true),
        eq(servicePricingRules.tenantSlug, query.tenantSlug),
      ),
    )
    .limit(1);

  return row ?? null;
}

// ─── Brand Map ──────────────────────────────────

export async function listBrandMap(
  servicioId: string,
): Promise<ServiceBrandMap[]> {
  return db()
    .select()
    .from(serviceBrandMap)
    .where(eq(serviceBrandMap.servicioId, servicioId));
}

export async function setBrandMap(
  servicioId: string,
  marcas: string[],
): Promise<{ count: number }> {
  // Delete existing mappings
  await db()
    .delete(serviceBrandMap)
    .where(eq(serviceBrandMap.servicioId, servicioId));

  // Insert new mappings
  if (marcas.length === 0) return { count: 0 };

  await db()
    .insert(serviceBrandMap)
    .values(marcas.map((marca) => ({ servicioId, marca })));

  return { count: marcas.length };
}

// ─── Reference Data (read-only) ─────────────────

export async function listVehicleTypes(): Promise<VehicleType[]> {
  return db()
    .select()
    .from(vehicleTypes)
    .where(eq(vehicleTypes.activo, true))
    .orderBy(vehicleTypes.nombre);
}

export async function listFuelTypes(): Promise<FuelType[]> {
  return db().select().from(fuelTypes).orderBy(fuelTypes.nombre);
}

export async function listMileageIntervals(): Promise<MileageInterval[]> {
  return db()
    .select()
    .from(mileageIntervals)
    .orderBy(mileageIntervals.orden);
}
