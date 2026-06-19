/**
 * DVI Service — Digital Vehicle Inspection business logic.
 *
 * Manages DVI creation, photo uploads, markup annotations,
 * health score calculation, and WhatsApp sharing.
 *
 * @module dvi/services/dvi.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { dviInspections, dviPhotos, dviItems } from "../schema/dvi.js";
import { eq, and, sql, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

// ─── Types ────────────────────────────────────

export interface CreateDviRequest {
  ordenTrabajoId: string;
  observaciones?: string;
  inspector?: string;
}

export interface AddPhotoRequest {
  categoria: string;
  url: string;
  nombreArchivo?: string;
  markup?: unknown;
  caption?: string;
  orden?: number;
}

export interface AddItemRequest {
  categoria: string;
  descripcion: string;
  estado?: string;
  peso?: number;
  notas?: string;
}

export interface DviWithDetails {
  id: string;
  ordenTrabajoId: string;
  healthScore: number;
  condicionGeneral: string;
  observaciones: string | null;
  inspector: string | null;
  compartidoWhatsApp: boolean;
  healthScoreUrl: string | null;
  createdAt: string;
  updatedAt: string;
  photos: Array<{
    id: string;
    categoria: string;
    url: string;
    markup: unknown;
    caption: string | null;
    orden: number;
  }>;
  items: Array<{
    id: string;
    categoria: string;
    descripcion: string;
    estado: string;
    peso: number;
    notas: string | null;
  }>;
}

// ─── CRUD Operations ──────────────────────────

/**
 * Creates a new DVI inspection.
 *
 * @param data - DVI creation payload
 * @param tenantSlug - Tenant identifier
 * @returns Created DVI record
 */
export async function createDvi(
  data: CreateDviRequest,
  tenantSlug: string,
): Promise<DviInspection> {
  const [dvi] = await db()
    .insert(dviInspections)
    .values({
      ordenTrabajoId: data.ordenTrabajoId,
      observaciones: data.observaciones ?? null,
      inspector: data.inspector ?? null,
      healthScore: 0,
      condicionGeneral: "REGULAR",
      tenantSlug,
    })
    .returning();

  return dvi;
}

/**
 * Gets a DVI inspection with all details (photos + items).
 *
 * @param id - DVI UUID
 * @param tenantSlug - Tenant identifier
 * @returns DVI with photos and items
 * @throws {NotFoundError} If DVI not found
 */
