/**
 * Accounting Bus — Motor de Contabilidad Automática (Sprint 6).
 *
 * Servicio central que cualquier módulo del sistema invoca para
 * generar asientos contables automáticos ante una transacción.
 *
 * Principios:
 *   1. Graceful degradation — error contable NO bloquea transacción origen
 *   2. CONTABILIZADO siempre — los asientos automáticos nacen definitivos
 *   3. Trazabilidad — cada asiento linkea a la transacción origen
 *   4. Audit logging — cada emisión se registra en audit_log
 *
 * Uso típico:
 *   import { accountingBus } from "./accounting-bus.service.js";
 *   await accountingBus.emit({
 *     tenantSlug: "taller-el-chero",
 *     tipo: "VENTA",
 *     fecha: new Date(),
 *     referenciaId: factura.id,
 *     referenciaTipo: "factura",
 *     descripcion: `Factura #${num}`,
 *     lineas: [
 *       { cuentaId: ctaCliente.id, debe: total },
 *       { cuentaId: ctaIngreso.id, haber: base },
 *       { cuentaId: ctaIva.id, haber: iva },
 *     ],
 *   });
 *
 * @module finance/services/accounting/accounting-bus.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import { planCuentas } from "../../schema/index.js";
import { createAsiento } from "./ledger.service.js";
import { logAudit } from "./audit-log.service.js";
import { resolveMapping } from "./mapping.service.js";
import { eq } from "drizzle-orm";
import type { CreateAsientoRequest, AsientoLineaRequest } from "../../types.js";

// ─── Transaction Event ─────────────────────────

/**
 * Evento simplificado para emitir asientos desde transacciones de negocio.
 *
 * A diferencia de AccountingEvent (que requiere líneas explícitas),
 * TransactionEvent solo necesita el módulo + tipo de evento + monto,
 * y el bus resuelve las cuentas de Débito/Haber mediante MappingService.
 */
export interface TransactionEvent {
  /** Tenant slug */
  tenantSlug: string;
  /** Tipo de asiento (VENTA, COMPRA, PAGO, etc.) */
  tipo: AccountingEventType;
  /** Fecha de la transacción */
  fecha: Date;
  /** ID de la transacción origen */
  referenciaId: string;
  /** Tipo de referencia (compra, factura, orden_trabajo, etc.) */
  referenciaTipo: string;
  /** Concepto / descripción del asiento */
  descripcion: string;
  /** Módulo de negocio (COMPRAS, SIFEN, WORKSHOP, TESORERIA) */
  modulo: string;
  /** Tipo de evento (CREADA, PAGADA, ANULADA, etc.) */
  tipoEvento: string;
  /** Subtipo opcional (CONTADO, CREDITO, EXENTA, GRAVADA) */
  subTipo?: string;
  /** Monto base del asiento */
  monto: number;
  /** Monto de IVA (se agrega como línea adicional si está presente) */
  montoIva?: number;
  /** Override: cuenta de Débito específica (salta MappingService) */
  cuentaDebeOverride?: string;
  /** Override: cuenta de Haber específica (salta MappingService) */
  cuentaHaberOverride?: string;
  /** Work order UUID si aplica */
  ordenTrabajoId?: string | null;

  /** Centro de Costo (dimensión analítica).
   *  Obligatorio para cuentas de COSTO (5) y GASTO (6). */
  centroCostoId?: string | null;
}

// ─── Types ──────────────────────────────────────

export type AccountingEventType =
  | "VENTA"
  | "COMPRA"
  | "CONSUMO_STOCK"
  | "NOMINA"
  | "DEPRECIACION"
  | "REVALUO"
  | "AJUSTE_TC"
  | "PAGO"
  | "COBRO"
  | "MOVIMIENTO_CAJA"
  | "TRANSFERENCIA"
  | "APERTURA"
  | "CIERRE"
  | "OTRO";

/**
 * Línea de asiento para el bus contable.
 * Los montos son números (se convierten a string internamente).
 */
export interface BusAccountingLine {
  cuentaId: string;
  debe?: number;
  haber?: number;
  descripcion?: string;
  centroCostoId?: string | null;
  ordenTrabajoId?: string | null;
}

/**
 * Evento contable — cualquier módulo del sistema emite esto
 * para generar un asiento automático.
 */
