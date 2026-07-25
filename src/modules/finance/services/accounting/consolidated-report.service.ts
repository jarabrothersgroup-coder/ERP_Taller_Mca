/**
 * Consolidated Report Service — Multi-tenant financial consolidation.
 *
 * Permite a dueños de múltiples talleres (tenant groups) ver
 * estados financieros consolidados: Balance General, P&L, Flujo de Efectivo,
 * y Evolución del Patrimonio, sumando datos de todos los talleres del grupo.
 *
 * @module finance/services/accounting/consolidated-report
 */

import { db, sql } from "../../../../shared/database/drizzle.js";

// ─── Types ──────────────────────────────────────

export interface ConsolidatedBalance {
  groupId: string;
  groupName: string;
  periodo: { anho: number; mes: number };
  tipo: string;
  totalActivo: number;
  totalPasivo: number;
  totalPatrimonio: number;
  diferencia: number;
  balanceado: boolean;
  tenants: TenantBalance[];
}

export interface TenantBalance {
  tenantSlug: string;
  tenantName: string;
  totalActivo: number;
  totalPasivo: number;
  totalPatrimonio: number;
}

export interface ConsolidatedPnL {
  groupId: string;
  groupName: string;
  periodo: { anho: number; mes: number };
  tipo: string;
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  utilidadBruta: number;
  utilidadNeta: number;
  tenants: TenantPnL[];
}

export interface TenantPnL {
  tenantSlug: string;
  tenantName: string;
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  utilidadNeta: number;
}

export interface TenantGroup {
  id: string;
  name: string;
  description?: string;
  ownerTenantSlug: string;
  isActive: boolean;
  memberCount: number;
}

export interface TenantGroupMember {
  id: string;
  groupId: string;
  tenantSlug: string;
  roleInGroup: string;
  tenantName?: string;
  joinedAt: Date;
  isActive: boolean;
}

// ─── Group Management ───────────────────────────



/**
 * Crea un nuevo grupo de tenants.
 *
 * @param input - Datos del grupo
 * @returns El grupo creado
 */
export async function createTenantGroup(input: {
  name: string;
  description?: string;
  ownerTenantSlug: string;
}): Promise<TenantGroup> {
  const id = `tg-${input.ownerTenantSlug}-${Date.now()}`;

  await db().execute(
    sql`INSERT INTO tenant_groups (id, name, description, owner_tenant_slug, is_active, created_at, updated_at)
        VALUES (${id}, ${input.name}, ${input.description ?? null}, ${input.ownerTenantSlug}, TRUE, NOW(), NOW())`,
  );

  // Auto-add owner as member with OWNER role
  const memberId = `tgm-${id}-${input.ownerTenantSlug}`;
  await db().execute(
    sql`INSERT INTO tenant_group_members (id, group_id, tenant_slug, role_in_group, joined_at, is_active)
        VALUES (${memberId}, ${id}, ${input.ownerTenantSlug}, 'OWNER', NOW(), TRUE)
        ON CONFLICT (group_id, tenant_slug) DO UPDATE SET role_in_group = 'OWNER'`,
  );

  return {
    id,
    name: input.name,
    description: input.description,
    ownerTenantSlug: input.ownerTenantSlug,
    isActive: true,
    memberCount: 1,
  };
}

/**
 * Agrega un miembro a un grupo de tenants.
 *
 * @param input - Datos del miembro
 * @returns El miembro creado
 */
export async function addTenantGroupMember(input: {
  groupId: string;
  tenantSlug: string;
  roleInGroup: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}): Promise<TenantGroupMember | null> {
  // Verificar que el grupo existe
  const groupResult = await db().execute(
    sql`SELECT id FROM tenant_groups WHERE id = ${input.groupId} AND is_active = TRUE`,
  );

  if (!groupResult || groupResult.length === 0) {
    return null;
  }

  const id = `tgm-${input.groupId}-${input.tenantSlug}`;

  await db().execute(
    sql`INSERT INTO tenant_group_members (id, group_id, tenant_slug, role_in_group, joined_at, is_active)
        VALUES (${id}, ${input.groupId}, ${input.tenantSlug}, ${input.roleInGroup}, NOW(), TRUE)
        ON CONFLICT (group_id, tenant_slug) DO UPDATE
          SET role_in_group = ${input.roleInGroup}, is_active = TRUE`,
  );

  return {
    id,
    groupId: input.groupId,
    tenantSlug: input.tenantSlug,
    roleInGroup: input.roleInGroup,
    joinedAt: new Date(),
    isActive: true,
  };
}

