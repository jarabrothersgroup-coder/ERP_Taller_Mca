/**
 * Account Resolver — resolución de cuentas contables imputables.
 *
 * Regla de negocio: un asiento solo puede imputarse a cuentas de
 * movimiento (`plan_cuentas.acepta_movimientos = true`). Las cuentas
 * agrupadoras (nivel 1–3) existen para consolidar, no para recibir
 * líneas de detalle.
 *
 * Antes de este módulo cada servicio resolvía cuentas con su propio
 * `resolveCuenta()` filtrando solo `codigo` + `activo`, y varios
 * hardcodeaban códigos agrupadores (`4.1.01`, `1.1.01`, `3`), lo que
 * producía dos fallas distintas:
 *
 *   1. Asientos rechazados con 422 «la cuenta no acepta movimientos».
 *   2. Peor: líneas insertadas directo en cuentas agrupadoras, sin
 *      validación, dejando el mayor descuadrado en silencio.
 *
 * La resolución es tolerante a las dos convenciones de plan vigentes
 * en el repo (`x.x.x.xx` de `seed.ts` y `x.xx.xx.xxx` de
 * `scripts/seed-accounting.ts`): si el código pedido es una cuenta
 * agrupadora, se baja al primer descendiente imputable.
 *
 * @module finance/services/accounting/account-resolver
 */

import { and, asc, eq, like } from "drizzle-orm";
import { db } from "../../../../shared/database/drizzle.js";
import { NotFoundError } from "../../../../shared/errors/app-error.js";
import { planCuentas } from "../../schema/index.js";

export interface PostingAccountQuery {
  /** Códigos exactos en orden de preferencia (admite agrupadoras). */
  codigos?: string[];
  /** Prefijos de código en orden de preferencia (ej. `"4.1.1."`). */
  prefijos?: string[];
  /** Etiqueta legible para el mensaje de error (ej. `"ingresos"`). */
  etiqueta: string;
}

/**
 * Busca la primera cuenta imputable (activa y que acepta movimientos)
 * que coincida exactamente con `codigo`.
 */
async function findExactPosting(codigo: string): Promise<string | null> {
  const [row] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(
      and(
        eq(planCuentas.codigo, codigo),
        eq(planCuentas.activo, true),
        eq(planCuentas.aceptaMovimientos, true),
      ),
    )
    .limit(1);

  return row?.id ?? null;
}

/**
 * Busca la primera cuenta imputable cuyo código empiece con `prefijo`.
 * El orden es por código ascendente para que el resultado sea
 * determinista entre corridas (antes se usaba `LIMIT 1` sin `ORDER BY`,
 * lo que elegía cuentas distintas según el plan de ejecución).
 */
async function findFirstPostingUnder(prefijo: string): Promise<string | null> {
  const [row] = await db()
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(
      and(
        like(planCuentas.codigo, `${prefijo}%`),
        eq(planCuentas.activo, true),
        eq(planCuentas.aceptaMovimientos, true),
      ),
    )
    .orderBy(asc(planCuentas.codigo))
    .limit(1);

  return row?.id ?? null;
}

/**
 * Resuelve una cuenta imputable a partir de códigos exactos y/o
 * prefijos, en orden de preferencia. Devuelve `null` si no hay
 * coincidencia (variante no arrojadiza, para call sites que degradan
 * con gracia).
 *
 * Para cada código candidato se intenta primero la coincidencia exacta
 * imputable y, si el código corresponde a una cuenta agrupadora, se
 * busca el primer descendiente imputable (`codigo.`).
 */
export async function findPostingAccount(
  query: PostingAccountQuery,
): Promise<string | null> {
  const { codigos = [], prefijos = [] } = query;

  for (const codigo of codigos) {
    const exact = await findExactPosting(codigo);
    if (exact) return exact;

    // El código puede ser una agrupadora (nivel 1-3) en alguna de las
    // convenciones de plan: bajar al primer descendiente imputable.
    const child = await findFirstPostingUnder(`${codigo}.`);
    if (child) return child;
  }

  for (const prefijo of prefijos) {
    const found = await findFirstPostingUnder(prefijo);
    if (found) return found;
  }

  return null;
}

/**
 * Resuelve una cuenta imputable a partir de códigos exactos y/o
 * prefijos, en orden de preferencia.
 *
 * @throws {NotFoundError} si ninguna cuenta imputable coincide.
 */
export async function resolvePostingAccount(
  query: PostingAccountQuery,
): Promise<string> {
  const { codigos = [], prefijos = [], etiqueta } = query;

  const found = await findPostingAccount(query);
  if (found) return found;

  const buscado = [...codigos, ...prefijos.map((p) => `${p}*`)].join(", ");
  throw new NotFoundError(
    `No se encontró una cuenta contable imputable para ${etiqueta} ` +
      `(se buscó: ${buscado || "sin criterio"}). ` +
      "Verifique el Plan de Cuentas: la cuenta debe estar activa y aceptar movimientos.",
  );
}

/**
 * Variante para códigos que deben existir tal cual (cuentas
 * configuradas explícitamente, p. ej. depreciación por tipo de activo).
 * Acepta agrupadoras resolviendo a su primer descendiente imputable.
 */
export async function resolvePostingAccountByCode(
  codigo: string,
  etiqueta: string,
): Promise<string> {
  return resolvePostingAccount({ codigos: [codigo], etiqueta });
}
