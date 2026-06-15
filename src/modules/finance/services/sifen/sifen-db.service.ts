/**
 * SIFEN Database Service — fiscal document persistence layer.
 *
 * Handles direct database operations for fiscal documents, details,
 * and sync log entries. Separated from business logic to maintain
 * single responsibility per the project pattern.
 *
 * @module finance/services/sifen/sifen-db.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  fiscalDocumentos,
  fiscalDocumentoDetalles,
  sifenSyncLog,
} from "../../schema/fiscal-docs.js";
import { eq, and, desc, count } from "drizzle-orm";
import { NotFoundError } from "../../../../shared/errors/app-error.js";
import type {
  NewFiscalDocumento,
  NewFiscalDocumentoDetalle,
  NewSifenSyncLogEntry,
  FiscalDocStatus,
} from "../../schema/fiscal-docs.js";

// ─── Fiscal Document CRUD ──────────────────────

/**
 * Creates a new fiscal document record (BORRADOR by default).
 *
 * @param data - Fiscal document data
 * @returns The created document
 */
export async function createFiscalDocumento(
  data: Omit<NewFiscalDocumento, "id" | "createdAt" | "updatedAt" | "estado"> & {
    estado?: FiscalDocStatus;
  },
) {
  const [doc] = await db()
    .insert(fiscalDocumentos)
    .values({
      ...data,
      estado: data.estado ?? "BORRADOR",
    } as any)
    .returning();

  return doc;
}

/**
 * Retrieves a fiscal document by ID.
 *
 * @param id - Document UUID
 * @returns The fiscal document
 * @throws {NotFoundError} If not found
 */
export async function getFiscalDocumentoById(id: string) {
  const [doc] = await db()
    .select()
    .from(fiscalDocumentos)
    .where(eq(fiscalDocumentos.id, id))
    .limit(1);

  if (!doc) {
    throw new NotFoundError(`Documento fiscal ${id} no encontrado`);
  }

  return doc;
}

/**
 * Lists fiscal documents with optional status filter and pagination.
 *
 * @param options - Filter and pagination options
 * @returns Paginated document list
 */
export async function listFiscalDocumentos(options: {
  estado?: string;
  page?: number;
  limit?: number;
}) {
  const { estado, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (estado) {
    conditions.push(eq(fiscalDocumentos.estado, estado as any));
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(fiscalDocumentos)
    .where(whereClause);

  const items = await db()
    .select()
    .from(fiscalDocumentos)
    .where(whereClause)
    .orderBy(desc(fiscalDocumentos.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: Number(totalCount?.total ?? 0),
    page,
    limit,
    totalPages: Math.ceil(Number(totalCount?.total ?? 0) / limit),
  };
}

/**
 * Updates a fiscal document's status and optional fields.
 *
 * @param id - Document UUID
 * @param estado - New status
 * @param xmlFirmado - Signed XML (optional)
 * @param cdc - Control code (optional)
 * @param numeroTransaccion - SIFEN transaction number (optional)
 * @returns The updated document
 */
export async function updateFiscalDocumentoEstado(
  id: string,
  estado: FiscalDocStatus,
  xmlFirmado?: string | null,
  cdc?: string | null,
  numeroTransaccion?: string | null,
) {
  const updateData: Record<string, unknown> = {
    estado,
    updatedAt: new Date(),
  };

  if (xmlFirmado !== undefined) {
    updateData["xmlFirmado"] = xmlFirmado;
  }

  if (cdc !== undefined) {
    updateData["cdc"] = cdc;
  }

  if (numeroTransaccion !== undefined) {
    updateData["numeroTransaccion"] = numeroTransaccion;
  }

  if (estado === "ENVIADO" || estado === "APROBADO") {
    updateData["fechaEnvio"] = new Date();
  }

  if (estado === "APROBADO") {
    updateData["fechaAprobacion"] = new Date();
  }

  const [doc] = await db()
    .update(fiscalDocumentos)
    .set(updateData)
    .where(eq(fiscalDocumentos.id, id))
    .returning();

  return doc;
}

/**
 * Adds line items to a fiscal document.
 *
 * @param documentoId - Parent document UUID
 * @param items - Array of line items
 */
export async function addFiscalDocumentoDetalles(
  documentoId: string,
  items: Array<Omit<NewFiscalDocumentoDetalle, "id" | "documentoId" | "createdAt">>,
) {
  if (items.length === 0) return;

  await db()
    .insert(fiscalDocumentoDetalles)
    .values(
      items.map((item) => ({
        ...item,
        documentoId,
      })),
    );
}

// ─── Sync Log ──────────────────────────────────

/**
 * Creates a SIFEN sync log entry for auditing.
 *
 * @param data - Log entry data
 * @returns The created log entry
 */
export async function createSyncLogEntry(
  data: Omit<NewSifenSyncLogEntry, "id" | "createdAt">,
) {
  const [entry] = await db()
    .insert(sifenSyncLog)
    .values(data as any)
    .returning();

  return entry;
}

/**
 * Retrieves sync log entries with optional filtering.
 *
 * @param options - Filter and pagination options
 * @returns Paginated log entries
 */
export async function getSyncLog(options: {
  documentoId?: string;
  page?: number;
  limit?: number;
}) {
  const { documentoId, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (documentoId) {
    conditions.push(eq(sifenSyncLog.documentoId, documentoId));
  }

  const whereClause = conditions.length > 0
    ? and(...conditions)
    : undefined;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(sifenSyncLog)
    .where(whereClause);

  const items = await db()
    .select()
    .from(sifenSyncLog)
    .where(whereClause)
    .orderBy(desc(sifenSyncLog.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: Number(totalCount?.total ?? 0),
    page,
    limit,
  };
}
