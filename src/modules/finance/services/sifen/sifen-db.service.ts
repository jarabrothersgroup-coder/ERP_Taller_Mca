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
import { eq, and, desc, asc, count } from "drizzle-orm";
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
      // S132-6: discriminador de tenant explícito (NOT NULL desde 0036).
      tenantSlug: data.tenantSlug,
      estado: data.estado ?? "BORRADOR",
    } as any)
    .returning();

  return doc;
}

/**
 * Retrieves a fiscal document by ID within a tenant.
 *
 * @param id - Document UUID
 * @param tenantSlug - Tenant owner (S132-6: filtro obligatorio, cerraba B-3)
 * @returns The fiscal document
 * @throws {NotFoundError} If not found (o pertenece a otro tenant)
 */
export async function getFiscalDocumentoById(id: string, tenantSlug: string) {
  const [doc] = await db()
    .select()
    .from(fiscalDocumentos)
    .where(
      and(eq(fiscalDocumentos.id, id), eq(fiscalDocumentos.tenantSlug, tenantSlug)),
    )
    .limit(1);

  if (!doc) {
    throw new NotFoundError(`Documento fiscal ${id} no encontrado`);
  }

  return doc;
}

/**
 * Lists fiscal documents with optional status filter, pagination, and sorting.
 *
 * @param options - Filter (tenantSlug obligatorio), pagination, and sort options
 * @returns Paginated document list with metadata
 */
export async function listFiscalDocumentos(options: {
  tenantSlug: string;
  estado?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { tenantSlug, estado, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
  const offset = (page - 1) * limit;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(fiscalDocumentos)
    .where(
      and(
        eq(fiscalDocumentos.tenantSlug, tenantSlug),
        estado ? eq(fiscalDocumentos.estado, estado as FiscalDocStatus) : undefined,
      ),
    );

  // Map sortBy to actual column
  const sortColumn = (fiscalDocumentos as any)[sortBy] ?? fiscalDocumentos.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const items = await db()
    .select()
    .from(fiscalDocumentos)
    .where(
      and(
        eq(fiscalDocumentos.tenantSlug, tenantSlug),
        estado ? eq(fiscalDocumentos.estado, estado as FiscalDocStatus) : undefined,
      ),
    )
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const total = Number(totalCount?.total ?? 0);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

/**
 * Updates a fiscal document's status and optional fields.
 *
 * @param id - Document UUID
 * @param estado - New status
 * @param opts - Tenant owner (obligatorio, S132-6) + optional fields:
 *               xmlFirmado, cdc, numeroTransaccion
 * @returns The updated document
 */
export async function updateFiscalDocumentoEstado(
  id: string,
  estado: FiscalDocStatus,
  opts: {
    tenantSlug: string;
    xmlFirmado?: string | null;
    cdc?: string | null;
    numeroTransaccion?: string | null;
  },
) {
  const updateData: Record<string, unknown> = {
    estado,
    updatedAt: new Date(),
  };

  if (opts.xmlFirmado !== undefined) {
    updateData["xmlFirmado"] = opts.xmlFirmado;
  }

  if (opts.cdc !== undefined) {
    updateData["cdc"] = opts.cdc;
  }

  if (opts.numeroTransaccion !== undefined) {
    updateData["numeroTransaccion"] = opts.numeroTransaccion;
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
    .where(
      and(eq(fiscalDocumentos.id, id), eq(fiscalDocumentos.tenantSlug, opts.tenantSlug)),
    )
    .returning();

  return doc;
}

/**
 * Adds line items to a fiscal document.
 *
 * @param documentoId - Parent document UUID
 * @param items - Array of line items
 * @param tenantSlug - Tenant owner (S132-6: espejo del documento, RLS no joins)
 */
export async function addFiscalDocumentoDetalles(
  documentoId: string,
  items: Array<Omit<NewFiscalDocumentoDetalle, "id" | "documentoId" | "tenantSlug" | "createdAt">>,
  tenantSlug: string,
) {
  if (items.length === 0) return;

  await db()
    .insert(fiscalDocumentoDetalles)
    .values(
      items.map((item) => ({
        ...item,
        tenantSlug,
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
    .values({ ...data, tenantSlug: data.tenantSlug } as any)
    .returning();

  return entry;
}

/**
 * Retrieves sync log entries with optional filtering, pagination, and sorting.
 *
 * @param options - Filter (tenantSlug obligatorio), pagination, and sort options
 * @returns Paginated log entries with metadata
 */
export async function getSyncLog(options: {
  tenantSlug: string;
  documentoId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const { tenantSlug, documentoId, page = 1, limit = 50, sortBy = "createdAt", sortOrder = "desc" } = options;
  const offset = (page - 1) * limit;

  const [totalCount] = await db()
    .select({ total: count() })
    .from(sifenSyncLog)
    .where(
      and(
        eq(sifenSyncLog.tenantSlug, tenantSlug),
        documentoId ? eq(sifenSyncLog.documentoId, documentoId) : undefined,
      ),
    );

  // Map sortBy to actual column
  const sortColumn = (sifenSyncLog as any)[sortBy] ?? sifenSyncLog.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const items = await db()
    .select()
    .from(sifenSyncLog)
    .where(
      and(
        eq(sifenSyncLog.tenantSlug, tenantSlug),
        documentoId ? eq(sifenSyncLog.documentoId, documentoId) : undefined,
      ),
    )
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  const total = Number(totalCount?.total ?? 0);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}
