/**
 * Seed script: Fiscal / electronic invoicing extra data (DNIT SIFEN V150).
 *
 * Populates the fiscal module tables that remain empty in a demo tenant:
 *   periodos_fiscales, liquidaciones_iva, liquidaciones_ire, liquidaciones_idu,
 *   liquidaciones_isc, liquidaciones_inr, fiscal_documentos,
 *   fiscal_documento_detalles, sifen_sync_log.
 *
 * Domain: Paraguay — DNIT SIFEN V150, RG 90 Marangatu (pre-factura electrónica),
 * Ley 1034/83. IVA / IRE / INR / IDU / ISC are Paraguayan taxes.
 *
 * Idempotent by design: every insert uses fixed/deterministic values and is
 * guarded by a marker lookup, so re-running inserts 0 new rows.
 *
 * Usage: npx tsx scripts/seed-fiscal-extra.ts <tenant_slug>
 *
 * @module scripts/seed-fiscal-extra
 */

import { db } from "../src/shared/database/drizzle.js";
import { closeDb } from "../src/shared/database/connection.js";
import { eq } from "drizzle-orm";
import {
  tenants,
  tenantConfig,
  clients,
  fiscalDocumentos,
  fiscalDocumentoDetalles,
  sifenSyncLog,
} from "../src/shared/database/schema/index.js";
import {
  periodosFiscales,
  liquidacionesIva,
  liquidacionesIre,
  liquidacionesIdu,
  liquidacionesIsc,
  liquidacionesInr,
} from "../src/modules/finance/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-fiscal-extra.ts <tenant_slug>");
  process.exit(1);
}

// ─── Emisor fallback (tenant_config for demo has no razon_social set) ──
const EMISOR_RUC_FALLBACK = "80012345-6";
const EMISOR_RAZON_SOCIAL_FALLBACK = "Taller MCA S.A.";

/** Deterministic ISO timestamp helper. */
const ts = (iso: string): Date => new Date(iso);

/**
 * Builds a deterministic 44-char CDC (Código de Control) for a DTE.
 *
 * Layout: tipo(2) + RUC(8) + DV(1) + estab(3) + punto(3) + tipoDoc(2)
 *         + numero(7) + fecha(8) + tipoEmision(1) + seguridad(9) = 44 chars.
 */
function makeCdc(numero: string, isoFecha: string, tipoDoc: string): string {
  const fecha = isoFecha.slice(0, 10).replace(/-/g, "");
  return (
    "01" +
    "80012345" +
    "6" +
    "001" +
    "001" +
    tipoDoc +
    numero.padStart(7, "0") +
    fecha +
    "1" +
    "123456789"
  );
}

interface LineaDef {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  iva: number;
}

/** Builds a line item row (subtotal / IVA computed from quantity × price). */
function linea(numeroLinea: number, def: LineaDef) {
  const subtotal = def.cantidad * def.precioUnitario;
  const ivaMonto = Math.round((subtotal * def.iva) / 100);
  return {
    numeroLinea,
    descripcion: def.descripcion,
    cantidad: def.cantidad.toFixed(2),
    unidadMedida: "UNIDAD",
    precioUnitario: def.precioUnitario.toFixed(2),
    iva: def.iva,
    ivaMonto: ivaMonto.toFixed(2),
    subtotal: subtotal.toFixed(2),
  };
}

/** Aggregates document totals from its line items (keeps IVA math consistent). */
function totales(lineas: ReturnType<typeof linea>[]) {
  let exento = 0;
  let iva5 = 0;
  let iva10 = 0;
  let ivaTotal = 0;
  for (const l of lineas) {
    if (l.iva === 10) iva10 += Number(l.subtotal);
    else if (l.iva === 5) iva5 += Number(l.subtotal);
    else exento += Number(l.subtotal);
    ivaTotal += Number(l.ivaMonto);
  }
  const liquido = exento + iva5 + iva10;
  return {
    totalExento: exento.toFixed(2),
    totalIva5: iva5.toFixed(2),
    totalIva10: iva10.toFixed(2),
    totalLiquido: liquido.toFixed(2),
    totalIva: ivaTotal.toFixed(2),
    totalDocumento: (liquido + ivaTotal).toFixed(2),
  };
}

