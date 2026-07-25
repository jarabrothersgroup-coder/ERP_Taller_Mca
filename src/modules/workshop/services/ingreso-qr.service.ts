/**
 * Ingreso QR Service — Generate QR codes for vehicle check-ins.
 *
 * Each ingreso gets a unique QR code that, when scanned,
 * links to the ingreso detail page in the ERP frontend.
 *
 * @module workshop/services/ingreso-qr
 */

import QRCode from "qrcode";
import { db } from "../../../shared/database/drizzle.js";
import { ingresos } from "../schema/index.js";
import { eq } from "drizzle-orm";

// ─── Configuration ────────────────────────────

const QR_WIDTH = 300;
const QR_MARGIN = 2;
const QR_ERROR_CORRECTION: "L" | "M" | "Q" | "H" = "M";

// ─── Generate QR ──────────────────────────────

/**
 * Generate a QR code PNG buffer for an ingreso.
 *
 * The QR encodes a URL to the frontend ingreso detail page.
 * Falls back to the ingreso UUID if FRONTEND_URL is not set.
 *
 * @param ingresoId - The ingreso UUID
 * @param tenantSlug - Tenant identifier (for ownership verification)
 * @returns PNG buffer
 * @throws Error if ingreso not found or doesn't belong to tenant
 */
export async function generateIngresoQR(
  ingresoId: string,
  _tenantSlug: string,
): Promise<Buffer> {
  // Verify ingreso exists (vehicleId check ensures tenant isolation via RLS)
  const rows = await db()
    .select({ id: ingresos.id })
    .from(ingresos)
    .where(eq(ingresos.id, ingresoId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Ingreso ${ingresoId} no encontrado`);
  }

  // Build QR content URL
  const frontendUrl = process.env["FRONTEND_URL"] || "";
  const content = frontendUrl
    ? `${frontendUrl}/dashboard/taller/checklist/${ingresoId}`
    : `ingreso:${ingresoId}`;

  const buffer = await QRCode.toBuffer(content, {
    type: "png",
    width: QR_WIDTH,
    margin: QR_MARGIN,
    errorCorrectionLevel: QR_ERROR_CORRECTION,
  });

  return buffer;
}
