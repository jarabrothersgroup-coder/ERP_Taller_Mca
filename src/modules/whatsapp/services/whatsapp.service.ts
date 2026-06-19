/**
 * WhatsApp Service — Evolution API integration.
 *
 * Handles communication with Evolution API gateway for:
 *   - QR code generation and pairing
 *   - Message sending (text + PDF attachments)
 *   - Connection status monitoring
 *   - Phone number sanitization (Paraguay format)
 *
 * Evolution API v2 documentation:
 *   https://doc.evolution-api.com/
 *
 * RAM impact: ~5 KB (HTTP client, no persistent connections).
 *
 * @module whatsapp/services/whatsapp.service
 */

import { env } from "../../../config/env.js";
import type {
  WhatsAppConnectionStatus,
  QRCodeResponse,
  WhatsAppSendResult,
  WhatsAppStatusResponse,
  MessageTemplateData,
} from "../types.js";

// ─── Constants ─────────────────────────────────

/** Default Paraguay country code */
const PARAGUAY_COUNTRY_CODE = "595";

/** HTTP timeout for Evolution API calls */
const API_TIMEOUT_MS = 15_000;

// ─── Phone Sanitizer ───────────────────────────

/**
 * Sanitizes a phone number to Paraguay international format (+5959xxxxxxxx).
 *
 * Handles various input formats:
 *   - "0981 123456" → "+595981123456"
 *   - "981123456" → "+595981123456"
 *   - "+595 981 123456" → "+595981123456"
 *   - "595981123456" → "+595981123456"
 *   - "0981-123-456" → "+595981123456"
 *
 * @param phone - Raw phone number input
 * @returns Sanitized phone in E.164 format for Paraguay
 * @throws {Error} If the phone number is invalid
 */
export function sanitizePhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");

  // Remove leading zeros (local format: 0981...)
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  // Remove country code if present
  if (digits.startsWith("595")) {
    digits = digits.substring(3);
  }

  // Validate: Paraguay mobile numbers are 9 digits starting with 9
  if (digits.length !== 9 || !digits.startsWith("9")) {
    throw new Error(
      `Número de teléfono inválido: "${phone}". Formato esperado: 09XXXXXXXX o +5959XXXXXXXX`,
    );
  }

  return `+${PARAGUAY_COUNTRY_CODE}${digits}`;
}

// ─── Evolution API Client ──────────────────────

/**
 * Gets the Evolution API base URL from environment.
 */
function getApiUrl(): string {
  return env.WHATSAPP_API_URL || "http://localhost:8080";
}

/**
 * Gets the Evolution API key from environment.
 */
function getApiKey(): string {
  return env.WHATSAPP_API_KEY || "";
}

/**
 * Gets the instance name for this tenant.
 * In multi-tenant setup, each tenant gets its own Evolution API instance.
 */
function getInstanceName(tenantSlug: string): string {
  return `erp-${tenantSlug}`;
}

/**
 * Makes an authenticated request to the Evolution API.
 *
 * @param method - HTTP method
 * @param path - API path (appended to base URL)
 * @param body - Request body (optional)
 * @returns Parsed JSON response
 */
async function evoApiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const apiKey = getApiKey();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: apiKey,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Evolution API ${response.status}: ${errorText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Evolution API timeout — verify connection");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API ────────────────────────────────

/**
 * Creates a new WhatsApp instance in Evolution API.
 *
 * @param tenantSlug - Tenant identifier
 * @returns Instance creation result
 */
export async function createInstance(
  tenantSlug: string,
): Promise<{ instanceName: string; status: string }> {
  const instanceName = getInstanceName(tenantSlug);

  try {
    const result = await evoApiRequest<{
      instance: { instanceName: string; status: string };
    }>("POST", "/instance/create", {
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      reject_call: false,
      groups_ignore: true,
      always_online: false,
      read_messages: true,
      read_status: false,
      sync_full_history: false,
    });

    return {
      instanceName,
      status: result.instance?.status || "CREATED",
    };
  } catch (err) {
    // Instance might already exist — try to connect
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("already") || msg.includes("exist")) {
      return { instanceName, status: "EXISTS" };
    }
    throw err;
  }
}

/**
 * Gets the QR code for pairing a device.
 *
 * @param tenantSlug - Tenant identifier
 * @returns QR code data (base64 image or raw string)
 */
export async function getQRCode(
  tenantSlug: string,
): Promise<QRCodeResponse> {
  const instanceName = getInstanceName(tenantSlug);

  // First, ensure instance exists
  await createInstance(tenantSlug);

  // Connect instance to get QR
  const result = await evoApiRequest<{
    base64?: string;
    code?: string;
  }>("GET", `/instance/connect/${instanceName}`);

  if (!result.base64 && !result.code) {
    throw new Error("No se pudo generar el código QR. Verifique la conexión del servidor.");
  }

  return {
    base64: result.base64 || "",
    code: result.code || "",
  };
}

/**
 * Gets the current connection status of a WhatsApp instance.
 *
 * @param tenantSlug - Tenant identifier
 * @returns Connection status details
 */
export async function getConnectionStatus(
  tenantSlug: string,
): Promise<WhatsAppStatusResponse> {
  const instanceName = getInstanceName(tenantSlug);

  try {
    const result = await evoApiRequest<{
      instance: {
        instanceName: string;
        status: string;
        owner?: string;
      };
    }>("GET", `/instance/connectionState/${instanceName}`);

    const statusMap: Record<string, WhatsAppConnectionStatus> = {
      open: "CONNECTED",
      connecting: "CONNECTING",
      close: "DISCONNECTED",
      qrcode: "QR_READY",
    };

    return {
      status: statusMap[result.instance?.status] || "DISCONNECTED",
      instanceName,
      phoneNumber: result.instance?.owner,
    };
  } catch {
    return {
      status: "DISCONNECTED",
      instanceName,
    };
  }
}

