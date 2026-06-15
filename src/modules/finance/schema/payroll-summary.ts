import { boolean, integer, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "../../../shared/database/schema/tenants.js";

export const payrollSummary = pgTable("payroll_summary", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  fixedExpensesTotal: integer("fixed_expenses_total").notNull(),
  payrollBaseTotal: integer("payroll_base_total").notNull(),
  netLaborRevenue: integer("net_labor_revenue").notNull(),
  breakevenThreshold: integer("breakeven_threshold").notNull(),
  breakevenHit: boolean("breakeven_hit").notNull(),
  breakevenPercentage: numeric("breakeven_percentage", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PayrollSummary = typeof payrollSummary.$inferSelect;
export type NewPayrollSummary = typeof payrollSummary.$inferInsert;
