/**
 * Loyalty Program Service — customer rewards and points.
 *
 * Manages loyalty points, rewards, and customer retention programs.
 *
 * @module marketing/services/loyalty.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface LoyaltyAccount {
  clienteId: string;
  clienteNombre: string;
  puntosActuales: number;
  puntosGanadosTotal: number;
  nivel: "BRONCE" | "PLATA" | "ORO" | "PLATINO";
}

export interface LoyaltyTransaction {
  id: string;
  clienteId: string;
  tipo: "GANADO" | "CANJEADO" | "EXPIRADO";
  puntos: number;
  descripcion: string;
  fecha: string;
}

export interface Reward {
  id: string;
  nombre: string;
  descripcion: string;
  puntosRequeridos: number;
  activo: boolean;
}

// ─── Points Functions ─────────────────────────

/**
 * Adds loyalty points to a customer account.
 */
export async function addPoints(
  clienteId: string,
  puntos: number,
  descripcion: string,
  tenantSlug: string,
): Promise<void> {
  await db().execute(sql`
    INSERT INTO loyalty_transactions (cliente_id, tipo, puntos, descripcion, tenant_slug)
    VALUES (${clienteId}, 'GANADO', ${puntos}, ${descripcion}, ${tenantSlug})
  `);

  // Update or create loyalty account
  await db().execute(sql`
    INSERT INTO loyalty_accounts (cliente_id, puntos_actuales, puntos_ganados_total, nivel, tenant_slug)
    VALUES (${clienteId}, ${puntos}, ${puntos}, 'BRONCE', ${tenantSlug})
    ON CONFLICT (cliente_id, tenant_slug)
    DO UPDATE SET
      puntos_actuales = loyalty_accounts.puntos_actuales + ${puntos},
      puntos_ganados_total = loyalty_accounts.puntos_ganados_total + ${puntos}
  `);
}

/**
 * Gets loyalty account for a customer.
 */
export async function getLoyaltyAccount(
  clienteId: string,
  tenantSlug: string,
): Promise<LoyaltyAccount | null> {
  const result = await db().execute(sql`
    SELECT la.*, c.name as cliente_nombre
    FROM loyalty_accounts la
    JOIN clients c ON c.id = la.cliente_id
    WHERE la.cliente_id = ${clienteId} AND la.tenant_slug = ${tenantSlug}
  `);

  const row = result.rows[0] as any;
  if (!row) return null;

  return {
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre,
    puntosActuales: row.puntos_actuales,
    puntosGanadosTotal: row.puntos_ganados_total,
    nivel: row.nivel,
  };
}

/**
 * Gets available rewards.
 */
export async function getRewards(tenantSlug: string): Promise<Reward[]> {
  const result = await db().execute(sql`
    SELECT id, nombre, descripcion, puntos_requeridos, activo
    FROM loyalty_rewards
    WHERE tenant_slug = ${tenantSlug} AND activo = true
    ORDER BY puntos_requeridos
  `);

  return result.rows.map((row: any) => ({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    puntosRequeridos: row.puntos_requeridos,
    activo: row.activo,
  }));
}