export interface AccountingEvent {
  /** Tenant slug */
  tenantSlug: string;
  /** Tipo de transacción que origina el asiento */
  tipo: AccountingEventType;
  /** Fecha de la transacción */
  fecha: Date;
  /** ID de la transacción origen (factura, OT, etc.) */
  referenciaId: string;
  /** Tipo de referencia (factura, orden_trabajo, movimiento_stock, etc.) */
  referenciaTipo: string;
  /** Descripción / concepto del asiento */
  descripcion: string;
  /** Líneas del asiento (Debe/Haber) */
  lineas: BusAccountingLine[];
  /** Work order UUID si aplica */
  ordenTrabajoId?: string | null;
}

/**
 * Resultado de emitir un evento contable.
 * Incluye graceful degradation: si falla, success=false pero no explota.
 */
export interface AccountingEventResult {
  success: boolean;
  asientoId?: string;
  asientoNumero?: number;
  error?: string;
}

// ─── Module name map ─────────────────────────

const MODULE_MAP: Record<AccountingEventType, string> = {
  VENTA: "SIFEN",
  COMPRA: "COMPRAS",
  CONSUMO_STOCK: "INVENTARIO",
  NOMINA: "NOMINA",
  DEPRECIACION: "ACTIVOS_FIJOS",
  REVALUO: "ACTIVOS_FIJOS",
  AJUSTE_TC: "TESORERIA",
  PAGO: "TESORERIA",
  COBRO: "TESORERIA",
  MOVIMIENTO_CAJA: "TESORERIA",
  TRANSFERENCIA: "TESORERIA",
  APERTURA: "CONTABILIDAD",
  CIERRE: "CONTABILIDAD",
  OTRO: "SISTEMA",
};

// ─── Helper: resolve account by code ──────────

/**
 * Busca una cuenta contable por su código.
 * Útil para que los módulos no necesiten saber UUIDs de cuentas.
 *
 * @returns cuentaId si existe, null si no
 */
export async function resolveAccount(
  codigo: string,
): Promise<string | null> {
  const [cuenta] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(eq(planCuentas.codigo, codigo))
    .limit(1);

  return cuenta?.id ?? null;
}

// ─── Core: emit ───────────────────────────────

/**
 * Emite un evento contable → genera asiento automático.
 *
 * Características:
 *   - Graceful degradation: si falla la contabilidad, retorna { success: false }
 *     y la transacción origen continúa.
 *   - Audit logging automático.
 *   - Maneja transacciones con línea única (autocompleta con contrapartida).
 *
 * @param event - Evento contable
 * @returns Resultado con asientoId si success
 */