/**
 * Lista los grupos de un tenant (como owner o miembro).
 *
 * @param tenantSlug - Slug del tenant
 * @returns Lista de grupos
 */
export async function listTenantGroups(
  tenantSlug: string,
): Promise<TenantGroup[]> {
  const rows = await db().execute(
    sql`SELECT tg.*, 
        (SELECT COUNT(*) FROM tenant_group_members WHERE group_id = tg.id AND is_active = TRUE) as member_count
        FROM tenant_groups tg
        WHERE tg.owner_tenant_slug = ${tenantSlug}
           OR tg.id IN (SELECT group_id FROM tenant_group_members WHERE tenant_slug = ${tenantSlug} AND is_active = TRUE)
        ORDER BY tg.name`,
  );

  return (rows ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    ownerTenantSlug: r.owner_tenant_slug,
    isActive: r.is_active,
    memberCount: Number(r.member_count ?? 0),
  }));
}

/**
 * Lista los miembros de un grupo.
 *
 * @param groupId - ID del grupo
 * @returns Lista de miembros
 */
export async function listTenantGroupMembers(
  groupId: string,
): Promise<TenantGroupMember[]> {
  const rows = await db().execute(
    sql`SELECT tgm.*, t.name as tenant_name
        FROM tenant_group_members tgm
        LEFT JOIN tenants t ON t.slug = tgm.tenant_slug
        WHERE tgm.group_id = ${groupId} AND tgm.is_active = TRUE
        ORDER BY tgm.role_in_group, tgm.joined_at`,
  );

  return (rows ?? []).map((r: any) => ({
    id: r.id,
    groupId: r.group_id,
    tenantSlug: r.tenant_slug,
    roleInGroup: r.role_in_group,
    tenantName: r.tenant_name,
    joinedAt: new Date(r.joined_at),
    isActive: r.is_active,
  }));
}

// ─── Consolidated Reports ──────────────────────

/**
 * Obtiene los slugs de todos los tenants activos en un grupo.
 */
async function getTenantSlugsFromGroup(groupId: string): Promise<string[]> {
  const rows = await db().execute(
    sql`SELECT tenant_slug FROM tenant_group_members
        WHERE group_id = ${groupId} AND is_active = TRUE AND role_in_group != 'VIEWER'`,
  );
  return (rows ?? []).map((r: any) => r.tenant_slug);
}

/**
 * Obtiene el nombre de un tenant por su slug.
 */
async function getTenantName(slug: string): Promise<string> {
  const rows = await db().execute(
    sql`SELECT name FROM tenants WHERE slug = ${slug} LIMIT 1`,
  );
  return (rows?.[0] as any)?.name ?? slug;
}

/**
 * Genera un Balance General Consolidado para un grupo de tenants.
 *
 * Suma los activos, pasivos y patrimonios de todos los talleres del grupo.
 *
 * @param groupId - ID del grupo de tenants
 * @param anho - Año fiscal
 * @param mes - Mes (1-12)
 * @returns Balance consolidado
 */
