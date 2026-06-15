/**
 * Notifications table — in-app alerts for workshop events.
 *
 * Auto-generated notifications for:
 *   - Low stock (INVENTARIO)
 *   - Overdue invoices (COBRO)
 *   - OT status changes (OT)
 *   - Safety alerts (SEGURIDAD)
 *
 * @module shared/database/schema/notifications
 */

import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const notificaciones = pgTable(
  "notificaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Notification type: INVENTARIO | COBRO | OT | SEGURIDAD | SISTEMA */
    tipo: text("tipo").notNull(),

    /** Short title (e.g. "Stock bajo: Filtro de aceite") */
    titulo: text("titulo").notNull(),

    /** Detailed message */
    mensaje: text("mensaje").notNull(),

    /** Optional link entity: { type: 'repuesto' | 'factura' | 'orden_trabajo', id: 'uuid' } */
    entityType: text("entity_type"),
    entityId: text("entity_id"),

    /** Has the user seen this notification? */
    leido: boolean("leido").notNull().default(false),

    /** Tenant scope */
    tenantSlug: text("tenant_slug").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index("notif_tenant_idx").on(table.tenantSlug),
    leidoIdx: index("notif_leido_idx").on(table.leido),
    tipoIdx: index("notif_tipo_idx").on(table.tipo),
    tenantLeidoIdx: index("notif_tenant_leido_idx").on(table.tenantSlug, table.leido),
  }),
);

export type Notificacion = typeof notificaciones.$inferSelect;
export type NewNotificacion = typeof notificaciones.$inferInsert;
