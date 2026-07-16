/**
 * Mobile Push Tokens — Drizzle ORM schema.
 *
 * Stores Expo push tokens per tenant/device so the backend can send
 * push notifications to a workshop's mobile app instances.
 *
 * @module mobile/schema
 */

import { pgTable, text, timestamp, index, unique } from "drizzle-orm/pg-core";

export const mobilePushTokens = pgTable(
  "mobile_push_tokens",
  {
    id: text("id").primaryKey(),
    tenantSlug: text("tenant_slug").notNull(),
    deviceId: text("device_id").notNull(),
    pushToken: text("push_token").notNull(),
    platform: text("platform").notNull().default("ios"), // ios | android | web
    profileEmail: text("profile_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("mobile_push_tenant_idx").on(table.tenantSlug),
    unique("mobile_push_tenant_device_unique").on(table.tenantSlug, table.deviceId),
  ],
);

export type MobilePushToken = typeof mobilePushTokens.$inferSelect;
export type NewMobilePushToken = typeof mobilePushTokens.$inferInsert;
