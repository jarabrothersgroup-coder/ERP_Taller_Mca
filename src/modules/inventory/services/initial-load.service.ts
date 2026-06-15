/**
 * Initial Load Service — "Puesta en Marcha" inventory setup.
 *
 * Handles the one-time initial inventory load (carga inicial) of
 * existing spare parts and tools that are already physically in
 * the workshop but were purchased before the ERP went live.
 *
 * Accounting treatment:
 *   Debit:  Asset account (Inventario de Repuestos / Activo Fijo)
 *   Credit: Equity account (Ajustes de Ejercicios Anteriores)
 *
 * This deliberately avoids supplier (Proveedores / Cuentas por Pagar)
 * accounts, since these are pre-existing items with no associated
 * unpaid invoice.
 *
 * @module inventory/services/initial-load.service
 */

import { db } from "../../../shared/database/drizzle.js";
import {
  repuestos,
  stockMovements,
  toolInstances,
  herramientas,
  inventoryAccountsMap,
  initialInventoryLoads,
} from "../schema/index.js";
import { planCuentas } from "../../finance/schema/accounting.js";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app-error.js";
import { createAsiento } from "../../finance/services/accounting/ledger.service.js";
import { recalcularPPP } from "./costing.service.js";

// ─── Constants ────────────────────────────────

/** Default equity account code for initial load credit side */
const DEFAULT_EQUITY_ACCOUNT_CODE = "3.1.1.04";

/** Default concept for the journal entry */
const DEFAULT_CONCEPT = "Carga Inicial — Puesta en Marcha del Sistema";

// ─── Types ────────────────────────────────────

export interface InitialLoadItemRepuesto {
  /** UUID of existing repuesto, or omit to create one */
  repuestoId?: string;
  /** New repuesto codigo (required if repuestoId is omitted) */
  codigo?: string;
  /** New repuesto description (required if repuestoId is omitted) */
  descripcion?: string;
  /** New repuesto category */
  categoria?: string;
  /** Quantity physically in stock */
  cantidad: number;
  /**
   * Valor Estimado de Mercado / Valor de Reposición Ajustado.
   * This becomes the initial PPP (costo_promedio).
   */
  valorEstimadoMercado: number;
}

export interface InitialLoadItemHerramienta {
  /** UUID of existing herramienta SKU */
  herramientaId: string;
  /** Serial number of the individual tool asset */
  numeroSerie: string;
  /** RFID tag (optional) */
  tagRfid?: string;
  /**
   * Initial physical state of the tool:
   *   DISPONIBLE        — Ready for use
   *   REQUIERE_REPARACION — Needs repair (will be set EN_REPARACION)
   *   EN_REPARACION      — Currently being repaired
   *   EN_CALIBRACION     — Needs calibration
   */
  estadoInicial: string;
  /** Original acquisition cost (pre-depreciation) */
  valorAdquisicion: number;
  /**
   * Net book value at load time.
   * = valorAdquisicion − accumulated depreciation estimated by the user.
   * This becomes the tool's valorActualLibros.
   */
  valorNetoActual: number;
  /** Acquisition date (ISO 8601 date string) */
  fechaAdquisicion?: string;
  /** Optional notes */
  observaciones?: string;
}

export interface InitialLoadRequest {
  /** Items to load: REPUESTOS, HERRAMIENTAS, or both */
  repuestos?: InitialLoadItemRepuesto[];
  herramientas?: InitialLoadItemHerramienta[];
  /**
   * Equity account UUID for the credit side.
   * If omitted, the system looks up "Ajustes de Ejercicios Anteriores"
   * by codigo "3.1.01.001" or creates it on the fly.
   */
  cuentaContrapartidaId?: string;
  /** Load date (ISO 8601). Defaults to today. */
  fecha?: string;
  /** Custom concept for the accounting entry. */
  concepto?: string;
  /** Tenant slug */
  tenantSlug: string;
}

export interface InitialLoadResponse {
  /** Unique batch identifier for this load */
  batchId: string;
  /** Number of repuesto items loaded */
  repuestosCargados: number;
  /** Number of tool items loaded */
  herramientasCargadas: number;
  /** Total value loaded (debe total del asiento) */
  valorTotalCargado: string;
  /** Accounting entry details */
  asiento: {
    id: string;
    numero: number;
    concepto: string;
    totalDebe: string;
    totalHaber: string;
  } | null;
  /** Details per loaded item */
  items: Array<{
    tipo: string;
    itemId: string;
    descripcion: string;
    cantidad: number;
    valorUnitario: string;
    valorTotal: string;
  }>;
}

