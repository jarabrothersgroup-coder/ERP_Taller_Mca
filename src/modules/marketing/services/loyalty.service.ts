/**
 * Loyalty Program Service — customer rewards and points.
 *
 * Manages loyalty points, rewards, and customer retention programs.
 *
 * Invariante de contabilidad: el saldo de la cuenta SIEMPRE es igual a la suma
 * de `loyalty_transactions.puntos` para ese cliente. Los canjes guardan puntos
 * NEGATIVOS para que el libro sea auditable con un simple SUM, y no hace falta
 * reconciliar signo por tipo.
 *
 * El nivel se calcula sobre `puntos_ganados_total` (acumulado histórico), no
 * sobre el saldo: canjear un premio no degrada al cliente de nivel, que es el
 * comportamiento esperado en un programa de fidelización.
 *
 * @module marketing/services/loyalty.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { withTransaction } from "../../../shared/database/transaction.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export type LoyaltyLevel = "BRONCE" | "PLATA" | "ORO" | "PLATINO";

export interface LoyaltyAccount {
  clienteId: string;
  clienteNombre: string;
  puntosActuales: number;
  puntosGanadosTotal: number;
  nivel: LoyaltyLevel;
}

export interface LoyaltyTransaction {
  id: string;
  clienteId: string;
  tipo: "GANADO" | "CANJEADO" | "EXPIRADO";
  puntos: number;
  descripcion: string | null;
  fecha: string;
}

export interface Reward {
  id: string;
  nombre: string;
  descripcion: string | null;
  puntosRequeridos: number;
  activo: boolean;
}

// ─── Constants ────────────────────────────────

/** Umbrales de nivel sobre puntos acumulados históricos. */
export const NIVEL_POR_PUNTOS: ReadonlyArray<{ nivel: LoyaltyLevel; desde: number }> = [
  { nivel: "PLATINO", desde: 5000 },
  { nivel: "ORO", desde: 2000 },
  { nivel: "PLATA", desde: 500 },
  { nivel: "BRONCE", desde: 0 },
];

/**
 * Expresión SQL del nivel, derivada de {@link NIVEL_POR_PUNTOS} para que los
 * umbrales vivan en un solo sitio.
 */
const NIVEL_SQL = `CASE
${NIVEL_POR_PUNTOS.map(
  (t) => `  WHEN puntos_ganados_total >= ${t.desde} THEN '${t.nivel}'`,
).join("\n")}
END`;

/** Tope de puntos por operación, para que un payload equivocado no borre el saldo. */
const MAX_PUNTOS_POR_OPERACION = 1_000_000;

// ─── Internal helpers ─────────────────────────

/**
 * Verifica que el cliente exista y pertenezca al tenant.
 *
 * Sin esto, acreditar puntos a un `clienteId` de otro tenant crearía una
 * cuenta de fidelización en un taller que no es dueño del cliente: los puntos
 * se sumarían sobre un saldo que el tenant ajeno nunca generó. La FK a
 * `clients(id)` no cubre el tenant porque `id` es global.
 */
