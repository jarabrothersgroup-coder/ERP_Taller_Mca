/**
 * Valores esperados por la suite E2E (T-62).
 *
 * Refleja exactamente lo que `scripts/seed-e2e.ts` escribe en la BD. La fuente
 * de verdad es el seed; este archivo solo evita que los números se dupliquen en
 * tres specs y se desincronicen.
 *
 * Por qué importa: un assert que compara contra un valor blando ("hay algo
 * pintado") pasa aunque la pantalla muestre ceros o un `—`. Comparar contra
 * 500.000 solo pasa si el backend calculó de verdad sobre las 3 OTs.
 *
 * @module web/e2e/expected-data
 */

export const EXPECTED = {
  /** Suma de `total_cost` de las 3 OTs sembradas dentro de la ventana de 30 días. */
  revenue: 500_000,
  /** Cantidad de OTs en el rango. */
  orderCount: 3,
  /** El backend redondea a entero: round(500000 / 3). */
  avgOrderValue: 166_667,
  /** 2 OTs "Listo" de 3. El backend redondea a un decimal. */
  completionRate: 66.7,
  /** Turnos sembrados en `agendamientos`. */
  appointments: 3,
  /** `payroll_summary` del mes en curso. */
  payroll: {
    percentage: 60,
    netLaborRevenue: 30_000_000,
    breakevenThreshold: 50_000_000,
    remaining: 20_000_000,
  },
} as const;

/**
 * Ventana por defecto de analytics: los últimos 30 días en UTC.
 *
 * Se calcula, no se fija en una constante, porque un literal "2026-09-01"
 * envejecería y el test empezaría a fallar por el calendario, no por el
 * producto. Réplica exacta de `getDefaultRange()` en
 * `analytics.routes.ts` y de `getDefaultRange()` en `analytics/page.tsx`; si
 * el backend cambia su ventana, este helper deja de coincidir y el assert de
 * `range` lo delata.
 */
export function defaultRange(): { from: string; to: string } {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  return { from, to };
}

/**
 * `analytics/page.tsx` ABREVIA los guaraníes (`formatGuanira`): 500000 no se
 * muestra como "₲ 500.000" sino como "₲ 500K". Un assert escrito contra la
 * forma larga pasaría solo si la página no renderiza nada, así que el helper
 * replica la abreviatura exacta de `formatGuanira`.
 */
export function guaraniesCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `₲ ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `₲ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₲ ${(amount / 1_000).toFixed(0)}K`;
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

/**
 * `nomina/page.tsx` NO abrevía (`formatGuarani`): 30000000 sí sale completo
 * como "₲ 30.000.000". Son dos formateadores distintos en el mismo repo, y por
 * eso hay dos helpers en vez de uno con flag.
 */
export function guaranies(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

/** `66.7` se renderiza como "66.7%" — el locale no añade decimales de relleno. */
export function percent(value: number): string {
  return `${value}%`;
}

/** Números enteros con separador de miles es-PY: 3 → "3". */
export function plain(value: number): string {
  return value.toLocaleString("es-PY");
}