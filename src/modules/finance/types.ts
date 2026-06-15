/**
 * Finance module — shared types & DTOs for SIFEN and Accounting.
 *
 * Defines request/response schemas for the finance Fastify endpoints.
 * Covers:
 *   - SIFEN electronic invoicing (DNIT V150, CDC, firmado digital)
 *   - Double-entry accounting (plan de cuentas, asientos contables)
 *   - RG 90 Marangatu export
 *
 * @module finance/types
 */

import type { FiscalDocStatus, DTETipo } from "./schema/fiscal-docs.js";

// ─── SIFEN / Electronic Invoicing ─────────────

/** Tipo de Contribuyente (Paraguay) */
export type TipoContribuyente =
  | "FISICO"        // Persona Física
  | "EMPRESARIAL"   // Empresa Unipersonal
  | "SOCIEDAD"      // Sociedad
  | "COOPERATIVA"
  | "ONG";

/** Régimen de IVA */
export type RegimenIVA =
  | "GENERAL"       // Régimen General
  | "PEQUENIO"      // Pequeño Contribuyente
  | "SIMPLIFICADO"  // Simplificado
  | "EXENTO";       // Exento

/** Moneda del DTE */
export type MonedaDTE = "PYG" | "USD" | "EUR" | "BRL" | "ARS";

/** Condición de venta */
export type CondicionVenta =
  | "CONTADO"       // Contado
  | "CREDITO"       // Crédito
  | "TARJETA_CRED"
  | "TARJETA_DEB"
  | "TRANSFERENCIA"
  | "OTRO";

/** POST /finance/sifen/emitir request body */
export interface EmitirDTERequest {
  /** Work order UUID that triggered this invoice */
  ordenTrabajoId: string;
  /** Client (receptor) UUID */
  clienteId: string;
  /** DTE type: Factura, NotaCredito, NotaDebito, etc. */
  dteTipo: DTETipo;
  /** Invoice series (e.g. "001") */
  serie: string;
  /** Invoice number (e.g. "0001234") */
  numero: string;
  /** Fecha de emisión (ISO 8601). Defaults to now. */
  fechaEmision?: string;
  /** Condición de venta */
  condicionVenta: CondicionVenta;
  /** Moneda */
  moneda: MonedaDTE;
  /** Tipo de cambio (if foreign currency) */
  tipoCambio?: number;
  /** Line items */
  items: DTEItemRequest[];
  /** IVA regime */
  regimenIVA: RegimenIVA;
  /** Descuento global (Gs) */
  descuentoGlobal?: string;
}

/** A single line item in a DTE */
export interface DTEItemRequest {
  /** Quantity */
  cantidad: number;
  /** Unit of measure (e.g. "UNIDAD", "KILO", "LITRO", "HORA") */
  unidadMedida: string;
  /** Product / service description */
  descripcion: string;
  /** Unit price (sin IVA) */
  precioUnitario: string;
  /** IVA rate: 0, 5, 10 (Paraguay: 5% reduced, 10% standard) */
  iva: number;
  /** IVA amount (pre-calculated or leave for backend) */
  ivaMonto?: string;
  /** Subtotal before IVA */
  subtotal: string;
  /** Internal repuesto ID if line is a spare part */
  repuestoId?: string | null;
  /** Internal service ID if line is a labor service */
  servicioId?: string | null;
}

/** Response after emitting a DTE */
export interface EmitirDTEResponse {
  /** Fiscal document record */
  documento: {
    id: string;
    dteTipo: DTETipo;
    serie: string;
    numero: string;
    cdc: string | null;
    estado: FiscalDocStatus;
    xmlFirmado: string | null;
    kuDePdfUrl: string | null;
  };
  /** Timestamp */
  emitidoEn: string;
}

/** Response from SIFEN SOAP WS after envío */
export interface SIFENSoapResponse {
  /** Result code from DNIT */
  codigoResultado: string;
  /** CDC (Código de Control) assigned */
  cdc: string | null;
  /** Número de transacción SIFEN */
  numeroTransaccion: string | null;
  /** Error message if rejected */
  mensajeError: string | null;
  /** Raw SOAP response XML */
  rawXml?: string;
}