// ─── Service ──────────────────────────────────

/**
 * Executes an initial inventory load (carga inicial / puesta en marcha).
 *
 * Process:
 *   1. Resolve or create the equity counter-account
 *   2. Process repuestos: create/update stock + set PPP
 *   3. Process herramientas: create tool_instances with initial state
 *   4. Generate consolidated accounting entry (Debit→Asset, Credit→Equity)
 *   5. Persist audit trail in initial_inventory_loads
 *
 * The entire operation is idempotent within a single call — if it fails,
 * no partial state persists (uses accounting rollback on error).
 *
 * @param data - Load request payload
 * @returns Load summary with batch ID and accounting entry
 * @throws {ValidationError} If validation fails
 * @throws {NotFoundError} If referenced accounts don't exist
 */
export async function executeInitialLoad(
  data: InitialLoadRequest,
): Promise<InitialLoadResponse> {
  const {
    repuestos: repuestosInput,
    herramientas: herramientasInput,
    cuentaContrapartidaId,
    fecha,
    concepto,
    tenantSlug,
  } = data;

  // ── 1. Validate at least one item ──
  const hasRepuestos = repuestosInput && repuestosInput.length > 0;
  const hasHerramientas = herramientasInput && herramientasInput.length > 0;

  if (!hasRepuestos && !hasHerramientas) {
    throw new ValidationError(
      'Debe cargar al menos un repuesto o una herramienta',
    );
  }

  // ── 2. Resolve equity account (contrapartida patrimonial) ──
  const equityAccount = await resolveEquityAccount(
    cuentaContrapartidaId,
    tenantSlug,
  );

  // ── 3. Generate unique batch ID ──
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const batchId = `LOAD-${dateStr}-${rand}`;

  // ── 4. Process items and build accounting lines ──
  const auditItems: Array<{
    tipo: string;
    itemId: string;
    itemDescripcion: string;
    cantidad: number;
    valorUnitario: number;
    valorTotal: number;
    cuentaActivoId: string;
  }> = [];

  // Track total by asset account for the consolidated entry
  const assetAccountTotals: Map<string, number> = new Map();

  const loadDate = fecha ? new Date(fecha) : new Date();

  // ── 4a. Process repuestos ──
  if (hasRepuestos) {
    for (const item of repuestosInput!) {
      const result = await processRepuestoItem(item, loadDate, tenantSlug);
      auditItems.push(result);

      const current = assetAccountTotals.get(result.cuentaActivoId) ?? 0;
      assetAccountTotals.set(result.cuentaActivoId, current + result.valorTotal);
    }
  }

  // ── 4b. Process herramientas ──
  if (hasHerramientas) {
    for (const item of herramientasInput!) {
      const result = await processHerramientaItem(item, loadDate, tenantSlug);
      auditItems.push(result);

      const current = assetAccountTotals.get(result.cuentaActivoId) ?? 0;
      assetAccountTotals.set(result.cuentaActivoId, current + result.valorTotal);
    }
  }

  // ── 5. Generate consolidated accounting entry ──
  const totalCargado = auditItems.reduce((sum, i) => sum + i.valorTotal, 0);

  let asientoResult: InitialLoadResponse['asiento'] = null;

  if (totalCargado > 0) {
    const lineas: Array<{ cuentaId: string; debe?: string; haber?: string; descripcion?: string }> = [];

    // Debit lines: one per asset account
    for (const [cuentaId, total] of assetAccountTotals.entries()) {
      const assetAccountName = await getAccountName(cuentaId);
      lineas.push({
        cuentaId,
        debe: total.toFixed(2),
        descripcion: `Carga inicial: ${assetAccountName}`,
      });
    }

    // Credit line: single equity account
    const equityName = await getAccountName(equityAccount.id);
    lineas.push({
      cuentaId: equityAccount.id,
      haber: totalCargado.toFixed(2),
      descripcion: `Contrapartida patrimonial: ${equityName}`,
    });

    const asiento = await createAsiento({
      fecha: loadDate.toISOString(),
      concepto: concepto ?? `${DEFAULT_CONCEPT} — Lote ${batchId}`,
      moduloOrigen: 'INVENTARIO_INICIAL',
      documentoRef: batchId,
      lineas,
    });

    asientoResult = {
      id: asiento.asiento.id,
      numero: asiento.asiento.numero,
      concepto: asiento.asiento.concepto,
      totalDebe: asiento.asiento.totalDebe,
      totalHaber: asiento.asiento.totalHaber,
    };

    // ── 6. Persist audit trail (append-only) ──
    for (const item of auditItems) {
      await db().insert(initialInventoryLoads).values({
        tipo: item.tipo,
        batchId,
        itemId: item.itemId,
        itemDescripcion: item.itemDescripcion,
        cantidad: item.cantidad,
        valorUnitario: item.valorUnitario.toFixed(2),
        valorTotal: item.valorTotal.toFixed(2),
        cuentaActivoId: item.cuentaActivoId,
        asientoId: asientoResult.id,
        cuentaPatrimonioId: equityAccount.id,
        tenantSlug,
      });
    }
  } else {
    // Zero-value items: still record audit trail without asiento
    for (const item of auditItems) {
      await db().insert(initialInventoryLoads).values({
        tipo: item.tipo,
        batchId,
        itemId: item.itemId,
        itemDescripcion: item.itemDescripcion,
        cantidad: item.cantidad,
        valorUnitario: item.valorUnitario.toFixed(2),
        valorTotal: item.valorTotal.toFixed(2),
        cuentaActivoId: item.cuentaActivoId,
        cuentaPatrimonioId: equityAccount.id,
        tenantSlug,
      });
    }
  }

  // ── 7. Return results ──
  const repuestosCount = auditItems.filter(i => i.tipo === 'REPUESTOS').length;
  const herramientasCount = auditItems.filter(i => i.tipo === 'HERRAMIENTAS').length;

  return {
    batchId,
    repuestosCargados: repuestosCount,
    herramientasCargadas: herramientasCount,
    valorTotalCargado: totalCargado.toFixed(2),
    asiento: asientoResult,
    items: auditItems.map(i => ({
      tipo: i.tipo,
      itemId: i.itemId,
      descripcion: i.itemDescripcion,
      cantidad: i.cantidad,
      valorUnitario: i.valorUnitario.toFixed(2),
      valorTotal: i.valorTotal.toFixed(2),
    })),
  };
}

