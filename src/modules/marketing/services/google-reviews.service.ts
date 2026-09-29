/**
 * Google Reviews Service — review management and monitoring.
 *
 * Tracks Google Business reviews, sentiment analysis,
 * and response management.
 *
 * Alcance: `google_reviews` es un ESPEJO LOCAL. Publicar la respuesta en el
 * Business Profile de Google requiere la API de Google Business Profile
 * (revisión de cuenta + credenciales OAuth de servicio), que el proyecto no
 * tiene configurada. `respondToReview()` registra la respuesta en la base con
 * su trazabilidad (quién / cuándo), y NO la publica en Google — no simula una
 * integración que no existe.
 *
 * @module marketing/services/google-reviews.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/app-error.js";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface GoogleReview {
  id: string;
  autor: string;
  rating: number;
  texto: string | null;
  fecha: string;
  responded: boolean;
  respuesta: string | null;
  respondidoAt: string | null;
  respondidoPor: string | null;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  /** Conteo real por estrella (1..5), no un placeholder de ceros. */
  ratingDistribution: Record<number, number>;
  responseRate: number;
  sentimentScore: number;
  pendingCount: number;
}

export interface RespondResult {
  review: GoogleReview;
  /** `true` si esta fue la primera respuesta, `false` si se editó una previa. */
  primeraRespuesta: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Google admite respuestas de hasta 3000 caracteres. */
const MAX_RESPUESTA = 3000;

/**
 * Normaliza un `timestamptz` a ISO-8601, venga como venga.
 *
 * Trampa real de estos servicios: el MISMO `timestamptz` llega en dos formatos
 * según por dónde se lea. `getDb()` (postgres.js directo) devuelve un `Date`,
 * pero `db().execute(sql...)` —la capa Drizzle que usan estos servicios— lo
 * devuelve como texto `'2026-09-28 13:03:31.14991+00'`. Un `instanceof Date`
 * asumiendo el primer caso devuelve `null` silenciosamente, y `new Date()` no
 * parsea el offset `+00` a secas (exige `+00:00` o `Z`).
 *
 * Por eso no se hace `new Date(valor)` a ciegas: se normaliza el formato y, si
 * algo no cuadra, se devuelve el texto original en vez de perder el dato.
 */
function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();

  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})$/.exec(value);
  if (!m) return value;
  const offset = m[3] === "+00" || m[3] === "-00" ? "Z" : `${m[3]}:00`;
  const parsed = new Date(`${m[1]}T${m[2]}${offset}`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/** Mapea una fila de `google_reviews` al tipo de dominio. */
function toGoogleReview(row: {
  id: string;
  autor: string;
  rating: number;
  texto: string | null;
  fecha: Date;
  responded: boolean;
  respuesta: string | null;
  respondido_at: Date | null;
  respondido_por: string | null;
}): GoogleReview {
  return {
    id: row.id,
    autor: row.autor,
    rating: row.rating,
    texto: row.texto,
    fecha: toIso(row.fecha) ?? "",
    responded: row.responded,
    respuesta: row.respuesta,
    respondidoAt: toIso(row.respondido_at),
    respondidoPor: row.respondido_por,
  };
}

const REVIEW_COLUMNS = sql`
  id, autor, rating, texto, fecha, responded, respuesta, respondido_at, respondido_por
`;

/**
 * Gets one review by id, scoped to the tenant.
 *
 * Por qué existe: leer "la reseña recién tocada" filtrando el listado completo
 * con `find()` falla en silencio en cuanto el tenant tiene más reseñas que el
 * límite del listado — el `find` no la encuentra y el endpoint responde 404
 * después de haber escrito la respuesta.
 */
async function getReviewById(
  reviewId: string,
  tenantSlug: string,
): Promise<GoogleReview | null> {
  const rows = (await db().execute(sql`
    SELECT ${REVIEW_COLUMNS}
    FROM google_reviews
    WHERE id = ${reviewId} AND tenant_slug = ${tenantSlug}
    LIMIT 1
  `)) as unknown as Array<{
    id: string;
    autor: string;
    rating: number;
    texto: string | null;
    fecha: Date;
    responded: boolean;
    respuesta: string | null;
    respondido_at: Date | null;
    respondido_por: string | null;
  }>;

  return rows[0] ? toGoogleReview(rows[0]) : null;
}

// ─── Review Functions ─────────────────────────

/**
 * Gets Google reviews for a tenant.
 *
 * @param tenantSlug - Tenant dueño de las reseñas
 * @param limit - Máximo a devolver (1..200)
 * @param soloPendientes - Si es true, solo reseñas sin responder
 */
export async function getReviews(
  tenantSlug: string,
  limit = 20,
  soloPendientes = false,
): Promise<GoogleReview[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 200);

  const result = (await db().execute(sql`
    SELECT ${REVIEW_COLUMNS}
    FROM google_reviews
    WHERE tenant_slug = ${tenantSlug}
      ${soloPendientes ? sql`AND responded = false` : sql``}
    ORDER BY fecha DESC
    LIMIT ${safeLimit}
  `)) as unknown as Array<{
    id: string;
    autor: string;
    rating: number;
    texto: string | null;
    fecha: Date;
    responded: boolean;
    respuesta: string | null;
    respondido_at: Date | null;
    respondido_por: string | null;
  }>;

  return result.map(toGoogleReview);
}

