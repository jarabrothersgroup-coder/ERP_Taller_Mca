/**
 * InventarioConfigurator — Integración contable de Inventario / Stock.
 *
 * Registra mappings por defecto y event handlers para que el motor
 * contable genere asientos automáticos en entradas, salidas, ajustes
 * y transferencias de stock.
 *
 * Mappings contables (PCG Paraguay — Ley 1034/83):
 *
 *   INVENTARIO.ENTRADA (compra):
 *     Debe:  1.1.3.01 — Inventario de Repuestos Nuevos
 *     Haber: 2.1.1.01 — Proveedores
 *
 *   INVENTARIO.SALIDA (consumo en OT):
 *     Debe:  5.1.1.01 — Costo de Repuestos Aplicados a OT
 *     Haber: 1.1.3.01 — Inventario de Repuestos Nuevos
 *
 *   INVENTARIO.AJUSTE (sobrante):
 *     Debe:  1.1.3.01 — Inventario de Repuestos
 *     Haber: 4.2.1.02 — Descuentos Obtenidos en Compras
 *
 *   INVENTARIO.AJUSTE (faltante):
 *     Debe:  6.1.1.05 — Gasto por Pérdida / Rotura
 *     Haber: 1.1.3.01 — Inventario de Repuestos
 *
 * Uso típico desde routes/services:
 *   import { inventarioConfigurator } from "../services/accounting/inventario.configurator.js";
 *   await inventarioConfigurator.onSalidaStock({ ... });
 *
 * @module finance/services/accounting/inventario.configurator
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
  INVENTARIO_REPUESTOS: "1.1.3.01",    // Inventario de Repuestos Nuevos
  INVENTARIO_USADOS: "1.1.3.02",       // Inventario de Repuestos Usados
  INVENTARIO_LUBRICANTES: "1.1.3.03",  // Inventario de Lubricantes y Fluidos
  PROVEEDORES: "2.1.1.01",             // Proveedores de Repuestos Nacionales
  COSTO_REPUESTOS_OT: "5.1.1.01",      // Costo de Repuestos Aplicados a OT
  PERDIDA_ROTURA: "6.1.1.05",          // Gasto por Pérdida / Rotura de Herramientas
  DESCUENTOS: "4.2.1.02",              // Descuentos Obtenidos en Compras
} as const;

// ─── Configurator Class ────────────────────────

class InventarioConfigurator {
  private configured = false;

  /**
   * Registra mappings por defecto y handlers para el módulo INVENTARIO.
   * Idempotente — puede llamarse múltiples veces.
   */
  async configure(): Promise<void> {
    if (this.configured) return;

    await registerModulo({
      modulo: "INVENTARIO",
      nombre: "Inventario y Almacén",
      descripcion: "Entradas, salidas, ajustes de stock, transferencias entre almacenes",
      activo: true,
      version: "1.0.0",
    });

    await ensureDefaultMappings([
      {
        modulo: "INVENTARIO",
        tipoEvento: "ENTRADA",
        subTipo: "COMPRA",
        codigoDebe: CUENTAS.INVENTARIO_REPUESTOS,
        codigoHaber: CUENTAS.PROVEEDORES,
        descripcion: "Entrada por compra — inventario vs proveedor",
      },
      {
        modulo: "INVENTARIO",
        tipoEvento: "ENTRADA",
        subTipo: "DEVOLUCION",
        codigoDebe: CUENTAS.INVENTARIO_REPUESTOS,
        codigoHaber: CUENTAS.COSTO_REPUESTOS_OT,
        descripcion: "Devolución de repuestos — reversión de consumo",
      },
      {
        modulo: "INVENTARIO",
        tipoEvento: "SALIDA",
        subTipo: "CONSUMO_OT",
        codigoDebe: CUENTAS.COSTO_REPUESTOS_OT,
        codigoHaber: CUENTAS.INVENTARIO_REPUESTOS,
        descripcion: "Consumo en OT — costo vs inventario",
      },
      {
        modulo: "INVENTARIO",
        tipoEvento: "AJUSTE",
        subTipo: "SOBRANTE",
        codigoDebe: CUENTAS.INVENTARIO_REPUESTOS,
        codigoHaber: CUENTAS.DESCUENTOS,
        descripcion: "Ajuste positivo de inventario (sobrante)",
      },
      {
        modulo: "INVENTARIO",
        tipoEvento: "AJUSTE",
        subTipo: "FALTANTE",
        codigoDebe: CUENTAS.PERDIDA_ROTURA,
        codigoHaber: CUENTAS.INVENTARIO_REPUESTOS,
        descripcion: "Ajuste negativo de inventario (faltante / pérdida)",
      },
      {
        modulo: "INVENTARIO",
        tipoEvento: "TRANSFERENCIA",
        codigoDebe: CUENTAS.INVENTARIO_REPUESTOS,
        codigoHaber: CUENTAS.INVENTARIO_REPUESTOS,
        descripcion: "Transferencia entre almacenes",
      },
    ]);

    this.configured = true;
  }

  // ─── Event handlers ─────────────────────────

  /**
   * Maneja una entrada de stock (compra o devolución).
   * Genera asiento: Debe=Inventario, Haber=Proveedor (o reversión de consumo).
   */
  async onEntradaStock(params: {
    tenantSlug: string;
    movimientoId: string;
    repuestoDescripcion: string;
    cantidad: number;
    costoTotal: number;
    tipoEntrada: "COMPRA" | "DEVOLUCION";
    proveedorNombre?: string;
    centroCostoId?: string;
    ordenTrabajoId?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    const label = params.tipoEntrada === "COMPRA"
      ? `Entrada por compra: ${params.repuestoDescripcion} x${params.cantidad} (${params.proveedorNombre ?? "proveedor"})`
      : `Devolución: ${params.repuestoDescripcion} x${params.cantidad}`;

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "CONSUMO_STOCK",
      fecha: new Date(),
      referenciaId: params.movimientoId,
      referenciaTipo: "movimiento_stock",
      descripcion: label,
      modulo: "INVENTARIO",
      tipoEvento: "ENTRADA",
      subTipo: params.tipoEntrada,
      monto: params.costoTotal,
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }

  /**
   * Maneja una salida de stock (consumo en OT).
   * Genera asiento: Debe=Costo Repuestos, Haber=Inventario.
   */
  async onSalidaStock(params: {
    tenantSlug: string;
    movimientoId: string;
    repuestoDescripcion: string;
    cantidad: number;
    costoTotal: number;
    ordenTrabajoId?: string;
    centroCostoId?: string;
    motivo?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "CONSUMO_STOCK",
      fecha: new Date(),
      referenciaId: params.movimientoId,
      referenciaTipo: "movimiento_stock",
      descripcion: `Consumo: ${params.repuestoDescripcion} x${params.cantidad} (${params.motivo ?? "uso en OT"})`,
      modulo: "INVENTARIO",
      tipoEvento: "SALIDA",
      subTipo: "CONSUMO_OT",
      monto: params.costoTotal,
      centroCostoId: params.centroCostoId,
      ordenTrabajoId: params.ordenTrabajoId,
    });
  }

  /**
   * Maneja un ajuste de inventario (sobrante o faltante).
   */
  async onAjusteStock(params: {
    tenantSlug: string;
    movimientoId: string;
    repuestoDescripcion: string;
    tipoAjuste: "SOBRANTE" | "FALTANTE";
    cantidad: number;
    costoTotal: number;
    centroCostoId?: string;
    observaciones?: string;
  }): Promise<AccountingEventResult> {
    await this.configure();

    return emitFromTransaction({
      tenantSlug: params.tenantSlug,
      tipo: "CONSUMO_STOCK",
      fecha: new Date(),
      referenciaId: params.movimientoId,
      referenciaTipo: "movimiento_stock",
      descripcion: `Ajuste ${params.tipoAjuste}: ${params.repuestoDescripcion} x${params.cantidad} (${params.observaciones ?? "inventario físico"})`,
      modulo: "INVENTARIO",
      tipoEvento: "AJUSTE",
      subTipo: params.tipoAjuste,
      monto: params.costoTotal,
      centroCostoId: params.centroCostoId,
    });
  }
}

// ─── Singleton export ──────────────────────────

export const inventarioConfigurator = new InventarioConfigurator();
