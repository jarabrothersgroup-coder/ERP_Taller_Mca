/**
 * Fiscal Documents — Drizzle ORM schema (SIFEN/DNIT V150).
 *
 * Stores electronic invoice (DTE) data including the signed XML,
 * CDC (Código de Control), KUDE (Kude) PDF URL, and the full
 * lifecycle status of each fiscal document.
 *
 * Multi-tenant: these tables live in each tenant's schema.
 *
 * @module finance/schema/fiscal-docs
 */

import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── ENUMs ─────────────────────────────────────

/**
 * DTE (Documento Tributario Electrónico) types per DNIT SIFEN.
 */
export const dteTipoEnum = pgEnum("dte_tipo", [
  "FACTURA",              // Factura Electrónica
  "NOTA_CREDITO",         // Nota de Crédito Electrónica
  "NOTA_DEBITO",          // Nota de Débito Electrónica
  "AUTOFACTURA",          // Autofactura Electrónica
  "COMPROBANTE_RETENCION",// Comprobante de Retención
]);

export type DTETipo = typeof dteTipoEnum.enumValues[number];

/**
 * Estado del documento fiscal a lo largo de su ciclo de vida.
 */
export const fiscalDocStatusEnum = pgEnum("fiscal_doc_status", [
  "BORRADOR",      // En edición, sin enviar
  "FIRMADO",       // XML firmado digitalmente, listo para enviar
  "ENVIADO",       // Enviado a DNIT, esperando respuesta
  "APROBADO",      // DNIT aprobó, CDC asignado
  "RECHAZADO",     // DNIT rechazó
  "ANULADO",       // Anulado por el contribuyente
]);

export type FiscalDocStatus = typeof fiscalDocStatusEnum.enumValues[number];

/**
 * Tipo de operación económica.
 */
export const tipoOperacionEnum = pgEnum("tipo_operacion", [
  "VENTA",            // Venta de bienes
  "SERVICIO",         // Prestación de servicios
  "VENTA_SERVICIO",   // Venta + Servicio
  "EXPORTACION",      // Exportación
  "IMPORTACION",      // Importación
]);

export type TipoOperacion = typeof tipoOperacionEnum.enumValues[number];

// ─── Tables ────────────────────────────────────

/**
 * Documentos Tributarios Electrónicos (DTE) — tabla principal.
 *
 * Almacena cada factura/nota emitida con su XML completo,
 * CDC asignado por DNIT, y estado del ciclo de vida.
 * Cada DTE pertenece a un cliente (receptor) y opcionalmente
 * a una orden de trabajo.
 *
 * @note El XML firmado se almacena comprimido si supera los 10KB
 *       para optimizar almacenamiento en Neon/Supabase.
 */
