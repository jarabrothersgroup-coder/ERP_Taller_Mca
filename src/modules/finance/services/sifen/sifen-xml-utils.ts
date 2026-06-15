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
 *
 * @param value - Number or string representation
 * @returns Formatted string with 2 decimal places
 */
export function fmtNum(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "0.00";
  return n.toFixed(2);
}
