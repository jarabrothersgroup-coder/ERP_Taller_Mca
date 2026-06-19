/**
 * Google Reviews Service — review management and monitoring.
 *
 * Tracks Google Business reviews, sentiment analysis,
 * and response management.
 *
 * @module marketing/services/google-reviews.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface GoogleReview {
  id: string;
  autor: string;
  rating: number;
  texto: string;
  fecha: string;
  responded: boolean;
  respuesta?: string;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  responseRate: number;
  sentimentScore: number;
}

// ─── Review Functions ─────────────────────────

/**
 * Gets Google reviews for a tenant.
 */
export async function getReviews(
  tenantSlug: string,
  limit = 20,
): Promise<GoogleReview[]> {
  const result = await db().execute(sql`
    SELECT id, autor, rating, texto, fecha, responded, respuesta
    FROM google_reviews
    WHERE tenant_slug = ${tenantSlug}
    ORDER BY fecha DESC
    LIMIT ${limit}
  `);

  return result.rows.map((row: any) => ({
    id: row.id,
    autor: row.autor,
    rating: row.rating,
    texto: row.texto,
    fecha: row.fecha?.toISOString() || "",
    responded: row.responded,
    respuesta: row.respuesta,
  }));
}

/**
 * Gets review statistics.
 */
export async function getReviewStats(
  tenantSlug: string,
): Promise<ReviewStats> {
  const result = await db().execute(sql`
    SELECT
      COUNT(*) as total,
      COALESCE(AVG(rating), 0) as avg_rating,
      COUNT(CASE WHEN responded = true THEN 1 END) as responded_count,
      COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_count
    FROM google_reviews
    WHERE tenant_slug = ${tenantSlug}
  `);

  const row = result.rows[0] as any;
  const total = Number(row.total) || 0;
  const responded = Number(row.responded_count) || 0;

  return {
    totalReviews: total,
    averageRating: Number(row.avg_rating) || 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
    sentimentScore: total > 0 ? (Number(row.positive_count) / total) * 100 : 0,
  };
}
