/**
 * VIN Decode Service — NHTSA VPIC integration.
 *
 * Decodes a 17-character VIN using the NHTSA Vehicle Product Information
 * (VPIC) API, returning structured vehicle data (brand, model, year,
 * engine type, etc.).
 *
 * Used to auto-populate vehicle fields during check-in.
 *
 * @module workshop/services/vin-decode.service
 */

const NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin";

export interface VinDecodeResult {
  vin: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  engineType: string | null;
  fuelType: string | null;
  cylinders: number | null;
  driveType: string | null;
  transmission: string | null;
  raw: Record<string, string | null>;
}

/**
 * Decode a VIN via NHTSA VPIC API.
 *
 * @param vin - 17-character VIN
 * @returns Structured vehicle data (fields may be null if API lacks some info)
 */
export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  if (!vin || vin.length !== 17) {
    throw new Error("VIN debe tener exactamente 17 caracteres");
  }

  const response = await fetch(`${NHTSA_URL}/${vin}?format=json`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Error NHTSA API: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { Results: Array<{ Variable: string; Value: string | null }> };
  const results = data.Results ?? [];

  // Build a lookup map
  const map = new Map<string, string | null>();
  for (const item of results) {
    map.set(item.Variable, item.Value);
  }

  const raw: Record<string, string | null> = {};
  for (const item of results) {
    raw[item.Variable] = item.Value;
  }

  const fuelType = map.get("Fuel Type - Primary") ?? null;

  // Map NHTSA fuel type to our engineType enum
  let engineType: string | null = "Nafta";
  if (fuelType) {
    const ft = fuelType.toUpperCase();
    if (ft.includes("DIESEL")) {
      engineType = "Diésel";
    } else if (ft.includes("ELECTRIC") && ft.includes("HYBRID")) {
      engineType = "HEV";
    } else if (ft.includes("ELECTRIC") || ft.includes("BATTERY")) {
      engineType = "BEV";
    }
  }

  const yearStr = map.get("Model Year") ?? null;
  const year = yearStr ? parseInt(yearStr, 10) : null;
  const cylindersStr = map.get("Engine Number of Cylinders") ?? null;
  const cylinders = cylindersStr ? parseInt(cylindersStr, 10) : null;

  return {
    vin,
    brand: map.get("Make") ?? null,
    model: map.get("Model") ?? null,
    year: year && !isNaN(year) ? year : null,
    engineType,
    fuelType,
    cylinders,
    driveType: map.get("Drive Type") ?? null,
    transmission: map.get("Transmission Style") ?? null,
    raw,
  };
}
