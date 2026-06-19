/**
 * SIFEN XML utility helpers — safe string escaping and formatting.
 *
 * Shared utilities used by both the XML builder and crypto services.
 * Kept separate to avoid circular imports.
 *
 * @module finance/services/sifen/sifen-xml-utils
 */

/**
 * Escapes XML special characters for safe text node inclusion.
 *
 * @param text - Raw text to escape
 * @returns XML-safe string
 */
export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats a numeric value to 2 decimal places for SIFEN fields.
 * Uses BigInt internally to avoid floating-point rounding errors on monetary values.
 *
 * @param value - Number or string representation
 * @returns Formatted string with 2 decimal places
 */
export function fmtNum(value: string | number): string {
  if (value === null || value === undefined || value === "") return "0.00";

  const str = typeof value === "number" ? String(value) : String(value).trim();
  if (!str || str === "0") return "0.00";

  // Handle Paraguayan format: "1.500.000" (dots as thousands)
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0.00";

  // Convert to centavos for exact arithmetic, then back
  const centavos = BigInt(Math.round(num * 100));
  const sign = centavos < 0n ? "-" : "";
  const abs = centavos < 0n ? -centavos : centavos;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}
