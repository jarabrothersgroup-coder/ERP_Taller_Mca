import { boolean, integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "../../../shared/database/schema/profiles.js";

export const personalCargoEnum = pgEnum("personal_cargo", [
  "GERENTE_GENERAL", "GERENTE_OPERATIVO", "JEFE_DE_TALLER",
]);

export const staffProfiles = pgTable("staff_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }).unique(),
  position: personalCargoEnum("position").notNull(),
  baseSalary: integer("base_salary").notNull(),
  profitSharing: boolean("profit_sharing").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StaffProfile = typeof staffProfiles.$inferSelect;
export type NewStaffProfile = typeof staffProfiles.$inferInsert;
