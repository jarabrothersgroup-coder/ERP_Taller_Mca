/**
 * WhatsApp Template Service — CRUD + variable filling + preview.
 *
 * @module whatsapp/services/whatsapp-template.service
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { whatsappTemplates } from "../schema/whatsapp-template.js";

/** Available template variables and their descriptions */
export const TEMPLATE_VARIABLES: Record<string, string> = {
  nombre_cliente: "Nombre del cliente",
  vehiculo: "Marca + modelo del vehículo",
  vehiculo_marca: "Marca del vehículo",
  vehiculo_modelo: "Modelo del vehículo",
  chapa: "Número de chapa",
  orden_id: "ID corto de la orden",
  monto_total: "Monto total del presupuesto",
  fecha_estimada: "Fecha estimada de entrega",
  tecnico: "Nombre del mecánico asignado",
  taller: "Nombre del taller",
  numero_factura: "Número de factura",
  url_encuesta: "URL de encuesta de satisfacción",
  kilometraje: "Kilometraje actual del vehículo",
  fecha_servicio: "Fecha del último servicio",
  proximo_servicio: "Fecha del próximo servicio",
  garantia_hasta: "Fecha de fin de garantía",
};

/** Default templates for new tenants */
export const DEFAULT_TEMPLATES: Array<{
  key: string;
  name: string;
  body: string;
  category: string;
  variables: string[];
  triggerEvent: string | null;
  triggerDelayHours: string;
}> = [
  {
    key: "recepcion",
    name: "Recepción del vehículo",
    body: "¡Hola {{nombre_cliente}}! 🚗 Tu {{vehiculo}} (Chapa: {{chapa}}) ya ingresó a nuestros talleres. Se generó la Orden #{{orden_id}}. Iniciamos el diagnóstico. Te mantendremos informado.",
    category: "ordenes",
    variables: ["nombre_cliente", "vehiculo", "chapa", "orden_id"],
    triggerEvent: "ot_created",
    triggerDelayHours: "0",
  },
  {
    key: "presupuesto",
    name: "Presupuesto listo",
    body: "Estimado/a {{nombre_cliente}}, el diagnóstico de tu {{vehiculo}} (Orden #{{orden_id}}) está listo. Presupuesto: Gs. {{monto_total}}. Aguardamos tu confirmación para iniciar reparaciones.",
    category: "ordenes",
    variables: ["nombre_cliente", "vehiculo", "orden_id", "monto_total"],
    triggerEvent: "ot_completed",
    triggerDelayHours: "0",
  },
  {
    key: "en_reparacion",
    name: "En reparación",
    body: "¡Buenas noticias, {{nombre_cliente}}! Hemos iniciado las reparaciones de tu {{vehiculo}}. Técnico: {{tecnico}}. Estimamos entrega: {{fecha_estimada}}.",
    category: "ordenes",
    variables: ["nombre_cliente", "vehiculo", "tecnico", "fecha_estimada"],
    triggerEvent: null,
    triggerDelayHours: "0",
  },
  {
    key: "listo_entrega",
    name: "Listo para entrega",
    body: "✨ ¡Tu vehículo está listo, {{nombre_cliente}}! La Orden #{{orden_id}} pasó control de calidad. Ya puedes pasar a retirar tu {{vehiculo}}.",
    category: "ordenes",
    variables: ["nombre_cliente", "vehiculo", "orden_id"],
    triggerEvent: null,
    triggerDelayHours: "0",
  },
  {
    key: "factura",
    name: "Factura emitida",
    body: "Gracias por tu confianza, {{nombre_cliente}}. Factura Nº {{numero_factura}} registrada. Si podés, calificá nuestro servicio: {{url_encuesta}}",
    category: "ordenes",
    variables: ["nombre_cliente", "numero_factura", "url_encuesta"],
    triggerEvent: null,
    triggerDelayHours: "0",
  },
  {
    key: "garantia",
    name: "Recordatorio de garantía",
    body: "Hola {{nombre_cliente}}, tu {{vehiculo}} tiene garantía hasta el {{garantia_hasta}}. Si tenés algún inconveniente con los trabajos realizados, contactanos sin costo.",
    category: "seguimiento",
    variables: ["nombre_cliente", "vehiculo", "garantia_hasta"],
    triggerEvent: "warranty_expiring",
    triggerDelayHours: "720", // 30 days
  },
  {
    key: "proximo_servicio",
    name: "Próximo servicio programado",
    body: "Hola {{nombre_cliente}}, recordá que tu {{vehiculo}} está pendiente de service. Último service: {{fecha_servicio}}. Kilometraje: {{kilometraje}} km. Agendá tu turno respondiendo este mensaje.",
    category: "seguimiento",
    variables: ["nombre_cliente", "vehiculo", "fecha_servicio", "kilometraje"],
    triggerEvent: "service_reminder",
    triggerDelayHours: "0",
  },
  {
    key: "encuesta",
    name: "Encuesta de satisfacción",
    body: "{{nombre_cliente}}, tu opinión nos ayuda a mejorar. Calificá tu experiencia en: {{url_encuesta}} (30 segundos). ¡Gracias! ⭐",
    category: "marketing",
    variables: ["nombre_cliente", "url_encuesta"],
    triggerEvent: "survey",
    triggerDelayHours: "24",
  },
];

