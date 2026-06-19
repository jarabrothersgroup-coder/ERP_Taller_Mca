/**
 * Digital Ads Service — Google Ads integration.
 *
 * Manages Google Ads campaigns for workshop marketing,
 * budget tracking, and performance analytics.
 *
 * @module marketing/services/digital-ads.service.ts
 */

// ─── Types ────────────────────────────────────

export interface AdCampaign {
  id: string;
  nombre: string;
  plataforma: "google_ads" | "facebook_ads" | "instagram";
  estado: "ACTIVA" | "PAUSADA" | "FINALIZADA";
  presupuestoDiario: number;
  gastoTotal: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  costoPorClic: number;
  tasaConversion: number;
}

export interface AdsStats {
  campañasActivas: number;
  presupuestoTotalDiario: number;
  gastoTotalMes: number;
  impresionesTotales: number;
  clicsTotales: number;
  costoPorLead: number;
  roi: number;
}

// ─── Ads Functions ────────────────────────────

/**
 * Gets ad campaigns for a tenant.
 */
export async function getCampaigns(
  tenantSlug: string,
): Promise<AdCampaign[]> {
  // Placeholder — would integrate with Google Ads API
  return [];
}

/**
 * Gets ads performance statistics.
 */
export async function getAdsStats(
  tenantSlug: string,
): Promise<AdsStats> {
  return {
    campañasActivas: 0,
    presupuestoTotalDiario: 0,
    gastoTotalMes: 0,
    impresionesTotales: 0,
    clicsTotales: 0,
    costoPorLead: 0,
    roi: 0,
  };
}