async function assertClienteInTenant(clienteId: string, tenantSlug: string): Promise<void> {
  if (!UUID_RE.test(clienteId)) {
    throw new ValidationError("clienteId debe ser un UUID válido");
  }
  const rows = (await db().execute(sql`
    SELECT 1 FROM clients WHERE id = ${clienteId} AND tenant_slug = ${tenantSlug} LIMIT 1
  `)) as unknown as unknown[];
  if (rows.length === 0) {
    throw new NotFoundError("Cliente no encontrado");
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normaliza un `timestamptz` a ISO-8601.
 *
 * El mismo `timestamptz` llega como `Date` por `getDb()` (postgres.js) pero
 * como texto `'2026-09-28 13:03:31.14991+00'` por `db().execute()`, que es la
 * capa que usa este servicio. Asumir `Date` devuelve `null` en silencio, y
 * `new Date()` no parsea un offset `+00` sin minutos.
 */
function toIso(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();

  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})$/.exec(value);
  if (!m) return String(value);
  const offset = m[3] === "+00" || m[3] === "-00" ? "Z" : `${m[3]}:00`;
  const parsed = new Date(`${m[1]}T${m[2]}${offset}`);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function assertPuntos(puntos: number): void {
  if (!Number.isInteger(puntos)) {
    throw new ValidationError("Los puntos deben ser un número entero");
  }
  if (puntos <= 0) {
    throw new ValidationError("Los puntos deben ser mayores a cero");
  }
  if (puntos > MAX_PUNTOS_POR_OPERACION) {
    throw new ValidationError(`Los puntos por operación no pueden superar ${MAX_PUNTOS_POR_OPERACION}`);
  }
}

// ─── Points Functions ─────────────────────────

/**
 * Adds loyalty points to a customer account.
 *
 * Atómico: el asiento del libro y el saldo de la cuenta se escriben en la
 * misma transacción, junto con la recálculo del nivel. Antes eran dos `execute`
 * sueltos, así que un fallo entre ambos dejaba el libro con un asiento sin
 * saldo o, al revés, saldo sin justification.
 *
 * @param clienteId - UUID del cliente (debe pertenecer al tenant)
 * @param puntos - Puntos a acreditar (> 0)
 * @param descripcion - Concepto visible en el historial
 * @param tenantSlug - Tenant dueño de la cuenta
 * @returns La cuenta de fidelización tras acreditar
 * @throws {ValidationError} Si los puntos no son un entero positivo dentro del tope
 * @throws {NotFoundError} Si el cliente no existe en el tenant
 */
export async function addPoints(
  clienteId: string,
  puntos: number,
  descripcion: string,
  tenantSlug: string,
): Promise<LoyaltyAccount> {
  assertPuntos(puntos);
  await assertClienteInTenant(clienteId, tenantSlug);

  return withTransaction(async () => {
    await db().execute(sql`
      INSERT INTO loyalty_transactions (cliente_id, tipo, puntos, descripcion, tenant_slug)
      VALUES (${clienteId}, 'GANADO', ${puntos}, ${descripcion}, ${tenantSlug})
    `);

    await db().execute(sql`
      INSERT INTO loyalty_accounts (cliente_id, puntos_actuales, puntos_ganados_total, nivel, tenant_slug)
      VALUES (${clienteId}, ${puntos}, ${puntos}, 'BRONCE', ${tenantSlug})
      ON CONFLICT (cliente_id, tenant_slug)
      DO UPDATE SET
        puntos_actuales = loyalty_accounts.puntos_actuales + ${puntos},
        puntos_ganados_total = loyalty_accounts.puntos_ganados_total + ${puntos},
        updated_at = now()
    `);

    // El nivel se recalcula en un UPDATE aparte y no dentro del upsert: en un
    // `ON CONFLICT DO UPDATE` una referencia sin calificar lee el valor VIEJO
    // de la fila, así que la expresión tendría que sumar los puntos a mano solo
    // en esa rama. Separatear el paso mantiene una única fuente de verdad.
    await db().execute(sql`
      UPDATE loyalty_accounts
      SET nivel = ${sql.raw(NIVEL_SQL)}, updated_at = now()
      WHERE cliente_id = ${clienteId} AND tenant_slug = ${tenantSlug}
    `);

    return getLoyaltyAccount(clienteId, tenantSlug) as Promise<LoyaltyAccount>;
  });
}

/**
 * Debits points from a customer account (canje manual).
 *
 * Bloquea la fila de la cuenta (`FOR UPDATE`) antes de leer el saldo: sin el
 * bloqueo, dos canjes concurrentes leen el mismo saldo y ambos prosperan,
 * dejando el saldo en negativo.
 *
 * @param clienteId - UUID del cliente (debe pertenecer al tenant)
 * @param puntos - Puntos a debitar (> 0); se registran como negativos en el libro
 * @param descripcion - Concepto visible en el historial
 * @param tenantSlug - Tenant dueño de la cuenta
 * @returns La cuenta de fidelización tras el canje
 * @throws {ValidationError} Si los puntos no son válidos o el saldo es insuficiente
 * @throws {NotFoundError} Si el cliente no existe en el tenant o no tiene cuenta
 */
export async function redeemPoints(
  clienteId: string,
  puntos: number,
  descripcion: string,
  tenantSlug: string,
): Promise<LoyaltyAccount> {
  assertPuntos(puntos);
  await assertClienteInTenant(clienteId, tenantSlug);

  return withTransaction(async () => {
    const locked = (await db().execute(sql`
      SELECT puntos_actuales
      FROM loyalty_accounts
      WHERE cliente_id = ${clienteId} AND tenant_slug = ${tenantSlug}
      FOR UPDATE
    `)) as unknown as Array<{ puntos_actuales: number }>;

    if (locked.length === 0) {
      throw new NotFoundError("Cuenta de fidelización no encontrada");
    }

    const saldo = Number(locked[0]!.puntos_actuales) || 0;
    if (saldo < puntos) {
      throw new ValidationError(
        `Saldo insuficiente: ${saldo} puntos disponibles, se requieren ${puntos}`,
      );
    }

    await db().execute(sql`
      INSERT INTO loyalty_transactions (cliente_id, tipo, puntos, descripcion, tenant_slug)
      VALUES (${clienteId}, 'CANJEADO', ${-puntos}, ${descripcion}, ${tenantSlug})
    `);

    // El nivel NO se recalcula: depende del acumulado histórico, que un canje
    // no altera. Canjear un premio no degrada al cliente.
    await db().execute(sql`
      UPDATE loyalty_accounts
      SET puntos_actuales = puntos_actuales - ${puntos}, updated_at = now()
      WHERE cliente_id = ${clienteId} AND tenant_slug = ${tenantSlug}
    `);

    return getLoyaltyAccount(clienteId, tenantSlug) as Promise<LoyaltyAccount>;
  });
}

/**
 * Redeems a catalog reward for a customer, debiting its required points.
 *
 * @param clienteId - UUID del cliente (debe pertenecer al tenant)
 * @param rewardId - UUID del premio
 * @param tenantSlug - Tenant dueño del catálogo y de la cuenta
 * @returns La cuenta de fidelización tras el canje
 * @throws {NotFoundError} Si el premio no existe, está inactivo, o el cliente no tiene cuenta
 * @throws {ValidationError} Si el saldo es insuficiente
 */
export async function redeemReward(
  clienteId: string,
  rewardId: string,
  tenantSlug: string,
): Promise<LoyaltyAccount> {
  if (!UUID_RE.test(rewardId)) {
    throw new ValidationError("rewardId debe ser un UUID válido");
  }

  const rewards = (await db().execute(sql`
    SELECT nombre, puntos_requeridos
    FROM loyalty_rewards
    WHERE id = ${rewardId} AND tenant_slug = ${tenantSlug} AND activo = true
    LIMIT 1
  `)) as unknown as Array<{ nombre: string; puntos_requeridos: number }>;

  if (rewards.length === 0) {
    throw new NotFoundError("Premio no encontrado o inactivo");
  }

  const reward = rewards[0]!;
  return redeemPoints(
    clienteId,
    reward.puntos_requeridos,
    `Canje de premio: ${reward.nombre}`,
    tenantSlug,
  );
}

/**
 * Gets loyalty account for a customer.
 *
 * El JOIN filtra también por `c.tenant_slug`: la FK garantiza que el cliente
 * existe, pero no que sea de este taller, y la respuesta incluye el nombre del
 * cliente.
 */
export async function getLoyaltyAccount(
  clienteId: string,
  tenantSlug: string,
): Promise<LoyaltyAccount | null> {
  const result = (await db().execute(sql`
    SELECT la.cliente_id, la.puntos_actuales, la.puntos_ganados_total, la.nivel,
           c.name as cliente_nombre
    FROM loyalty_accounts la
    JOIN clients c ON c.id = la.cliente_id
    WHERE la.cliente_id = ${clienteId}
      AND la.tenant_slug = ${tenantSlug}
      AND c.tenant_slug = ${tenantSlug}
  `)) as unknown as Array<{
    cliente_id: string;
    puntos_actuales: number;
    puntos_ganados_total: number;
    nivel: LoyaltyLevel;
    cliente_nombre: string;
  }>;

  const row = result[0];
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
  const result = (await db().execute(sql`
    SELECT id, nombre, descripcion, puntos_requeridos, activo
    FROM loyalty_rewards
    WHERE tenant_slug = ${tenantSlug} AND activo = true
    ORDER BY puntos_requeridos
  `)) as unknown as Array<{
    id: string;
    nombre: string;
    descripcion: string | null;
    puntos_requeridos: number;
    activo: boolean;
  }>;

  return result.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    puntosRequeridos: row.puntos_requeridos,
    activo: row.activo,
  }));
}

/**
 * Gets a customer's points ledger, most recent first.
 *
 * @param clienteId - UUID del cliente
 * @param tenantSlug - Tenant dueño de la cuenta
 * @param limit - Máximo de asientos (1..200)
 */
export async function getLoyaltyTransactions(
  clienteId: string,
  tenantSlug: string,
  limit = 50,
): Promise<LoyaltyTransaction[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);

  const result = (await db().execute(sql`
    SELECT id, cliente_id, tipo, puntos, descripcion, fecha
    FROM loyalty_transactions
    WHERE cliente_id = ${clienteId} AND tenant_slug = ${tenantSlug}
    ORDER BY fecha DESC, id DESC
    LIMIT ${safeLimit}
  `)) as unknown as Array<{
    id: string;
    cliente_id: string;
    tipo: LoyaltyTransaction["tipo"];
    puntos: number;
    descripcion: string | null;
    fecha: Date;
  }>;

  return result.map((row) => ({
    id: row.id,
    clienteId: row.cliente_id,
    tipo: row.tipo,
    puntos: row.puntos,
    descripcion: row.descripcion,
    fecha: toIso(row.fecha),
  }));
}
