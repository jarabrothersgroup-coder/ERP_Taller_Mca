/**
 * CRM Deals Service — pipeline management business logic.
 *
 * @module crm/services/deals.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { crmDeals, crmPipelineStages } from "../schema/deals.js";
import { eq, and, asc, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";

// C-10: In-memory nonce map — prevents duplicate deal creation within same day.
// Key format: `tenantSlug:titulo_lowercase:YYYY-MM-DD`
// TTL: auto-cleaned after 24h via daily key rotation
const dealNonces = new Map<string, number>();

/**
 * Generate a daily nonce key for deduplication.
 * @returns Key in format `tenantSlug:titulo:YYYY-MM-DD`
 */
function dailyDealNonceKey(tenantSlug: string, titulo: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `${tenantSlug}:${titulo.toLowerCase().trim()}:${today}`;
}

/**
 * Clean stale nonce entries older than 24h to prevent memory leak.
 */
function cleanStaleNonces(): void {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, timestamp] of dealNonces) {
    if (timestamp < yesterday) {
      dealNonces.delete(key);
    }
  }
}

// ─── Pipeline Stages ──

export async function listStages(tenantSlug: string) {
  return db()
    .select()
    .from(crmPipelineStages)
    .where(eq(crmPipelineStages.tenantSlug, tenantSlug))
    .orderBy(asc(crmPipelineStages.orden));
}

export async function createStage(data: { nombre: string; color?: string }, tenantSlug: string) {
  if (!data.nombre?.trim()) throw new ValidationError("El nombre es obligatorio");
  const [row] = await db()
    .insert(crmPipelineStages)
    .values({ ...data, tenantSlug })
    .returning();
  return row;
}

export async function updateStage(id: string, data: Record<string, any>, tenantSlug: string) {
  await db()
    .select({ id: crmPipelineStages.id })
    .from(crmPipelineStages)
    .where(and(eq(crmPipelineStages.id, id), eq(crmPipelineStages.tenantSlug, tenantSlug)))
    .limit(1)
    .then((r) => { if (!r[0]) throw new NotFoundError(`Stage ${id} no encontrado`); });

  const [row] = await db()
    .update(crmPipelineStages)
    .set(data)
    .where(eq(crmPipelineStages.id, id))
    .returning();
  return row;
}

export async function deleteStage(id: string, _tenantSlug: string) {
  const dealsInStage = await db()
    .select({ id: crmDeals.id })
    .from(crmDeals)
    .where(eq(crmDeals.stageId, id))
    .limit(1);
  if (dealsInStage.length > 0) {
    throw new ValidationError("No se puede eliminar un stage que tiene deals activos");
  }
  await db().delete(crmPipelineStages).where(eq(crmPipelineStages.id, id));
}

// ─── Deals ──

export async function listDeals(tenantSlug: string) {
  return db()
    .select()
    .from(crmDeals)
    .where(eq(crmDeals.tenantSlug, tenantSlug))
    .orderBy(sql`${crmDeals.createdAt} DESC`);
}

export async function getDealById(id: string, tenantSlug: string) {
  const [row] = await db()
    .select()
    .from(crmDeals)
    .where(and(eq(crmDeals.id, id), eq(crmDeals.tenantSlug, tenantSlug)))
    .limit(1);
  if (!row) throw new NotFoundError(`Deal ${id} no encontrado`);
  return row;
}