/** GET /finance/sifen/consulta query */
export interface ConsultaDTEQuery {
  /** CDC to query */
  cdc: string;
  /** DTE type */
  dteTipo?: DTETipo;
}

// ─── Accounting (Double-Entry) ─────────────────

/** Tipo de cuenta contable */
export type TipoCuenta =
  | "ACTIVO"
  | "PASIVO"
  | "PATRIMONIO"
  | "INGRESO"
  | "GASTO"
  | "COSTO"
  | "ORDEN";

/** POST /finance/contabilidad/cuentas request body */
export interface CreateCuentaRequest {
  /** Account code (e.g. "1.1.01.001") */
  codigo: string;
  /** Account name */
  nombre: string;
  /** Account type */
  tipo: TipoCuenta;
  /** Parent account ID (for hierarchical chart of accounts) */
  cuentaPadreId?: string | null;
  /** Whether this is an account that accepts transactions */
  aceptaMovimientos?: boolean;
  /** Nivel jerárquico (0 = raíz) */
  nivel?: number;
}

/** POST /finance/contabilidad/asientos request body */
export interface CreateAsientoRequest {
  /** Fecha del asiento (ISO 8601) */
  fecha: string;
  /** Concepto / glosa */
  concepto: string;
  /** Reference to origin document */
  documentoRef?: string | null;
  /** Module that originated the entry */
  moduloOrigen?: string;
  /** Work order UUID if related */
  ordenTrabajoId?: string | null;
  /** Debe / Haber lines */
  lineas: AsientoLineaRequest[];
}

/** A single double-entry line */
export interface AsientoLineaRequest {
  /** Chart of account UUID */
  cuentaId: string;
  /** Debe amount (monto débito) */
  debe?: string;
  /** Haber amount (monto crédito) */
  haber?: string;
  /** Additional description for this line */
  descripcion?: string | null;
  /**
   * Centro de Costo (dimensión analítica).
   * Obligatorio para cuentas de COSTO (5) y GASTO (6) según engram.json.
   */
  centroCostoId?: string | null;
  /**
   * Orden de Trabajo (dimensión analítica).
   * Obligatorio para cuentas de COSTO (5) y GASTO (6).
   */
  ordenTrabajoId?: string | null;
}

/** Response after creating an asiento */
export interface CreateAsientoResponse {
  asiento: {
    id: string;
    numero: number;
    fecha: string;
    concepto: string;
    totalDebe: string;
    totalHaber: string;
    estado: string;
  };
  lineas: Array<{
    id: string;
    cuentaCodigo: string;
    cuentaNombre: string;
    debe: string | null;
    haber: string | null;
  }>;
}

/** POST /finance/contabilidad/asientos/automatico request body */
export interface AsientoAutomaticoRequest {
  /** Work order UUID */
  ordenTrabajoId: string;
  /** Date for the accounting entry */
  fecha: string;
  /** Optional concept override */
  concepto?: string;
}

// ─── RG 90 (Marangatu) ─────────────────────────

/** RG 90 export record */
export interface RG90ExportRecord {
  /** RUC del contribuyente */
  ruc: string;
  /** DV (dígito verificador) */
  dv: string;
  /** Razón social */
  razonSocial: string;
  /** Periodo: año */
  anho: number;
  /** Periodo: mes */
  mes: number;
  /** Tipo de registro (A = asientos) */
  tipoRegistro: "A";
  /** Número de asiento */
  numeroAsiento: number;
  /** Fecha del asiento (DDMMAAAA) */
  fechaAsiento: string;
  /** Código de cuenta */
  codigoCuenta: string;
  /** Descripción de la cuenta */
  descripcionCuenta: string;
  /** Débito del asiento */
  debe: string;
  /** Crédito del asiento */
  haber: string;
  /** Número de documento de respaldo */
  documentoRespaldo: string;
  /** Descripción del comprobante */
  descripcionComprobante: string;
}

