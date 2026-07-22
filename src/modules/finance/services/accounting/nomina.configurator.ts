/**
 * NominaConfigurator — Integración contable de Nómina / Planilla.
 *
 * Registra mappings por defecto y event handlers para que el motor
 * contable genere asientos automáticos cuando se calcula la nómina
 * mensual (comisiones + mano de obra + cargas sociales).
 *
 * Mappings contables (PCG Paraguay — Ley 1034/83):
 *
 *   NOMINA.DEVENGADA (sueldos y comisiones):
 *     Debe:  6.1.1.01 — Sueldos Administrativos
 *     Debe:  5.1.2.01 — Salarios de Mecánicos/Técnicos
 *     Haber: 2.1.3.01 — Sueldos y Salarios por Pagar
 *
 *   NOMINA.CARGAS_SOCIALES (IPS patronal):
 *     Debe:  6.1.1.07 — Cargas Sociales Patronales
 *     Haber: 2.1.3.03 — IPS y Cargas Sociales por Pagar
 *
 * Ahora propaga centroCostoId para dimensión analítica en cuentas de COSTO/GASTO.
 *
 * @module finance/services/accounting/nomina.configurator
 */

import {
  emitFromTransaction,
} from "./accounting-bus.service.js";
import {
  ensureDefaultMappings,
  registerModulo,
} from "./mapping.service.js";
import type { AccountingEventResult } from "./accounting-bus.service.js";

// ─── Codes ─────────────────────────────────────

const CUENTAS = {
  GASTO_SUELDOS: "6.1.1.01",          // Sueldos Administrativos
  COSTO_MO: "5.1.2.01",               // Salarios de Mecánicos/Técnicos
  SALARIOS_X_PAGAR: "2.1.3.01",       // Sueldos y Salarios por Pagar
  CARGAS_SOCIALES: "6.1.1.07",        // Cargas Sociales Patronales (IPS)
  IPS_X_PAGAR: "2.1.3.03",            // IPS y Cargas Sociales por Pagar
} as const;

// ─── Configurator Class ────────────────────────

class NominaConfigurator {
  private configured = false;

  /** Idempotente */
  async configure(): Promise<void> {
    if (this.configured) return;

    await registerModulo({
      modulo: "NOMINA",
      nombre: "Nómina y Planilla",
      descripcion: "Sueldos, comisiones, cargas sociales IPS, aguinaldos",
      activo: true,
      version: "1.0.0",
    });

    await ensureDefaultMappings([
      {
        modulo: "NOMINA",
        tipoEvento: "DEVENGADA",
        codigoDebe: CUENTAS.GASTO_SUELDOS,
        codigoHaber: CUENTAS.SALARIOS_X_PAGAR,
        descripcion: "Devengamiento de sueldos y comisiones del período",
      },
      {
        modulo: "NOMINA",
        tipoEvento: "CARGAS_SOCIALES",
        codigoDebe: CUENTAS.CARGAS_SOCIALES,
        codigoHaber: CUENTAS.IPS_X_PAGAR,
        descripcion: "Cargas sociales patronales (IPS) del período",
      },
    ]);

    this.configured = true;
  }

  // ─── Event handlers ─────────────────────────

  /**
   * Maneja el devengamiento de sueldos y comisiones.
   */
  async onDevengada(params: {
    tenantSlug: string;
    periodo: { anho: number; mes: number };
    totalSueldos: number;
    descripcion?: string;
    /** Centro de Costo (dimensión analítica). */
    centroCostoId?: string;
    /** Orden de Trabajo asociada. */
    ordenTrabajoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    const label = params.descripcion
      ?? `Nómina ${params.periodo.mes}/${params.periodo.anho}`;

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "NOMINA",
      fecha: new Date(params.periodo.anho, params.periodo.mes - 1, 1),
      referenciaId: `nomina_${params.periodo.anho}_${params.periodo.mes}`,
      referenciaTipo: "nomina_mensual",
      descripcion: label,
      modulo: "NOMINA",
      tipoEvento: "DEVENGADA",
      monto: params.totalSueldos,
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }

  /**
   * Maneja el registro de cargas sociales (IPS).
   */
  async onCargasSociales(params: {
    tenantSlug: string;
    periodo: { anho: number; mes: number };
    totalCargas: number;
    /** Centro de Costo (dimensión analítica). */
    centroCostoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "NOMINA",
      fecha: new Date(params.periodo.anho, params.periodo.mes - 1, 1),
      referenciaId: `cargas_sociales_${params.periodo.anho}_${params.periodo.mes}`,
      referenciaTipo: "nomina_cargas_sociales",
      descripcion: `Cargas sociales IPS ${params.periodo.mes}/${params.periodo.anho}`,
      modulo: "NOMINA",
      tipoEvento: "CARGAS_SOCIALES",
      monto: params.totalCargas,
      centroCostoId: params.centroCostoId,
    });
  }
}

// ─── Singleton export ──────────────────────────

export const nominaConfigurator = new NominaConfigurator();
