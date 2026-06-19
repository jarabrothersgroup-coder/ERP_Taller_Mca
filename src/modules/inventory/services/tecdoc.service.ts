/**
 * TecDoc Integration Service — Parts catalog search by VIN.
 *
 * Integrates with TecDoc API for cross-referencing vehicle parts
 * by VIN, brand, model, and engine specifications.
 *
 * @module inventory/services/tecdoc.service.ts
 */

// ─── Types ────────────────────────────────────

export interface TecDocPart {
  articleNumber: string;
  description: string;
  brand: string;
  price: number;
  currency: string;
  availability: string;
  imageUrl?: string;
}

export interface TecDocSearchResult {
  parts: TecDocPart[];
  total: number;
  source: string;
}

// ─── Configuration ────────────────────────────

const TECDOC_API_URL = process.env.TECDOC_API_URL || "";
const TECDOC_API_KEY = process.env.TECDOC_API_KEY || "";

// ─── Search Functions ─────────────────────────

/**
 * Searches parts by vehicle VIN.
 *
 * @param vin - Vehicle Identification Number
 * @param query - Search query (part name, category)
 * @returns Matching parts from TecDoc
 */
export async function searchByVIN(
  vin: string,
  query: string,
): Promise<TecDocSearchResult> {
  if (!TECDOC_API_URL || !TECDOC_API_KEY) {
    return {
      parts: [],
      total: 0,
      source: "tecdoc (not configured)",
    };
  }

  try {
    const response = await fetch(
      `${TECDOC_API_URL}/parts/search?vin=${encodeURIComponent(vin)}&q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${TECDOC_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`TecDoc API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      parts: data.parts || [],
      total: data.total || 0,
      source: "tecdoc",
    };
  } catch (err) {
    console.warn("[tecdoc] Error searching parts:", err);
    return { parts: [], total: 0, source: "tecdoc (error)" };
  }
}

/**
 * Searches parts by brand and model.
 *
 * @param brand - Vehicle brand
 * @param model - Vehicle model
 * @param year - Vehicle year
 * @param query - Part search query
 * @returns Matching parts
 */
export async function searchByBrandModel(
  brand: string,
  model: string,
  year: number,
  query: string,
): Promise<TecDocSearchResult> {
  if (!TECDOC_API_URL || !TECDOC_API_KEY) {
    return { parts: [], total: 0, source: "tecdoc (not configured)" };
  }

  try {
    const response = await fetch(
      `${TECDOC_API_URL}/parts/search?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&year=${year}&q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${TECDOC_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) throw new Error(`TecDoc API error: ${response.status}`);

    const data = await response.json();
    return {
      parts: data.parts || [],
      total: data.total || 0,
      source: "tecdoc",
    };
  } catch (err) {
    console.warn("[tecdoc] Error searching by brand/model:", err);
    return { parts: [], total: 0, source: "tecdoc (error)" };
  }
}

/**
 * Checks if TecDoc integration is configured.
 */
export function isTecDocConfigured(): boolean {
  return Boolean(TECDOC_API_URL && TECDOC_API_KEY);
}