/** POST /finance/rg90/exportar request body */
export interface RG90ExportRequest {
  /** Tax year */
  anho: number;
  /** Tax month (1-12) */
  mes: number;
  /** Export format */
  formato?: "TXT" | "CSV" | "JSON";
}

/** RG 90 export response */
export interface RG90ExportResponse {
  /** Period */
  periodo: { anho: number; mes: number };
  /** Number of records exported */
  totalRegistros: number;
  /** Total debe */
  totalDebe: string;
  /** Total haber */
  totalHaber: string;
  /** Download URL for the generated file */
  archivoUrl: string;
  /** File format */
  formato: string;
}

// ─── Common ────────────────────────────────────

/** Pagination query params */
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

/** Error response */
export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

// ─── Fiscal Forms (Formularios DNIT) ──────────

/** POST /finance/fiscal/form120/calcular request */
export interface CalcularForm120Request {
  /** Año fiscal */
  anho: number;
  /** Mes fiscal (1-12) */
  mes: number;
}

/** Resultado de la liquidación del Formulario 120 (IVA) */
export interface Form120Result {
  /** Período liquidado */
  periodo: { anho: number; mes: number };
  /** ID del periodo fiscal registrado */
  periodoFiscalId: string;
  /** ID de la liquidación persistida */
  liquidacionId: string;

  // ─── Débito Fiscal (Rubro 1) ─────────────────
  ventas: {
    gravada10: string;
    iva10: string;
    gravada5: string;
    iva5: string;
    exenta: string;
    total: string;
  };

  // ─── Crédito Fiscal (Rubro 2) ────────────────
  compras: {
    gravada10: string;
    iva10: string;
    gravada5: string;
    iva5: string;
    otras: string;
    total: string;
  };

  // ─── Liquidación (Rubro 3) ───────────────────
  ivaDebito: string;
  ivaCredito: string;
  ivaAPagar: string;
  saldoFavor: string;

  /** Índice de prorrateo (si aplica) */
  prorrateoIndice: string | null;
  /** Saldo arrastre del período anterior */
  saldoArrastre: string;

  /** Alertas de pre-auditoría */
  alertas: string[];
}

// ─── IRE — Impuesto a la Renta Empresarial (Form 500/501/502) ──

/** Formulario IRE: General | Simple | Resimple */
export type FormularioIRE = "FORM_500_IRE" | "FORM_501_IRE_SIMPLE" | "FORM_502_IRE_RESIMPLE";

/** POST /finance/fiscal/ire/calcular request */
export interface CalcularIreRequest {
  /** Año fiscal a liquidar */
  anho: number;
  /** Formulario: 500 (General), 501 (Simple), 502 (Resimple) */
  formulario: FormularioIRE;
}

/** Resultado de la liquidación del Impuesto a la Renta Empresarial */
export interface IreResult {
  /** Período liquidado */
  periodo: { anho: number };
  /** Formulario aplicado */
  formulario: FormularioIRE;
  /** ID del periodo fiscal registrado */
  periodoFiscalId: string;
  /** ID de la liquidación persistida */
  liquidacionId: string;

  // ─── Ingresos ────────────────────────────────
  ingresos: {
    servicios: string;
    bienes: string;
    noOperacionales: string;
    brutos: string;
  };

  // ─── Costos ──────────────────────────────────
  costos: {
    repuestos: string;
    manoObra: string;
    indirectos: string;
    total: string;
  };

  // ─── Gastos ──────────────────────────────────
  gastos: {
    administrativos: string;
    ventas: string;
    total: string;
  };

  // ─── Deducciones Adicionales ─────────────────
  donaciones: string;
  otrasDeducciones: string;
  totalDeducciones: string;

  // ─── Cálculo ─────────────────────────────────
  rentaNeta: string;
  impuestoIre: string;
  reservaLegal: string;
  retenciones: string;
  anticipos: string;
  saldoPagar: string;
  saldoFavor: string;

