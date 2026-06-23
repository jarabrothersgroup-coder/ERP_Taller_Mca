/**
 * Workshop routes barrel.
 *
 * Aggregates all workshop route handlers and registers them
 * on the Fastify instance with consistent prefix and hooks.
 *
 * @module workshop/routes/index
 */

import type { FastifyInstance } from "fastify";
import { ingresosRoutes } from "./ingresos.js";
import { trabajosTercerosRoutes } from "./trabajos-terceros.js";
import { ordenesRoutes } from "./ordenes.js";
import { clientesRoutes } from "./clientes.js";
import { vehiculosRoutes } from "./vehiculos.js";
import { servicesCatalogRoutes } from "./services-catalog.routes.js";
import { orderItemsRoutes } from "./order-items.routes.js";
import { analyticsRoutes } from "./analytics.routes.js";
// notifications.routes.ts removed — superseded by notification-push.routes.ts (duplicate GET /api/notifications)
import { servicePricingRoutes } from "./service-pricing.routes.js";
import { bulkOperationsRoutes } from "./bulk-operations.routes.js";
import { flatRateRoutes } from "./flat-rate.routes.js";
import { signatureRoutes } from "./signature.routes.js";
import { predictiveMaintenanceRoutes } from "./predictive-maintenance.routes.js";
import { notificationPushRoutes } from "./notification-push.routes.js";

/**
 * Registers all workshop routes on the given Fastify instance.
 *
 * Routes:
 *   - /workshop/ingresos                      (POST, GET)
 *   - /workshop/ordenes/:id/trabajos-terceros (POST, GET)
 *   - /workshop/ordenes/:id/sign-lockout      (POST)
 *   - /workshop/ordenes/:id/status            (PATCH)
 *   - /workshop/ordenes                       (GET)
 *   - /workshop/ordenes/:id                   (GET)
 *   - /workshop/ordenes/:id/servicios         (POST, GET)
 *   - /workshop/ordenes/:id/servicios/:itemId (PATCH, DELETE)
 *   - /workshop/ordenes/:id/repuestos         (POST, GET)
 *   - /workshop/ordenes/:id/repuestos/:itemId (PATCH, DELETE)
 *   - /workshop/servicios                     (POST, GET)
 *   - /workshop/servicios/:id                 (GET, PATCH, DELETE)
 *   - /workshop/service-categories             (POST, GET)
 *   - /workshop/service-categories/:id         (PATCH, DELETE)
 *   - /workshop/pricing-rules                  (POST, GET)
 *   - /workshop/pricing-rules/:id              (PATCH, DELETE)
 *   - /workshop/pricing-matrix                 (GET)
 *   - /workshop/service-brand-map/:servicioId  (GET, PUT)
 *   - /workshop/reference/vehicle-types        (GET)
 *   - /workshop/reference/fuel-types           (GET)
 *   - /workshop/reference/mileage-intervals    (GET)
 *   - /workshop/clientes                      (POST, GET)
 *   - /workshop/clientes/:id                  (GET, PATCH, DELETE)
 *   - /workshop/vehiculos                     (POST, GET)
 *   - /workshop/vehiculos/:id                 (GET, PATCH, DELETE)
 *   - /workshop/vehiculos/decode-vin          (POST)
 *   - /workshop/analytics/dashboard           (GET)
 *   - /workshop/analytics/top-servicios       (GET)
 *   - /workshop/analytics/top-clientes        (GET)
 *   - /workshop/analytics/productividad       (GET)
 *
 * @param app - Fastify instance
 */
export async function workshopRoutes(app: FastifyInstance): Promise<void> {
  await app.register(ingresosRoutes);
  await app.register(trabajosTercerosRoutes);
  await app.register(ordenesRoutes);
  await app.register(clientesRoutes);
  await app.register(vehiculosRoutes);
  await app.register(servicesCatalogRoutes);
  await app.register(orderItemsRoutes);
  await app.register(analyticsRoutes);
  // notificationsRoutes removed — superseded by notificationPushRoutes
  await app.register(servicePricingRoutes);
  await app.register(bulkOperationsRoutes);
  await app.register(flatRateRoutes);
  await app.register(signatureRoutes);
  await app.register(predictiveMaintenanceRoutes);
  await app.register(notificationPushRoutes);
}