// ─── Períodos fiscales ─────────────────────────────────────────────
const PERIODOS = [
  { formulario: "FORM_120_IVA", anho: 2026, mes: 8, estado: "PRESENTADO", fechaPresentacion: ts("2026-09-10T12:00:00Z") },
  { formulario: "FORM_120_IVA", anho: 2026, mes: 9, estado: "BORRADOR", fechaPresentacion: null },
  { formulario: "FORM_500_IRE", anho: 2025, mes: 0, estado: "PRESENTADO", fechaPresentacion: ts("2026-03-31T12:00:00Z") },
  { formulario: "FORM_500_IRE", anho: 2024, mes: 0, estado: "PRESENTADO", fechaPresentacion: ts("2025-03-31T12:00:00Z") },
  { formulario: "FORM_520_IDU", anho: 2025, mes: 0, estado: "BORRADOR", fechaPresentacion: null },
  { formulario: "FORM_130_ISC", anho: 2026, mes: 9, estado: "BORRADOR", fechaPresentacion: null },
  { formulario: "FORM_515_INR", anho: 2026, mes: 9, estado: "BORRADOR", fechaPresentacion: null },
];

// ─── Documentos electrónicos (DTE) ─────────────────────────────────
interface DocDef {
  clienteIdx: number;
  serie: string;
  numero: string;
  dteTipo: "FACTURA" | "NOTA_CREDITO";
  tipoDoc: string;
  tipoOperacion: "VENTA" | "SERVICIO" | "VENTA_SERVICIO";
  estado: "APROBADO" | "ENVIADO" | "RECHAZADO";
  fecha: string;
  condicionVenta: string;
  lineas: ReturnType<typeof linea>[];
}

const DOC_DEFS: DocDef[] = [
  {
    clienteIdx: 0,
    serie: "001",
    numero: "0000101",
    dteTipo: "FACTURA",
    tipoDoc: "01",
    tipoOperacion: "VENTA_SERVICIO",
    estado: "APROBADO",
    fecha: "2026-08-12T13:00:00Z",
    condicionVenta: "CONTADO",
    lineas: [
      linea(1, { descripcion: "Mano de obra — Reparación de motor", cantidad: 1, precioUnitario: 1500000, iva: 10 }),
      linea(2, { descripcion: "Kit de juntas y empaques", cantidad: 1, precioUnitario: 850000, iva: 10 }),
    ],
  },
  {
    clienteIdx: 1,
    serie: "001",
    numero: "0000102",
    dteTipo: "FACTURA",
    tipoDoc: "01",
    tipoOperacion: "VENTA_SERVICIO",
    estado: "APROBADO",
    fecha: "2026-08-27T13:00:00Z",
    condicionVenta: "CREDITO_30_DIAS",
    lineas: [
      linea(1, { descripcion: "Aceite sintético 5W-30 (4L)", cantidad: 4, precioUnitario: 95000, iva: 10 }),
      linea(2, { descripcion: "Filtro de aceite", cantidad: 1, precioUnitario: 65000, iva: 10 }),
      linea(3, { descripcion: "Mano de obra — Service completo", cantidad: 1, precioUnitario: 250000, iva: 10 }),
    ],
  },
  {
    clienteIdx: 2,
    serie: "001",
    numero: "0000103",
    dteTipo: "FACTURA",
    tipoDoc: "01",
    tipoOperacion: "VENTA_SERVICIO",
    estado: "APROBADO",
    fecha: "2026-09-05T13:00:00Z",
    condicionVenta: "CONTADO",
    lineas: [
      linea(1, { descripcion: "Diagnóstico electrónico con scanner Launch", cantidad: 1, precioUnitario: 200000, iva: 10 }),
      linea(2, { descripcion: "Batería 12V 60Ah", cantidad: 1, precioUnitario: 780000, iva: 10 }),
    ],
  },
  {
    clienteIdx: 3,
    serie: "001",
    numero: "0000104",
    dteTipo: "FACTURA",
    tipoDoc: "01",
    tipoOperacion: "VENTA_SERVICIO",
    estado: "APROBADO",
    fecha: "2026-09-18T13:00:00Z",
    condicionVenta: "CONTADO",
    lineas: [
      linea(1, { descripcion: "Mano de obra — Reparación de suspensión", cantidad: 1, precioUnitario: 1500000, iva: 10 }),
    ],
  },
  {
    clienteIdx: 4,
    serie: "001",
    numero: "0000105",
    dteTipo: "NOTA_CREDITO",
    tipoDoc: "05",
    tipoOperacion: "VENTA_SERVICIO",
    estado: "APROBADO",
    fecha: "2026-09-22T13:00:00Z",
    condicionVenta: "CONTADO",
    lineas: [
      linea(1, { descripcion: "Ajuste — Devolución parcial de repuestos", cantidad: 1, precioUnitario: 200000, iva: 10 }),
    ],
  },
];

