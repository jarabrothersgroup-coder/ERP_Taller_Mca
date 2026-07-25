/**
 * Contingencia SIFEN — Offline contingency mode for DNIT SIFEN V150.
 *
 * Cuando DNIT está offline, este servicio permite:
 *   1. Generar XML normalmente con serie especial de contingencia (K)
 *   2. Almacenar DTE con estado CONTINGENCIA
 *   3. Encolar para envío cuando DNIT responda
 *   4. Reenviar lote en orden cronológico al restaurar conexión
 *
 * Cumple con el Art. 20 de la RG 90/2021 (Marangatu) que establece
 * el procedimiento de contingencia para facturación electrónica.
 *
 * @module finance/services/sifen/contingencia
 */

import crypto from "node:crypto";
import { db, sql } from "../../../../shared/database/drizzle.js";

// ─── Schema Imports ─────────────────────────────

// We use raw SQL through drizzle for the contingency queue table
// since it's a lightweight operational table



// ─── Types ──────────────────────────────────────

export interface ContingenciaEntry {
  id: string;
  tenantSlug: string;
  documentoId: string;
  cdcOriginal?: string | null;
  xmlOriginal: string;
  xmlFirmado?: string | null;
  serieContingencia: string;
  numeroContingencia: string;
  dteTipo: string;
  totalDocumento: string;
  estado: "PENDIENTE" | "FIRMADO" | "ENVIADO" | "ERROR";
  createdAt: Date;
  enviadoAt?: Date | null;
  errorMessage?: string | null;
  intentos: number;
}

export interface ContingenciaResult {
  success: boolean;
  entryId?: string;
  cdcAsignado?: string;
  error?: string;
  queueSize?: number;
}

export interface ContingenciaStatus {
  modoActivo: boolean;
  queueSize: number;
  pendientes: number;
  enviados: number;
  errores: number;
  ultimoEnvio?: string;
}

// ─── Constants ──────────────────────────────────

/** Prefijo de serie para documentos de contingencia (K) */
const SERIE_CONTINGENCIA_PREFIX = "K00";

/** Máximo de reintentos por documento */
const MAX_RETRIES = 5;

// ─── Service ────────────────────────────────────

/**
 * Verifica si SIFEN está disponible consultando el health endpoint.
 * Si no responde después de 10 segundos, asume que está offline.
 */
export async function checkSifenAvailability(): Promise<boolean> {
  try {
    const { testSifenConnection } = await import("./sifen-soap.service.js");
    const result = await testSifenConnection();
    return result.reachable === true;
  } catch {
    return false;
  }
}

/**
 * Almacena un DTE en la cola de contingencia cuando DNIT está offline.
 *
 * @param input - Datos del DTE a encolar
 * @returns Resultado de la operación
 */
