/**
 * Pre-Transaction Validator Service — Validación antes de emitir asientos.
 *
 * Previene errores contables validando que las cuentas, mappings,
 * centros de costo y montos sean válidos ANTES de emitir un asiento
 * contable automático.
 *
 * Útil para:
 *   - Validar en el frontend antes de enviar
 *   - Validar en configuradores antes de emitFromTransaction
 *   - Validar en importación masiva de datos
 *
 * @module finance/services/accounting/pre-transaction-validator.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  planCuentas,
  centrosCosto,
} from "../../schema/index.js";
import { eq, and } from "drizzle-orm";
import { resolveMapping } from "./mapping.service.js";

// ─── Types ──────────────────────────────────────

export interface ValidationResult {
  valido: boolean;
  errores: string[];
  advertencias: string[];
  mapping?: {
    cuentaDebeCodigo: string;
    cuentaDebeNombre: string;
    cuentaHaberCodigo: string;
    cuentaHaberNombre: string;
  };
}

export interface PreValidationInput {
  modulo: string;
  tipoEvento: string;
  subTipo?: string | null;
  monto: number;
  tenantSlug: string;
  centroCostoId?: string | null;
  /** Módulos que requieren centro de costo obligatorio */
  centrosCostoRequeridos?: string[];
}

// ─── Service ────────────────────────────────────

/**
 * Valida que una transacción pueda generar un asiento contable.
 *
 * Verifica:
 *   1. Que exista mapping para el módulo/tipoEvento
 *   2. Que las cuentas del mapping existan y estén activas
 *   3. Que las cuentas acepten movimientos
 *   4. Que el centro de costo exista (si es obligatorio)
 *   5. Que el monto sea positivo
 *
 * @param input - Datos de la transacción a validar
 * @returns Resultado de la validación
 */
export async function validarPreTransaccion(
  input: PreValidationInput,
): Promise<ValidationResult> {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const {
    modulo,
    tipoEvento,
    subTipo,
    monto,
    tenantSlug,
    centroCostoId,
    centrosCostoRequeridos = [],
  } = input;

  // ── 1. Validar monto ──
  if (monto <= 0) {
    errores.push(`El monto debe ser positivo (recibido: ${monto})`);
  }

  // ── 2. Validar que exista mapping ──
  const mapping = await resolveMapping({
    modulo,
    tipoEvento,
    subTipo: subTipo ?? null,
    tenantSlug,
  });

  if (!mapping) {
    errores.push(
      `No hay mapping contable activo para ${modulo}/${tipoEvento}` +
      (subTipo ? `/${subTipo}` : ""),
    );
    return { valido: false, errores, advertencias };
  }

  // ── 3. Validar cuentas contables ──
  const [cuentaDebe, cuentaHaber] = await Promise.all([
    db()
      .select({
        codigo: planCuentas.codigo,
        nombre: planCuentas.nombre,
        activo: planCuentas.activo,
        aceptaMovimientos: planCuentas.aceptaMovimientos,
      })
      .from(planCuentas)
      .where(eq(planCuentas.id, mapping.cuentaDebeId))
      .limit(1),
    db()
      .select({
        codigo: planCuentas.codigo,
        nombre: planCuentas.nombre,
        activo: planCuentas.activo,
        aceptaMovimientos: planCuentas.aceptaMovimientos,
      })
      .from(planCuentas)
      .where(eq(planCuentas.id, mapping.cuentaHaberId))
      .limit(1),
  ]);

  if (cuentaDebe.length === 0) {
    errores.push(`Cuenta débito ID ${mapping.cuentaDebeId} no existe en el plan de cuentas`);
  } else {
    const cta = cuentaDebe[0]!;
    if (!cta.activo) {
      errores.push(`Cuenta débito ${cta.codigo} (${cta.nombre}) está inactiva`);
    }
    if (!cta.aceptaMovimientos) {
      errores.push(`Cuenta débito ${cta.codigo} (${cta.nombre}) no acepta movimientos directos`);
    }
  }

  if (cuentaHaber.length === 0) {
    errores.push(`Cuenta haber ID ${mapping.cuentaHaberId} no existe en el plan de cuentas`);
  } else {
    const cta = cuentaHaber[0]!;
    if (!cta.activo) {
      errores.push(`Cuenta haber ${cta.codigo} (${cta.nombre}) está inactiva`);
    }
    if (!cta.aceptaMovimientos) {
      errores.push(`Cuenta haber ${cta.codigo} (${cta.nombre}) no acepta movimientos directos`);
    }
  }

  // ── 4. Validar centro de costo (si es obligatorio) ──
  if (centrosCostoRequeridos.includes(modulo)) {
    if (!centroCostoId) {
      errores.push(`Centro de costo es obligatorio para el módulo ${modulo}`);
    } else {
      // Verificar que el centro de costo exista
      const [centro] = await db()
        .select({ id: centrosCosto.id })
        .from(centrosCosto)
        .where(and(eq(centrosCosto.id, centroCostoId), eq(centrosCosto.activo, true)))
        .limit(1);

      if (!centro) {
        errores.push(`Centro de costo ID ${centroCostoId} no encontrado o inactivo`);
      }
    }
  }

  // ── 5. Advertencia si mapping tiene prioridad baja ──
  if (mapping.prioridad !== null && mapping.prioridad < 50) {
    advertencias.push(
      `Mapping ${modulo}/${tipoEvento} tiene prioridad baja (${mapping.prioridad}). ` +
      "Verifique que no haya otro mapping con mayor prioridad.",
    );
  }

  // ── 6. Armar resultado con info del mapping ──
  let mappingInfo: ValidationResult["mapping"];
  if (cuentaDebe[0] && cuentaHaber[0]) {
    mappingInfo = {
      cuentaDebeCodigo: cuentaDebe[0].codigo,
      cuentaDebeNombre: cuentaDebe[0].nombre,
      cuentaHaberCodigo: cuentaHaber[0].codigo,
      cuentaHaberNombre: cuentaHaber[0].nombre,
    };
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    mapping: mappingInfo,
  };
}