// ─── Bitácora SIFEN ────────────────────────────────────────────────
const SIFEN_LOG_DEFS = [
  { numero: "0000101", operacion: "ENVIO", codigoResultado: "0300", exitoso: true, httpStatus: 200, duracionMs: 812, mensajeError: null },
  { numero: "0000102", operacion: "ENVIO", codigoResultado: "0300", exitoso: true, httpStatus: 200, duracionMs: 905, mensajeError: null },
  { numero: "0000103", operacion: "ENVIO", codigoResultado: "0300", exitoso: true, httpStatus: 200, duracionMs: 733, mensajeError: null },
  { numero: "0000103", operacion: "CONSULTA", codigoResultado: "0361", exitoso: true, httpStatus: 200, duracionMs: 410, mensajeError: null },
  { numero: "0000104", operacion: "ENVIO", codigoResultado: "0300", exitoso: true, httpStatus: 200, duracionMs: 688, mensajeError: null },
  { numero: "0000105", operacion: "ENVIO", codigoResultado: "0160", exitoso: false, httpStatus: 200, duracionMs: 501, mensajeError: "CDC duplicado — documento ya registrado en SIFEN" },
];

// ─── Liquidaciones ─────────────────────────────────────────────────
const IVA_DEFS = [
  {
    formulario: "FORM_120_IVA",
    anho: 2026,
    mes: 8,
    ventasGravada10: "3045000.00",
    ventasIva10: "304500.00",
    ventasGravada5: "0.00",
    ventasIva5: "0.00",
    ventasExenta: "0.00",
    ventasTotal: "3349500.00",
    comprasGravada10: "1200000.00",
    comprasIva10: "120000.00",
    comprasGravada5: "0.00",
    comprasIva5: "0.00",
    comprasOtras: "0.00",
    comprasTotal: "1200000.00",
    ivaDebito: "304500.00",
    ivaCredito: "120000.00",
    ivaAPagar: "184500.00",
    saldoFavor: "0.00",
    saldoArrastre: "0.00",
    alertas: null as string | null,
  },
  {
    formulario: "FORM_120_IVA",
    anho: 2026,
    mes: 9,
    ventasGravada10: "2480000.00",
    ventasIva10: "248000.00",
    ventasGravada5: "0.00",
    ventasIva5: "0.00",
    ventasExenta: "0.00",
    ventasTotal: "2728000.00",
    comprasGravada10: "900000.00",
    comprasIva10: "90000.00",
    comprasGravada5: "0.00",
    comprasIva5: "0.00",
    comprasOtras: "0.00",
    comprasTotal: "900000.00",
    ivaDebito: "248000.00",
    ivaCredito: "90000.00",
    ivaAPagar: "158000.00",
    saldoFavor: "0.00",
    saldoArrastre: "0.00",
    alertas: null as string | null,
  },
];

const IRE_DEFS = [
  {
    formulario: "FORM_500_IRE",
    anho: 2025,
    ingresosServicios: "380000000.00",
    ingresosBienes: "70000000.00",
    ingresosNoOperacionales: "0.00",
    ingresosBrutos: "450000000.00",
    costoRepuestos: "120000000.00",
    costoManoObra: "60000000.00",
    costosIndirectos: "0.00",
    totalCostos: "180000000.00",
    gastosAdministrativos: "65000000.00",
    gastosVentas: "30000000.00",
    totalGastos: "95000000.00",
    donaciones: "0.00",
    otrasDeducciones: "0.00",
    rentaNeta: "175000000.00",
    impuestoIre: "17500000.00",
    reservaLegal: "8750000.00",
    retenciones: "0.00",
    anticipos: "0.00",
    saldoPagar: "17500000.00",
    saldoFavorIre: "0.00",
  },
  {
    formulario: "FORM_500_IRE",
    anho: 2024,
    ingresosServicios: "260000000.00",
    ingresosBienes: "60000000.00",
    ingresosNoOperacionales: "0.00",
    ingresosBrutos: "320000000.00",
    costoRepuestos: "90000000.00",
    costoManoObra: "50000000.00",
    costosIndirectos: "0.00",
    totalCostos: "140000000.00",
    gastosAdministrativos: "55000000.00",
    gastosVentas: "25000000.00",
    totalGastos: "80000000.00",
    donaciones: "0.00",
    otrasDeducciones: "0.00",
    rentaNeta: "100000000.00",
    impuestoIre: "10000000.00",
    reservaLegal: "5000000.00",
    retenciones: "0.00",
    anticipos: "0.00",
    saldoPagar: "10000000.00",
    saldoFavorIre: "0.00",
  },
];