  /** Alertas de pre-auditoría */
  alertas: string[];
}

// ─── ISC — Impuesto Selectivo al Consumo (Form 130) ──

/** Rubros ISC */
export type RubroISC =
  | "COMBUSTIBLE"
  | "TABACO"
  | "BEBIDAS_ALCOHOLICAS"
  | "BIENES_SUNTUARIOS"
  | "OTROS";

/** POST /finance/fiscal/isc/calcular request */
export interface CalcularIscRequest {
  /** Año fiscal */
  anho: number;
  /** Mes fiscal (1-12) */
  mes: number;
  /** Rubro ISC */
  rubro: RubroISC;
  /** Cantidad (litros, unidades, kg) */
  cantidad?: number;
  /** Unidad de medida */
  unidadMedida?: string;
  /** Base imponible en Gs. */
  baseImponible: number;
  /** Tasa aplicada (ej: 0.24 = 24% o 350 = Gs./unidad) */
  tasa: number;
  /** Tipo de tasa */
  tipoTasa?: "PORCENTUAL" | "ESPECIFICA";
  /** Créditos / compensaciones */
  creditos?: number;
}

/** Resultado del ISC (Formulario 130) */
export interface IscResult {
  periodo: { anho: number; mes: number };
  rubro: RubroISC;
  periodoFiscalId: string;
  liquidacionId: string;

  cantidad: string;
  unidadMedida: string;
  baseImponible: string;
  tasaAplicada: string;
  tipoTasa: string;
  impuestoIsc: string;
  creditosIsc: string;
  saldoPagar: string;

  alertas: string[];
}

// ─── INR — Impuesto a la Renta de No Residentes (Form 515) ──

/** Tipos de renta para INR */
export type TipoRentaINR =
  | "SERVICIOS_TECNICOS"
  | "REGALIAS"
  | "INTERESES"
  | "DIVIDENDOS"
  | "OTROS";

/** POST /finance/fiscal/inr/calcular request */
export interface CalcularInrRequest {
  /** Año fiscal */
  anho: number;
  /** Mes fiscal (1-12) */
  mes: number;
  /** Tipo de renta pagada */
  tipoRenta: TipoRentaINR;
  /** Nombre del beneficiario del exterior */
  beneficiarioNombre?: string;
  /** País del beneficiario */
  beneficiarioPais?: string;
  /** Monto bruto pagado en Gs. */
  montoBruto: number;
  /** Tasa de retención (ej: 0.15 = 15%) */
  tasaRetencion: number;
}

/** Resultado del INR (Formulario 515) */
export interface InrResult {
  periodo: { anho: number; mes: number };
  tipoRenta: TipoRentaINR;
  beneficiarioNombre: string;
  beneficiarioPais: string;
  periodoFiscalId: string;
  liquidacionId: string;

  montoBruto: string;
  tasaRetencion: string;
  impuestoInr: string;
  saldoPagar: string;

  alertas: string[];
}

/** POST /finance/fiscal/idu/calcular request */
export interface CalcularIduRequest {
  /** Año fiscal a liquidar */
  anho: number;
  /** Tipo de beneficiario: RESIDENTE (8%) o NO_RESIDENTE (15%) */
  tipoBeneficiario?: "RESIDENTE" | "NO_RESIDENTE";
  /** Porcentaje de utilidades distribuido (0.01 - 1.00). Default 1.00 = 100% */
  porcentajeDistribuido?: number;
  /** Liquidación de IRE específica (UUID). Si se omite, usa la última del año. */
  liquidacionIreId?: string;
}

/** Resultado de la liquidación del IDU (Formulario 520) */
export interface IduResult {
  /** Período liquidado */
  periodo: { anho: number };
  /** Tipo de beneficiario */
  tipoBeneficiario: "RESIDENTE" | "NO_RESIDENTE";
  /** Tasa aplicada */
  tasaAplicada: string;
  /** ID del periodo fiscal registrado */
  periodoFiscalId: string;
  /** ID de la liquidación persistida */
  liquidacionId: string;
  /** Referencia a la liquidación IRE base */
  liquidacionIreId: string | null;