/**
 * Fill a template body with variable values.
 */
export function fillTemplate(
  body: string,
  variables: Record<string, string>,
): string {
  let filled = body;
  for (const [key, value] of Object.entries(variables)) {
    filled = filled.replaceAll(`{{${key}}}`, value || `[${key}]`);
  }
  return filled;
}

/**
 * Extract variable names from a template body.
 */
export function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

/**
 * Preview a template with sample data.
 */
export function previewTemplate(
  body: string,
  sampleData: Record<string, string> = {},
): string {
  const defaults: Record<string, string> = {
    nombre_cliente: "Juan Pérez",
    vehiculo: "Toyota Hilux 2022",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "Hilux 2022",
    chapa: "ABC-1234",
    orden_id: "OT-0001",
    monto_total: "3.500.000",
    fecha_estimada: "20/06/2026",
    tecnico: "Carlos Méndez",
    taller: "Taller El Chero",
    numero_factura: "001-001-0001234",
    url_encuesta: "https://encuesta.taller.com.py/abc123",
    kilometraje: "45.000",
    fecha_servicio: "15/03/2026",
    proximo_servicio: "15/09/2026",
    garantia_hasta: "15/12/2026",
  };

  return fillTemplate(body, { ...defaults, ...sampleData });
}

// ─── CRUD ───────────────────────────────────

/**
 * List all templates for a tenant.
 */
export async function listTemplates(tenantSlug: string) {
  return db()
    .select()
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.tenantSlug, tenantSlug))
    .orderBy(desc(whatsappTemplates.createdAt));
}

/**
 * Get a single template by key.
 */
export async function getTemplate(tenantSlug: string, key: string) {
  const rows = await db()
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.tenantSlug, tenantSlug),
        eq(whatsappTemplates.key, key),
      ),
    )
    .limit(1);
  return rows[0] || null;
}

/**
 * Upsert a template (create or update by key).
 */
export async function upsertTemplate(
  tenantSlug: string,
  data: {
    key: string;
    name: string;
    body: string;
    category?: string;
    active?: boolean;
    triggerEvent?: string | null;
    triggerDelayHours?: string;
  },
) {
  const variables = extractVariables(data.body);

  // Check if exists
  const existing = await getTemplate(tenantSlug, data.key);

  if (existing) {
    const [updated] = await db()
      .update(whatsappTemplates)
      .set({
        name: data.name,
        body: data.body,
        category: data.category || existing.category,
        active: data.active ?? existing.active,
        variables,
        triggerEvent: data.triggerEvent !== undefined ? data.triggerEvent : existing.triggerEvent,
        triggerDelayHours: data.triggerDelayHours || existing.triggerDelayHours,
        updatedAt: new Date(),
      })
      .where(eq(whatsappTemplates.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db()
    .insert(whatsappTemplates)
    .values({
      tenantSlug,
      key: data.key,
      name: data.name,
      body: data.body,
      category: data.category || "general",
      active: data.active ?? true,
      variables,
      triggerEvent: data.triggerEvent || null,
      triggerDelayHours: data.triggerDelayHours || "0",
    })
    .returning();
  return created;
}

/**
 * Delete a template by key.
 */
export async function deleteTemplate(tenantSlug: string, key: string) {
  await db()
    .delete(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.tenantSlug, tenantSlug),
        eq(whatsappTemplates.key, key),
      ),
    );
}

/**
 * Seed default templates for a tenant (skip existing).
 */
export async function seedDefaultTemplates(tenantSlug: string) {
  let seeded = 0;
  for (const tmpl of DEFAULT_TEMPLATES) {
    const existing = await getTemplate(tenantSlug, tmpl.key);
    if (!existing) {
      await upsertTemplate(tenantSlug, tmpl);
      seeded++;
    }
  }
  return seeded;
}