const IDU_DEFS = [
  {
    ireAnho: 2025,
    tipoBeneficiario: "RESIDENTE",
    tasaAplicada: "0.0800",
    rentaNetaBase: "175000000.00",
    impuestoIrePagado: "17500000.00",
    reservaLegalBase: "8750000.00",
    utilidadDistribuible: "148750000.00",
    porcentajeDistribuido: "1.0000",
    utilidadEfectiva: "148750000.00",
    impuestoIdu: "11900000.00",
    retencionesIdu: "0.00",
    saldoPagarIdu: "11900000.00",
    saldoFavorIdu: "0.00",
  },
  {
    ireAnho: 2025,
    tipoBeneficiario: "NO_RESIDENTE",
    tasaAplicada: "0.1500",
    rentaNetaBase: "175000000.00",
    impuestoIrePagado: "17500000.00",
    reservaLegalBase: "8750000.00",
    utilidadDistribuible: "148750000.00",
    porcentajeDistribuido: "0.5000",
    utilidadEfectiva: "74375000.00",
    impuestoIdu: "11156250.00",
    retencionesIdu: "0.00",
    saldoPagarIdu: "11156250.00",
    saldoFavorIdu: "0.00",
  },
];

const ISC_DEFS = [
  {
    rubro: "COMBUSTIBLE",
    cantidad: "1200.00",
    unidadMedida: "LITRO",
    baseImponible: "9000000.00",
    tasaAplicada: "250.00",
    tipoTasa: "ESPECIFICA",
    impuestoIsc: "300000.00",
    creditosIsc: "0.00",
    saldoPagarIsc: "300000.00",
  },
  {
    rubro: "TABACO",
    cantidad: "0.00",
    unidadMedida: "UNIDAD",
    baseImponible: "5000000.00",
    tasaAplicada: "0.20",
    tipoTasa: "PORCENTUAL",
    impuestoIsc: "1000000.00",
    creditosIsc: "0.00",
    saldoPagarIsc: "1000000.00",
  },
  {
    rubro: "BEBIDAS_ALCOHOLICAS",
    cantidad: "0.00",
    unidadMedida: "UNIDAD",
    baseImponible: "3000000.00",
    tasaAplicada: "0.10",
    tipoTasa: "PORCENTUAL",
    impuestoIsc: "300000.00",
    creditosIsc: "0.00",
    saldoPagarIsc: "300000.00",
  },
];

const INR_DEFS = [
  {
    tipoRenta: "SERVICIOS_TECNICOS",
    beneficiarioNombre: "Bosch Diagnósticos GmbH",
    beneficiarioPais: "Alemania",
    montoBruto: "15000000.00",
    tasaRetencion: "0.15",
    impuestoInr: "2250000.00",
    saldoPagarInr: "2250000.00",
  },
  {
    tipoRenta: "REGALIAS",
    beneficiarioNombre: "AutoData Software LLC",
    beneficiarioPais: "Estados Unidos",
    montoBruto: "5000000.00",
    tasaRetencion: "0.30",
    impuestoInr: "1500000.00",
    saldoPagarInr: "1500000.00",
  },
];