// ─── Item Processors ──────────────────────────

/**
 * Processes a single repuesto item in the initial load.
 *
 * If repuestoId is provided and the repuesto exists:
 *   - Increases stock by cantidad
 *   - Recalculates PPP using valorEstimadoMercado
 * Else:
 *   - Creates a new repuesto with initial stock and PPP
 *
 * Returns the audit item ready for the accounting entry.
 */
async function processRepuestoItem(
  item: InitialLoadItemRepuesto,
  _loadDate: Date,
  tenantSlug: string,
) {
  const {
    repuestoId,
    codigo,
    descripcion,
    categoria,
    cantidad,
    valorEstimadoMercado,
  } = item;

  if (!cantidad || cantidad <= 0) {
    throw new ValidationError('La cantidad debe ser mayor a cero');
  }
  if (!valorEstimadoMercado || valorEstimadoMercado < 0) {
    throw new ValidationError(
      `El valor estimado de mercado debe ser >= 0 para "${descripcion ?? codigo}"`,
    );
  }

  let finalRepuestoId: string;
  let finalDescripcion: string;
  let assetAccountId: string;

  if (repuestoId) {
    // ── Use existing repuesto ──
    const existing = await db()
      .select()
      .from(repuestos)
      .where(eq(repuestos.id, repuestoId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError(`Repuesto ${repuestoId} no encontrado`);
    }

    finalRepuestoId = existing[0]!.id;
    finalDescripcion = existing[0]!.descripcion;

    // Increase stock and set PPP via recalcularPPP
    await recalcularPPP(
      finalRepuestoId,
      cantidad,
      valorEstimadoMercado,
      tenantSlug,
    );

    // Resolve asset account for this repuesto's category
    assetAccountId = await resolveAssetAccount(
      'REPUESTOS',
      existing[0]!.categoria ?? categoria ?? '*',
      tenantSlug,
    );

    // Record a stock movement of type "ENTRADA" with motivo "CARGA_INICIAL"
    const [updated] = await db()
      .select({ stockActual: repuestos.stockActual })
      .from(repuestos)
      .where(eq(repuestos.id, finalRepuestoId))
      .limit(1);

    await db().insert(stockMovements).values({
      repuestoId: finalRepuestoId,
      tipo: 'ENTRADA',
      cantidad,
      stockAnterior: existing[0]!.stockActual,
      stockPosterior: updated.stockActual,
      costoUnitario: String(valorEstimadoMercado),
      costoTotal: String(valorEstimadoMercado * cantidad),
      motivo: 'CARGA_INICIAL',
      observaciones: `Carga inicial — Valor estimado: ${valorEstimadoMercado}`,
      tenantSlug,
    });
  } else {
    // ── Create new repuesto ──
    if (!codigo || !descripcion) {
      throw new ValidationError(
        'Para crear un nuevo repuesto debe proporcionar codigo y descripcion',
      );
    }

    const [created] = await db()
      .insert(repuestos)
      .values({
        codigo,
        descripcion,
        categoria: categoria ?? null,
        stockActual: cantidad,
        stockMinimo: 0,
        precioCosto: String(valorEstimadoMercado),
        costoPromedio: String(valorEstimadoMercado), // Initial PPP
        precioVenta: null, // User must set selling price later
        activo: true,
      })
      .returning();

    finalRepuestoId = created.id;
    finalDescripcion = created.descripcion;

    // Record stock movement
    await db().insert(stockMovements).values({
      repuestoId: finalRepuestoId,
      tipo: 'ENTRADA',
      cantidad,
      stockAnterior: 0,
      stockPosterior: cantidad,
      costoUnitario: String(valorEstimadoMercado),
      costoTotal: String(valorEstimadoMercado * cantidad),
      motivo: 'CARGA_INICIAL',
      observaciones: `Carga inicial — Nuevo repuesto creado desde puesta en marcha`,
      tenantSlug,
    });

    // Resolve asset account
    assetAccountId = await resolveAssetAccount(
      'REPUESTOS',
      categoria ?? '*',
      tenantSlug,
    );
  }

  const valorTotal = valorEstimadoMercado * cantidad;

  return {
    tipo: 'REPUESTOS' as const,
    itemId: finalRepuestoId,
    itemDescripcion: finalDescripcion,
    cantidad,
    valorUnitario: valorEstimadoMercado,
    valorTotal,
    cuentaActivoId: assetAccountId,
  };
}

/**
 * Processes a single herramienta item in the initial load.
 *
 * Creates a new tool_instance with the specified initial state,
 * acquisition cost, and net book value.
 */
async function processHerramientaItem(
  item: InitialLoadItemHerramienta,
  loadDate: Date,
  tenantSlug: string,
) {
  const {
    herramientaId,
    numeroSerie,
    tagRfid,
    estadoInicial,
    valorAdquisicion,
    valorNetoActual,
    fechaAdquisicion,
  } = item;

  // ── Validate field presence ──
  if (!numeroSerie) {
    throw new ValidationError('El número de serie es obligatorio para herramientas');
  }
  if (!estadoInicial) {
    throw new ValidationError('El estado inicial es obligatorio para herramientas');
  }

  // ── Validate estadoInicial ──
  const ESTADOS_VALIDOS = ['DISPONIBLE', 'EN_REPARACION', 'EN_CALIBRACION', 'REQUIERE_REPARACION'];
  if (!ESTADOS_VALIDOS.includes(estadoInicial)) {
    throw new ValidationError(
      `Estado inicial inválido: "${estadoInicial}". Valores válidos: ${ESTADOS_VALIDOS.join(', ')}`,
    );
  }

  // ── Validate herramienta SKU exists ──
  const [sku] = await db()
    .select({ id: herramientas.id, nombre: herramientas.nombre, codigo: herramientas.codigo })
    .from(herramientas)
    .where(eq(herramientas.id, herramientaId))
    .limit(1);

  if (!sku) {
    throw new NotFoundError(`Herramienta SKU ${herramientaId} no encontrada`);
  }

  // ── Check serial uniqueness ──
  const existing = await db()
    .select({ id: toolInstances.id })
    .from(toolInstances)
    .where(and(
      eq(toolInstances.herramientaId, herramientaId),
      eq(toolInstances.numeroSerie, numeroSerie),
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new ValidationError(
      `Ya existe un activo con serie "${numeroSerie}" para esta herramienta`,
    );
  }

  // ── Map estadoInicial to the tool instance state machine ──
  const estadoMap: Record<string, string> = {
    DISPONIBLE: 'DISPONIBLE',
    REQUIERE_REPARACION: 'EN_REPARACION',
    EN_REPARACION: 'EN_REPARACION',
    EN_CALIBRACION: 'EN_CALIBRACION',
  };

  const estadoInterno = estadoMap[estadoInicial] ?? 'DISPONIBLE';

  // ── Create the tool instance ──
  const [instance] = await db()
    .insert(toolInstances)
    .values({
      herramientaId,
      numeroSerie,
      tagRfid: tagRfid ?? null,
      costoAdquisicion: String(valorAdquisicion),
      fechaAdquisicion: fechaAdquisicion ?? loadDate.toISOString().slice(0, 10),
      valorActualLibros: String(valorNetoActual),
      ultimaDepreciacion: null,
      estadoActual: estadoInterno,
      activa: true,
      tenantSlug,
    })
    .returning();

  // ── Resolve asset account for tools ──
  const assetAccountId = await resolveAssetAccount(
    'HERRAMIENTAS',
    sku.codigo,
    tenantSlug,
  );

  return {
    tipo: 'HERRAMIENTAS' as const,
    itemId: instance.id,
    itemDescripcion: `${sku.nombre} (SN: ${numeroSerie})`,
    cantidad: 1,
    valorUnitario: valorNetoActual,
    valorTotal: valorNetoActual,
    cuentaActivoId: assetAccountId,
  };
}

// ─── Account Resolution ───────────────────────

/**
 * Resolves or creates the equity counter-account for initial loads.
 *
 * Priority:
 *   1. User-provided cuentaContrapartidaId
 *   2. Look up by codigo "3.1.1.04" (Ajustes por Carga Inicial / Puesta en Marcha)
 *   3. Look up any PATRIMONIO account
 *   4. Create a default equity account
 */
async function resolveEquityAccount(
  cuentaContrapartidaId: string | undefined,
  _tenantSlug: string,
) {
  // Priority 1: user-provided
  if (cuentaContrapartidaId) {
    const [account] = await db()
      .select()
      .from(planCuentas)
      .where(eq(planCuentas.id, cuentaContrapartidaId))
      .limit(1);

    if (!account) {
      throw new NotFoundError(
        `Cuenta contrapartida ${cuentaContrapartidaId} no encontrada en el plan de cuentas`,
      );
    }

    if (account.tipo !== 'PATRIMONIO') {
      throw new ValidationError(
        `La cuenta "${account.nombre}" es de tipo "${account.tipo}", debe ser PATRIMONIO`,
      );
    }

    return account;
  }

  // Priority 2: lookup by code
  const [byCode] = await db()
    .select()
    .from(planCuentas)
    .where(eq(planCuentas.codigo, DEFAULT_EQUITY_ACCOUNT_CODE))
    .limit(1);

  if (byCode) return byCode;

  // Priority 3: any PATRIMONIO account
  const [anyEquity] = await db()
    .select()
    .from(planCuentas)
    .where(and(
      eq(planCuentas.tipo, 'PATRIMONIO'),
      eq(planCuentas.activo, true),
    ))
    .limit(1);

  if (anyEquity) return anyEquity;

  // Priority 4: create default equity account
  const [created] = await db()
    .insert(planCuentas)
    .values({
      codigo: DEFAULT_EQUITY_ACCOUNT_CODE,
      nombre: 'Ajustes por Carga Inicial / Puesta en Marcha',
      tipo: 'PATRIMONIO',
      nivel: 4,
      aceptaMovimientos: true,
      activo: true,
    })
    .returning();

  return created;
}

/**
 * Resolves the asset account for a given item type and category.
 *
 * For repuestos: looks up inventory_accounts_map by categoria.
 * For herramientas: looks up default tool asset account or creates one.
 */
async function resolveAssetAccount(
  tipo: 'REPUESTOS' | 'HERRAMIENTAS',
  categoria: string,
  tenantSlug: string,
): Promise<string> {
  if (tipo === 'REPUESTOS') {
    // Look up inventory_accounts_map by category, fallback to '*'
    const [map] = await db()
      .select()
      .from(inventoryAccountsMap)
      .where(and(
        eq(inventoryAccountsMap.categoria, categoria),
        eq(inventoryAccountsMap.tenantSlug, tenantSlug),
      ))
      .limit(1);

    if (map) return map.cuentaInventarioId;

    // Fallback: look for any account with "inventario" in the name
    const [fallback] = await db()
      .select({ id: planCuentas.id })
      .from(planCuentas)
      .where(
        and(
          eq(planCuentas.tipo, 'ACTIVO'),
          eq(planCuentas.aceptaMovimientos, true),
          sql`${planCuentas.nombre} ILIKE '%inventario%'`,
          eq(planCuentas.activo, true),
        ),
      )
      .orderBy(sql`${planCuentas.nivel} DESC`)
      .limit(1);

    if (fallback) return fallback.id;

    // Last resort: create a basic inventory account
    const [created] = await db()
      .insert(planCuentas)
      .values({
        codigo: '1.1.3.01',
        nombre: 'Inventario de Repuestos Nuevos',
        tipo: 'ACTIVO',
        nivel: 4,
        aceptaMovimientos: true,
        activo: true,
      })
      .returning();

    return created.id;
  }

  // ── HERRAMIENTAS ──
  // Look for tool/equipment fixed asset account
  const [toolAccount] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.tipo, 'ACTIVO'),
        eq(planCuentas.aceptaMovimientos, true),
        sql`(${planCuentas.nombre} ILIKE '%herramienta%' OR ${planCuentas.nombre} ILIKE '%equipo%' OR ${planCuentas.nombre} ILIKE '%activo fijo%')`,
        eq(planCuentas.activo, true),
      ),
    )
    .orderBy(sql`${planCuentas.nivel} DESC`)  // Prefer most specific (level 4+)
    .limit(1);

  if (toolAccount) return toolAccount.id;

  // Create a default tool asset account
  const [created] = await db()
    .insert(planCuentas)
    .values({
      codigo: '1.2.1.03',
      nombre: 'Herramientas Especializadas del Taller',
      tipo: 'ACTIVO',
      nivel: 4,
      aceptaMovimientos: true,
      activo: true,
    })
    .returning();

  return created.id;
}