export async function guardarEnContingencia(input: {
  tenantSlug: string;
  documentoId: string;
  xmlOriginal: string;
  xmlFirmado?: string;
  dteTipo: string;
  totalDocumento: string;
  serieOriginal: string;
  numeroOriginal: string;
  cdcOriginal?: string;
}): Promise<ContingenciaResult> {
  try {
    const { tenantSlug, documentoId, xmlOriginal, xmlFirmado, dteTipo, totalDocumento } = input;

    // Generar serie de contingencia: K + 2 dígitos del mes
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const serieContingencia = `${SERIE_CONTINGENCIA_PREFIX}${mes}`;

    // Obtener próximo número de contingencia
    const ultimoEntry = await getUltimoNumeroContingencia(tenantSlug, serieContingencia);
    const numeroContingencia = ultimoEntry
      ? String(parseInt(ultimoEntry.numeroContingencia, 10) + 1).padStart(7, "0")
      : "0000001";

    const id = crypto.randomUUID();

    // Insertar en cola de contingencia (raw SQL con drizzle)
    await db().execute(
      sql`INSERT INTO sifen_contingencia_queue
          (id, tenant_slug, documento_id, xml_original, xml_firmado, serie_contingencia, numero_contingencia, dte_tipo, total_documento, estado, created_at, intentos)
          VALUES (${id}, ${tenantSlug}, ${documentoId}, ${xmlOriginal}, ${xmlFirmado ?? null}, ${serieContingencia}, ${numeroContingencia}, ${dteTipo}, ${totalDocumento}, 'PENDIENTE', NOW(), 0)`,
    );

    return {
      success: true,
      entryId: id,
      queueSize: await getQueueSize(tenantSlug),
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error al guardar en contingencia: ${err.message}`,
    };
  }
}

/**
 * Obtiene el último número de contingencia usado para una serie.
 */
async function getUltimoNumeroContingencia(
  tenantSlug: string,
  serieContingencia: string,
): Promise<{ numeroContingencia: string } | null> {
  try {
    const rows = await db().execute(
      sql`SELECT numero_contingencia FROM sifen_contingencia_queue
          WHERE tenant_slug = ${tenantSlug} AND serie_contingencia = ${serieContingencia} AND estado != 'ERROR'
          ORDER BY created_at DESC LIMIT 1`,
    );
    if (rows && rows.length > 0) {
      return { numeroContingencia: String((rows[0] as any).numero_contingencia) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reintenta el envío de todos los documentos pendientes en la cola de contingencia.
 * Procesa en orden cronológico (FIFO).
 *
 * @param tenantSlug - Slug del tenant
 * @returns Resultado del proceso de reenvío
 */
export async function reenviarContingencia(
  tenantSlug: string,
): Promise<{ enviados: number; errores: number; total: number }> {
  const pendientes = await db().execute(
    sql`SELECT * FROM sifen_contingencia_queue
        WHERE tenant_slug = ${tenantSlug} AND estado IN ('PENDIENTE', 'ERROR') AND intentos < ${MAX_RETRIES}
        ORDER BY created_at ASC`,
  );

  let enviados = 0;
  let errores = 0;

  if (!pendientes || pendientes.length === 0) {
    return { enviados: 0, errores: 0, total: 0 };
  }

  const { enviarDTE } = await import("./sifen-soap.service.js");
  const { updateFiscalDocumentoEstado, createSyncLogEntry } = await import("./sifen-db.service.js");

  for (const entry of pendientes) {
    const row = entry as any;
    try {
      const xmlFirmado = row.xml_firmado ?? row.xml_original;
      const resultado = await enviarDTE(xmlFirmado, row.documento_id);

      if (resultado.cdc) {
        // Éxito — actualizar estado
        await db().execute(
          sql`UPDATE sifen_contingencia_queue
              SET estado = 'ENVIADO', enviado_at = NOW(), cdc_asignado = ${resultado.cdc}
              WHERE id = ${row.id}`,
        );

        // Actualizar el documento fiscal original
        if (row.documento_id) {
          await updateFiscalDocumentoEstado(
            row.documento_id,
            "APROBADO",
            xmlFirmado,
            resultado.cdc,
            resultado.numeroTransaccion,
          );
        }

        await createSyncLogEntry({
          documentoId: row.documento_id,
          operacion: "CONTINGENCIA_REENVIO",
          codigoResultado: resultado.codigoResultado ?? "OK",
          cdc: resultado.cdc,
          xmlEnviado: xmlFirmado,
          exitoso: true,
        });

        enviados++;
      } else {
        // Error del DNIT — incrementar intentos
        const nuevosIntentos = (row.intentos ?? 0) + 1;
        await db().execute(
          sql`UPDATE sifen_contingencia_queue
              SET estado = 'ERROR', intentos = ${nuevosIntentos}, error_message = ${resultado.mensajeError ?? "Error de DNIT"}
              WHERE id = ${row.id}`,
        );
        errores++;
      }
    } catch (err: any) {
      // Error de conexión — incrementar intentos
      const nuevosIntentos = (row.intentos ?? 0) + 1;
      const nuevoEstado = nuevosIntentos >= MAX_RETRIES ? "ERROR" : "PENDIENTE";
      await db().execute(
        sql`UPDATE sifen_contingencia_queue
            SET estado = ${nuevoEstado}, intentos = ${nuevosIntentos}, error_message = ${err.message}
            WHERE id = ${row.id}`,
      );
      errores++;
    }
  }

  return { enviados, errores, total: pendientes.length };
}

/**
 * Reintenta el envío de contingencia para todos los tenants.
 * Útil para el cron job global.
 */
export async function reenviarContingenciaGlobal(): Promise<{
  totalTenants: number;
  totalEnviados: number;
  totalErrores: number;
}> {
  try {
    const tenants = await db().execute(
      sql`SELECT DISTINCT tenant_slug FROM sifen_contingencia_queue
          WHERE estado IN ('PENDIENTE', 'ERROR') AND intentos < ${MAX_RETRIES}`,
    );

    let totalEnviados = 0;
    let totalErrores = 0;

    if (!tenants || tenants.length === 0) return { totalTenants: 0, totalEnviados: 0, totalErrores: 0 };

    for (const row of tenants) {
      const r = row as any;
      const result = await reenviarContingencia(r.tenant_slug);
      totalEnviados += result.enviados;
      totalErrores += result.errores;
    }

    return {
      totalTenants: tenants.length,
      totalEnviados,
      totalErrores,
    };
  } catch (err: any) {
    console.error("[contingencia-global] Error:", err.message);
    return { totalTenants: 0, totalEnviados: 0, totalErrores: 0 };
  }
}

/**
 * Obtiene el estado actual del modo contingencia.
 *
 * @param tenantSlug - Slug del tenant
 * @returns Estado de la contingencia
 */
export async function getContingenciaStatus(
  tenantSlug: string,
): Promise<ContingenciaStatus> {
  const disponible = await checkSifenAvailability();

  // Contar por estado
  const countResult = await db().execute(
    sql`SELECT estado, COUNT(*) as count FROM sifen_contingencia_queue
        WHERE tenant_slug = ${tenantSlug}
        GROUP BY estado`,
  );

  const counts: Record<string, number> = {
    PENDIENTE: 0,
    FIRMADO: 0,
    ENVIADO: 0,
    ERROR: 0,
  };

  if (countResult) {
    for (const row of countResult) {
      const r = row as any;
      const estado = r.estado as string;
      if (estado in counts) {
        counts[estado] = Number(r.count);
      }
    }
  }

  const totalPendientes = counts.PENDIENTE + counts.FIRMADO + counts.ERROR;

  // Último envío exitoso
  const ultimoEnvio = await db().execute(
    sql`SELECT enviado_at FROM sifen_contingencia_queue
        WHERE tenant_slug = ${tenantSlug} AND estado = 'ENVIADO'
        ORDER BY enviado_at DESC LIMIT 1`,
  );

  return {
    modoActivo: !disponible && totalPendientes > 0,
    queueSize: totalPendientes + counts.ENVIADO,
    pendientes: counts.PENDIENTE + counts.FIRMADO,
    enviados: counts.ENVIADO,
    errores: counts.ERROR,
    ultimoEnvio: ultimoEnvio && ultimoEnvio.length > 0
      ? String((ultimoEnvio[0] as any).enviado_at)
      : undefined,
  };
}

/**
 * Obtiene el tamaño de la cola de contingencia para un tenant.
 */
async function getQueueSize(tenantSlug: string): Promise<number> {
  try {
    const result = await db().execute(
      sql`SELECT COUNT(*) as count FROM sifen_contingencia_queue
          WHERE tenant_slug = ${tenantSlug} AND estado IN ('PENDIENTE', 'FIRMADO')`,
    );
    return result && result.length > 0 ? Number((result[0] as any).count) : 0;
  } catch {
    return 0;
  }
}

/**
 * Limpia entradas de contingencia viejas (más de 90 días).
 *
 * @param tenantSlug - Slug del tenant (opcional, si no se especifica limpia todo)
 */
export async function limpiarContingenciaVieja(
  tenantSlug?: string,
): Promise<number> {
  try {
    let cleanupResult;
    if (tenantSlug) {
      cleanupResult = await db().execute(
        sql`DELETE FROM sifen_contingencia_queue
            WHERE tenant_slug = ${tenantSlug} AND created_at < NOW() - INTERVAL '90 days'`,
      );
    } else {
      cleanupResult = await db().execute(
        sql`DELETE FROM sifen_contingencia_queue
            WHERE created_at < NOW() - INTERVAL '90 days'`,
      );
    }
    return (cleanupResult as any)?.length ?? 0;
  } catch {
    return 0;
  }
}
