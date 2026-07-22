/**
 * ComprasConfigurator — Integración contable de Compras (Sprint 7/8).
 *
 * Registra mappings por defecto y event handlers para que el motor
 * contable genere asientos automáticos cuando se crean, pagan o
 * anulan facturas de compra.
 *
 * Mappings contables (PCG Paraguay — Ley 1034/83):
 *
 *   COMPRA.CREADA (crédito simple):
 *     Debe:  5.1.01  — Compras / Costo de Mercaderías
 *     Haber: 2.1.01  — Proveedores (cuenta por pagar)
 *
 *   COMPRA.CREADA (contado):
 *     Debe:  5.1.01  — Compras / Costo de Mercaderías
 *     Haber: 1.1.01  — Caja / Bancos
 *
 *   COMPRA.PAGADA:
 *     Debe:  2.1.01  — Proveedores
 *     Haber: 1.1.01  — Caja / Bancos
 *
 *   COMPRA.ANULADA: reversión de COMPRA.CREADA
 *
 * Uso típico desde routes:
 *   import { comprasConfigurator } from "../services/accounting/compras.configurator.js";
 *   await comprasConfigurator.onCompraCreada(compra);
 *
 * @module finance/services/accounting/compras.configurator
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

/**
 * Códigos de cuenta del PCG paraguayo para compras.
 * Deben existir en plan_cuentas para que los mappings funcionen.
 */
const CUENTAS = {
  COSTO_MERCADERIAS: "5.1.01",      // Costo de Mercaderías / Compras
  PROVEEDORES: "2.1.01",            // Proveedores (cuenta por pagar)
  CAJA: "1.1.01.001",               // Caja Chica
  BANCOS: "1.1.01.002",            // Bancos
  IVA_CREDITO_FISCAL: "1.1.02.001", // IVA Crédito Fiscal (si aplica)
} as const;

// ─── Configurator Class ────────────────────────

class ComprasConfigurator {
  private configured = false;

  /**
   * Registra mappings por defecto y handlers para el módulo COMPRAS.
   * Idempotente — puede llamarse múltiples veces.
   */
  async configure(): Promise<void> {
    if (this.configured) return;

    // 1. Register module
    await registerModulo({
      modulo: "COMPRAS",
      nombre: "Compras y Proveedores",
      descripcion: "Facturas de compra, pagos a proveedores, notas de crédito",
      activo: true,
      version: "1.0.0",
    });

    // 2. Seed default mappings
    await ensureDefaultMappings([
      {
        modulo: "COMPRAS",
        tipoEvento: "CREADA",
        subTipo: "CREDITO",
        codigoDebe: CUENTAS.COSTO_MERCADERIAS,
        codigoHaber: CUENTAS.PROVEEDORES,
        descripcion: "Compra a crédito — costo vs proveedor",
      },
      {
        modulo: "COMPRAS",
        tipoEvento: "CREADA",
        subTipo: "CONTADO",
        codigoDebe: CUENTAS.COSTO_MERCADERIAS,
        codigoHaber: CUENTAS.CAJA,
        descripcion: "Compra al contado — costo vs caja",
      },
      {
        modulo: "COMPRAS",
        tipoEvento: "PAGADA",
        codigoDebe: CUENTAS.PROVEEDORES,
        codigoHaber: CUENTAS.CAJA,
        descripcion: "Pago a proveedor — cancela cuenta por pagar",
      },
      {
        modulo: "COMPRAS",
        tipoEvento: "ANULADA",
        codigoDebe: CUENTAS.PROVEEDORES,
        codigoHaber: CUENTAS.COSTO_MERCADERIAS,
        descripcion: "Anulación de compra — reversión",
      },
    ]);

    this.configured = true;
  }

  // ─── Event handlers ─────────────────────────

  /**
   * Maneja una compra recién creada.
   * Genera asiento: Debe=Costo, Haber=Proveedor (o Caja si contado).
   * Ahora propaga centroCostoId y ordenTrabajoId para dimensión analítica.
   */
  async onCompraCreada(params: {
    tenantSlug: string;
    compraId: string;
    numeroFactura: string;
    proveedorNombre: string;
    fecha: string;
    total: string;
    estadoPago?: string;
    compraDetalles?: Array<{ cantidad: number; costoUnitario: string }>;
    /** Centro de Costo (dimensión analítica). Obligatorio para cuentas COSTO/GASTO. */
    centroCostoId?: string;
    /** Orden de Trabajo asociada (si la compra se vincula a una OT). */
    ordenTrabajoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    const isContado = params.estadoPago === "CONTADO" || params.estadoPago === "PAGADO";

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "COMPRA",
      fecha: new Date(params.fecha),
      referenciaId: params.compraId,
      referenciaTipo: "compra",
      descripcion: `Compra #${params.numeroFactura} — ${params.proveedorNombre}`,
      modulo: "COMPRAS",
      tipoEvento: "CREADA",
      subTipo: isContado ? "CONTADO" : "CREDITO",
      monto: parseFloat(params.total),
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }

  /**
   * Maneja el pago de una compra.
   * Genera asiento: Debe=Proveedor, Haber=Caja.
   */
  async onCompraPagada(params: {
    tenantSlug: string;
    compraId: string;
    numeroFactura: string;
    total: string;
    centroCostoId?: string;
    ordenTrabajoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "PAGO",
      fecha: new Date(),
      referenciaId: params.compraId,
      referenciaTipo: "compra",
      descripcion: `Pago Compra #${params.numeroFactura}`,
      modulo: "COMPRAS",
      tipoEvento: "PAGADA",
      monto: parseFloat(params.total),
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }

  /**
   * Maneja la anulación de una compra.
   * Genera asiento inverso: Debe=Proveedor, Haber=Costo.
   */
  async onCompraAnulada(params: {
    tenantSlug: string;
    compraId: string;
    numeroFactura: string;
    total: string;
    centroCostoId?: string;
    ordenTrabajoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "COMPRA",
      fecha: new Date(),
      referenciaId: params.compraId,
      referenciaTipo: "compra",
      descripcion: `Anulación Compra #${params.numeroFactura}`,
      modulo: "COMPRAS",
      tipoEvento: "ANULADA",
      monto: parseFloat(params.total),
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }
}

// ─── Singleton export ──────────────────────────

export const comprasConfigurator = new ComprasConfigurator();
