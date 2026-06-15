import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "../../../shared/database/schema/tenants.js";

export const gastoFijoCategoriaEnum = pgEnum("gasto_fijo_categoria", [
  "ALQUILER", "ANDES", "COPACO", "LICENCIAS", "CONTADOR", "SALARIO_BASE", "OTROS",
]);

export const fixedExpenses = pgTable("fixed_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  category: gastoFijoCategoriaEnum("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FixedExpense = typeof fixedExpenses.$inferSelect;
export type NewFixedExpense = typeof fixedExpenses.$inferInsert;
