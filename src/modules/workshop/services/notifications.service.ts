/**
 * Notifications Service — in-app alerts engine.
 *
 * Handles CRUD for notifications + auto-trigger checks:
 *   - Low stock alerts
 *   - Overdue CxC invoices
 *   - OT status changes
 *
 * @module workshop/services/notifications.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { notificaciones, type NewNotificacion } from "../../../shared/database/schema/notifications.js";
import { eq, and, desc, sql, count } from "drizzle-orm";

// ─── CRUD ──────────────────────────────────────────────

/**
 * Create a new notification.
 */
export async function crearNotificacion(
  input: Omit<NewNotificacion, "id" | "createdAt" | "updatedAt">,
) {
  const [notif] = await db()
    .insert(notificaciones)
    .values(input)
    .returning();
  return notif;
}

/**
 * List notifications for a tenant, newest first.
 */
export async function listarNotificaciones(
  tenantSlug: string,
  opts: { leido?: boolean; tipo?: string; limit?: number; offset?: number } = {},
) {
  const { leido, tipo, limit = 50, offset = 0 } = opts;

  const conditions = [eq(notificaciones.tenantSlug, tenantSlug)];
  if (leido !== undefined) conditions.push(eq(notificaciones.leido, leido));
  if (tipo) conditions.push(eq(notificaciones.tipo, tipo));

  const rows = await db()
    .select()
    .from(notificaciones)
    .where(and(...conditions))
    .orderBy(desc(notificaciones.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

/**
 * Get count of unread notifications.
 */
export async function contarNoLeidas(tenantSlug: string) {
  const [result] = await db()
    .select({ total: count() })
    .from(notificaciones)
    .where(
      and(
        eq(notificaciones.tenantSlug, tenantSlug),
        eq(notificaciones.leido, false),
      ),
    );
  return result?.total ?? 0;
}

/**
 * Mark a notification as read.
 */
export async function marcarLeido(id: string) {
  const [updated] = await db()
    .update(notificaciones)
    .set({ leido: true, updatedAt: new Date() })
    .where(eq(notificaciones.id, id))
    .returning();
  return updated;
}

/**
 * Mark all notifications as read for a tenant.
 */
export async function marcarTodoLeido(tenantSlug: string) {
  await db()
    .update(notificaciones)
    .set({ leido: true, updatedAt: new Date() })
    .where(
      and(
        eq(notificaciones.tenantSlug, tenantSlug),
        eq(notificaciones.leido, false),
      ),
    );
}

// ─── Auto-trigger checks ───────────────────────────────

/**
 * Check for low-stock repuestos and create notifications.
 * Call periodically or after stock operations.
 */
export async function verificarStockBajo(tenantSlug: string) {
  // Import here to avoid circular deps
  const { repuestos } = await import("../../inventory/schema/index.js");

  const lowStock = await db()
    .select({
      id: repuestos.id,
      descripcion: repuestos.descripcion,
      stockActual: repuestos.stockActual,
      puntoReorden: repuestos.puntoReorden,
    })
    .from(repuestos)
    .where(
      and(
        sql`${repuestos.stockActual} <= ${repuestos.puntoReorden}`,
        eq(repuestos.activo, true),
      ),
    );

  for (const item of lowStock) {
    // Check if notification already exists (avoid duplicates within 24h)
    const existing = await db()
      .select({ id: notificaciones.id })
      .from(notificaciones)
      .where(
        and(
          eq(notificaciones.tenantSlug, tenantSlug),
          eq(notificaciones.tipo, "INVENTARIO"),
          eq(notificaciones.entityId, item.id),
          sql`${notificaciones.createdAt} > NOW() - INTERVAL '24 hours'`,
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await crearNotificacion({
        tipo: "INVENTARIO",
        titulo: `Stock bajo: ${item.descripcion}`,
        mensaje: `Stock actual: ${item.stockActual} — Punto de reorden: ${item.puntoReorden}`,
        entityType: "repuesto",
        entityId: item.id,
        tenantSlug,
      });
    }
  }

  return lowStock.length;
}

/**
 * Check for overdue CxC invoices and create notifications.
 */
export async function verificarCxCVencidas(tenantSlug: string) {
  const { facturas } = await import("../../finance/schema/index.js");

  const overdue = await db()
    .select({
      id: facturas.id,
      total: facturas.total,
      saldoPendiente: facturas.saldoPendiente,
      fechaVencimiento: facturas.fechaVencimiento,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.tenantSlug, tenantSlug),
        eq(facturas.estadoPago, "PENDIENTE"),
        sql`${facturas.fechaVencimiento} < NOW()`,
      ),
    );

  for (const inv of overdue) {
    const existing = await db()
      .select({ id: notificaciones.id })
      .from(notificaciones)
      .where(
        and(
          eq(notificaciones.tenantSlug, tenantSlug),
          eq(notificaciones.tipo, "COBRO"),
          eq(notificaciones.entityId, inv.id),
          sql`${notificaciones.createdAt} > NOW() - INTERVAL '24 hours'`,
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await crearNotificacion({
        tipo: "COBRO",
        titulo: `CxC vencida — ₲${Number(inv.saldoPendiente || 0).toLocaleString("es-PY")}`,
        mensaje: `Factura vencida el ${inv.fechaVencimiento ? new Date(inv.fechaVencimiento).toLocaleDateString("es-PY") : "N/A"}. Saldo pendiente: ₲${Number(inv.saldoPendiente || 0).toLocaleString("es-PY")}`,
        entityType: "factura",
        entityId: inv.id,
        tenantSlug,
      });
    }
  }

  return overdue.length;
}

/**
 * Notify OT status change.
 */
export async function notificarCambioOT(
  tenantSlug: string,
  otId: string,
  otNumero: string,
  estadoAnterior: string,
  estadoNuevo: string,
) {
  await crearNotificacion({
    tipo: "OT",
    titulo: `OT #${otNumero}: ${estadoAnterior} → ${estadoNuevo}`,
    mensaje: `La orden de trabajo #${otNumero} cambió de "${estadoAnterior}" a "${estadoNuevo}".`,
    entityType: "orden_trabajo",
    entityId: otId,
    tenantSlug,
  });
}
