import { relations } from "drizzle-orm";
import { fiscalDocumentos, fiscalDocumentoDetalles, sifenSyncLog } from "./fiscal-docs.js";
import { planCuentas, asientosContables, asientosDetalle } from "./accounting.js";
import { mechanicProfiles } from "./mechanic-profiles.js";
import { staffProfiles } from "./staff-profiles.js";
import { commissionRecords } from "./commission-records.js";

export const fiscalDocumentosRelations = relations(fiscalDocumentos, ({ many }) => ({
  detalles: many(fiscalDocumentoDetalles),
}));

export const fiscalDocumentoDetallesRelations = relations(fiscalDocumentoDetalles, ({ one }) => ({
  documento: one(fiscalDocumentos, {
    fields: [fiscalDocumentoDetalles.documentoId],
    references: [fiscalDocumentos.id],
  }),
}));

export const sifenSyncLogRelations = relations(sifenSyncLog, ({ one }) => ({
  documento: one(fiscalDocumentos, {
    fields: [sifenSyncLog.documentoId],
    references: [fiscalDocumentos.id],
  }),
}));

export const planCuentasRelations = relations(planCuentas, ({ one, many }) => ({
  parent: one(planCuentas, {
    fields: [planCuentas.cuentaPadreId],
    references: [planCuentas.id],
  }),
  children: many(planCuentas),
}));

export const asientosContablesRelations = relations(asientosContables, ({ many }) => ({
  detalles: many(asientosDetalle),
}));

export const asientosDetalleRelations = relations(asientosDetalle, ({ one }) => ({
  asiento: one(asientosContables, {
    fields: [asientosDetalle.asientoId],
    references: [asientosContables.id],
  }),
  cuenta: one(planCuentas, {
    fields: [asientosDetalle.cuentaId],
    references: [planCuentas.id],
  }),
}));

export const mechanicProfilesRelations = relations(mechanicProfiles, ({ many }) => ({
  commissions: many(commissionRecords),
}));

export const staffProfilesRelations = relations(staffProfiles, () => ({}));

export const commissionRecordsRelations = relations(commissionRecords, ({ one }) => ({
  mechanicProfile: one(mechanicProfiles, {
    fields: [commissionRecords.mechanicProfileId],
    references: [mechanicProfiles.id],
  }),
}));
