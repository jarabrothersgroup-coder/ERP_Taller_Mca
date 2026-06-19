/**
 * Enhanced Notification Service — CRUD + priority + WebSocket push.
 *
 * @module workshop/services/notification-push.service
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { notificaciones } from "../../../shared/database/schema/notifications.js";
import { pushNotification, pushToUser } from "../ws/notification-gateway.js";

/**
 * Create notification + push via WebSocket.
 */
export async function crearNotificacionPush(params: {
  tenantSlug: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  entityType?: string;
  entityId?: string;
  targetUser?: string;
  actionUrl?: string;
}) {
  // Create in DB
  const [notif] = await db()
    .insert(notificaciones)
    .values({
      tipo: params.tipo,
      titulo: params.titulo,
      mensaje: params.mensaje,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      tenantSlug: params.tenantSlug,
    })
    .returning();

  if (!notif) return null;

  // Push via WebSocket
  const payload = {
    id: notif.id,
    tipo: notif.tipo,
    titulo: notif.titulo,
    mensaje: notif.mensaje,
    priority: params.priority || "NORMAL",
    actionUrl: params.actionUrl,
    entityType: params.entityType,
    entityId: params.entityId,
  };

  if (params.targetUser) {
    pushToUser(params.tenantSlug, params.targetUser, payload);
  } else {
    pushNotification(params.tenantSlug, payload);
  }

  return notif;
}

/**
 * Get unread count for a tenant.
 */
export async function getUnreadCount(tenantSlug: string) {
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
 * List notifications with pagination.
 */
export async function listNotifications(
  tenantSlug: string,
  opts: { leido?: boolean; tipo?: string; limit?: number; offset?: number } = {},
) {
  const { leido, tipo, limit = 50, offset = 0 } = opts;
  const conditions = [eq(notificaciones.tenantSlug, tenantSlug)];
  if (leido !== undefined) conditions.push(eq(notificaciones.leido, leido));
  if (tipo) conditions.push(eq(notificaciones.tipo, tipo));

  return db()
    .select()
    .from(notificaciones)
    .where(and(...conditions))
    .orderBy(desc(notificaciones.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Mark as read + broadcast update.
 */
export async function markAsRead(id: string, tenantSlug: string) {
  const [updated] = await db()
    .update(notificaciones)
    .set({ leido: true, updatedAt: new Date() })
    .where(eq(notificaciones.id, id))
    .returning();

  // Broadcast unread count update
  const unread = await getUnreadCount(tenantSlug);
  pushNotification(tenantSlug, {
    id: "count-update",
    tipo: "SISTEMA",
    titulo: "count_update",
    mensaje: String(unread),
    priority: "LOW",
  });

  return updated;
}

/**
 * Mark all as read + broadcast update.
 */
export async function markAllAsRead(tenantSlug: string) {
  await db()
    .update(notificaciones)
    .set({ leido: true, updatedAt: new Date() })
    .where(
      and(
        eq(notificaciones.tenantSlug, tenantSlug),
        eq(notificaciones.leido, false),
      ),
    );

  // Broadcast unread count = 0
  pushNotification(tenantSlug, {
    id: "count-update",
    tipo: "SISTEMA",
    titulo: "count_update",
    mensaje: "0",
    priority: "LOW",
  });
}

/**
 * Delete old notifications (> 30 days).
 */
export async function cleanupOldNotifications(tenantSlug: string) {
  const result = await db()
    .delete(notificaciones)
    .where(
      and(
        eq(notificaciones.tenantSlug, tenantSlug),
        sql`${notificaciones.createdAt} < NOW() - INTERVAL '30 days'`,
      ),
    );
  return result;
}