export async function getDviById(
  id: string,
  tenantSlug: string,
): Promise<DviWithDetails> {
  const [dvi] = await db()
    .select()
    .from(dviInspections)
    .where(
      and(
        eq(dviInspections.id, id),
        eq(dviInspections.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!dvi) {
    throw new NotFoundError(`DVI ${id} no encontrado`);
  }

  const photos = await db()
    .select()
    .from(dviPhotos)
    .where(eq(dviPhotos.dviId, id))
    .orderBy(dviPhotos.orden);

  const items = await db()
    .select()
    .from(dviItems)
    .where(eq(dviItems.dviId, id))
    .orderBy(dviItems.categoria);

  return {
    id: dvi.id,
    ordenTrabajoId: dvi.ordenTrabajoId,
    healthScore: dvi.healthScore,
    condicionGeneral: dvi.condicionGeneral,
    observaciones: dvi.observaciones,
    inspector: dvi.inspector,
    compartidoWhatsApp: dvi.compartidoWhatsApp,
    healthScoreUrl: dvi.healthScoreUrl,
    createdAt: dvi.createdAt.toISOString(),
    updatedAt: dvi.updatedAt.toISOString(),
    photos: photos.map((p) => ({
      id: p.id,
      categoria: p.categoria,
      url: p.url,
      markup: p.markup,
      caption: p.caption,
      orden: p.orden,
    })),
    items: items.map((i) => ({
      id: i.id,
      categoria: i.categoria,
      descripcion: i.descripcion,
      estado: i.estado,
      peso: i.peso,
      notas: i.notas,
    })),
  };
}

/**
 * Lists DVI inspections for a work order.
 *
 * @param ordenTrabajoId - Work order UUID
 * @param tenantSlug - Tenant identifier
 * @returns List of DVI inspections
 */
export async function listDviByOrden(
  ordenTrabajoId: string,
  tenantSlug: string,
): Promise<DviInspection[]> {
  return db()
    .select()
    .from(dviInspections)
    .where(
      and(
        eq(dviInspections.ordenTrabajoId, ordenTrabajoId),
        eq(dviInspections.tenantSlug, tenantSlug),
      ),
    )
    .orderBy(desc(dviInspections.createdAt));
}

// ─── Photo Management ─────────────────────────

/**
 * Adds a photo to a DVI inspection.
 *
 * @param dviId - DVI UUID
 * @param data - Photo payload
 * @param tenantSlug - Tenant identifier
 * @returns Created photo record
 */
export async function addPhoto(
  dviId: string,
  data: AddPhotoRequest,
  tenantSlug: string,
) {
  // Verify DVI exists
  const [existing] = await db()
    .select({ id: dviInspections.id })
    .from(dviInspections)
    .where(
      and(
        eq(dviInspections.id, dviId),
        eq(dviInspections.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`DVI ${dviId} no encontrado`);
  }

  const [photo] = await db()
    .insert(dviPhotos)
    .values({
      dviId,
      categoria: data.categoria,
      url: data.url,
      nombreArchivo: data.nombreArchivo ?? null,
      markup: data.markup ?? null,
      caption: data.caption ?? null,
      orden: data.orden ?? 0,
      tenantSlug,
    })
    .returning();

  return photo;
}

/**
 * Updates markup annotations on a photo.
 *
 * @param photoId - Photo UUID
 * @param markup - Canvas markup JSON
 * @param tenantSlug - Tenant identifier
 * @returns Updated photo
 */
export async function updatePhotoMarkup(
  photoId: string,
  markup: unknown,
  tenantSlug: string,
) {
  const [updated] = await db()
    .update(dviPhotos)
    .set({ markup })
    .where(
      and(
        eq(dviPhotos.id, photoId),
        eq(dviPhotos.tenantSlug, tenantSlug),
      ),
    )
    .returning();

  if (!updated) {
    throw new NotFoundError(`Foto ${photoId} no encontrada`);
  }

  return updated;
}

// ─── Inspection Items ─────────────────────────

/**
 * Adds an inspection item to a DVI.
 *
 * @param dviId - DVI UUID
 * @param data - Item payload
 * @param tenantSlug - Tenant identifier
 * @returns Created item record
 */
export async function addItem(
  dviId: string,
  data: AddItemRequest,
  tenantSlug: string,
) {
  const [existing] = await db()
    .select({ id: dviInspections.id })
    .from(dviInspections)
    .where(
      and(
        eq(dviInspections.id, dviId),
        eq(dviInspections.tenantSlug, tenantSlug),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`DVI ${dviId} no encontrado`);
  }

  const [item] = await db()
    .insert(dviItems)
    .values({
      dviId,
      categoria: data.categoria,
      descripcion: data.descripcion,
      estado: data.estado ?? "OK",
      peso: data.peso ?? 5,
      notas: data.notas ?? null,
      tenantSlug,
    })
    .returning();

  return item;
}

/**
 * Updates an inspection item's status.
 *
 * @param itemId - Item UUID
 * @param estado - New status (OK, REQUIERE_ATENCION, CRITICO)
 * @param tenantSlug - Tenant identifier
 * @returns Updated item
 */
export async function updateItemStatus(
  itemId: string,
  estado: string,
  tenantSlug: string,
) {
  const validStatuses = ["OK", "REQUIERE_ATENCION", "CRITICO"];
  if (!validStatuses.includes(estado)) {
    throw new ValidationError(`Estado inválido: ${estado}`);
  }

  const [updated] = await db()
    .update(dviItems)
    .set({ estado })
    .where(
      and(
        eq(dviItems.id, itemId),
        eq(dviItems.tenantSlug, tenantSlug),
      ),
    )
    .returning();

  if (!updated) {
    throw new NotFoundError(`Item ${itemId} no encontrado`);
  }

  return updated;
}

// ─── Health Score Calculation ──────────────────

/**
 * Calculates and updates the health score for a DVI.
 *
 * Score = 100 - (sum of critical item weights / total possible weight × 100)
 *
 * @param dviId - DVI UUID
 * @param tenantSlug - Tenant identifier
 * @returns Updated health score
 */
export async function calculateHealthScore(
  dviId: string,
  tenantSlug: string,
): Promise<number> {
  const items = await db()
    .select({
      estado: dviItems.estado,
      peso: dviItems.peso,
    })
    .from(dviItems)
    .where(eq(dviItems.dviId, dviId));

  if (items.length === 0) return 100;

  const totalWeight = items.reduce((sum, i) => sum + i.peso, 0);
  const criticalWeight = items
    .filter((i) => i.estado === "CRITICO")
    .reduce((sum, i) => sum + i.peso, 0);
  const attentionWeight = items
    .filter((i) => i.estado === "REQUIERE_ATENCION")
    .reduce((sum, i) => sum + i.peso, 0);

  // Critical items reduce score more than attention items
  const score = Math.max(
    0,
    100 - Math.round((criticalWeight * 2 + attentionWeight) / totalWeight * 100),
  );

  // Determine general condition
  let condicionGeneral: string;
  if (score >= 90) condicionGeneral = "EXCELENTE";
  else if (score >= 70) condicionGeneral = "BUENO";
  else if (score >= 50) condicionGeneral = "REGULAR";
  else if (score >= 30) condicionGeneral = "MALO";
  else condicionGeneral = "CRITICO";

  await db()
    .update(dviInspections)
    .set({
      healthScore: score,
      condicionGeneral,
      updatedAt: new Date(),
    })
    .where(eq(dviInspections.id, dviId));

  return score;
}

// ─── WhatsApp Sharing ─────────────────────────

/**
 * Marks a DVI as shared via WhatsApp and generates health score URL.
 *
 * @param dviId - DVI UUID
 * @param tenantSlug - Tenant identifier
 * @returns Health score URL
 */
export async function shareViaWhatsApp(
  dviId: string,
  tenantSlug: string,
): Promise<string> {
  const healthScoreUrl = `https://dvi.taller.com.py/score/${dviId.substring(0, 8)}`;

  await db()
    .update(dviInspections)
    .set({
      compartidoWhatsApp: true,
      compartidoAt: new Date(),
      healthScoreUrl,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dviInspections.id, dviId),
        eq(dviInspections.tenantSlug, tenantSlug),
      ),
    );

  return healthScoreUrl;
}
