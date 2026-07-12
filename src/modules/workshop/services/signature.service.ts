/**
 * Digital Signature Service — Canvas-based client authorization.
 *
 * Provides digital signature capture for work order authorizations,
 * vehicle check-in, and service approvals.
 *
 * @module workshop/services/signature.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql } from "drizzle-orm";

// ─── Schema (inline for flexibility) ──────────

/**
 * Signatures table — stores digital signature data.
 * Created as raw SQL since this is a new table.
 */
// ─── Types ────────────────────────────────────

export interface SignatureData {
  ordenTrabajoId: string;
  tipo: string;
  firmaBase64: string;
  clienteNombre?: string;
  clienteDocumento?: string;
  observaciones?: string;
}

export interface StoredSignature {
  id: string;
  ordenTrabajoId: string;
  tipo: string;
  firmaBase64: string;
  clienteNombre: string | null;
  clienteDocumento: string | null;
  createdAt: string;
}

// ─── Functions ────────────────────────────────

/**
 * Saves a digital signature.
 *
 * @param data - Signature data (base64 canvas image)
 * @param tenantSlug - Tenant identifier
 * @returns Stored signature record
 */
export async function saveSignature(
  data: SignatureData,
  tenantSlug: string,
): Promise<StoredSignature> {
  const result = await db().execute(sql`
    INSERT INTO digital_signatures (
      orden_trabajo_id, tipo, firma_base64,
      cliente_nombre, cliente_documento, observaciones,
      tenant_slug
    ) VALUES (
      ${data.ordenTrabajoId}, ${data.tipo}, ${data.firmaBase64},
      ${data.clienteNombre || null}, ${data.clienteDocumento || null},
      ${data.observaciones || null}, ${tenantSlug}
    )
    RETURNING id, orden_trabajo_id, tipo, firma_base64,
              cliente_nombre, cliente_documento, created_at
  `);

  const row = result[0] as any;
  return {
    id: row.id,
    ordenTrabajoId: row.orden_trabajo_id,
    tipo: row.tipo,
    firmaBase64: row.firma_base64,
    clienteNombre: row.cliente_nombre,
    clienteDocumento: row.cliente_documento,
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Gets all signatures for a work order.
 *
 * @param ordenId - Work order UUID
 * @param tenantSlug - Tenant identifier
 * @returns List of signatures
 */
export async function getSignaturesByOrden(
  ordenId: string,
  tenantSlug: string,
): Promise<StoredSignature[]> {
  const result = await db().execute(sql`
    SELECT id, orden_trabajo_id, tipo, firma_base64,
           cliente_nombre, cliente_documento, created_at
    FROM digital_signatures
    WHERE orden_trabajo_id = ${ordenId}
      AND tenant_slug = ${tenantSlug}
    ORDER BY created_at DESC
  `);

  return result.map((row: any) => ({
    id: row.id,
    ordenTrabajoId: row.orden_trabajo_id,
    tipo: row.tipo,
    firmaBase64: row.firma_base64,
    clienteNombre: row.cliente_nombre,
    clienteDocumento: row.cliente_documento,
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
  }));
}
