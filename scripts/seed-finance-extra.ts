/**
 * Seed script: Remaining finance/accounting tables (idempotent).
 *
 * Populates the finance/accounting tables that the base demo seeders
 * (`seed-treasury.ts` / `seed-accounting.ts`) do not cover:
 *
 *   activos_fijos, depreciacion_activos, revaluaciones,
 *   asientos_contables, asientos_detalle,
 *   conciliacion_bancaria, factura_detalles,
 *   fixed_expenses, invoice_config,
 *   presupuestos, presupuestos_items,
 *   tipos_cambio
 *
 * Design:
 *   - Idempotent: every insert is guarded by a deterministic marker
 *     (codigo / periodo / documento_ref / descripcion / moneda+fecha).
 *     A second run inserts 0 new rows.
 *   - Foreign keys are resolved by SELECTing the parent rows first
 *     (filtered by tenant_slug where applicable) and using their `id`.
 *     If a required parent set is empty, the dependent insert is skipped
 *     gracefully and logged — the script never crashes on a missing parent.
 *   - Deterministic dates only (no Date.now()) so idempotency keys are
 *     stable across runs.
 *   - Amounts are in PYG (Paraguayan guaraníes), realistic demo data.
 *
 * Usage:
 *   DATABASE_URL="postgresql://erp_user:...@localhost:5435/automotive_os?sslmode=disable" \
 *     npx tsx scripts/seed-finance-extra.ts <tenant_slug>
 *
 * @module scripts/seed-finance-extra
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import {
  activosFijos,
  asientosContables,
  asientosDetalle,
  conciliacionBancaria,
  cuentasBancarias,
  depreciacionActivos,
  facturaDetalles,
  facturas,
  fixedExpenses,
  planCuentas,
  tenants,
} from "../src/shared/database/schema/index.js";
import {
  centrosCosto,
  presupuestos,
  presupuestosItems,
  revaluaciones,
  tiposCambio,
} from "../src/modules/finance/schema/index.js";
import { invoiceConfig } from "../src/modules/label-printing/schema/invoice-config.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-finance-extra.ts <tenant_slug>");
  process.exit(1);
}

/** Deterministic date helper — fixed timestamps keep idempotency keys stable. */
const D = (iso: string): Date => new Date(iso);

let totalInserted = 0;
let totalSkipped = 0;

interface SummaryRow {
  table: string;
  inserted: number;
  skipped: number;
  note?: string;
}
const summary: SummaryRow[] = [];

function addSummary(
  table: string,
  inserted: number,
  skipped: number,
  note?: string,
): void {
  summary.push({ table, inserted, skipped, note });
  totalInserted += inserted;
  totalSkipped += skipped;
}