export async function getConsolidatedBalance(
  groupId: string,
  anho: number,
  mes: number,
): Promise<ConsolidatedBalance> {
  // Obtener datos del grupo
  const groupRows = await db().execute(
    sql`SELECT name FROM tenant_groups WHERE id = ${groupId}`,
  );

  if (!groupRows || groupRows.length === 0) {
    throw new Error(`Grupo de tenants ${groupId} no encontrado`);
  }

  const groupName = (groupRows[0] as any).name as string;
  const tenantSlugs = await getTenantSlugsFromGroup(groupId);

  if (tenantSlugs.length === 0) {
    return {
      groupId,
      groupName,
      periodo: { anho, mes },
      tipo: "CONSOLIDADO",
      totalActivo: 0,
      totalPasivo: 0,
      totalPatrimonio: 0,
      diferencia: 0,
      balanceado: true,
      tenants: [],
    };
  }

  // Obtener balance de cada tenant
  const { getBalanceGeneral } = await import("./balance.service.js");
  const tenantsBalance: TenantBalance[] = [];

  for (const slug of tenantSlugs) {
    try {
      const balance = await getBalanceGeneral(
        new Date(anho, mes, 1).toISOString(),
      );

      if (balance && Math.abs(balance.diferencia) < 1) {
        const tenantName = await getTenantName(slug);
        const patrimonioTotal = balance.patrimonio?.total ?? 0;
        tenantsBalance.push({
          tenantSlug: slug,
          tenantName,
          totalActivo: balance.totalActivo,
          totalPasivo: balance.totalPasivoPatrimonio - patrimonioTotal,
          totalPatrimonio: patrimonioTotal,
        });
      }
    } catch (err) {
      console.warn(`[consolidated] Error obteniendo balance de ${slug}:`, err);
    }
  }

  const totalActivo = tenantsBalance.reduce((s, t) => s + t.totalActivo, 0);
  const totalPasivo = tenantsBalance.reduce((s, t) => s + t.totalPasivo, 0);
  const totalPatrimonio = tenantsBalance.reduce((s, t) => s + t.totalPatrimonio, 0);
  const totalPasivoPatrimonio = totalPasivo + totalPatrimonio;
  const diferencia = Math.round((totalActivo - totalPasivoPatrimonio) * 100) / 100;

  // Cachear snapshot
  await cacheConsolidatedSnapshot(groupId, "BALANCE", anho, mes, {
    totalActivo, totalPasivo, totalPatrimonio, tenants: tenantsBalance,
  });

  return {
    groupId,
    groupName,
    periodo: { anho, mes },
    tipo: "CONSOLIDADO",
    totalActivo: Math.round(totalActivo * 100) / 100,
    totalPasivo: Math.round(totalPasivo * 100) / 100,
    totalPatrimonio: Math.round(totalPatrimonio * 100) / 100,
    diferencia,
    balanceado: Math.abs(diferencia) < 1,
    tenants: tenantsBalance,
  };
}

/**
 * Genera un Estado de Resultados Consolidado para un grupo de tenants.
 *
 * Suma ingresos, costos y gastos de todos los talleres del grupo.
 *
 * @param groupId - ID del grupo de tenants
 * @param anho - Año fiscal
 * @param mes - Mes (1-12)
 * @param acumulado - Si true, calcula desde inicio del año
 * @returns P&L consolidado
 */
export async function getConsolidatedPnL(
  groupId: string,
  anho: number,
  mes: number,
  acumulado = false,
): Promise<ConsolidatedPnL> {
  const groupRows2 = await db().execute(
    sql`SELECT name FROM tenant_groups WHERE id = ${groupId}`,
  );

  if (!groupRows2 || groupRows2.length === 0) {
    throw new Error(`Grupo de tenants ${groupId} no encontrado`);
  }

  const groupName = (groupRows2[0] as any).name as string;
  const tenantSlugs = await getTenantSlugsFromGroup(groupId);

  if (tenantSlugs.length === 0) {
    return {
      groupId,
      groupName,
      periodo: { anho, mes },
      tipo: "CONSOLIDADO",
      totalIngresos: 0, totalCostos: 0, totalGastos: 0,
      utilidadBruta: 0, utilidadNeta: 0,
      tenants: [],
    };
  }

  const { getEstadoResultados } = await import("./pnl.service.js");
  const tenantsPnL: TenantPnL[] = [];

  for (const slug of tenantSlugs) {
    try {
      const pnl = await getEstadoResultados(anho, mes, acumulado);
      if (pnl) {
        const tenantName = await getTenantName(slug);
        tenantsPnL.push({
          tenantSlug: slug,
          tenantName,
          totalIngresos: pnl.ingresos.total,
          totalCostos: pnl.costos.total,
          totalGastos: pnl.gastos.total,
          utilidadNeta: pnl.utilidadNeta,
        });
      }
    } catch (err) {
      console.warn(`[consolidated] Error obteniendo P&L de ${slug}:`, err);
    }
  }

  const totalIngresos = tenantsPnL.reduce((s, t) => s + t.totalIngresos, 0);
  const totalCostos = tenantsPnL.reduce((s, t) => s + t.totalCostos, 0);
  const totalGastos = tenantsPnL.reduce((s, t) => s + t.totalGastos, 0);
  const utilidadBruta = Math.round((totalIngresos - totalCostos) * 100) / 100;
  const utilidadNeta = Math.round((utilidadBruta - totalGastos) * 100) / 100;

  await cacheConsolidatedSnapshot(groupId, "PNL", anho, mes, {
    totalIngresos, totalCostos, totalGastos, utilidadBruta, utilidadNeta,
    tenants: tenantsPnL,
  });

  return {
    groupId,
    groupName,
    periodo: { anho, mes },
    tipo: "CONSOLIDADO",
    totalIngresos: Math.round(totalIngresos * 100) / 100,
    totalCostos: Math.round(totalCostos * 100) / 100,
    totalGastos: Math.round(totalGastos * 100) / 100,
    utilidadBruta: Math.round(utilidadBruta * 100) / 100,
    utilidadNeta: Math.round(utilidadNeta * 100) / 100,
    tenants: tenantsPnL,
  };
}