/**
 * Sends a WhatsApp text message.
 *
 * @param tenantSlug - Tenant identifier
 * @param to - Recipient phone number (will be sanitized)
 * @param message - Message text
 * @returns Send result
 */
export async function sendTextMessage(
  tenantSlug: string,
  to: string,
  message: string,
): Promise<WhatsAppSendResult> {
  const instanceName = getInstanceName(tenantSlug);
  const phone = sanitizePhone(to);

  try {
    const result = await evoApiRequest<{
      key?: { id?: string };
      message?: { timestamp?: number };
    }>("POST", `/message/sendText/${instanceName}`, {
      number: phone,
      text: message,
      delay: 1200, // Simulate typing delay (ms)
    });

    return {
      success: true,
      key: result.key?.id,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de envío";
    return {
      success: false,
      error: msg,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Sends a WhatsApp message with a PDF document attachment.
 *
 * @param tenantSlug - Tenant identifier
 * @param to - Recipient phone number
 * @param message - Message text
 * @param pdfUrl - URL or path to the PDF file
 * @param filename - Filename for the attachment
 * @returns Send result
 */
export async function sendDocumentMessage(
  tenantSlug: string,
  to: string,
  message: string,
  pdfUrl: string,
  filename: string,
): Promise<WhatsAppSendResult> {
  const instanceName = getInstanceName(tenantSlug);
  const phone = sanitizePhone(to);

  try {
    const result = await evoApiRequest<{
      key?: { id?: string };
    }>("POST", `/message/sendPresence/${instanceName}`, {
      number: phone,
      text: message,
      delay: 1200,
    });

    // Send document after presence
    const docResult = await evoApiRequest<{
      key?: { id?: string };
    }>("POST", `/message/sendDocument/${instanceName}`, {
      number: phone,
      document: pdfUrl,
      fileName: filename,
      caption: message,
      mimetype: "application/pdf",
    });

    return {
      success: true,
      key: docResult.key?.id || result.key?.id,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de envío con adjunto";
    return {
      success: false,
      error: msg,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Disconnects a WhatsApp instance.
 *
 * @param tenantSlug - Tenant identifier
 */
export async function disconnectInstance(
  tenantSlug: string,
): Promise<void> {
  const instanceName = getInstanceName(tenantSlug);
  try {
    await evoApiRequest("DELETE", `/instance/logout/${instanceName}`);
  } catch {
    // Ignore errors on disconnect
  }
}

/**
 * Deletes a WhatsApp instance entirely.
 *
 * @param tenantSlug - Tenant identifier
 */
export async function deleteInstance(
  tenantSlug: string,
): Promise<void> {
  const instanceName = getInstanceName(tenantSlug);
  try {
    await evoApiRequest("DELETE", `/instance/delete/${instanceName}`);
  } catch {
    // Ignore errors on delete
  }
}

// ─── Message Templates ─────────────────────────

/**
 * Message templates for each order state.
 * Uses {variable} placeholders for substitution.
 */
export const MESSAGE_TEMPLATES: Record<string, string> = {
  RECEPCIONADO:
    "¡Hola {nombre_cliente}! 🚗 Tu {vehiculo_marca} {vehiculo_modelo} (Chapa: {chapa}) ya ingresó a nuestros talleres. Se ha generado la Orden de Trabajo #{id_orden}. Iniciamos la fase de diagnóstico. Te mantendremos informado por aquí.",

  PRESUPUESTADO:
    "Estimado/a {nombre_cliente}, tenemos listo el diagnóstico para la Orden #{id_orden}. El presupuesto total estimado es de Gs. {monto_total}. Adjuntamos el documento PDF detallado 👇. Aguardamos tu confirmación por este medio para iniciar las reparaciones.",

  EN_REPARACION:
    "¡Buenas noticias, {nombre_cliente}! Hemos iniciado las reparaciones de tu {vehiculo_modelo}. El técnico asignado es {nombre_mecanico}. Estimamos tener el vehículo listo para el {fecha_estimada_entrega}.",

  LISTO_ENTREGA:
    "✨ ¡Tu vehículo está listo, {nombre_cliente}! Concluimos con éxito todos los trabajos de la Orden #{id_orden} y superamos el control de calidad. Ya puedes pasar a retirar tu {vehiculo_modelo}.",

  FINALIZADO_RETIRADO:
    "Muchas gracias por tu confianza, {nombre_cliente}. Se registró la salida de tu vehículo con la Factura Nº {numero_factura}. Nos ayudaría muchísimo si calificas nuestro servicio en este enlace de 30 segundos: {url_encuesta_satisfaccion}",
};

/**
 * Builds a message from a template and data.
 *
 * @param template - Template key (e.g., "RECEPCIONADO")
 * @param data - Template data with variable values
 * @returns Formatted message string
 */
export function buildMessage(
  template: string,
  data: MessageTemplateData,
): string {
  const templateText = MESSAGE_TEMPLATES[template];
  if (!templateText) {
    throw new Error(`Plantilla no encontrada: ${template}`);
  }

  let message = templateText;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    message = message.replaceAll(placeholder, value ?? "");
  }

  return message;
}