async function main() {
  console.log(`🌱 Seeding fiscal / electronic invoicing data for tenant: ${TENANT_SLUG}\n`);

  // ── 0. Tenant + emisor identity ─────────────────────────────
  const [tenant] = await db()
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG));
  if (!tenant) {
    console.warn(`   ⚠️  Tenant "${TENANT_SLUG}" no existe en tenants — se continúa (tenant_slug no es FK).`);
  }

  const [cfg] = await db()
    .select()
    .from(tenantConfig)
    .where(eq(tenantConfig.tenantSlug, TENANT_SLUG));
  const emisorRuc = cfg?.ruc?.trim() || EMISOR_RUC_FALLBACK;
  const emisorRazonSocial = cfg?.razonSocial?.trim() || EMISOR_RAZON_SOCIAL_FALLBACK;
  console.log(`   Emisor: ${emisorRazonSocial} (RUC ${emisorRuc})`);

  // ── 1. Periodos fiscales ────────────────────────────────────
  const existingPeriodos = await db()
    .select()
    .from(periodosFiscales)
    .where(eq(periodosFiscales.tenantSlug, TENANT_SLUG));

  const periodoIdByKey = new Map<string, string>();
  for (const p of existingPeriodos) {
    periodoIdByKey.set(`${p.formulario}|${p.anho}|${p.mes}`, p.id);
  }

  let periodosInserted = 0;
  for (const def of PERIODOS) {
    const key = `${def.formulario}|${def.anho}|${def.mes}`;
    if (periodoIdByKey.has(key)) continue;
    const [row] = await db()
      .insert(periodosFiscales)
      .values({
        formulario: def.formulario,
        anho: def.anho,
        mes: def.mes,
        estado: def.estado,
        tenantSlug: TENANT_SLUG,
        fechaPresentacion: def.fechaPresentacion,
      } as any)
      .returning();
    periodoIdByKey.set(key, row!.id);
    periodosInserted++;
  }

  const pid = (formulario: string, anho: number, mes: number): string => {
    const id = periodoIdByKey.get(`${formulario}|${anho}|${mes}`);
    if (!id) throw new Error(`Período fiscal no encontrado: ${formulario} ${anho}-${mes}`);
    return id;
  };

  console.log(`   ✅  periodos_fiscales: ${periodosInserted} inserted (${PERIODOS.length - periodosInserted} already existed)`);

  // ── 2. Liquidaciones IVA (Form 120) ─────────────────────────
  const existingIva = await db()
    .select({ periodoFiscalId: liquidacionesIva.periodoFiscalId })
    .from(liquidacionesIva)
    .where(eq(liquidacionesIva.tenantSlug, TENANT_SLUG));
  const ivaByPeriodo = new Set(existingIva.map((r) => r.periodoFiscalId));

  let ivaInserted = 0;
  for (const def of IVA_DEFS) {
    const periodoFiscalId = pid(def.formulario, def.anho, def.mes);
    if (ivaByPeriodo.has(periodoFiscalId)) continue;
    await db()
      .insert(liquidacionesIva)
      .values({ ...def, periodoFiscalId, tenantSlug: TENANT_SLUG } as any);
    ivaByPeriodo.add(periodoFiscalId);
    ivaInserted++;
  }
  console.log(`   ✅  liquidaciones_iva: ${ivaInserted} inserted (${IVA_DEFS.length - ivaInserted} already existed)`);

  // ── 3. Liquidaciones IRE (Form 500) ─────────────────────────
  const existingIre = await db()
    .select({ id: liquidacionesIre.id, periodoFiscalId: liquidacionesIre.periodoFiscalId })
    .from(liquidacionesIre)
    .where(eq(liquidacionesIre.tenantSlug, TENANT_SLUG));
  const ireIdByPeriodo = new Map(existingIre.map((r) => [r.periodoFiscalId, r.id]));

  let ireInserted = 0;
  for (const def of IRE_DEFS) {
    const periodoFiscalId = pid(def.formulario, def.anho, 0);
    if (ireIdByPeriodo.has(periodoFiscalId)) continue;
    const [row] = await db()
      .insert(liquidacionesIre)
      .values({ ...def, periodoFiscalId, tenantSlug: TENANT_SLUG } as any)
      .returning();
    ireIdByPeriodo.set(periodoFiscalId, row!.id);
    ireInserted++;
  }
  console.log(`   ✅  liquidaciones_ire: ${ireInserted} inserted (${IRE_DEFS.length - ireInserted} already existed)`);

  // ── 4. Liquidaciones IDU (Form 520) ─────────────────────────
  const existingIdu = await db()
    .select({ periodoFiscalId: liquidacionesIdu.periodoFiscalId, tipoBeneficiario: liquidacionesIdu.tipoBeneficiario })
    .from(liquidacionesIdu)
    .where(eq(liquidacionesIdu.tenantSlug, TENANT_SLUG));
  const iduMarkers = new Set(existingIdu.map((r) => `${r.periodoFiscalId}|${r.tipoBeneficiario}`));

  let iduInserted = 0;
  for (const def of IDU_DEFS) {
    const periodoFiscalId = pid("FORM_520_IDU", def.ireAnho, 0);
    const marker = `${periodoFiscalId}|${def.tipoBeneficiario}`;
    if (iduMarkers.has(marker)) continue;
    const liquidacionIreId = ireIdByPeriodo.get(pid("FORM_500_IRE", def.ireAnho, 0)) ?? null;
    const { ireAnho: _ireAnho, ...values } = def;
    await db()
      .insert(liquidacionesIdu)
      .values({ ...values, periodoFiscalId, liquidacionIreId, tenantSlug: TENANT_SLUG } as any);
    iduMarkers.add(marker);
    iduInserted++;
  }
  console.log(`   ✅  liquidaciones_idu: ${iduInserted} inserted (${IDU_DEFS.length - iduInserted} already existed)`);

  // ── 5. Liquidaciones ISC (Form 130) ─────────────────────────
  const existingIsc = await db()
    .select({ periodoFiscalId: liquidacionesIsc.periodoFiscalId, rubro: liquidacionesIsc.rubro })
    .from(liquidacionesIsc)
    .where(eq(liquidacionesIsc.tenantSlug, TENANT_SLUG));
  const iscMarkers = new Set(existingIsc.map((r) => `${r.periodoFiscalId}|${r.rubro}`));

  let iscInserted = 0;
  for (const def of ISC_DEFS) {
    const periodoFiscalId = pid("FORM_130_ISC", 2026, 9);
    const marker = `${periodoFiscalId}|${def.rubro}`;
    if (iscMarkers.has(marker)) continue;
    await db()
      .insert(liquidacionesIsc)
      .values({ ...def, periodoFiscalId, tenantSlug: TENANT_SLUG, alertas: null } as any);
    iscMarkers.add(marker);
    iscInserted++;
  }
  console.log(`   ✅  liquidaciones_isc: ${iscInserted} inserted (${ISC_DEFS.length - iscInserted} already existed)`);

  // ── 6. Liquidaciones INR (Form 515) ─────────────────────────
  const existingInr = await db()
    .select({ periodoFiscalId: liquidacionesInr.periodoFiscalId, tipoRenta: liquidacionesInr.tipoRenta })
    .from(liquidacionesInr)
    .where(eq(liquidacionesInr.tenantSlug, TENANT_SLUG));
  const inrMarkers = new Set(existingInr.map((r) => `${r.periodoFiscalId}|${r.tipoRenta}`));

  let inrInserted = 0;
  for (const def of INR_DEFS) {
    const periodoFiscalId = pid("FORM_515_INR", 2026, 9);
    const marker = `${periodoFiscalId}|${def.tipoRenta}`;
    if (inrMarkers.has(marker)) continue;
    await db()
      .insert(liquidacionesInr)
      .values({ ...def, periodoFiscalId, tenantSlug: TENANT_SLUG, alertas: null } as any);
    inrMarkers.add(marker);
    inrInserted++;
  }
  console.log(`   ✅  liquidaciones_inr: ${inrInserted} inserted (${INR_DEFS.length - inrInserted} already existed)`);

  // ── 7. Documentos electrónicos (DTE) ────────────────────────
  const demoClients = await db()
    .select({ id: clients.id, name: clients.name, ruc: clients.ruc, address: clients.address })
    .from(clients)
    .where(eq(clients.tenantSlug, TENANT_SLUG))
    .orderBy(clients.name)
    .limit(20);

  let docsInserted = 0;
  let detallesInserted = 0;
  let logsInserted = 0;

  if (demoClients.length === 0) {
    console.warn("   ⚠️  Sin clientes para el tenant — se omiten fiscal_documentos, detalles y sifen_sync_log.");
  } else {
    const existingDocs = await db()
      .select({ id: fiscalDocumentos.id, serie: fiscalDocumentos.serie, numero: fiscalDocumentos.numero })
      .from(fiscalDocumentos);
    const docIdByKey = new Map(existingDocs.map((d) => [`${d.serie}|${d.numero}`, d.id]));
    const docIdByNumero = new Map<string, string>();

    for (const def of DOC_DEFS) {
      const key = `${def.serie}|${def.numero}`;
      const totals = totales(def.lineas);
      const cdc = makeCdc(def.numero, def.fecha, def.tipoDoc);

      let docId = docIdByKey.get(key);
      if (docId) {
        // already exists — reuse
      } else {
        const cliente = demoClients[def.clienteIdx % demoClients.length]!;
        const [row] = await db()
          .insert(fiscalDocumentos)
          .values({
            emisorRuc,
            emisorRazonSocial,
            clienteId: cliente.id,
            receptorRuc: cliente.ruc,
            receptorRazonSocial: cliente.name,
            receptorDireccion: cliente.address,
            dteTipo: def.dteTipo,
            tipoOperacion: def.tipoOperacion,
            serie: def.serie,
            numero: def.numero,
            fechaEmision: ts(def.fecha),
            condicionVenta: def.condicionVenta,
            cdc,
            numeroTransaccion: `100000${def.numero.slice(-4)}`,
            xmlOriginal: `<rDE><Id>${cdc}</Id></rDE>`,
            xmlFirmado: `<rDE><Id>${cdc}</Id><Signature/></rDE>`,
            kudePdfUrl: `/fiscal/kude/${cdc}.pdf`,
            estado: def.estado,
            fechaEnvio: ts(def.fecha),
            fechaAprobacion: def.estado === "APROBADO" ? ts(def.fecha) : null,
            ...totals,
          } as any)
          .returning();
        docId = row!.id;
        docIdByKey.set(key, docId);
        docsInserted++;
      }
      docIdByNumero.set(def.numero, docId);

      // Detalles (line items) — idempotent per (documento, numero_linea)
      const existingLines = await db()
        .select({ numeroLinea: fiscalDocumentoDetalles.numeroLinea })
        .from(fiscalDocumentoDetalles)
        .where(eq(fiscalDocumentoDetalles.documentoId, docId));
      const lineSet = new Set(existingLines.map((l) => l.numeroLinea));
      for (const l of def.lineas) {
        if (lineSet.has(l.numeroLinea)) continue;
        await db()
          .insert(fiscalDocumentoDetalles)
          .values({ documentoId: docId, ...l } as any);
        lineSet.add(l.numeroLinea);
        detallesInserted++;
      }
    }

    // ── 8. Bitácora SIFEN ─────────────────────────────────────
    const existingLogs = await db()
      .select({ documentoId: sifenSyncLog.documentoId, operacion: sifenSyncLog.operacion, codigoResultado: sifenSyncLog.codigoResultado })
      .from(sifenSyncLog);
    const logMarkers = new Set(existingLogs.map((l) => `${l.documentoId}|${l.operacion}|${l.codigoResultado}`));

    for (const def of SIFEN_LOG_DEFS) {
      const documentoId = docIdByNumero.get(def.numero);
      if (!documentoId) continue;
      const marker = `${documentoId}|${def.operacion}|${def.codigoResultado}`;
      if (logMarkers.has(marker)) continue;
      const doc = DOC_DEFS.find((d) => d.numero === def.numero)!;
      const cdc = makeCdc(def.numero, doc.fecha, def.tipoDoc);
      await db()
        .insert(sifenSyncLog)
        .values({
          documentoId,
          operacion: def.operacion,
          codigoResultado: def.codigoResultado,
          cdc: def.exitoso ? cdc : null,
          xmlEnviado: `<rEnvioLote><Id>${cdc}</Id></rEnvioLote>`,
          xmlRecibido: def.exitoso ? `<rProtDe><dCodRes>${def.codigoResultado}</dCodRes></rProtDe>` : null,
          httpStatus: def.httpStatus,
          mensajeError: def.mensajeError,
          duracionMs: def.duracionMs,
          exitoso: def.exitoso,
        } as any);
      logMarkers.add(marker);
      logsInserted++;
    }
  }

  console.log(`   ✅  fiscal_documentos: ${docsInserted} inserted`);
  console.log(`   ✅  fiscal_documento_detalles: ${detallesInserted} inserted`);
  console.log(`   ✅  sifen_sync_log: ${logsInserted} inserted`);

  console.log("\n🌱 Fiscal extra seeding complete!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
