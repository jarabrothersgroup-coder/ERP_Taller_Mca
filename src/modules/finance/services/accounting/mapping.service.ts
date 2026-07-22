/**
 * MappingService — Resolución de mapping contable (CUENTAS automáticas).
 *
 * Traduce eventos de negocio del tipo (modulo, tipoEvento, subTipo)
 * en cuentas del plan contable (cuentaDebeId, cuentaHaberId).
 *
 * Multi-tenant:
 *   - Busca primero un mapping específico del tenant
 *   - Si no encuentra, cae al mapping global (tenantSlug = NULL)
 *   - Si no hay mapping global, retorna null (no se genera asiento)
 *
 * @module finance/services/accounting/mapping.service
 */

import { db } from "../../../../shared/database/drizzle.js";
import {
  cuentaMapping,
  configuradorModulo,
} from "../../schema/index.js";
import { eq, and, isNull, desc } from "drizzle-orm";
import type {
  CuentaMapping,
  NewCuentaMapping,
  NewConfiguradorModulo,
} from "../../schema/index.js";
import { NotFoundError, ConflictError } from "../../../../shared/errors/app-error.js";
import { planCuentas } from "../../schema/index.js";

export type {
  CuentaMapping,
  NewCuentaMapping,
  ConfiguradorModulo,
  NewConfiguradorModulo,
} from "../../schema/index.js";

// ─── Resolve ───────────────────────────────────

export interface ResolveMappingInput {
  modulo: string;
  tipoEvento: string;
  subTipo?: string | null;
  tenantSlug?: string | null;
}

/**
 * Resuelve el mapping contable para un evento de negocio.
 *
 * Estrategia de resolución (por prioridad):
 *   1. Tenant-specific exacto (modulo + tipoEvento + subTipo)
 *   2. Tenant-specific sin subtipo (modulo + tipoEvento)
 *   3. Global exacto (modulo + tipoEvento + subTipo)
 *   4. Global sin subtipo (modulo + tipoEvento)
 *
 * @returns El mapping activo de mayor prioridad, o null
 */
export async function resolveMapping(
  input: ResolveMappingInput,
): Promise<CuentaMapping | null> {
  const { modulo, tipoEvento, subTipo, tenantSlug } = input;

  // Base: modulo + tipoEvento activo
  const baseCondition = and(
    eq(cuentaMapping.modulo, modulo),
    eq(cuentaMapping.tipoEvento, tipoEvento),
    eq(cuentaMapping.activo, true),
  );

  if (!baseCondition) return null;

  // Try tenant-specific with subTipo
  if (tenantSlug && subTipo) {
    const result = await db()
      .select()
      .from(cuentaMapping)
      .where(
        and(
          eq(cuentaMapping.tenantSlug, tenantSlug),
          eq(cuentaMapping.subTipo, subTipo),
          baseCondition,
        ),
      )
      .orderBy(desc(cuentaMapping.prioridad))
      .limit(1);

    if (result.length > 0) return result[0]!;
  }

  // Try tenant-specific without subTipo
  if (tenantSlug) {
    const result = await db()
      .select()
      .from(cuentaMapping)
      .where(
        and(
          eq(cuentaMapping.tenantSlug, tenantSlug),
          isNull(cuentaMapping.subTipo),
          baseCondition,
        ),
      )
      .orderBy(desc(cuentaMapping.prioridad))
      .limit(1);

    if (result.length > 0) return result[0]!;
  }

  // Try global with subTipo
  if (subTipo) {
    const result = await db()
      .select()
      .from(cuentaMapping)
      .where(
        and(
          isNull(cuentaMapping.tenantSlug),
          eq(cuentaMapping.subTipo, subTipo),
          baseCondition,
        ),
      )
      .orderBy(desc(cuentaMapping.prioridad))
      .limit(1);

    if (result.length > 0) return result[0]!;
  }

  // Fallback: global without subTipo
  const result = await db()
    .select()
    .from(cuentaMapping)
    .where(
      and(
        isNull(cuentaMapping.tenantSlug),
        isNull(cuentaMapping.subTipo),
        baseCondition,
      ),
    )
    .orderBy(desc(cuentaMapping.prioridad))
    .limit(1);

  return result[0] ?? null;
}

// ─── CRUD ──────────────────────────────────────

/**
 * Crea un nuevo mapping contable.
 */
export async function createMapping(
  input: NewCuentaMapping,
): Promise<CuentaMapping> {
  // Check duplicate
  const existing = await db()
    .select({ id: cuentaMapping.id })
    .from(cuentaMapping)
    .where(
      and(
        eq(cuentaMapping.modulo, input.modulo),
        eq(cuentaMapping.tipoEvento, input.tipoEvento),
        input.subTipo
          ? eq(cuentaMapping.subTipo, input.subTipo)
          : isNull(cuentaMapping.subTipo),
        input.tenantSlug
          ? eq(cuentaMapping.tenantSlug, input.tenantSlug)
          : isNull(cuentaMapping.tenantSlug),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      `Ya existe un mapping para ${input.modulo}/${input.tipoEvento}` +
      (input.subTipo ? `/${input.subTipo}` : "") +
      (input.tenantSlug ? ` (tenant: ${input.tenantSlug})` : " (global)"),
    );
  }

  const [mapping] = await db()
    .insert(cuentaMapping)
    .values(input)
    .returning();

  return mapping!;
}

