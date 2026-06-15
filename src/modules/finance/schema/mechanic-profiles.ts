import { integer, numeric, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "../../../shared/database/schema/profiles.js";

export const mecanicoCategoriaEnum = pgEnum("mecanico_categoria", [
  "AYUDANTE", "MEDIO_OFICIAL", "OFICIAL", "OFICIAL_CERTIFICADO",
]);

export const mechanicProfiles = pgTable("mechanic_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }).unique(),
  category: mecanicoCategoriaEnum("category").notNull(),
  baseSalary: integer("base_salary").notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MechanicProfile = typeof mechanicProfiles.$inferSelect;
export type NewMechanicProfile = typeof mechanicProfiles.$inferInsert;