async function main() {
  console.log(`🌱 Seeding finance/accounting extra tables for tenant: ${TENANT_SLUG}\n`);

  // ── Resolve shared parents ────────────────────────────────────────────
  const [tenantRow] = await db()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);
  if (!tenantRow) {
    console.error(`❌ Tenant not found: ${TENANT_SLUG}`);
    process.exit(1);
  }
  const tenantId = tenantRow.id;

  // Plan de Cuentas is a GLOBAL chart of accounts (no tenant_slug).
  const cuentasRows = await db()
    .select({ id: planCuentas.id, codigo: planCuentas.codigo })
    .from(planCuentas);
  const cuentaId = new Map<string, string>(cuentasRows.map((c) => [c.codigo, c.id]));

  // ── 1. activos_fijos ──────────────────────────────────────────────────
  console.log("1. Activos fijos...");
  const existingAf = await db()
    .select({ codigo: activosFijos.codigo })
    .from(activosFijos)
    .where(eq(activosFijos.tenantSlug, TENANT_SLUG));
  const existingAfCodes = new Set(existingAf.map((a) => a.codigo));

  const activosDefs = [
    {
      codigo: "AF-001",
      nombre: "Escáner Automotriz Launch X431 PAD VII",
      tipo: "EQUIPO_DIAGNOSTICO" as const,
      marca: "Launch",
      modelo: "X431 PAD VII",
      numeroSerie: "LNCH-X431-0001",
      fechaAdquisicion: D("2024-03-15T00:00:00.000Z"),
      costoAdquisicion: "18500000",
      valorResidual: "1850000",
      vidaUtilAnos: 5,
      metodoDepreciacion: "LINEA_RECTA" as const,
      valorActualLibros: "13227500",
      depreciacionAcumulada: "5272500",
      ultimaDepreciacion: D("2026-10-31T00:00:00.000Z"),
      estado: "ACTIVO" as const,
      notas: "Equipo principal de diagnóstico. Incluye módulo EV/HEV.",
    },
    {
      codigo: "AF-002",
      nombre: "Elevador de Dos Columnas 4.5T",
      tipo: "MAQUINARIA_TALLER" as const,
      marca: "Hunter",
      modelo: "RX Scissor Lift",
      numeroSerie: "HNTR-LIFT-0007",
      fechaAdquisicion: D("2023-08-01T00:00:00.000Z"),
      costoAdquisicion: "42000000",
      valorResidual: "4200000",
      vidaUtilAnos: 10,
      metodoDepreciacion: "LINEA_RECTA" as const,
      valorActualLibros: "35385000",
      depreciacionAcumulada: "6615000",
      ultimaDepreciacion: D("2026-10-31T00:00:00.000Z"),
      estado: "ACTIVO" as const,
      notas: "Elevador hidráulico del sector mecánica rápida.",
    },
    {
      codigo: "AF-003",
      nombre: "Toyota Hilux 2022 — Vehículo de Servicio",
      tipo: "VEHICULO_SERVICIO" as const,
      marca: "Toyota",
      modelo: "Hilux SR 2.8 4x4",
      numeroSerie: "8AJBA3CD1N1234567",
      fechaAdquisicion: D("2022-06-20T00:00:00.000Z"),
      costoAdquisicion: "185000000",
      valorResidual: "27750000",
      vidaUtilAnos: 7,
      metodoDepreciacion: "LINEA_RECTA" as const,
      valorActualLibros: "145400000",
      depreciacionAcumulada: "39600000",
      ultimaDepreciacion: D("2026-09-30T00:00:00.000Z"),
      estado: "ACTIVO" as const,
      notas: "Vehículo de apoyo para retiro y entrega de unidades.",
    },
    {
      codigo: "AF-004",
      nombre: "Compresor de Aire 500L",
      tipo: "MAQUINARIA_TALLER" as const,
      marca: "Schulz",
      modelo: "CSL 500L",
      numeroSerie: "SCHZ-500-0021",
      fechaAdquisicion: D("2023-02-10T00:00:00.000Z"),
      costoAdquisicion: "12500000",
      valorResidual: "1250000",
      vidaUtilAnos: 10,
      metodoDepreciacion: "LINEA_RECTA" as const,
      valorActualLibros: "10625000",
      depreciacionAcumulada: "1875000",
      ultimaDepreciacion: D("2026-10-31T00:00:00.000Z"),
      estado: "ACTIVO" as const,
      notas: "Alimenta herramientas neumáticas del taller.",
    },
    {
      codigo: "AF-005",
      nombre: "Notebook Dell Latitude 5540",
      tipo: "INFORMATICA" as const,
      marca: "Dell",
      modelo: "Latitude 5540",
      numeroSerie: "DL5540-0093",
      fechaAdquisicion: D("2024-11-05T00:00:00.000Z"),
      costoAdquisicion: "6800000",
      valorResidual: "680000",
      vidaUtilAnos: 4,
      metodoDepreciacion: "LINEA_RECTA" as const,
      valorActualLibros: "4250000",
      depreciacionAcumulada: "2550000",
      ultimaDepreciacion: D("2026-09-30T00:00:00.000Z"),
      estado: "ACTIVO" as const,
      notas: "Equipo de admisión para diagnóstico y facturación.",
    },
  ];

  let afCount = 0;
  for (const a of activosDefs) {
    if (existingAfCodes.has(a.codigo)) continue;
    await db().insert(activosFijos).values({ ...a, tenantSlug: TENANT_SLUG });
    afCount++;
  }
  addSummary("activos_fijos", afCount, activosDefs.length - afCount);
  console.log(`   ✅ ${afCount} inserted (${activosDefs.length - afCount} already existed)`);

  // Fetch activos (created above or pre-existing) for dependent tables.
  const activosList = await db()
    .select({ id: activosFijos.id, codigo: activosFijos.codigo })
    .from(activosFijos)
    .where(eq(activosFijos.tenantSlug, TENANT_SLUG));
  const activoId = new Map<string, string>(activosList.map((a) => [a.codigo, a.id]));

  // ── 2. depreciacion_activos (FK → activos_fijos) ──────────────────────
  console.log("\n2. Depreciación de activos...");
  const existingDep = await db()
    .select({ activoFijoId: depreciacionActivos.activoFijoId, periodo: depreciacionActivos.periodo })
    .from(depreciacionActivos)
    .where(eq(depreciacionActivos.tenantSlug, TENANT_SLUG));
  const existingDepKeys = new Set(existingDep.map((d) => `${d.activoFijoId}|${d.periodo}`));

  const depDefs = [
    { codigo: "AF-001", periodo: "2026-09", fecha: D("2026-09-30T00:00:00.000Z"), valorInicial: "13782500", montoDepreciacion: "277500", valorFinal: "13505000", depreciacionAcumulada: "4995000" },
    { codigo: "AF-001", periodo: "2026-10", fecha: D("2026-10-31T00:00:00.000Z"), valorInicial: "13505000", montoDepreciacion: "277500", valorFinal: "13227500", depreciacionAcumulada: "5272500" },
    { codigo: "AF-002", periodo: "2026-09", fecha: D("2026-09-30T00:00:00.000Z"), valorInicial: "36015000", montoDepreciacion: "315000", valorFinal: "35700000", depreciacionAcumulada: "6300000" },
    { codigo: "AF-002", periodo: "2026-10", fecha: D("2026-10-31T00:00:00.000Z"), valorInicial: "35700000", montoDepreciacion: "315000", valorFinal: "35385000", depreciacionAcumulada: "6615000" },
    { codigo: "AF-004", periodo: "2026-09", fecha: D("2026-09-30T00:00:00.000Z"), valorInicial: "10812500", montoDepreciacion: "93750", valorFinal: "10718750", depreciacionAcumulada: "1781250" },
    { codigo: "AF-004", periodo: "2026-10", fecha: D("2026-10-31T00:00:00.000Z"), valorInicial: "10718750", montoDepreciacion: "93750", valorFinal: "10625000", depreciacionAcumulada: "1875000" },
  ];

  let depCount = 0;
  for (const d of depDefs) {
    const afId = activoId.get(d.codigo);
    if (!afId) {
      console.log(`   ⚠️  Skipping depreciación ${d.codigo}/${d.periodo}: activo fijo no encontrado`);
      continue;
    }
    const key = `${afId}|${d.periodo}`;
    if (existingDepKeys.has(key)) continue;
    await db().insert(depreciacionActivos).values({
      activoFijoId: afId,
      periodo: d.periodo,
      fecha: d.fecha,
      valorInicial: d.valorInicial,
      montoDepreciacion: d.montoDepreciacion,
      valorFinal: d.valorFinal,
      depreciacionAcumulada: d.depreciacionAcumulada,
      tenantSlug: TENANT_SLUG,
    });
    depCount++;
  }
  addSummary("depreciacion_activos", depCount, depDefs.length - depCount);
  console.log(`   ✅ ${depCount} inserted (${depDefs.length - depCount} already existed)`);

  // ── 3. revaluaciones (FK → activos_fijos) ─────────────────────────────
  console.log("\n3. Revaluaciones...");
  const existingRev = await db()
    .select({ activoFijoId: revaluaciones.activoFijoId, motivo: revaluaciones.motivo })
    .from(revaluaciones)
    .where(eq(revaluaciones.tenantSlug, TENANT_SLUG));
  const existingRevKeys = new Set(existingRev.map((r) => `${r.activoFijoId}|${r.motivo}`));

  const revDefs = [
    { codigo: "AF-001", fecha: D("2026-10-31T00:00:00.000Z"), valorAnterior: "13227500", valorNuevo: "15000000", diferencia: "1772500", depreciacionAcumuladaAnterior: "5272500", motivo: "Revaluación por tasación de mercado — Octubre 2026" },
    { codigo: "AF-003", fecha: D("2026-10-31T00:00:00.000Z"), valorAnterior: "145400000", valorNuevo: "165000000", diferencia: "19600000", depreciacionAcumuladaAnterior: "39600000", motivo: "Revaluación por inflación acumulada 2026" },
  ];

  let revCount = 0;
  for (const r of revDefs) {
    const afId = activoId.get(r.codigo);
    if (!afId) {
      console.log(`   ⚠️  Skipping revaluación ${r.codigo}: activo fijo no encontrado`);
      continue;
    }
    const key = `${afId}|${r.motivo}`;
    if (existingRevKeys.has(key)) continue;
    await db().insert(revaluaciones).values({
      activoFijoId: afId,
      tenantSlug: TENANT_SLUG,
      fecha: r.fecha,
      valorAnterior: r.valorAnterior,
      valorNuevo: r.valorNuevo,
      diferencia: r.diferencia,
      depreciacionAcumuladaAnterior: r.depreciacionAcumuladaAnterior,
      motivo: r.motivo,
    });
    revCount++;
  }
  addSummary("revaluaciones", revCount, revDefs.length - revCount);
  console.log(`   ✅ ${revCount} inserted (${revDefs.length - revCount} already existed)`);

  // ── 4. asientos_contables + 5. asientos_detalle ───────────────────────
  console.log("\n4. Asientos contables + detalle...");
  const existingAsientos = await db()
    .select({ documentoRef: asientosContables.documentoRef })
    .from(asientosContables);
  const existingRefs = new Set(
    existingAsientos.map((a) => a.documentoRef).filter((r): r is string => !!r),
  );

  const asientosDefs = [
    {
      numero: 9001,
      fecha: D("2026-10-05T00:00:00.000Z"),
      concepto: "Venta de servicios — Factura 001-001-0001234",
      estado: "CONTABILIZADO" as const,
      documentoRef: "SEEDFIN-VTA-0001",
      moduloOrigen: "SIFEN",
      lineas: [
        { codigo: "1.1.01.002", debe: "5500000", haber: null, descripcion: "Cobro en Banco Continental" },
        { codigo: "4.1.01.001", debe: null, haber: "5500000", descripcion: "Ingreso por venta de servicios" },
      ],
    },
    {
      numero: 9002,
      fecha: D("2026-10-12T00:00:00.000Z"),
      concepto: "Compra de repuestos a proveedor local",
      estado: "CONTABILIZADO" as const,
      documentoRef: "SEEDFIN-CMP-0002",
      moduloOrigen: "COMPRAS",
      lineas: [
        { codigo: "1.1.03.001", debe: "2400000", haber: null, descripcion: "Ingreso de repuestos a inventario" },
        { codigo: "2.1.01.001", debe: null, haber: "2400000", descripcion: "Obligación con proveedor nacional" },
      ],
    },
    {
      numero: 9003,
      fecha: D("2026-10-30T00:00:00.000Z"),
      concepto: "Pago de sueldos y jornales — Octubre 2026",
      estado: "CONTABILIZADO" as const,
      documentoRef: "SEEDFIN-NOM-0003",
      moduloOrigen: "NOMINA",
      lineas: [
        { codigo: "5.1.01.001", debe: "12000000", haber: null, descripcion: "Sueldos y jornales de octubre" },
        { codigo: "1.1.01.002", debe: null, haber: "12000000", descripcion: "Pago de nómina por transferencia" },
      ],
    },
    {
      numero: 9004,
      fecha: D("2026-10-30T00:00:00.000Z"),
      concepto: "Pago de alquiler del local — Octubre 2026",
      estado: "CONTABILIZADO" as const,
      documentoRef: "SEEDFIN-ALQ-0004",
      moduloOrigen: "TESORERIA",
      lineas: [
        { codigo: "5.1.02.001", debe: "3500000", haber: null, descripcion: "Alquiler del local" },
        { codigo: "1.1.01.002", debe: null, haber: "3500000", descripcion: "Pago de alquiler por transferencia" },
      ],
    },
  ];

  let asientoCount = 0;
  let detalleCount = 0;
  let asientoSkipped = 0;
  for (const a of asientosDefs) {
    if (existingRefs.has(a.documentoRef)) {
      asientoSkipped++;
      continue;
    }
    const resolved = a.lineas.map((l) => ({ ...l, cuentaId: cuentaId.get(l.codigo) }));
    if (resolved.some((l) => !l.cuentaId)) {
      console.log(`   ⚠️  Skipping asiento ${a.numero}: falta una cuenta en plan_cuentas`);
      continue;
    }
    const totalDebe = a.lineas.reduce((sum, l) => sum + Number(l.debe ?? 0), 0);
    const totalHaber = a.lineas.reduce((sum, l) => sum + Number(l.haber ?? 0), 0);

    const [asiento] = await db()
      .insert(asientosContables)
      .values({
        numero: a.numero,
        fecha: a.fecha,
        concepto: a.concepto,
        estado: a.estado,
        totalDebe: totalDebe.toFixed(2),
        totalHaber: totalHaber.toFixed(2),
        diferencia: (totalDebe - totalHaber).toFixed(2),
        documentoRef: a.documentoRef,
        moduloOrigen: a.moduloOrigen,
      })
      .returning();
    if (!asiento) continue;
    asientoCount++;

    let nro = 1;
    for (const l of resolved) {
      await db().insert(asientosDetalle).values({
        asientoId: asiento.id,
        cuentaId: l.cuentaId!,
        numeroLinea: nro++,
        debe: l.debe,
        haber: l.haber,
        descripcion: l.descripcion,
      });
      detalleCount++;
    }
  }
  addSummary("asientos_contables", asientoCount, asientoSkipped);
  addSummary("asientos_detalle", detalleCount, 0);
  console.log(`   ✅ Asientos: ${asientoCount} inserted (${asientoSkipped} already existed)`);
  console.log(`   ✅ Detalle: ${detalleCount} lines inserted`);

  // ── 6. conciliacion_bancaria (FK → cuentas_bancarias) ─────────────────
  console.log("\n5. Conciliación bancaria...");
  const cuentas = await db()
    .select({ id: cuentasBancarias.id, codigo: cuentasBancarias.codigo, saldoActual: cuentasBancarias.saldoActual })
    .from(cuentasBancarias)
    .where(eq(cuentasBancarias.tenantSlug, TENANT_SLUG));

  if (cuentas.length === 0) {
    console.log("   ⏭️  Skipped: no existen cuentas_bancarias para este tenant");
    addSummary("conciliacion_bancaria", 0, 0, "sin cuentas_bancarias");
  } else {
    const existingConc = await db()
      .select({ cuentaId: conciliacionBancaria.cuentaId, periodo: conciliacionBancaria.periodo })
      .from(conciliacionBancaria)
      .where(eq(conciliacionBancaria.tenantSlug, TENANT_SLUG));
    const existingConcKeys = new Set(existingConc.map((c) => `${c.cuentaId}|${c.periodo}`));

    const concDefs = [
      { codigo: "CAJA-001", periodo: "2026-10", diferencia: 0, conciliado: true },
      { codigo: "BCO-001", periodo: "2026-09", diferencia: 0, conciliado: true },
      { codigo: "BCO-001", periodo: "2026-10", diferencia: -12500, conciliado: false },
      { codigo: "BLL-001", periodo: "2026-10", diferencia: 0, conciliado: true },
    ];

    let concCount = 0;
    for (const c of concDefs) {
      const cuenta = cuentas.find((x) => x.codigo === c.codigo);
      if (!cuenta) {
        console.log(`   ⚠️  Skipping conciliación ${c.codigo}/${c.periodo}: cuenta no encontrada`);
        continue;
      }
      const key = `${cuenta.id}|${c.periodo}`;
      if (existingConcKeys.has(key)) continue;
      const saldoLibros = Number(cuenta.saldoActual ?? 0);
      const saldoBanco = saldoLibros + c.diferencia;
      await db().insert(conciliacionBancaria).values({
        cuentaId: cuenta.id,
        periodo: c.periodo,
        saldoLibros: saldoLibros.toFixed(2),
        saldoBanco: saldoBanco.toFixed(2),
        diferencia: (saldoBanco - saldoLibros).toFixed(2),
        conciliado: c.conciliado,
        tenantSlug: TENANT_SLUG,
      });
      concCount++;
    }
    addSummary("conciliacion_bancaria", concCount, concDefs.length - concCount);
    console.log(`   ✅ ${concCount} inserted (${concDefs.length - concCount} already existed)`);
  }

  // ── 5b. Datos base: centros_costo + facturas ──────────────────────────
  // Padres requeridos por presupuestos_items (centros_costo) y
  // factura_detalles (facturas); el demo no los creaba.
  console.log("\n5b. Centros de costo + Facturas...");
  const existingCentros = await db()
    .select({ codigo: centrosCosto.codigo })
    .from(centrosCosto)
    .where(eq(centrosCosto.tenantSlug, TENANT_SLUG));
  const centroCodigos = new Set(existingCentros.map((c) => c.codigo));
  const centrosDefs = [
    { codigo: "TALLER", nombre: "Taller Mecánica General" },
    { codigo: "ADMIN", nombre: "Administración" },
    { codigo: "VENTAS", nombre: "Ventas y Atención al Cliente" },
  ];
  let centroCount = 0;
  for (const c of centrosDefs) {
    if (centroCodigos.has(c.codigo)) continue;
    await db().insert(centrosCosto).values({ ...c, tenantSlug: TENANT_SLUG, activo: true });
    centroCount++;
  }
  addSummary("centros_costo", centroCount, centrosDefs.length - centroCount);
  console.log(`   ✅ Centros de costo: ${centroCount} inserted (${centrosDefs.length - centroCount} already existed)`);

  const existingFacturasBase = await db()
    .select({ numeroFacturaManual: facturas.numeroFacturaManual })
    .from(facturas)
    .where(eq(facturas.tenantSlug, TENANT_SLUG));
  const facturaNumeros = new Set(existingFacturasBase.map((f) => f.numeroFacturaManual));
  const facturasDefs = [
    { numeroFacturaManual: "001-001-0000101", total: "550000.00" },
    { numeroFacturaManual: "001-001-0000102", total: "880000.00" },
  ];
  let facturaCount = 0;
  for (const f of facturasDefs) {
    if (facturaNumeros.has(f.numeroFacturaManual)) continue;
    await db().insert(facturas).values({
      tenantSlug: TENANT_SLUG,
      tipo: "MANUAL",
      numeroFacturaManual: f.numeroFacturaManual,
      sifenStatus: "MANUAL_CONVERT_QUEUE",
      total: f.total,
      estadoPago: "PENDIENTE",
      saldoPendiente: f.total,
      fechaVencimiento: D("2026-11-15T00:00:00.000Z"),
    });
    facturaCount++;
  }
  addSummary("facturas", facturaCount, facturasDefs.length - facturaCount);
  console.log(`   ✅ Facturas: ${facturaCount} inserted (${facturasDefs.length - facturaCount} already existed)`);

  // ── 7. factura_detalles (FK → facturas) ───────────────────────────────
  console.log("\n6. Detalle de facturas...");
  const facturasRows = await db()
    .select({ id: facturas.id, total: facturas.total })
    .from(facturas)
    .where(eq(facturas.tenantSlug, TENANT_SLUG));

  if (facturasRows.length === 0) {
    console.log("   ⏭️  Skipped: no existen facturas para este tenant (parent list empty)");
    addSummary("factura_detalles", 0, 0, "sin facturas — parent vacío");
  } else {
    const existingFactDet = await db()
      .select({ facturaId: facturaDetalles.facturaId, numeroLinea: facturaDetalles.numeroLinea })
      .from(facturaDetalles)
      .where(eq(facturaDetalles.tenantSlug, TENANT_SLUG));
    const existingFactDetKeys = new Set(existingFactDet.map((f) => `${f.facturaId}|${f.numeroLinea}`));

    let fdCount = 0;
    let fdSkipped = 0;
    const facturasToDetail = facturasRows.slice(0, 3);
    for (const f of facturasToDetail) {
      const total = Number(f.total ?? 0);
      const subtotal = total / 1.1;
      const lineas = [
        { numeroLinea: 1, tipoLinea: "SERVICIO", descripcion: "Mano de obra — revisión general", cantidad: "1", precioUnitario: (subtotal * 0.6).toFixed(2) },
        { numeroLinea: 2, tipoLinea: "REPUESTO", descripcion: "Repuestos varios", cantidad: "1", precioUnitario: (subtotal * 0.4).toFixed(2) },
      ];
      for (const l of lineas) {
        const key = `${f.id}|${l.numeroLinea}`;
        if (existingFactDetKeys.has(key)) {
          fdSkipped++;
          continue;
        }
        const lineSubtotal = Number(l.precioUnitario) * Number(l.cantidad);
        const lineIva = lineSubtotal * 0.1;
        await db().insert(facturaDetalles).values({
          facturaId: f.id,
          numeroLinea: l.numeroLinea,
          tipoLinea: l.tipoLinea,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          iva: 10,
          ivaMonto: lineIva.toFixed(2),
          subtotal: lineSubtotal.toFixed(2),
          tenantSlug: TENANT_SLUG,
        });
        fdCount++;
      }
    }
    addSummary("factura_detalles", fdCount, fdSkipped);
    console.log(`   ✅ ${fdCount} inserted (${fdSkipped} already existed)`);
  }

  // ── 8. fixed_expenses (FK → tenants) ──────────────────────────────────
  console.log("\n7. Gastos fijos...");
  const existingFe = await db()
    .select({ description: fixedExpenses.description, month: fixedExpenses.month, year: fixedExpenses.year })
    .from(fixedExpenses)
    .where(eq(fixedExpenses.tenantId, tenantId));
  const existingFeKeys = new Set(existingFe.map((f) => `${f.year}-${f.month}|${f.description}`));

  const feDefs = [
    { month: 10, year: 2026, description: "Alquiler del local — Av. Mcal. López 1234, Asunción", amount: 3500000, category: "ALQUILER" as const },
    { month: 10, year: 2026, description: "Energía eléctrica (ANDE)", amount: 850000, category: "ANDES" as const },
    { month: 10, year: 2026, description: "Internet y telefonía (COPACO)", amount: 320000, category: "COPACO" as const },
    { month: 10, year: 2026, description: "Honorarios contables mensuales", amount: 1500000, category: "CONTADOR" as const },
    { month: 10, year: 2026, description: "Licencias de software de gestión", amount: 450000, category: "LICENCIAS" as const },
  ];

  let feCount = 0;
  for (const f of feDefs) {
    const key = `${f.year}-${f.month}|${f.description}`;
    if (existingFeKeys.has(key)) continue;
    await db().insert(fixedExpenses).values({
      tenantId,
      month: f.month,
      year: f.year,
      description: f.description,
      amount: f.amount,
      category: f.category,
    });
    feCount++;
  }
  addSummary("fixed_expenses", feCount, feDefs.length - feCount);
  console.log(`   ✅ ${feCount} inserted (${feDefs.length - feCount} already existed)`);

  // ── 9. invoice_config (unique tenant_slug → 1 row) ────────────────────
  console.log("\n8. Configuración de facturación...");
  const existingInvCfg = await db()
    .select({ id: invoiceConfig.id })
    .from(invoiceConfig)
    .where(eq(invoiceConfig.tenantSlug, TENANT_SLUG))
    .limit(1);
  let invCfgCount = 0;
  if (existingInvCfg.length > 0) {
    console.log("   ⏭️  invoice_config ya existía");
    addSummary("invoice_config", 0, 1);
  } else {
    await db().insert(invoiceConfig).values({
      tenantSlug: TENANT_SLUG,
      paperWidthMm: 210,
      paperHeightMm: 297,
      printerProtocol: "PCL",
      printerDpi: 600,
      printerModel: "hp-laserjet-p1150",
      cupsPrinterName: "HP_LaserJet_P1150",
      paperTray: "Auto",
      companyNombre: "Taller MCA S.A.",
      companyRuc: "80012345-6",
      companyDireccion: "Av. Mariscal López 1234, Asunción",
      companyTelefono: "+595 21 555 1234",
      companyActividad: "Mantenimiento y reparación de vehículos automotores",
      timbradoNumero: "12345678",
      timbradoVigenciaInicio: "2025-01-01",
      timbradoVigenciaFin: "2026-12-31",
      condicionVentaDefault: "CREDITO",
      seriePrefix: "001",
    });
    invCfgCount = 1;
    addSummary("invoice_config", 1, 0);
    console.log("   ✅ 1 inserted");
  }

  // ── 10. presupuestos + 11. presupuestos_items ─────────────────────────
  console.log("\n9. Presupuestos + ítems...");
  const existingPres = await db()
    .select({ periodo: presupuestos.periodo, descripcion: presupuestos.descripcion })
    .from(presupuestos)
    .where(eq(presupuestos.tenantSlug, TENANT_SLUG));
  const existingPresKeys = new Set(existingPres.map((p) => `${p.periodo}|${p.descripcion ?? ""}`));

  const presDefs = [
    { periodo: "2026-10", descripcion: "Presupuesto operativo mensual — Octubre 2026", estado: "aprobado", totalEstimado: "45000000" },
    { periodo: "2026-Q4", descripcion: "Presupuesto trimestral Q4 2026", estado: "borrador", totalEstimado: "135000000" },
    { periodo: "2026", descripcion: "Presupuesto anual 2026", estado: "aprobado", totalEstimado: "540000000" },
  ];

  let presCount = 0;
  let presSkipped = 0;
  for (const p of presDefs) {
    const key = `${p.periodo}|${p.descripcion}`;
    if (existingPresKeys.has(key)) {
      presSkipped++;
      continue;
    }
    const [ins] = await db()
      .insert(presupuestos)
      .values({
        periodo: p.periodo,
        descripcion: p.descripcion,
        estado: p.estado,
        totalEstimado: p.totalEstimado,
        tenantSlug: TENANT_SLUG,
      })
      .returning();
    if (ins) {
      presCount++;
    }
  }
  addSummary("presupuestos", presCount, presSkipped);
  console.log(`   ✅ Presupuestos: ${presCount} inserted (${presSkipped} already existed)`);

  // presupuestos_items requires centros_costo (not present in the demo DB).
  const centros = await db()
    .select({ id: centrosCosto.id, codigo: centrosCosto.codigo, nombre: centrosCosto.nombre })
    .from(centrosCosto)
    .where(eq(centrosCosto.tenantSlug, TENANT_SLUG));

  if (centros.length === 0) {
    console.log("   ⏭️  Skipped: no existen centros_costo para este tenant (parent list empty)");
    addSummary("presupuestos_items", 0, 0, "sin centros_costo — parent vacío");
  } else {
    const existingPresItems = await db()
      .select({ presupuestoId: presupuestosItems.presupuestoId, centroCostoId: presupuestosItems.centroCostoId, categoria: presupuestosItems.categoria })
      .from(presupuestosItems)
      .where(eq(presupuestosItems.tenantSlug, TENANT_SLUG));
    const existingPresItemKeys = new Set(
      existingPresItems.map((i) => `${i.presupuestoId}|${i.centroCostoId}|${i.categoria}`),
    );

    const allPresupuestos = await db()
      .select({ id: presupuestos.id, totalEstimado: presupuestos.totalEstimado })
      .from(presupuestos)
      .where(eq(presupuestos.tenantSlug, TENANT_SLUG));

    const categorias = ["servicios", "repuestos", "mano_obra", "fijo"];
    let itemCount = 0;
    let itemSkipped = 0;
    for (const p of allPresupuestos) {
      let idx = 0;
      for (const cc of centros.slice(0, 4)) {
        const categoria = categorias[idx % categorias.length]!;
        const key = `${p.id}|${cc.id}|${categoria}`;
        idx++;
        if (existingPresItemKeys.has(key)) {
          itemSkipped++;
          continue;
        }
        const monto = (Number(p.totalEstimado ?? 0) / 4).toFixed(2);
        await db().insert(presupuestosItems).values({
          presupuestoId: p.id,
          centroCostoId: cc.id,
          categoria,
          montoPresupuestado: monto,
          montoReal: "0",
          notas: null,
          tenantSlug: TENANT_SLUG,
        });
        itemCount++;
      }
    }
    addSummary("presupuestos_items", itemCount, itemSkipped);
    console.log(`   ✅ Ítems: ${itemCount} inserted (${itemSkipped} already existed)`);
  }

  // ── 12. tipos_cambio ──────────────────────────────────────────────────
  console.log("\n10. Tipos de cambio...");
  const existingTc = await db()
    .select({ moneda: tiposCambio.moneda, fecha: tiposCambio.fecha, fuente: tiposCambio.fuente })
    .from(tiposCambio)
    .where(eq(tiposCambio.tenantSlug, TENANT_SLUG));
  const existingTcKeys = new Set(
    existingTc.map((t) => `${t.moneda}|${t.fecha.toISOString()}|${t.fuente}`),
  );

  const tcDefs = [
    { moneda: "USD" as const, fecha: D("2026-10-01T00:00:00.000Z"), compra: "7300.00", venta: "7350.00", referencia: "7325.00", fuente: "BCP" as const, notas: "Cotización BCP — inicio de mes" },
    { moneda: "USD" as const, fecha: D("2026-10-15T00:00:00.000Z"), compra: "7320.00", venta: "7370.00", referencia: "7345.00", fuente: "BCP" as const, notas: "Cotización BCP — media mes" },
    { moneda: "EUR" as const, fecha: D("2026-10-01T00:00:00.000Z"), compra: "7950.00", venta: "8050.00", referencia: "8000.00", fuente: "BCP" as const, notas: null },
    { moneda: "BRL" as const, fecha: D("2026-10-01T00:00:00.000Z"), compra: "1300.00", venta: "1360.00", referencia: "1330.00", fuente: "REFERENCIA" as const, notas: "Referencia para repuestos importados de Brasil" },
    { moneda: "ARS" as const, fecha: D("2026-10-01T00:00:00.000Z"), compra: "7.10", venta: "7.60", referencia: "7.35", fuente: "REFERENCIA" as const, notas: null },
  ];

  let tcCount = 0;
  for (const t of tcDefs) {
    const key = `${t.moneda}|${t.fecha.toISOString()}|${t.fuente}`;
    if (existingTcKeys.has(key)) continue;
    await db().insert(tiposCambio).values({
      moneda: t.moneda,
      fecha: t.fecha,
      compra: t.compra,
      venta: t.venta,
      referencia: t.referencia,
      fuente: t.fuente,
      tenantSlug: TENANT_SLUG,
      notas: t.notas,
    });
    tcCount++;
  }
  addSummary("tipos_cambio", tcCount, tcDefs.length - tcCount);
  console.log(`   ✅ ${tcCount} inserted (${tcDefs.length - tcCount} already existed)`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Resumen seed-finance-extra");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const s of summary) {
    const note = s.note ? `  (${s.note})` : "";
    console.log(
      `   ${s.table.padEnd(22)} ${String(s.inserted).padStart(3)} inserted, ${String(s.skipped).padStart(3)} already existed${note}`,
    );
  }
  console.log(`\n   TOTAL: ${totalInserted} inserted, ${totalSkipped} already existed`);
  console.log("\n🌱 Finance extra seeding complete!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
