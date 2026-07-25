/**
 * Fleet Recurring Billing Service — auto-generates invoices for fleet contracts.
 *
 * Finds contracts due for billing, creates factura records,
 * and advances the next invoice date based on billing cycle.
 *
 * @module fleet/services/recurring-billing
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface FleetContractRow {
  id: string;
  fleet_id: string;
  tenant_slug: string;
  nombre: string;
  monto_mensual: string;
  ciclo_facturacion: string;
  dia_cobro: number;
  proxima_factura: string | null;
  estado: string;
  descripcion: string | null;
}

export interface BillingResult {
  contractId: string;
  fleetId: string;
  monto: number;
  facturaId: string;
}

// ─── Contract CRUD ────────────────────────────

/**
 * Creates a new fleet contract.
 */
export async function createContract(
  data: {
    fleetId: string;
    nombre: string;
    montoMensual: number;
    cicloFacturacion?: string;
    diaCobro?: number;
    descripcion?: string;
  },
  tenantSlug: string,
): Promise<FleetContractRow> {
  const nextDate = calculateNextInvoice(data.diaCobro || 1, data.cicloFacturacion || "MENSUAL");
  const rows = await db().execute(sql`
    INSERT INTO fleet_contracts
      (fleet_id, tenant_slug, nombre, monto_mensual, ciclo_facturacion, dia_cobro, proxima_factura, descripcion)
    VALUES
      (${data.fleetId}, ${tenantSlug}, ${data.nombre}, ${String(data.montoMensual)},
       ${data.cicloFacturacion || "MENSUAL"}, ${data.diaCobro || 1},
       ${nextDate}, ${data.descripcion || null})
    RETURNING *
  `);
  return rows[0] as unknown as FleetContractRow;
}

/**
 * Lists all contracts for a tenant.
 */
export async function listContracts(tenantSlug: string): Promise<FleetContractRow[]> {
  const rows = await db().execute(sql`
    SELECT * FROM fleet_contracts
    WHERE tenant_slug = ${tenantSlug}
    ORDER BY created_at DESC
  `);
  return rows as unknown as FleetContractRow[];
}

/**
 * Lists contracts for a specific fleet.
 */
export async function listContractsByFleet(
  fleetId: string,
  tenantSlug: string,
): Promise<FleetContractRow[]> {
  const rows = await db().execute(sql`
    SELECT * FROM fleet_contracts
    WHERE fleet_id = ${fleetId} AND tenant_slug = ${tenantSlug}
    ORDER BY created_at DESC
  `);
  return rows as unknown as FleetContractRow[];
}

/**
 * Updates a fleet contract.
 */
export async function updateContract(
  id: string,
  data: Partial<{
    nombre: string;
    montoMensual: number;
    cicloFacturacion: string;
    diaCobro: number;
    descripcion: string;
  }>,
  tenantSlug: string,
): Promise<FleetContractRow | null> {
  const updates: string[] = [];
  if (data.nombre !== undefined) updates.push(`nombre = '${data.nombre}'`);
  if (data.montoMensual !== undefined) updates.push(`monto_mensual = '${data.montoMensual}'`);
  if (data.cicloFacturacion !== undefined) updates.push(`ciclo_facturacion = '${data.cicloFacturacion}'`);
  if (data.diaCobro !== undefined) updates.push(`dia_cobro = ${data.diaCobro}`);
  if (data.descripcion !== undefined) updates.push(`descripcion = '${data.descripcion}'`);
  updates.push("updated_at = now()");

  if (updates.length === 1) return null;

  const rows = await db().execute(sql.raw(`
    UPDATE fleet_contracts SET ${updates.join(", ")}
    WHERE id = '${id}' AND tenant_slug = '${tenantSlug}'
    RETURNING *
  `));
  return (rows[0] as unknown as FleetContractRow) || null;
}

/**
 * Cancels a fleet contract.
 */
export async function cancelContract(
  id: string,
  tenantSlug: string,
): Promise<boolean> {
  const rows = await db().execute(sql`
    UPDATE fleet_contracts SET estado = 'CANCELADO', updated_at = now()
    WHERE id = ${id} AND tenant_slug = ${tenantSlug}
    RETURNING id
  `);
  return rows.length > 0;
}

// ─── Billing Engine ───────────────────────────

/**
 * Generates monthly invoices for all due fleet contracts.
 */
export async function generateMonthlyInvoices(
  tenantSlug: string,
): Promise<BillingResult[]> {
  const dueContracts = await db().execute(sql`
    SELECT fc.*, f.empresa, f.contacto, f.ruc
    FROM fleet_contracts fc
    JOIN fleets f ON f.id = fc.fleet_id
    WHERE fc.tenant_slug = ${tenantSlug}
      AND fc.estado = 'ACTIVO'
      AND fc.proxima_factura <= now()
  `);

  const results: BillingResult[] = [];

  for (const contract of dueContracts as any[]) {
    try {
      const monto = Number(contract.monto_mensual);
      const dummyOrdenId = "00000000-0000-0000-0000-000000000000";

      const facturaRows = await db().execute(sql`
        INSERT INTO facturas
          (tenant_slug, orden_id, tipo, total, estado_pago, saldo_pendiente, fecha_vencimiento)
        VALUES
          (${tenantSlug}, ${dummyOrdenId}, 'MANUAL', ${String(monto)}, 'PENDIENTE', ${String(monto)},
           ${new Date(Date.now() + 30 * 86400000).toISOString()})
        RETURNING id
      `);

      const facturaId = (facturaRows[0] as any).id;
      const nextDate = calculateNextInvoice(contract.dia_cobro, contract.ciclo_facturacion);

      await db().execute(sql`
        UPDATE fleet_contracts
        SET proxima_factura = ${nextDate}, updated_at = now()
        WHERE id = ${contract.id}
      `);

      results.push({ contractId: contract.id, fleetId: contract.fleet_id, monto, facturaId });
      console.log(`[fleet-billing] Contract ${contract.nombre}: factura ${facturaId} (₲${monto})`);
    } catch (err) {
      console.warn(`[fleet-billing] Error billing contract ${contract.id}:`, err instanceof Error ? err.message : err);
    }
  }

  if (results.length > 0) {
    console.log(`[fleet-billing] Tenant "${tenantSlug}": ${results.length} invoice(s) generated`);
  }
  return results;
}

/**
 * Gets billing statistics for a tenant.
 */
export async function getBillingStats(tenantSlug: string) {
  const rows = await db().execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN estado = 'ACTIVO' THEN 1 END) as active,
      COALESCE(SUM(CASE WHEN estado = 'ACTIVO' THEN monto_mensual ELSE 0 END), 0) as monthly
    FROM fleet_contracts
    WHERE tenant_slug = ${tenantSlug}
  `);
  const row = rows[0] as any;
  return {
    totalContracts: Number(row.total) || 0,
    activeContracts: Number(row.active) || 0,
    monthlyRevenue: Number(row.monthly) || 0,
  };
}

// ─── Helpers ──────────────────────────────────

function calculateNextInvoice(diaCobro: number, ciclo: string): string {
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), diaCobro);
  if (next <= now) {
    if (ciclo === "TRIMESTRAL") next.setMonth(next.getMonth() + 3);
    else if (ciclo === "ANUAL") next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString();
}
