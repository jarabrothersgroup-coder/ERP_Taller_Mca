/**
 * Notification Priority schema — extends base notifications with priority and user targeting.
 *
 * @module workshop/schema/notification-priority
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Extended notifications with priority and user targeting.
 * Works alongside existing `notificaciones` table.
 */
export const notificationPriorities = pgTable("notification_priorities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantSlug: varchar("tenant_slug", { length: 100 }).notNull(),

  /** Notification type */
  tipo: varchar("tipo", { length: 50 }).notNull(),

  /** Priority: LOW, NORMAL, HIGH, URGENT */
  priority: varchar("priority", { length: 20 }).notNull().default("NORMAL"),

  /** Short title */
  titulo: text("titulo").notNull(),

  /** Detailed message */
  mensaje: text("mensaje").notNull(),

  /** Optional entity reference */
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id", { length: 36 }),

  /** Target user email (null = broadcast to all tenant users) */
  targetUser: varchar("target_user", { length: 200 }),

  /** Whether delivered via WebSocket */
  delivered: boolean("delivered").notNull().default(false),

  /** Has the user seen this notification? */
  leido: boolean("leido").notNull().default(false),

  /** Action URL for bell click */
  actionUrl: varchar("action_url", { length: 500 }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("np_tenant_idx").on(table.tenantSlug),
  targetIdx: index("np_target_idx").on(table.targetUser),
  deliveredIdx: index("np_delivered_idx").on(table.delivered),
  priorityIdx: index("np_priority_idx").on(table.priority),
}));

export type NotificationPriority = typeof notificationPriorities.$inferSelect;
export type NewNotificationPriority = typeof notificationPriorities.$inferInsert;