// ─── Cache ──────────────────────────────────────

/**
 * Guarda un snapshot consolidado en caché.
 */
async function cacheConsolidatedSnapshot(
  groupId: string,
  reportType: string,
  anho: number,
  mes: number,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const id = `crs-${groupId}-${reportType}-${anho}-${mes}`;

  await db().execute(
    sql`INSERT INTO consolidated_report_snapshots (id, group_id, report_type, period_anho, period_mes, snapshot_data, created_at)
        VALUES (${id}, ${groupId}, ${reportType}, ${anho}, ${mes}, ${JSON.stringify(data)}::jsonb, NOW())
        ON CONFLICT (group_id, report_type, period_anho, period_mes)
        DO UPDATE SET snapshot_data = ${JSON.stringify(data)}::jsonb, created_at = NOW()`,
  );
  } catch (err) {
    console.warn("[consolidated] Error caching snapshot:", err);
  }
}

/**
 * Obtiene un snapshot consolidado previamente cacheado.
 *
 * @param groupId - ID del grupo
 * @param reportType - Tipo de reporte
 * @param anho - Año
 * @param mes - Mes
 * @returns Datos del snapshot o null
 */
export async function getCachedConsolidatedSnapshot(
  groupId: string,
  reportType: string,
  anho: number,
  mes: number,
): Promise<Record<string, unknown> | null> {
  try {
    const rows = await db().execute(
      sql`SELECT snapshot_data FROM consolidated_report_snapshots
          WHERE group_id = ${groupId} AND report_type = ${reportType} AND period_anho = ${anho} AND period_mes = ${mes}`,
    );
    const row = rows?.[0] as Record<string, unknown> | undefined;
    return (row?.snapshot_data as Record<string, unknown> | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Elimina un miembro de un grupo.
 *
 * @param groupId - ID del grupo
 * @param tenantSlug - Slug del tenant a remover
 * @returns true si se eliminó correctamente
 */
export async function removeTenantGroupMember(
  groupId: string,
  tenantSlug: string,
): Promise<boolean> {
  const updateResult = await db().execute(
    sql`UPDATE tenant_group_members SET is_active = FALSE
        WHERE group_id = ${groupId} AND tenant_slug = ${tenantSlug}
        RETURNING id`,
  );
  return updateResult !== null && (updateResult as any[])?.length > 0;
}

/**
 * Desactiva un grupo de tenants.
 *
 * @param groupId - ID del grupo
 * @returns true si se desactivó correctamente
 */
export async function deactivateTenantGroup(
  groupId: string,
): Promise<boolean> {
  const deactivateResult = await db().execute(
    sql`UPDATE tenant_groups SET is_active = FALSE, updated_at = NOW()
        WHERE id = ${groupId}
        RETURNING id`,
  );
  return deactivateResult !== null && deactivateResult.length > 0;
}
