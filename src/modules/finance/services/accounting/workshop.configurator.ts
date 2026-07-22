/**
 * WorkshopConfigurator — Integración contable de Taller / Órdenes de Trabajo.
 *
 * Registra mappings por defecto y event handlers para que el motor
 * contable genere asientos de reconocimiento de ingresos cuando una
 * Orden de Trabajo se completa (estado → "Listo" o "FINALIZADO").
 *
 * Mappings contables (PCG Paraguay — Ley 1034/83):
 *
 *   WORKSHOP.OT_COMPLETADA:
 *     Debe:  1.1.2.01 — Clientes Particulares (cuenta por cobrar)
 *     Haber: 4.1.1.01 — Ingresos por Mano de Obra
 *     Haber: 4.1.2.01 — Ingresos por Venta de Repuestos
 *     Haber: 1.1.2.50 — IVA Crédito Fiscal (por el IVA)
 *
 *   WORKSHOP.OT_CANCELADA:
 *     Reversión del asiento original de OT_COMPLETADA
 *
 * Uso típico desde orden.service.ts (updateOrdenStatus):
 *   import { workshopConfigurator } from "../services/accounting/workshop.configurator.js";
 *   await workshopConfigurator.onOTCompletada({ ... });
 *
 * @module finance/services/accounting/workshop.configurator
 */

import {
  emit,
  emitFromTransaction,
  resolveAccount,
} from "./accounting-bus.service.js";
import {
  ensureDefaultMappings,
  registerModulo,
} from "./mapping.service.js";
import type { AccountingEventResult, BusAccountingLine } from "./accounting-bus.service.js";

// ─── Codes ─────────────────────────────────────

const CUENTAS = {
  CLIENTES: "1.1.2.01",           // Clientes Particulares
  INGRESO_MO: "4.1.1.01",         // Ingresos por Mano de Obra
  INGRESO_REPUESTOS: "4.1.2.01",  // Ingresos por Venta de Repuestos
  INGRESO_SERVICIOS: "4.1.1.04",  // Ingresos por Servicios Tercerizados
  IVA_DEBITO_FISCAL: "2.1.2.01",  // IVA Débito Fiscal por Pagar
} as const;

// ─── Configurator Class ────────────────────────

class WorkshopConfigurator {
  private configured = false;

  /**
   * Registra mappings por defecto y handlers para el módulo WORKSHOP.
   * Idempotente — puede llamarse múltiples veces.
   */
  async configure(): Promise<void> {
    if (this.configured) return;

    await registerModulo({
      modulo: "WORKSHOP",
      nombre: "Taller / Órdenes de Trabajo",
      descripcion: "Reconocimiento de ingresos al completar OT, mano de obra, repuestos, servicios tercerizados",
      activo: true,
      version: "1.0.0",
    });

    await ensureDefaultMappings([
      {
        modulo: "WORKSHOP",
        tipoEvento: "OT_COMPLETADA",
        codigoDebe: CUENTAS.CLIENTES,
        codigoHaber: CUENTAS.INGRESO_MO,
        descripcion: "OT completada — cliente vs ingreso por mano de obra",
      },
      {
        modulo: "WORKSHOP",
        tipoEvento: "OT_CANCELADA",
        codigoDebe: CUENTAS.INGRESO_MO,
        codigoHaber: CUENTAS.CLIENTES,
        descripcion: "OT cancelada — reversión de ingreso",
      },
    ]);

    this.configured = true;
  }

  // ─── Event handlers ─────────────────────────