export const fiscalDocumentos = pgTable(
  "fiscal_documentos",
  {
    /** Primary key UUID */
    id: uuid("id").primaryKey().defaultRandom(),

    // ─── Emisor (el taller) ───────────────────
    /** RUC del taller (emisor) */
    emisorRuc: text("emisor_ruc").notNull(),
    /** Razón social del emisor */
    emisorRazonSocial: text("emisor_razon_social").notNull(),

    // ─── Receptor (cliente) ───────────────────
    /** Client UUID (from clients table) */
    clienteId: uuid("cliente_id").notNull(),
    /** RUC / CI del cliente receptor */
    receptorRuc: text("receptor_ruc").notNull(),
    /** Razón social / nombre del receptor */
    receptorRazonSocial: text("receptor_razon_social").notNull(),
    /** Dirección del receptor */
    receptorDireccion: text("receptor_direccion"),

    // ─── Work order linkage ───────────────────
    /** Optional work order that generated this invoice */
    ordenTrabajoId: uuid("orden_trabajo_id"),

    // ─── DTE identification ───────────────────
    /** DTE type: Factura, NotaCredito, etc. */
    dteTipo: dteTipoEnum("dte_tipo").notNull().default("FACTURA"),
    /** Tipo de operación económica */
    tipoOperacion: tipoOperacionEnum("tipo_operacion").notNull().default("VENTA_SERVICIO"),
    /** Invoice series (e.g. "001") */
    serie: text("serie").notNull(),
    /** Invoice number (e.g. "0001234") */
    numero: text("numero").notNull(),
    /** Unique: serie + numero form the DTE ID within a tenant */

    /** Fecha de emisión (timestamp ISO) */
    fechaEmision: timestamp("fecha_emision", { withTimezone: true }).notNull().defaultNow(),

    // ─── Monetary ────────────────────────────
    /** Currency: PYG, USD, etc. */
    moneda: text("moneda").notNull().default("PYG"),
    /** Tipo de cambio (if foreign currency) */
    tipoCambio: numeric("tipo_cambio", { precision: 12, scale: 6 }),
    /** Total exento de IVA */
    totalExento: numeric("total_exento", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total gravado IVA 5% */
    totalIva5: numeric("total_iva_5", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total gravado IVA 10% */
    totalIva10: numeric("total_iva_10", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total líquido (suma de totales) */
    totalLiquido: numeric("total_liquido", { precision: 14, scale: 2 }).notNull().default("0"),
    /** IVA total */
    totalIva: numeric("total_iva", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Total final del documento */
    totalDocumento: numeric("total_documento", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Descuento global */
    descuentoGlobal: numeric("descuento_global", { precision: 14, scale: 2 }).default("0"),
    /** Condición de venta */
    condicionVenta: text("condicion_venta").notNull().default("CONTADO"),

    // ─── SIFEN fields ─────────────────────────
    /**
     * CDC (Código de Control) — 44-character alphanumeric code
     * assigned by DNIT after successful validation.
     * NULL until the DTE is approved.
     */
    cdc: text("cdc"),
    /**
     * Número de transacción SIFEN (internal DNIT tracking).
     */
    numeroTransaccion: text("numero_transaccion"),
    /**
     * Full signed XML body (after X.509 signature).
     * NULL until the DTE is signed.
     */
    xmlFirmado: text("xml_firmado"),
    /**
     * XML original (before signing) — for debugging and re-signing.
     */
    xmlOriginal: text("xml_original"),
    /**
     * KUDE (Kude) PDF URL — taxpayer-facing invoice PDF.
     */
    kuDePdfUrl: text("kude_pdf_url"),

    // ─── Status lifecycle ─────────────────────
    /** Current lifecycle status */
    estado: fiscalDocStatusEnum("estado").notNull().default("BORRADOR"),
    /** DNIT rejection/error message (if any) */
    mensajeError: text("mensaje_error"),
    /** Raw SOAP response XML from DNIT (for auditing) */
    respuestaSifenXml: text("respuesta_sifen_xml"),

    // ─── Metadata ─────────────────────────────
    /** Timestamp when sent to DNIT */
    fechaEnvio: timestamp("fecha_envio", { withTimezone: true }),
    /** Timestamp when DNIT approved */
    fechaAprobacion: timestamp("fecha_aprobacion", { withTimezone: true }),
    /** Soft-delete / cancellation flag */
    activo: boolean("activo").notNull().default(true),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /** Index on serie + numero — fast DTE lookup */
    serieNumeroIdx: index("fiscal_doc_serie_numero_idx").on(
      table.serie, table.numero,
    ),
    /** Index on CDC — for quick query by control code */
    cdcIdx: index("fiscal_doc_cdc_idx").on(table.cdc),
    /** Index on estado — filter by status */
    estadoIdx: index("fiscal_doc_estado_idx").on(table.estado),
    /** Index on cliente_id — list invoices per client */
    clienteIdx: index("fiscal_doc_cliente_idx").on(table.clienteId),
    /** Index on orden_trabajo_id — link to work orders */
    ordenTrabajoIdx: index("fiscal_doc_ot_idx").on(table.ordenTrabajoId),
    /** Index on fecha_emision — date-range queries */
    fechaEmisionIdx: index("fiscal_doc_fecha_emision_idx").on(table.fechaEmision),
  }),
);

// ─── DTE Line Items ────────────────────────────

/**
 * Líneas de detalle del DTE.
 *
 * Cada item de una factura se registra aquí con su descripción,
 * cantidad, precio, IVA, y referencias al inventario si procede.
 */
export const fiscalDocumentoDetalles = pgTable(
  "fiscal_documento_detalles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Parent DTE */
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => fiscalDocumentos.id, { onDelete: "cascade" }),

    // ─── Item data ─────────────────────────────
    /** Line number within the DTE */
    numeroLinea: integer("numero_linea").notNull(),
    /** Quantity */
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    /** Unit of measure */
    unidadMedida: text("unidad_medida").notNull().default("UNIDAD"),
    /** Description */
    descripcion: text("descripcion").notNull(),
    /** Unit price (sin IVA) */
    precioUnitario: numeric("precio_unitario", { precision: 14, scale: 2 }).notNull(),
    /** IVA rate: 0, 5, or 10 */
    iva: integer("iva").notNull().default(10),
    /** IVA amount */
    ivaMonto: numeric("iva_monto", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Subtotal before IVA */
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),

    // ─── References ────────────────────────────
    /** Optional repuesto UUID */
    repuestoId: uuid("repuesto_id"),
    /** Optional servicio UUID */
    servicioId: uuid("servicio_id"),

    // ─── Timestamps ─────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    documentoIdx: index("fiscal_detalle_documento_idx").on(table.documentoId),
  }),
);

// ─── SIFEN sync log ────────────────────────────

/**
 * Bitácora de comunicación con los Web Services de SIFEN.
 *
 * Cada intento de envío, consulta o anulación queda registrado
 * para auditoría y debugging.
 */
export const sifenSyncLog = pgTable(
  "sifen_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** DTE UUID */
    documentoId: uuid("documento_id")
      .notNull()
      .references(() => fiscalDocumentos.id, { onDelete: "cascade" }),
    /** Operation: ENVIO, CONSULTA, ANULACION */
    operacion: text("operacion").notNull(),
    /** Result code */
    codigoResultado: text("codigo_resultado"),
    /** CDC involved (if any) */
    cdc: text("cdc"),
    /** XML sent to DNIT */
    xmlEnviado: text("xml_enviado"),
    /** XML received from DNIT */
    xmlRecibido: text("xml_recibido"),
    /** HTTP status */
    httpStatus: integer("http_status"),
    /** Error message on failure */
    mensajeError: text("mensaje_error"),
    /** Duration in ms */
    duracionMs: integer("duracion_ms"),
    /** Success flag */
    exitoso: boolean("exitoso").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    documentoIdx: index("sifen_log_documento_idx").on(table.documentoId),
    operacionIdx: index("sifen_log_operacion_idx").on(table.operacion),
  }),
);

// ─── Types ────────────────────────────────────

export type FiscalDocumento = typeof fiscalDocumentos.$inferSelect;
export type NewFiscalDocumento = typeof fiscalDocumentos.$inferInsert;

export type FiscalDocumentoDetalle = typeof fiscalDocumentoDetalles.$inferSelect;
export type NewFiscalDocumentoDetalle = typeof fiscalDocumentoDetalles.$inferInsert;

export type SifenSyncLogEntry = typeof sifenSyncLog.$inferSelect;
export type NewSifenSyncLogEntry = typeof sifenSyncLog.$inferInsert;
