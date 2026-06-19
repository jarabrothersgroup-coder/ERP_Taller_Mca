/**
 * Marketing Automation Service — Campaign management.
 *
 * Manages automated marketing campaigns via WhatsApp and email
 * for service reminders, promotions, and customer retention.
 *
 * @module marketing/services/campaign.service.ts
 */

import { db } from "../../../shared/database/drizzle.js";
import { sql, eq, and, desc } from "drizzle-orm";

// ─── Types ────────────────────────────────────

export interface Campaign {
  id: string;
  nombre: string;
  tipo: "whatsapp" | "email" | "sms";
  estado: "BORRADOR" | "PROGRAMADA" | "ENVIADA" | "CANCELADA";
  mensaje: string;
  programadaAt?: string;
  enviadaAt?: string;
  destinatarios: number;
  enviados: number;
  fallidos: number;
}

export interface CreateCampaignRequest {
  nombre: string;
  tipo: "whatsapp" | "email" | "sms";
  mensaje: string;
  programadaAt?: string;
  segmento?: string;
}

export interface CampaignStats {
  totalCampaigns: number;
  enviadas: number;
  destinatariosTotales: number;
  tasaExito: number;
}

// ─── Campaign CRUD ────────────────────────────

/**
 * Creates a new marketing campaign.
 */
export async function createCampaign(
  data: CreateCampaignRequest,
  tenantSlug: string,
): Promise<Campaign> {
  const result = await db().execute(sql`
    INSERT INTO marketing_campaigns (nombre, tipo, mensaje, programada_at, segmento, tenant_slug)
    VALUES (${data.nombre}, ${data.tipo}, ${data.mensaje}, ${data.programadaAt || null}, ${data.segmento || null}, ${tenantSlug})
    RETURNING id, nombre, tipo, 'BORRADOR' as estado, mensaje, programada_at, 0 as destinatarios, 0 as enviados, 0 as fallidos
  `);

  const row = result.rows[0] as any;
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    estado: row.estado,
    mensaje: row.mensaje,
    programadaAt: row.programada_at,
    destinatarios: row.destinatarios,
    enviados: row.enviados,
    fallidos: row.fallidos,
  };
}

/**
 * Lists campaigns for a tenant.
 */
export async function listCampaigns(
  tenantSlug: string,
): Promise<Campaign[]> {
  const result = await db().execute(sql`
    SELECT id, nombre, tipo, estado, mensaje, programada_at, enviada_at,
           destinatarios, enviados, fallidos
    FROM marketing_campaigns
    WHERE tenant_slug = ${tenantSlug}
    ORDER BY created_at DESC
  `);

  return result.rows.map((row: any) => ({
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    estado: row.estado,
    mensaje: row.mensaje,
    programadaAt: row.programada_at,
    enviadaAt: row.enviada_at,
    destinatarios: row.destinatarios,
    enviados: row.enviados,
    fallidos: row.fallidos,
  }));
}

/**
 * Gets campaign statistics.
 */
export async function getCampaignStats(
  tenantSlug: string,
): Promise<CampaignStats> {
  const result = await db().execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN estado = 'ENVIADA' THEN 1 END) as enviadas,
      COALESCE(SUM(destinatarios), 0) as destinatarios,
      COALESCE(SUM(enviados), 0) as enviados
    FROM marketing_campaigns
    WHERE tenant_slug = ${tenantSlug}
  `);

  const row = result.rows[0] as any;
  const enviados = Number(row.enviados) || 0;
  const destinatarios = Number(row.destinatarios) || 0;

  return {
    totalCampaigns: Number(row.total) || 0,
    enviadas: Number(row.enviadas) || 0,
    destinatariosTotales: destinatarios,
    tasaExito: destinatarios > 0 ? Math.round((enviados / destinatarios) * 100) : 0,
  };
}
