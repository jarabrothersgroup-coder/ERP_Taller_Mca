/**
 * Tenant Profile Service — Configuración del Perfil del Contribuyente.
 *
 * Gestiona la configuración del tenant: clasificación MIC, forma jurídica,
 * régimen IRE, y la activación automática de libros obligatorios.
 *
 * @module tenants/services/tenant-profile.service
 */

import { db } from "../../../shared/database/drizzle.js";
import { and, eq } from "drizzle-orm";
import { tenantConfig, librosObligatorios } from "../schema/index.js";
import { clasificarMIC, determinarRegimenIRE, activarLibrosObligatorios } from "./tenant-classifier.service.js";
import { NotFoundError } from "../../../shared/errors/app-error.js";

// ─── DTO ───────────────────────────────────────

export interface TenantProfileDTO {
  tenantSlug: string;
  ruc: string;
  dv: string;
  razonSocial: string;
  clasificacionMic: string;
  formaJuridica: string;
  regimenIre: string;
  ingresosAnuales: string;
  cantidadPersonal: number;
  capitalIntegrado: string;
  ejercicioActual: number;
  periodoAbiertoMes: number;
  cerradoHastaMes: number;
  libros: Array<{
    libro: string;
    obligatorio: boolean;
    rubricado: boolean;
    fechaRubrica: string | null;
    numeroRubrica: string | null;
  }>;
}

export interface UpdateTenantProfileDTO {
  ruc?: string;
  dv?: string;
  razonSocial?: string;
  ingresosAnuales?: number;
  cantidadPersonal?: number;
  capitalIntegrado?: number;
  formaJuridica?: string;
}

// ─── Service ───────────────────────────────────

/**
 * Obtiene el perfil completo del tenant, incluyendo libros obligatorios.
 */
export async function getTenantProfile(tenantSlug: string): Promise<TenantProfileDTO> {
  let config = await db()
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantSlug, tenantSlug))
    .limit(1)
    .then((r) => r[0]);

  if (!config) {
    // Auto-crear perfil con valores por defecto
    config = await createDefaultProfile(tenantSlug);
  }

  const libros = await db()
    .select()
    .from(librosObligatorios)
    .where(eq(librosObligatorios.tenantSlug, tenantSlug))
    .orderBy(librosObligatorios.libro);

  return {
    tenantSlug: config.tenantSlug,
    ruc: config.ruc,
    dv: config.dv,
    razonSocial: config.razonSocial,
    clasificacionMic: config.clasificacionMic,
    formaJuridica: config.formaJuridica,
    regimenIre: config.regimenIre,
    ingresosAnuales: config.ingresosAnuales ?? "0",
    cantidadPersonal: config.cantidadPersonal,
    capitalIntegrado: config.capitalIntegrado ?? "0",
    ejercicioActual: config.ejercicioActual,
    periodoAbiertoMes: config.periodoAbiertoMes,
    cerradoHastaMes: config.cerradoHastaMes,
    libros: libros.map((l) => ({
      libro: l.libro,
      obligatorio: l.obligatorio,
      rubricado: l.rubricado,
      fechaRubrica: l.fechaRubrica?.toISOString() ?? null,
      numeroRubrica: l.numeroRubrica,
    })),
  };
}

/**
 * Actualiza el perfil del tenant y reclasifica automáticamente.
 */
export async function updateTenantProfile(
  tenantSlug: string,
  data: UpdateTenantProfileDTO,
): Promise<TenantProfileDTO> {
  const existing = await db()
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantSlug, tenantSlug))
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    throw new NotFoundError(`Tenant ${tenantSlug} no encontrado`);
  }

  // Merge valores
  const ingresos = data.ingresosAnuales ?? parseFloat(existing.ingresosAnuales ?? "0");
  const personal = data.cantidadPersonal ?? existing.cantidadPersonal;
  const formaJuridica = data.formaJuridica ?? existing.formaJuridica;

  // Reclasificar
  const nuevaClasificacion = clasificarMIC(ingresos, personal);
  const nuevoRegimen = determinarRegimenIRE(nuevaClasificacion);

  // Actualizar config
  await db()
    .update(tenantConfig)
    .set({
      ruc: data.ruc ?? existing.ruc,
      dv: data.dv ?? existing.dv,
      razonSocial: data.razonSocial ?? existing.razonSocial,
      ingresosAnuales: String(ingresos.toFixed(2)),
      cantidadPersonal: personal,
      capitalIntegrado: data.capitalIntegrado !== undefined
        ? String(data.capitalIntegrado.toFixed(2))
        : existing.capitalIntegrado,
      formaJuridica,
      clasificacionMic: nuevaClasificacion,
      regimenIre: nuevoRegimen,
      updatedAt: new Date(),
    })
    .where(eq(tenantConfig.tenantSlug, tenantSlug));

  // Re-sincronizar libros obligatorios
  await sincronizarLibros(tenantSlug, formaJuridica, nuevoRegimen);

  return getTenantProfile(tenantSlug);
}

/**
 * Crea un perfil por defecto para un tenant nuevo.
 */
async function createDefaultProfile(tenantSlug: string) {
  const clasificacion = clasificarMIC(0, 0);
  const regimen = determinarRegimenIRE(clasificacion);

  const [config] = await db()
    .insert(tenantConfig)
    .values({
      tenantSlug,
      clasificacionMic: clasificacion,
      regimenIre: regimen,
    })
    .returning();

  // Activar libros por defecto
  await sincronizarLibros(tenantSlug, "UNIPERSONAL", regimen);

  return config;
}

/**
 * Sincroniza la tabla de libros obligatorios según la clasificación actual.
 *
 * Inserta los que faltan, actualiza los existentes, NO elimina
 * (por si el usuario marcó manualmente algún libro como rubricado).
 */
async function sincronizarLibros(
  tenantSlug: string,
  formaJuridica: string,
  regimenIre: string,
) {
  const librosRequeridos = activarLibrosObligatorios(formaJuridica, regimenIre);
  const existentes = await db()
    .select({ libro: librosObligatorios.libro })
    .from(librosObligatorios)
    .where(eq(librosObligatorios.tenantSlug, tenantSlug));

  const existentesSet = new Set(existentes.map((l) => l.libro));

  for (const lr of librosRequeridos) {
    if (!existentesSet.has(lr.libro)) {
      await db().insert(librosObligatorios).values({
        tenantSlug,
        libro: lr.libro,
        obligatorio: lr.obligatorio,
      });
    } else {
      // Actualizar obligatorio si cambió
      await db()
        .update(librosObligatorios)
        .set({ obligatorio: lr.obligatorio })
        .where(
          and(
            eq(librosObligatorios.tenantSlug, tenantSlug),
            eq(librosObligatorios.libro, lr.libro),
          ),
        );
    }
  }
}
