/**
 * Workshop schema relations — central definition.
 *
 * Drizzle ORM relations for all workshop tables.
 * Defined in a single file to avoid circular imports between
 * table definition files while still enabling eager-loading
 * across the full entity graph.
 *
 * Relations enable JOIN-based queries that eliminate N+1:
 * ```ts
 * const result = await db().query.vehiculos.findMany({
 *   with: { client: true, ordenesTrabajo: true },
 * });
 * ```
 *
 * @module workshop/schema/relations
 */

import { relations } from "drizzle-orm";
import { clients } from "../../../shared/database/schema/clients.js";
import { vehiculos } from "./vehiculos.js";
import { ordenesTrabajo } from "./ordenes-trabajo.js";
import { ingresos } from "./ingresos.js";
import { trabajosTerceros } from "./trabajos-terceros.js";
import { serviciosCatalogo } from "./servicios-catalogo.js";
import { ordenServicios } from "./orden-servicios.js";
import { ordenRepuestos } from "./orden-repuestos.js";

// ─── clients (extend shared relations) ────────
// clientsRelations already exists in shared/schema/clients.ts

// ─── vehiculos → client, ordenesTrabajo ───────

export const vehiculosRelations = relations(vehiculos, ({ one, many }) => ({
  client: one(clients, {
    fields: [vehiculos.clientId],
    references: [clients.id],
  }),
  ordenesTrabajo: many(ordenesTrabajo),
}));

// ─── ordenesTrabajo → vehicle, client, ingresos, trabajosTerceros, items ──

export const ordenesTrabajoRelations = relations(
  ordenesTrabajo,
  ({ one, many }) => ({
    vehicle: one(vehiculos, {
      fields: [ordenesTrabajo.vehicleId],
      references: [vehiculos.id],
    }),
    client: one(clients, {
      fields: [ordenesTrabajo.clientId],
      references: [clients.id],
    }),
    ingresos: many(ingresos),
    trabajosTerceros: many(trabajosTerceros),
    serviciosItems: many(ordenServicios),
    repuestosItems: many(ordenRepuestos),
  }),
);

// ─── ingresos → vehicle, ordenTrabajo ─────────

export const ingresosRelations = relations(ingresos, ({ one }) => ({
  vehicle: one(vehiculos, {
    fields: [ingresos.vehicleId],
    references: [vehiculos.id],
  }),
  ordenTrabajo: one(ordenesTrabajo, {
    fields: [ingresos.ordenTrabajoId],
    references: [ordenesTrabajo.id],
  }),
}));

// ─── trabajosTerceros → ordenTrabajo ─────────

export const trabajosTercerosRelations = relations(trabajosTerceros, ({ one }) => ({
  ordenTrabajo: one(ordenesTrabajo, {
    fields: [trabajosTerceros.ordenTrabajoId],
    references: [ordenesTrabajo.id],
  }),
}));

// ─── serviciosCatalogo → (none) ───────────────

export const serviciosCatalogoRelations = relations(serviciosCatalogo, () => ({}));

// ─── ordenServicios → ordenTrabajo, servicio ──

export const ordenServiciosRelations = relations(ordenServicios, ({ one }) => ({
  ordenTrabajo: one(ordenesTrabajo, {
    fields: [ordenServicios.ordenTrabajoId],
    references: [ordenesTrabajo.id],
  }),
  servicio: one(serviciosCatalogo, {
    fields: [ordenServicios.servicioId],
    references: [serviciosCatalogo.id],
  }),
}));

// ─── ordenRepuestos → ordenTrabajo ────────────

export const ordenRepuestosRelations = relations(ordenRepuestos, ({ one }) => ({
  ordenTrabajo: one(ordenesTrabajo, {
    fields: [ordenRepuestos.ordenTrabajoId],
    references: [ordenesTrabajo.id],
  }),
}));

// ─── Extend ordenesTrabajo — add children ─────

// Already has: vehicle, client, ingresos, trabajosTerceros
// Adding: serviciosItems, repuestosItems
// We need to re-export a merged version — but drizzle relations don't support
// additive extension. Instead we replace the export with an enhanced version.