export async function createDeal(data: {
  titulo: string;
  descripcion?: string;
  clienteNombre?: string;
  clienteEmail?: string;
  clientePhone?: string;
  vehiculoChapa?: string;
  vehiculoMarca?: string;
  vehiculoModelo?: string;
  stageId: string;
  valorEstimado?: number;
  probabilidad?: number;
  fuente?: string;
  responsable?: string;
}, tenantSlug: string) {
  if (!data.titulo?.trim()) throw new ValidationError("El título es obligatorio");
  if (!data.stageId) throw new ValidationError("El stage es obligatorio");

  // ── C-10: Check in-memory nonce for idempotency ──
  // Auto-generated from tenant + titulo + date to prevent duplicate deal creation
  // within the same calendar day without requiring client-side nonce.
  const nonceKey = dailyDealNonceKey(tenantSlug, data.titulo);
  const now = Date.now();

  if (dealNonces.has(nonceKey)) {
    // Nonce exists — possible duplicate submission within the same day
    // Query DB to find existing deal and return it gracefully
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [existingDeal] = await db()
      .select()
      .from(crmDeals)
      .where(
        and(
          eq(crmDeals.tenantSlug, tenantSlug),
          eq(crmDeals.titulo, data.titulo.trim()),
          gte(crmDeals.createdAt, todayStart),
        ),
      )
      .limit(1);
    if (existingDeal) {
      return existingDeal;
    }
  }

  const { titulo, descripcion, clienteNombre, clienteEmail, clientePhone,
          vehiculoChapa, vehiculoMarca, vehiculoModelo, stageId,
          valorEstimado, probabilidad, fuente, responsable } = data;

  const [row] = await db()
    .insert(crmDeals)
    .values({
      titulo: titulo.trim(),
      descripcion,
      clienteNombre,
      clienteEmail,
      clientePhone,
      vehiculoChapa,
      vehiculoMarca,
      vehiculoModelo,
      stageId,
      valorEstimado: valorEstimado?.toString(),
      probabilidad,
      fuente,
      responsable,
      tenantSlug,
    })
    .returning();

  // C-10: Set nonce AFTER successful insert to avoid false positives
  dealNonces.set(nonceKey, now);

  // Periodic cleanup of stale nonces (every 100 creates)
  if (dealNonces.size > 1000) {
    cleanStaleNonces();
  }

  return row;
}

export async function updateDeal(
  id: string,
  data: Record<string, any>,
  tenantSlug: string,
) {
  await getDealById(id, tenantSlug);

  if (data.valorEstimado !== undefined) {
    data.valorEstimado = data.valorEstimado?.toString();
  }

  const [row] = await db()
    .update(crmDeals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(crmDeals.id, id))
    .returning();
  return row;
}

export async function moveDeal(
  id: string,
  newStageId: string,
  tenantSlug: string,
) {
  await getDealById(id, tenantSlug);

  const [row] = await db()
    .update(crmDeals)
    .set({ stageId: newStageId, updatedAt: new Date() })
    .where(eq(crmDeals.id, id))
    .returning();
  return row;
}

export async function closeDeal(
  id: string,
  ganado: boolean,
  tenantSlug: string,
) {
  await getDealById(id, tenantSlug);

  const [row] = await db()
    .update(crmDeals)
    .set({
      ganado,
      fechaCierre: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(crmDeals.id, id))
    .returning();
  return row;
}

export async function deleteDeal(id: string, tenantSlug: string) {
  await getDealById(id, tenantSlug);
  await db().delete(crmDeals).where(eq(crmDeals.id, id));
}

// ─── Default stages seed ──

export async function ensureDefaultStages(tenantSlug: string) {
  const existing = await listStages(tenantSlug);
  if (existing.length > 0) return existing;

  const defaults = [
    { nombre: "Prospecto", color: "#94a3b8", orden: 0 },
    { nombre: "Contactado", color: "#3b82f6", orden: 1 },
    { nombre: "Presupuesto", color: "#f59e0b", orden: 2 },
    { nombre: "Negociación", color: "#8b5cf6", orden: 3 },
    { nombre: "Cerrado Ganado", color: "#22c55e", orden: 4 },
    { nombre: "Cerrado Perdido", color: "#ef4444", orden: 5 },
  ];

  const inserted: any[] = [];
  for (const stage of defaults) {
    const [row] = await db()
      .insert(crmPipelineStages)
      .values({ ...stage, tenantSlug })
      .returning();
    inserted.push(row);
  }
  return inserted;
}