  // ─── Base desde IRE ─────────────────────────
  rentaNetaBase: string;
  impuestoIrePagado: string;
  reservaLegalBase: string;

  // ─── Utilidad Distribuible ──────────────────
  utilidadDistribuible: string;
  porcentajeDistribuido: string;
  utilidadEfectiva: string;

  // ─── Cálculo IDU ────────────────────────────
  impuestoIdu: string;
  retencionesIdu: string;
  saldoPagar: string;
  saldoFavor: string;

  /** Alertas de pre-auditoría */
  alertas: string[];
}

// ─── Sprint 3: Devengamiento, Depreciación, Centralización ──

/** POST /finance/contabilidad/devengamiento/ingresos request */
export interface DevengamientoIngresosRequest {
  anho: number;
  mes: number;
}

/** POST /finance/contabilidad/devengamiento/gastos request */
export interface DevengamientoGastosRequest {
  gastos: Array<{
    concepto: string;
    monto: number;
    cuentaGastoId: string;
    cuentaPagarId?: string;
    ordenTrabajoId?: string;
  }>;
}

/** POST /finance/contabilidad/devengamiento/ajustes request */
export interface AjustesPeriodoRequest {
  ajustes: Array<{
    concepto: string;
    lineas: AsientoLineaRequest[];
  }>;
}

/** POST /finance/contabilidad/devengamiento/revertir request */
export interface RevertirDevengamientoRequest {
  anho: number;
  mes: number;
}

/** POST /finance/contabilidad/depreciacion/calcular request */
export interface CalcularDepreciacionRequest {
  anho: number;
  mes: number;
}

/** POST /finance/contabilidad/depreciacion/activos request */
export interface CreateActivoFijoRequest {
  codigo: string;
  nombre: string;
  tipo: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  fechaAdquisicion: string;
  costoAdquisicion: number;
  valorResidual?: number;
  vidaUtilAnos: number;
  metodoDepreciacion?: "LINEA_RECTA" | "DIGITO_CRECIENTE" | "DIGITO_DECRECIENTE";
  notas?: string;
}

/** POST /finance/contabilidad/centralizacion/ejecutar request */
export interface CentralizacionRequest {
  anho: number;
  mes: number;
  modulos?: ("VENTAS" | "COMPRAS" | "INVENTARIO" | "NOMINA")[];
}

// ─── Sprint 4: Fx, Revaluo, Refundición, Reserva Legal ──

/** POST /finance/contabilidad/tipos-cambio request */
export interface SetExchangeRateRequest {
  moneda: string;
  fecha: string;
  compra: number;
  venta: number;
  referencia?: number;
  fuente?: string;
  notas?: string;
}

/** POST /finance/contabilidad/diferencia-cambio/calcular request */
export interface DiferenciaCambioRequest {
  anho: number;
  mes: number;
}

/** POST /finance/contabilidad/revaluo request */
export interface RevaluoRequest {
  activoFijoId: string;
  nuevoValor: number;
  fecha: string;
  motivo?: string;
}

/** POST /finance/contabilidad/refundir request */
export interface RefundirRequest {
  asientoIds: string[];
  fecha?: string;
  concepto?: string;
}

/** POST /finance/contabilidad/reserva-legal request */
export interface ReservaLegalRequest {
  anho: number;
}

// ─── Sprint 5: Libros Contables ──

/** GET /finance/contabilidad/libro-diario request */
export interface LibroDiarioRequest {
  anho: number;
  mes: number;
}

/** GET /finance/contabilidad/libro-mayor request */
export interface LibroMayorRequest {
  anho: number;
  mes: number;
  codigoDesde?: string;
  codigoHasta?: string;
}

/** GET /finance/contabilidad/libro-inventario request */
export interface LibroInventarioRequest {
  anho: number;
  mes: number;
}