/**
 * Actualiza un mapping existente.
 */
export async function updateMapping(
  id: string,
  input: Partial<NewCuentaMapping>,
): Promise<CuentaMapping> {
  const [mapping] = await db()
    .update(cuentaMapping)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(cuentaMapping.id, id))
    .returning();

  if (!mapping) {
    throw new NotFoundError(`Mapping ${id} no encontrado`);
  }

  return mapping;
}

/**
 * Elimina (borrado físico) un mapping.
 */
export async function deleteMapping(id: string): Promise<void> {
  const result = await db()
    .delete(cuentaMapping)
    .where(eq(cuentaMapping.id, id))
    .returning({ id: cuentaMapping.id });

  if (result.length === 0) {
    throw new NotFoundError(`Mapping ${id} no encontrado`);
  }
}

/**
 * Lista mappings, opcionalmente filtrados por módulo.
 */
export async function listMappings(modulo?: string): Promise<CuentaMapping[]> {
  const condition = modulo
    ? eq(cuentaMapping.modulo, modulo)
    : undefined;

  return db()
    .select()
    .from(cuentaMapping)
    .where(condition)
    .orderBy(
      cuentaMapping.modulo,
      cuentaMapping.tipoEvento,
      desc(cuentaMapping.prioridad),
    );
}

// ─── Default Mappings ──────────────────────────

export interface DefaultMappingDef {
  modulo: string;
  tipoEvento: string;
  subTipo?: string;
  codigoDebe: string;
  codigoHaber: string;
  descripcion: string;
}

/**
 * Crea mappings por defecto para un módulo, resolviendo códigos de cuenta.
 *
 * Estrategia:
 *   - Busca cada código en plan_cuentas
 *   - Si la cuenta no existe, salta ese mapping (no bloquea)
 *   - Si ya existe un mapping idéntico, no duplica
 *
 * @returns Número de mappings creados
 */
export async function ensureDefaultMappings(
  defaults: DefaultMappingDef[],
): Promise<number> {
  let created = 0;

  for (const def of defaults) {
    // Resolve account codes to IDs
    const [cuentaDebe] = await db()
      .select({ id: planCuentas.id })
      .from(planCuentas)
      .where(
        and(
          eq(planCuentas.codigo, def.codigoDebe),
          eq(planCuentas.activo, true),
        ),
      )
      .limit(1);

    const [cuentaHaber] = await db()
      .select({ id: planCuentas.id })
      .from(planCuentas)
      .where(
        and(
          eq(planCuentas.codigo, def.codigoHaber),
          eq(planCuentas.activo, true),
        ),
      )
      .limit(1);

    if (!cuentaDebe || !cuentaHaber) {
      // Skip — accounts may not be seeded yet
      continue;
    }

    try {
      await createMapping({
        modulo: def.modulo,
        tipoEvento: def.tipoEvento,
        subTipo: def.subTipo ?? null,
        cuentaDebeId: cuentaDebe.id,
        cuentaHaberId: cuentaHaber.id,
        descripcion: def.descripcion,
        activo: true,
        prioridad: 0,
      });
      created++;
    } catch {
      // Already exists — skip silently
    }
  }

  return created;
}

// ─── Configurador Module Registration ──────────

/**
 * Registra un módulo configurador en el sistema.
 */
export async function registerModulo(
  input: NewConfiguradorModulo,
): Promise<void> {
  await db()
    .insert(configuradorModulo)
    .values(input)
    .onConflictDoNothing({ target: configuradorModulo.modulo });
}

/**
 * Lista los módulos configuradores activos (solo códigos).
 */
export async function listModulosActivos(): Promise<string[]> {
  const modulos = await db()
    .select({ modulo: configuradorModulo.modulo })
    .from(configuradorModulo)
    .where(eq(configuradorModulo.activo, true));

  return modulos.map((m) => m.modulo);
}

/**
 * Lista los módulos configuradores activos con detalles completos.
 * Utilizado por el dashboard de integración contable.
 */
export async function listModulosActivosDetalle(): Promise<Array<{
  modulo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  version: string | null;
}>> {
  return db()
    .select({
      modulo: configuradorModulo.modulo,
      nombre: configuradorModulo.nombre,
      descripcion: configuradorModulo.descripcion,
      activo: configuradorModulo.activo,
      version: configuradorModulo.version,
    })
    .from(configuradorModulo)
    .where(eq(configuradorModulo.activo, true))
    .orderBy(configuradorModulo.modulo);
}