/**
 * Gets review statistics.
 *
 * La distribución por estrella se calcula con un `GROUP BY rating` real. Antes
 * devolvía `{1:0,2:0,3:0,4:0,5:0}` hardcodeado, así que el gráfico de barras del
 * panel salía vacío por mucho que hubiera reseñas, y el porcentaje de
 * respuestas se comparaba contra una distribución falsa.
 */
export async function getReviewStats(
  tenantSlug: string,
): Promise<ReviewStats> {
  const [agg, byRating] = (await Promise.all([
    db().execute(sql`
      SELECT
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as avg_rating,
        COUNT(*) FILTER (WHERE responded = true) as responded_count,
        COUNT(*) FILTER (WHERE rating >= 4) as positive_count
      FROM google_reviews
      WHERE tenant_slug = ${tenantSlug}
    `),
    db().execute(sql`
      SELECT rating, COUNT(*) as n
      FROM google_reviews
      WHERE tenant_slug = ${tenantSlug}
      GROUP BY rating
    `),
  ])) as unknown as [
    Array<{ total: string; avg_rating: string; responded_count: string; positive_count: string }>,
    Array<{ rating: number; n: string }>,
  ];

  const row = agg[0];
  const total = Number(row?.total ?? 0) || 0;
  const responded = Number(row?.responded_count ?? 0) || 0;

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const line of byRating) {
    const star = Number(line.rating);
    if (star >= 1 && star <= 5) ratingDistribution[star] = Number(line.n) || 0;
  }

  return {
    totalReviews: total,
    // ROUND a 2 decimales en SQL: en JS, 4.7 * 100 / 100 puede dar 4.699999…
    // y el panel lo pintaba con decimales de más.
    averageRating: Math.round((Number(row?.avg_rating ?? 0) || 0) * 100) / 100,
    ratingDistribution,
    responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
    sentimentScore:
      total > 0 ? Math.round((Number(row?.positive_count ?? 0) / total) * 100) : 0,
    pendingCount: total - responded,
  };
}

/**
 * Records a public response to a review.
 *
 * Idempotente por diseño: responder dos veces a la misma reseña edita la
 * respuesta existente en lugar de duplicarla (Google permite editar la
 * respuesta, no publicar varias). `primeraRespuesta` distingue ambos casos.
 *
 * NO publica en Google: solo persiste la respuesta en el espejo local
 * (ver nota de alcance en la cabecera del módulo).
 *
 * @param reviewId - UUID de la reseña
 * @param respuesta - Texto de la respuesta pública
 * @param tenantSlug - Tenant dueño de la reseña
 * @param usuarioId - Usuario que responde (null si no hay actor resuelto)
 * @returns La reseña actualizada y si fue primera respuesta o edición
 * @throws {ValidationError} Si la respuesta está vacía o excede el límite
 * @throws {NotFoundError} Si la reseña no existe en el tenant
 */
export async function respondToReview(
  reviewId: string,
  respuesta: string,
  tenantSlug: string,
  usuarioId: string | null = null,
): Promise<RespondResult> {
  if (!UUID_RE.test(reviewId)) {
    throw new ValidationError("reviewId debe ser un UUID válido");
  }
  const texto = respuesta?.trim() ?? "";
  if (texto.length === 0) {
    throw new ValidationError("La respuesta no puede estar vacía");
  }
  if (texto.length > MAX_RESPUESTA) {
    throw new ValidationError(`La respuesta no puede superar ${MAX_RESPUESTA} caracteres`);
  }

  const existing = (await db().execute(sql`
    SELECT id, responded
    FROM google_reviews
    WHERE id = ${reviewId} AND tenant_slug = ${tenantSlug}
    LIMIT 1
  `)) as unknown as Array<{ id: string; responded: boolean }>;

  if (existing.length === 0) {
    throw new NotFoundError("Reseña no encontrada");
  }
  const primeraRespuesta = existing[0]!.responded !== true;

  await db().execute(sql`
    UPDATE google_reviews
    SET responded = true,
        respuesta = ${texto},
        respondido_at = now(),
        respondido_por = ${usuarioId}
    WHERE id = ${reviewId} AND tenant_slug = ${tenantSlug}
  `);

  const review = await getReviewById(reviewId, tenantSlug);
  if (!review) {
    throw new NotFoundError("Reseña no encontrada");
  }

  return { review, primeraRespuesta };
}

/**
 * Clears a response, returning the review to the pending state.
 *
 * Soporta el caso "nos equivocamos en la respuesta": Google permite borrar la
 * respuesta publicada, así que el espejo local debe poder volver atrás.
 *
 * @throws {NotFoundError} Si la reseña no existe en el tenant
 */
export async function removeResponse(
  reviewId: string,
  tenantSlug: string,
): Promise<GoogleReview> {
  if (!UUID_RE.test(reviewId)) {
    throw new ValidationError("reviewId debe ser un UUID válido");
  }

  const existing = (await db().execute(sql`
    SELECT id FROM google_reviews
    WHERE id = ${reviewId} AND tenant_slug = ${tenantSlug}
    LIMIT 1
  `)) as unknown as unknown[];

  if (existing.length === 0) {
    throw new NotFoundError("Reseña no encontrada");
  }

  await db().execute(sql`
    UPDATE google_reviews
    SET responded = false, respuesta = NULL, respondido_at = NULL, respondido_por = NULL
    WHERE id = ${reviewId} AND tenant_slug = ${tenantSlug}
  `);

  const review = await getReviewById(reviewId, tenantSlug);
  if (!review) {
    throw new NotFoundError("Reseña no encontrada");
  }
  return review;
}
