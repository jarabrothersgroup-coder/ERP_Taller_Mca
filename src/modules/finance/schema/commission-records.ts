import { integer, numeric, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "../../../shared/database/schema/tenants.js";
import { mechanicProfiles } from "./mechanic-profiles.js";

export const comisionEstadoEnum = pgEnum("comision_estado", [
  "EN_ESPERA_DE_UMBRAL", "LIBERADO",
]);

export const commissionRecords = pgTable("commission_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderId: uuid("order_id"),
  mechanicProfileId: uuid("mechanic_profile_id").notNull().references(() => mechanicProfiles.id, { onDelete: "cascade" }),
  laborAmount: integer("labor_amount").notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: integer("commission_amount").notNull(),
  status: comisionEstadoEnum("status").notNull().default("EN_ESPERA_DE_UMBRAL"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CommissionRecord = typeof commissionRecords.$inferSelect;
export type NewCommissionRecord = typeof commissionRecords.$inferInsert;