  /**
   * Maneja la finalización de una Orden de Trabajo.
   * Genera asiento con múltiples líneas:
   *   Debe: Clientes (total de la OT)
   *   Haber: Ingresos MO (mano de obra)
   *   Haber: Ingresos Repuestos (repuestos consumidos)
   *   Haber: Ingresos Servicios (servicios tercerizados)
   *
   * Usa `emit()` directamente (líneas explícitas) porque requiere
   * múltiples cuentas de Haber, lo que el mapping simple (1 Debe + 1 Haber)
   * no puede expresar.
   */
  async onOTCompletada(params: {
    tenantSlug: string;
    ordenId: string;
    clienteNombre: string;
    totalManoObra: number;
    totalRepuestos: number;
    totalServicios: number;
    totalIva?: number;
    centroCostoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    const total = params.totalManoObra + params.totalRepuestos + params.totalServicios + (params.totalIva ?? 0);
    if (total <= 0) {
      return { success: false, error: "La OT no tiene costo total para generar asiento contable" };
    }

    // Resolve account IDs by code
    const ctaClientes = await resolveAccount(CUENTAS.CLIENTES);
    const ctaIngresoMO = await resolveAccount(CUENTAS.INGRESO_MO);
    const ctaIngresoRep = await resolveAccount(CUENTAS.INGRESO_REPUESTOS);
    const ctaIngresoServ = await resolveAccount(CUENTAS.INGRESO_SERVICIOS);

    if (!ctaClientes || !ctaIngresoMO) {
      return {
        success: false,
        error: "No se encontraron cuentas contables necesarias. Verifique el Plan de Cuentas (se requiere 1.1.2.01 y 4.1.1.01).",
      };
    }

    // Build lines: Debe total a Clientes, Haber desglosado
    const lineas: BusAccountingLine[] = [
      {
        cuentaId: ctaClientes,
        debe: total,
        descripcion: `OT completada: ${params.clienteNombre}`,
      },
    ];

    // Haber: Mano de Obra
    if (params.totalManoObra > 0) {
      lineas.push({
        cuentaId: ctaIngresoMO,
        haber: params.totalManoObra,
        descripcion: `Mano de obra: ${params.clienteNombre}`,
        centroCostoId: params.centroCostoId,
      });
    }

    // Haber: Repuestos
    if (params.totalRepuestos > 0 && ctaIngresoRep) {
      lineas.push({
        cuentaId: ctaIngresoRep,
        haber: params.totalRepuestos,
        descripcion: `Repuestos: ${params.clienteNombre}`,
        centroCostoId: params.centroCostoId,
      });
    }

    // Haber: Servicios tercerizados
    if (params.totalServicios > 0 && ctaIngresoServ) {
      lineas.push({
        cuentaId: ctaIngresoServ,
        haber: params.totalServicios,
        descripcion: `Servicios: ${params.clienteNombre}`,
        centroCostoId: params.centroCostoId,
      });
    }

    // Haber: IVA
    if (params.totalIva && params.totalIva > 0) {
      const ctaIva = await resolveAccount(CUENTAS.IVA_DEBITO_FISCAL);
      if (ctaIva) {
        lineas.push({
          cuentaId: ctaIva,
          haber: params.totalIva,
          descripcion: `IVA: ${params.clienteNombre}`,
        });
      }
    }

    return emit({
      tenantSlug: params.tenantSlug,
      tipo: "VENTA",
      fecha: new Date(),
      referenciaId: params.ordenId,
      referenciaTipo: "orden_trabajo",
      descripcion: `OT Completada — ${params.clienteNombre}`,
      lineas,
      ordenTrabajoId: params.ordenId,
    });
  }

  /**
   * Maneja la cancelación de una OT.
   * Genera asiento inverso usando emitFromTransaction con el mapping
   * OT_CANCELADA (Debe=Ingresos, Haber=Clientes).
   *
   * NOTA: Para reversiones completas de asientos existentes, usar
   * el servicio autoReversal() que automáticamente intercambia
   * Debe↔Haber del asiento original.
   */
  async onOTCancelada(params: {
    tenantSlug: string;
    ordenId: string;
    clienteNombre: string;
    total: number;
    centroCostoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "VENTA",
      fecha: new Date(),
      referenciaId: params.ordenId,
      referenciaTipo: "orden_trabajo",
      descripcion: `OT Cancelada — ${params.clienteNombre}`,
      modulo: "WORKSHOP",
      tipoEvento: "OT_CANCELADA",
      monto: params.total,
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenId,
    });
  }
}

// ─── Singleton export ──────────────────────────

export const workshopConfigurator = new WorkshopConfigurator();