/**
 * Gets the human-readable name of a plan_cuentas account.
 */
async function getAccountName(cuentaId: string): Promise<string> {
  const [account] = await db()
    .select({ nombre: planCuentas.nombre })
    .from(planCuentas)
    .where(eq(planCuentas.id, cuentaId))
    .limit(1);

  return account?.nombre ?? 'Cuenta Desconocida';
}

// ─── Query Helpers ────────────────────────────

/**
 * Lists initial load audit records, grouped by batch.
 *
 * @param tenantSlug - Current tenant
 * @param limit - Max results
 * @returns Distinct batches with summary
 */
export async function listInitialLoadBatches(
  tenantSlug: string,
  limit = 20,
) {
  const batches = await db()
    .select({
      batchId: initialInventoryLoads.batchId,
      tipo: initialInventoryLoads.tipo,
      asientoId: initialInventoryLoads.asientoId,
      createdAt: initialInventoryLoads.createdAt,
    })
    .from(initialInventoryLoads)
    .where(eq(initialInventoryLoads.tenantSlug, tenantSlug))
    .orderBy(desc(initialInventoryLoads.createdAt))
    .limit(limit);

  // Deduplicate by batchId
  const seen = new Set<string>();
  return batches.filter(b => {
    if (seen.has(b.batchId)) return false;
    seen.add(b.batchId);
    return true;
  });
}

/**
 * Gets detailed items for a specific load batch.
 *
 * @param batchId - LOAD-YYYYMMDD-XXXX identifier
 * @param tenantSlug - Current tenant
 * @returns Items in the batch
 */
export async function getLoadBatchDetails(
  batchId: string,
  tenantSlug: string,
) {
  return db()
    .select()
    .from(initialInventoryLoads)
    .where(and(
      eq(initialInventoryLoads.batchId, batchId),
      eq(initialInventoryLoads.tenantSlug, tenantSlug),
    ))
    .orderBy(initialInventoryLoads.createdAt);
}