export async function emit(
  event: AccountingEvent,
): Promise<AccountingEventResult> {
  try {
    // 1. Convert lines: number → string, validate
    const lineas: AsientoLineaRequest[] = event.lineas.map((l, i) => {
      if (l.debe && l.haber) {
        throw new Error(
          `Línea ${i + 1}: no puede tener Débito y Crédito simultáneamente`,
        );
      }
      if (!l.debe && !l.haber) {
        throw new Error(
          `Línea ${i + 1}: debe tener Débito o Crédito`,
        );
      }
      return {
        cuentaId: l.cuentaId,
        debe: l.debe ? l.debe.toFixed(2) : undefined,
        haber: l.haber ? l.haber.toFixed(2) : undefined,
        descripcion: l.descripcion ?? null,
        centroCostoId: l.centroCostoId ?? null,
        ordenTrabajoId: l.ordenTrabajoId ?? null,
      };
    });

    // 2. Validate min 2 lines
    if (lineas.length < 2) {
      throw new Error(
        "Un asiento debe tener al menos 2 líneas (un Débito y un Crédito)",
      );
    }

    // 3. Calculate moduloOrigen from tipo
    const moduloOrigen = MODULE_MAP[event.tipo] ?? "SISTEMA";

    // 4. Build documentoRef
    const documentoRef = `${event.referenciaTipo}:${event.referenciaId}`;

    // 5. Create the accounting entry
    const asientoReq: CreateAsientoRequest = {
      fecha: event.fecha.toISOString(),
      concepto: event.descripcion,
      documentoRef,
      moduloOrigen,
      ordenTrabajoId: event.ordenTrabajoId ?? null,
      lineas,
    };

    const result = await createAsiento(asientoReq);

    // 6. Audit: log the automatic entry
    await logAudit({
      tenantSlug: event.tenantSlug,
      usuarioId: "system",
      accion: "CREATE",
      entidad: "asientos_contables",
      entidadId: result.asiento.id,
      descripcion: `[AUTO] ${event.tipo}: ${event.descripcion}`,
    }).catch(() => {
      /* silent — audit failure is non-critical */
    });

    return {
      success: true,
      asientoId: result.asiento.id,
      asientoNumero: result.asiento.numero,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.warn(
      `[accounting-bus] Error al generar asiento para ${event.tipo} ` +
      `(${event.referenciaTipo}:${event.referenciaId}): ${message}`,
    );
    return {
      success: false,
      error: message,
    };
  }
}

// ─── High-level: emitFromTransaction ──────────

/**
 * Emite un asiento contable desde una transacción de negocio.
 *
 * A diferencia de `emit()` (que requiere líneas explícitas),
 * esta función usa el MappingService para resolver automáticamente
 * las cuentas de Débito y Haber según (modulo, tipoEvento, subTipo).
 *
 * Flujo:
 *   1. Resuelve mapping: (modulo, tipoEvento, subTipo) → (cuentaDebe, cuentaHaber)
 *   2. Si hay montoIva, agrega línea de IVA Crédito Fiscal (SIFEN)
 *   3. Delega a `emit()` para crear el asiento
 *   4. Graceful degradation: error contable NO explota la transacción origen
 *
 * @param event - Evento de transacción simplificado
 * @returns Resultado con asientoId si success
 */
export async function emitFromTransaction(
  event: TransactionEvent,
): Promise<AccountingEventResult> {
  try {
    // 1. Resolve accounts (mapping or override)
    let cuentaDebe = event.cuentaDebeOverride;
    let cuentaHaber = event.cuentaHaberOverride;

    if (!cuentaDebe || !cuentaHaber) {
      const mapping = await resolveMapping({
        modulo: event.modulo,
        tipoEvento: event.tipoEvento,
        subTipo: event.subTipo,
        tenantSlug: event.tenantSlug,
      });

      if (!mapping) {
        return {
          success: false,
          error:
            `No hay mapping contable para ${event.modulo}/` +
            `${event.tipoEvento}${event.subTipo ? `/${event.subTipo}` : ""}` +
            `. Configure el Plan de Cuentas y los mappings por defecto.`,
        };
      }

      cuentaDebe ??= mapping.cuentaDebeId;
      cuentaHaber ??= mapping.cuentaHaberId;
    }

    // 2. Build lines
    const lineas: BusAccountingLine[] = [
      {
        cuentaId: cuentaDebe,
        debe: event.monto,
        descripcion: `Débito: ${event.descripcion}`,
        centroCostoId: event.centroCostoId ?? null,
        ordenTrabajoId: event.ordenTrabajoId ?? null,
      },
      {
        cuentaId: cuentaHaber,
        haber: event.monto,
        descripcion: `Haber: ${event.descripcion}`,
        centroCostoId: event.centroCostoId ?? null,
        ordenTrabajoId: event.ordenTrabajoId ?? null,
      },
    ];

    // 3. If IVA present, add IVA Crédito Fiscal line
    //    Debita el IVA como un activo (crédito fiscal recuperable)
    if (event.montoIva && event.montoIva > 0) {
      const cuentaIva = await resolveAccount("1.1.02.001");
      if (cuentaIva) {
        lineas.push({
          cuentaId: cuentaIva,
          debe: event.montoIva,
          descripcion: `IVA Crédito Fiscal: ${event.descripcion}`,
        });

        // The Haber side needs an extra line to balance the IVA
        // We add it to the same cuentaHaber (the total invoice includes IVA)
        const ivaToHaber: BusAccountingLine = {
          cuentaId: cuentaHaber,
          haber: event.montoIva,
          descripcion: `IVA ${event.descripcion}`,
        };
        lineas.push(ivaToHaber);
      }
    }

    // 4. Delegate to emit
    return emit({
      tenantSlug: event.tenantSlug,
      tipo: event.tipo,
      fecha: event.fecha,
      referenciaId: event.referenciaId,
      referenciaTipo: event.referenciaTipo,
      descripcion: event.descripcion,
      lineas,
      ordenTrabajoId: event.ordenTrabajoId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.warn(
      `[accounting-bus] Error en emitFromTransaction para ${event.modulo}/` +
      `${event.tipoEvento} (${event.referenciaTipo}:${event.referenciaId}): ${message}`,
    );
    return {
      success: false,
      error: message,
    };
  }
}

export { resolveMapping } from "./mapping.service.js";
export { ensureDefaultMappings } from "./mapping.service.js";

