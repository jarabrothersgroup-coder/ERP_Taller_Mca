/**
 * TesoreriaConfigurator — Integración contable de Tesorería.
 *
 * Registra mappings por defecto y event handlers para que el motor
 * contable genere asientos automáticos cuando se registran pagos,
 * cobros y movimientos de caja/bancos.
 *
 * Mappings contables (PCG Paraguay — Ley 1034/83):
 *
 *   TESORERIA.MOVIMIENTO_INGRESO:
 *     Debe:  1.1.1.03 — Bancos
 *     Haber: (según origen — se pasa cuenta de contrapartida)
 *
 *   TESORERIA.MOVIMIENTO_EGRESO:
 *     Debe:  (según destino — se pasa cuenta de contrapartida)
 *     Haber: 1.1.1.03 — Bancos
 *
 *   TESORERIA.PAGO_PROVEEDOR:
 *     Debe:  2.1.1.01 — Proveedores
 *     Haber: 1.1.1.03 — Bancos
 *
 *   TESORERIA.COBRO_CLIENTE:
 *     Debe:  1.1.1.03 — Bancos
 *     Haber: 1.1.2.01 — Clientes
 *
 * Ahora propaga centroCostoId y ordenTrabajoId para dimensión analítica.
 *
 * @module finance/services/accounting/tesoreria.configurator
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
  CAJA_CHICA: "1.1.1.01",          // Caja Chica Taller
  CAJA_GRAL: "1.1.1.02",           // Caja General
  BANCOS: "1.1.1.03",              // Bancos Nacionales
  CLIENTES: "1.1.2.01",            // Clientes Particulares
  PROVEEDORES: "2.1.1.01",         // Proveedores de Repuestos Nacionales
  PRESTAMOS_LP: "2.2.1.01",        // Préstamos Bancarios por Pagar L/P
  GASTOS_BANC: "6.1.1.03",         // Servicios Básicos
} as const;

// ─── Configurator Class ────────────────────────

class TesoreriaConfigurator {
  private configured = false;

  /** Idempotente — registra mappings y handlers */
  async configure(): Promise<void> {
    if (this.configured) return;

    await registerModulo({
      modulo: "TESORERIA",
      nombre: "Tesorería (Caja y Bancos)",
      descripcion: "Movimientos de caja/bancos, cobros, pagos, conciliaciones",
      activo: true,
      version: "1.0.0",
    });

    await ensureDefaultMappings([
      {
        modulo: "TESORERIA",
        tipoEvento: "MOVIMIENTO_INGRESO",
        codigoDebe: CUENTAS.CAJA_CHICA,
        codigoHaber: CUENTAS.CLIENTES,
        descripcion: "Ingreso de caja — efectivo recibido",
      },
      {
        modulo: "TESORERIA",
        tipoEvento: "MOVIMIENTO_EGRESO",
        codigoDebe: CUENTAS.GASTOS_BANC,
        codigoHaber: CUENTAS.CAJA_CHICA,
        descripcion: "Egreso de caja — pago realizado",
      },
      {
        modulo: "TESORERIA",
        tipoEvento: "PAGO_PROVEEDOR",
        codigoDebe: CUENTAS.PROVEEDORES,
        codigoHaber: CUENTAS.BANCOS,
        descripcion: "Pago a proveedor — débito bancario",
      },
      {
        modulo: "TESORERIA",
        tipoEvento: "COBRO_CLIENTE",
        codigoDebe: CUENTAS.BANCOS,
        codigoHaber: CUENTAS.CLIENTES,
        descripcion: "Cobro de cliente — acreditación bancaria",
      },
      {
        modulo: "TESORERIA",
        tipoEvento: "TRANSFERENCIA",
        codigoDebe: CUENTAS.BANCOS,
        codigoHaber: CUENTAS.BANCOS,
        descripcion: "Transferencia entre cuentas bancarias",
      },
    ]);

    this.configured = true;
  }

  // ─── Event handlers ─────────────────────────

  /**
   * Maneja el registro de un ingreso de caja/bancos.
   */
  async onMovimientoIngreso(params: {
    tenantSlug: string;
    movimientoId: string;
    concepto: string;
    monto: number;
    cuentaContrapartida?: string;
    fecha?: Date;
    /** Centro de Costo (dimensión analítica). */
    centroCostoId?: string;
    /** Orden de Trabajo asociada. */
    ordenTrabajoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "COBRO",
      fecha: params.fecha ?? new Date(),
      referenciaId: params.movimientoId,
      referenciaTipo: "movimiento_tes",
      descripcion: `Ingreso: ${params.concepto}`,
      modulo: "TESORERIA",
      tipoEvento: "MOVIMIENTO_INGRESO",
      monto: params.monto,
      cuentaDebeOverride: params.cuentaContrapartida,
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }

  /**
   * Maneja el registro de un egreso de caja/bancos.
   */
  async onMovimientoEgreso(params: {
    tenantSlug: string;
    movimientoId: string;
    concepto: string;
    monto: number;
    cuentaContrapartida?: string;
    fecha?: Date;
    /** Centro de Costo (dimensión analítica). */
    centroCostoId?: string;
    /** Orden de Trabajo asociada. */
    ordenTrabajoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "PAGO",
      fecha: params.fecha ?? new Date(),
      referenciaId: params.movimientoId,
      referenciaTipo: "movimiento_tes",
      descripcion: `Egreso: ${params.concepto}`,
      modulo: "TESORERIA",
      tipoEvento: "MOVIMIENTO_EGRESO",
      monto: params.monto,
      cuentaHaberOverride: params.cuentaContrapartida,
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }

  /**
   * Maneja el pago a un proveedor.
   */
  async onPagoProveedor(params: {
    tenantSlug: string;
    facturaProvId: string;
    proveedorNombre: string;
    monto: number;
    medioPago: string;
    /** Centro de Costo (dimensión analítica). */
    centroCostoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "PAGO",
      fecha: new Date(),
      referenciaId: params.facturaProvId,
      referenciaTipo: "factura_proveedor",
      descripcion: `Pago a proveedor: ${params.proveedorNombre} (${params.medioPago})`,
      modulo: "TESORERIA",
      tipoEvento: "PAGO_PROVEEDOR",
      monto: params.monto,
      centroCostoId: params.centroCostoId,
    });
  }
}

// ─── Singleton export ──────────────────────────

export const tesoreriaConfigurator = new TesoreriaConfigurator();
