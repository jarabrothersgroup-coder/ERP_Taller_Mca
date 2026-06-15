import type { FastifyInstance } from "fastify";
import { sifenRoutes } from "./sifen.js";
import { accountingRoutes } from "./accounting.js";
import { payrollRoutes } from "./payroll-routes.js";
import { invoiceRoutes } from "./invoice.routes.js";
import { fiscalRoutes } from "./fiscal.js";
import { treasuryRoutes } from "./treasury.routes.js";
import { paymentRoutes } from "./payment.routes.js";
import { budgetRoutes } from "./budget.routes.js";

export async function financeRoutes(app: FastifyInstance): Promise<void> {
  await app.register(invoiceRoutes);
  await app.register(paymentRoutes);
  await app.register(sifenRoutes);
  await app.register(accountingRoutes);
  await app.register(payrollRoutes);
  await app.register(fiscalRoutes);
  await app.register(treasuryRoutes);
  await app.register(budgetRoutes);
}
