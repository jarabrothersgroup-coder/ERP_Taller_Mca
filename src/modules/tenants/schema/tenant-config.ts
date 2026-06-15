/**
 * Tenant Configuration — Drizzle ORM schema.
 *
 * Define la clasificación del tenant según parámetros MIC (Ministerio
 * de Industria y Comercio) y la forma jurídica, activando los libros
 * obligatorios correspondientes según la Ley 4457/12 y DNIT.
 *
 * @module tenants/schema/tenant-config
 */

import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Tablas ────────────────────────────────────

/**
 * Configuración del Tenant — clasificación MIC + datos societarios.
 *
 * Almacena la información que determina qué libros y formularios
 * son obligatorios para el contribuyente.
 */
export const tenantConfig = pgTable(
  "tenant_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Slug único del tenant (corresponde al header X-Tenant-Slug) */
    tenantSlug: text("tenant_slug").notNull(),

    // ─── Identificación Tributaria ────────────
    /** RUC del contribuyente (8 dígitos + DV) */
    ruc: text("ruc").notNull().default(""),
    /** Dígito verificador del RUC */
    dv: text("dv").notNull().default(""),
    /** Razón social completa */
    razonSocial: text("razon_social").notNull().default(""),

    // ─── Clasificación MIC ────────────────────
    /**
     * Clasificación según MIC (Ley 4457/12):
     *   MICRO → ingresos ≤ 500M, personal ≤ 10
     *   PEQUENIA → ingresos ≤ 5MM, personal ≤ 30
     *   MEDIANA → ingresos ≤ 20MM, personal ≤ 100
     *   GRANDE → ingresos > 20MM, personal > 100
     */
    clasificacionMic: text("clasificacion_mic").notNull().default("PEQUENIA"),

    /** Forma jurídica: SA, SRL, EAS, SAECA, UNIPERSONAL, COOPERATIVA, ONG */
    formaJuridica: text("forma_juridica").notNull().default("UNIPERSONAL"),

    /** Régimen IRE: IRE_GENERAL, IRE_SIMPLE, IRE_RESIMPLE */
    regimenIre: text("regimen_ire").notNull().default("IRE_SIMPLE"),

    // ─── Parámetros de Clasificación ──────────
    /** Ingresos anuales del último ejercicio cerrado (Gs.) */
    ingresosAnuales: numeric("ingresos_anuales", { precision: 16, scale: 2 }).notNull().default("0"),
    /** Cantidad de personal ocupado */
    cantidadPersonal: integer("cantidad_personal").notNull().default(0),
    /** Capital social integrado (Gs.) — para cálculo de reserva legal */
    capitalIntegrado: numeric("capital_integrado", { precision: 14, scale: 2 }).notNull().default("0"),

    // ─── Control de Ejercicio Contable ────────
    /** Ejercicio fiscal actual */
    ejercicioActual: integer("ejercicio_actual").notNull().default(2026),
    /** Último mes con asientos contabilizados (1-12) */
    periodoAbiertoMes: integer("periodo_abierto_mes").notNull().default(1),
    /** Último mes cerrado (inmutable, 0 = ninguno) */
    cerradoHastaMes: integer("cerrado_hasta_mes").notNull().default(0),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantSlugUnique: unique("tenant_config_slug_unique").on(table.tenantSlug),
    tenantSlugIdx: index("tenant_config_slug_idx").on(table.tenantSlug),
  }),
);

/**
 * Libros Obligatorios del Tenant.
 *
 * Define qué libros contables y societarios debe llevar el contribuyente
 * según su forma jurídica y régimen, incluyendo estado de rúbrica.
 */
export const librosObligatorios = pgTable(
  "libros_obligatorios",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Slug del tenant */
    tenantSlug: text("tenant_slug").notNull(),

    /**
     * Tipo de libro:
     *   DIARIO, MAYOR, INVENTARIO — contables obligatorios
     *   ACTAS_ASAMBLEA, REGISTRO_ACCIONES — S.A./E.A.S./S.A.E.C.A.
     *   REGISTRO_SOCIOS — S.R.L.
     *   COMPRAS_VENTAS_SIMPLE — IRE Simple
     *   INGRESOS_EGRESOS_RESIMPLE — IRE Resimple
     */
    libro: text("libro").notNull(),

    /** Indica si es obligatorio para este tenant */
    obligatorio: boolean("obligatorio").notNull().default(true),
    /** Indica si ya fue rubricado en la Abogacía del Tesoro */
    rubricado: boolean("rubricado").notNull().default(false),
    /** Fecha de rúbrica */
    fechaRubrica: timestamp("fecha_rubrica", { withTimezone: true }),
    /** Número de rúbrica asignado */
    numeroRubrica: text("numero_rubrica"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantLibroUnique: unique("libros_obligatorios_tenant_libro_unique").on(
      table.tenantSlug, table.libro,
    ),
    tenantIdx: index("libros_obligatorios_tenant_idx").on(table.tenantSlug),
  }),
);

// ─── Types ────────────────────────────────────

export type TenantConfig = typeof tenantConfig.$inferSelect;
export type NewTenantConfig = typeof tenantConfig.$inferInsert;

export type LibroObligatorio = typeof librosObligatorios.$inferSelect;
export type NewLibroObligatorio = typeof librosObligatorios.$inferInsert;
