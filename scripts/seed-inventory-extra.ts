/**
 * Seed script: Additional inventory domain tables (Sprint 7+).
 *
 * Populates inventory-related tables that currently have no seed data:
 * almacenes, stock_movements, initial_inventory_loads, reorder_alerts, cycle_counts,
 * cycle_count_items, cost_history, revaluaciones, service_brand_map, control_herramientas,
 * tool_instances, tool_maintenance_events, tool_depreciation_entries
 *
 * Usage: npx tsx scripts/seed-inventory-extra.ts <tenant_slug>
 *
 * @module scripts/seed-inventory-extra
 */

import { db } from "../src/shared/database/drizzle.js";
import { and, eq, sql } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import {
  almacenes,
  stockMovements,
  initialInventoryLoads,
  reorderAlerts,
  cycleCounts,
  cycleCountItems,
  costHistory,
  controlHerramientas,
  toolInstances,
  toolMaintenanceEvents,
  toolDepreciationEntries,
} from "../src/modules/inventory/schema/index.js";
import { revaluaciones } from "../src/modules/finance/schema/index.js";
import { serviceBrandMap } from "../src/modules/workshop/schema/service-pricing.js";
import { repuestos } from "../src/modules/inventory/schema/repuestos.js";
import { herramientas } from "../src/modules/inventory/schema/herramientas.js";
import { ordenesTrabajo } from "../src/modules/workshop/schema/ordenes-trabajo.js";
import { activosFijos } from "../src/modules/finance/schema/fixed-assets.js";
import { serviciosCatalogo } from "../src/modules/workshop/schema/servicios-catalogo.js";
import { profiles } from "../src/shared/database/schema/profiles.js";
import { tenants } from "../src/shared/database/schema/tenants.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-inventory-extra.ts <tenant_slug>");
  process.exit(1);
}

async function getTenantId() {
  const [row] = await db()
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, TENANT_SLUG))
    .limit(1);
  if (!row) throw new Error(`Tenant not found: ${TENANT_SLUG}`);
  return row.id;
}

async function main() {
  console.log(`🌱 Seeding inventory extra tables for tenant: ${TENANT_SLUG}\n`);

  // Get profiles for demo tenant
  const tenantId = await getTenantId();
  const profileRows = await db()
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.tenantId, tenantId))
    .limit(3);

  const mechanic = profileRows.find((p: any) => p.fullName?.includes("Mecánico")) || profileRows[0];

  // Get existing base data
  const repuestosList = await db()
    .select({ id: repuestos.id, codigo: repuestos.codigo, descripcion: repuestos.descripcion, precioCosto: repuestos.precioCosto, stockActual: repuestos.stockActual })
    .from(repuestos)
    .where(eq(repuestos.tenantSlug, TENANT_SLUG))
    .limit(10);

  const herramientasList = await db()
    .select({ id: herramientas.id, codigo: herramientas.codigo, nombre: herramientas.nombre })
    .from(herramientas)
    .where(eq(herramientas.tenantSlug, TENANT_SLUG))
    .limit(10);

  const otList = await db()
    .select({ id: ordenesTrabajo.id })
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.tenantSlug, TENANT_SLUG))
    .limit(5);

  const activosList = await db()
    .select({ id: activosFijos.id, codigo: activosFijos.codigo, nombre: activosFijos.nombre })
    .from(activosFijos)
    .where(eq(activosFijos.tenantSlug, TENANT_SLUG))
    .limit(2);

  const serviciosList = await db()
    .select({ id: serviciosCatalogo.id, codigo: serviciosCatalogo.codigo, nombre: serviciosCatalogo.nombre })
    .from(serviciosCatalogo)
    .where(eq(serviciosCatalogo.tenantSlug, TENANT_SLUG))
    .limit(5);

  let totalInserted = 0;
  let totalSkipped = 0;

  // ── 1. ALMACENES ─────────────────────────────────
  console.log("1. Almacenes...");
  const existingAlm = await db()
    .select({ codigo: almacenes.codigo })
    .from(almacenes)
    .where(eq(almacenes.tenantSlug, TENANT_SLUG));
  const existingAlmCodes = new Set(existingAlm.map((a) => a.codigo));

  const almacenesToInsert = [
    { codigo: "PRINCIPAL", nombre: "Almacén Principal", direccion: "Av. Mariscal López 1234, Asunción", responsable: "Jefe de Almacén" },
    { codigo: "SUCURSAL", nombre: "Almacén Sucursal", direccion: "Ruta 1 Km 12, San Lorenzo", responsable: "Encargado de Sucursal" },
  ];
  let almCount = 0;
  for (const a of almacenesToInsert) {
    if (!existingAlmCodes.has(a.codigo)) {
      await db().insert(almacenes).values({ ...a, tenantSlug: TENANT_SLUG });
      almCount++;
    }
  }
  console.log(`   ✅ ${almCount} inserted (${almacenesToInsert.length - almCount} already existed)`);
  totalInserted += almCount;
  totalSkipped += (almacenesToInsert.length - almCount);

  // Get almacen IDs
  const almacenesList = await db()
    .select({ id: almacenes.id, codigo: almacenes.codigo })
    .from(almacenes)
    .where(eq(almacenes.tenantSlug, TENANT_SLUG));

  const almPrincipal = almacenesList.find((a) => a.codigo === "PRINCIPAL") || almacenesList[0]!;
  const almSucursal = almacenesList.find((a) => a.codigo === "SUCURSAL") || almacenesList[1] || almacenesList[0]!;

  // ── 2. STOCK_MOVEMENTS ─────────────────────────────────
  console.log("\n2. Stock Movements...");
  const existingMov = await db()
    .select({ motivo: stockMovements.motivo })
    .from(stockMovements)
    .where(eq(stockMovements.tenantSlug, TENANT_SLUG));
  const existingMovMotivos = new Set(existingMov.map((m) => m.motivo));

  const movimientosToInsert = [];
  if (repuestosList.length > 0) {
    movimientosToInsert.push({
      repuestoId: repuestosList[0]!.id,
      tipo: "ENTRADA" as const,
      cantidad: 10,
      stockAnterior: repuestosList[0]!.stockActual ?? 0,
      stockPosterior: (repuestosList[0]!.stockActual ?? 0) + 10,
      costoUnitario: repuestosList[0]!.precioCosto?.toString() || "0",
      costoTotal: ((repuestosList[0]!.precioCosto ?? 0) * 10).toFixed(2),
      ordenTrabajoId: otList.length > 0 ? otList[0]!.id : null,
      motivo: "Compra inicial - Demo",
      observaciones: "Movimiento de prueba para demo",
      usuarioId: mechanic?.id || profileRows[0]?.id || null,
    });
    movimientosToInsert.push({
      repuestoId: repuestosList[1]?.id || repuestosList[0]!.id,
      tipo: "SALIDA" as const,
      cantidad: 2,
      stockAnterior: repuestosList[1]?.stockActual ?? 5,
      stockPosterior: (repuestosList[1]?.stockActual ?? 5) - 2,
      costoUnitario: (repuestosList[1]?.precioCosto ?? 0).toString(),
      costoTotal: ((repuestosList[1]?.precioCosto ?? 0) * 2).toFixed(2),
      ordenTrabajoId: otList.length > 1 ? otList[1]!.id : otList[0]?.id || null,
      motivo: "Salida para OT",
      observaciones: "Consumo en orden de trabajo",
      usuarioId: mechanic?.id || null,
    });
  }

  let movCount = 0;
  for (const m of movimientosToInsert) {
    if (!existingMovMotivos.has(m.motivo)) {
      await db().insert(stockMovements).values({ ...m, tenantSlug: TENANT_SLUG });
      movCount++;
    }
  }
  console.log(`   ✅ ${movCount} inserted (${movimientosToInsert.length - movCount} already existed)`);
  totalInserted += movCount;
  totalSkipped += (movimientosToInsert.length - movCount);

  // ── 3. INITIAL_INVENTORY_LOADS ─────────────────────────────────
  console.log("\n3. Initial Inventory Loads...");
  const existingLoads = await db()
    .select({ batchId: initialInventoryLoads.batchId, itemDescripcion: initialInventoryLoads.itemDescripcion })
    .from(initialInventoryLoads)
    .where(eq(initialInventoryLoads.tenantSlug, TENANT_SLUG));
  const existingLoadKey = new Set(existingLoads.map((l) => `${l.batchId}|${l.itemDescripcion}`));

  const batchIdLoad = "LOAD-DEMO-INICIAL";
  const loadsToInsert = [];
  if (repuestosList.length > 0) {
    loadsToInsert.push({
      tipo: "REPUESTOS" as const,
      batchId: batchIdLoad,
      itemId: repuestosList[0]!.id,
      itemDescripcion: repuestosList[0]!.descripcion || "Repuesto demo",
      cantidad: 50,
      valorUnitario: (repuestosList[0]!.precioCosto || 100000).toString(),
      valorTotal: ((repuestosList[0]!.precioCosto || 100000) * 50).toFixed(2),
      cuentaActivoId: "00000000-0000-0000-0000-000000000001",
      cuentaPatrimonioId: "00000000-0000-0000-0000-000000000002",
    });
  }
  if (herramientasList.length > 0) {
    loadsToInsert.push({
      tipo: "HERRAMIENTAS" as const,
      batchId: batchIdLoad,
      itemId: herramientasList[0]!.id,
      itemDescripcion: herramientasList[0]!.nombre || "Herramienta demo",
      cantidad: 2,
      valorUnitario: "150000".toString(),
      valorTotal: "300000",
      cuentaActivoId: "00000000-0000-0000-0000-000000000001",
      cuentaPatrimonioId: "00000000-0000-0000-0000-000000000002",
    });
  }

  let loadCount = 0;
  for (const l of loadsToInsert) {
    const key = `${l.batchId}|${l.itemDescripcion}`;
    if (!existingLoadKey.has(key)) {
      await db().insert(initialInventoryLoads).values({ ...l, tenantSlug: TENANT_SLUG });
      loadCount++;
    }
  }
  console.log(`   ✅ ${loadCount} inserted (${loadsToInsert.length - loadCount} already existed)`);
  totalInserted += loadCount;
  totalSkipped += (loadsToInsert.length - loadCount);

  // ── 4. REORDER_ALERTS ─────────────────────────────────
  console.log("\n4. Reorder Alerts...");
  const existingAlerts = await db()
    .select({ repuestoId: reorderAlerts.repuestoId })
    .from(reorderAlerts)
    .where(eq(reorderAlerts.tenantSlug, TENANT_SLUG));
  const existingAlertRepIds = new Set(existingAlerts.map((a) => a.repuestoId));

  const alertsToInsert = [];
  if (repuestosList.length > 2) {
    alertsToInsert.push({
      repuestoId: repuestosList[2]!.id,
      stockActual: (repuestosList[2]!.stockActual ?? 0),
      puntoReorden: 20,
      estado: "PENDIENTE" as const,
    });
    if (repuestosList[3]) {
      alertsToInsert.push({
        repuestoId: repuestosList[3]!.id,
        stockActual: (repuestosList[3]!.stockActual ?? 0),
        puntoReorden: 15,
        estado: "PENDIENTE" as const,
      });
    }
  }

  let alertCount = 0;
  for (const a of alertsToInsert) {
    if (!existingAlertRepIds.has(a.repuestoId)) {
      await db().insert(reorderAlerts).values({ ...a, tenantSlug: TENANT_SLUG });
      alertCount++;
    }
  }
  console.log(`   ✅ ${alertCount} inserted (${alertsToInsert.length - alertCount} already existed)`);
  totalInserted += alertCount;
  totalSkipped += (alertsToInsert.length - alertCount);

  // ── 5. CYCLE_COUNTS + CYCLE_COUNT_ITEMS ─────────────────────────────────
  console.log("\n5. Cycle Counts & Items...");
  const existingCC = await db()
    .select({ almacenId: cycleCounts.almacenId, observaciones: cycleCounts.observaciones })
    .from(cycleCounts)
    .where(eq(cycleCounts.tenantSlug, TENANT_SLUG));
  const existingCCKey = new Set(existingCC.map((c) => `${c.almacenId}|${c.observaciones || ''}`));

  let ccCount = 0;
  const ccObs = "Conteo cíclico demo";
  const hasCC = existingCCKey.has(`${almPrincipal.id}|${ccObs}`);
  let newCCId: any = null;
  if (!hasCC) {
    const [ins] = await db().insert(cycleCounts).values({
      almacenId: almPrincipal.id,
      estado: "COMPLETADO" as const,
      observaciones: ccObs,
      creadoPor: mechanic?.id || profileRows[0]?.id || null,
      tenantSlug: TENANT_SLUG,
    }).returning();
    newCCId = ins.id;
    ccCount++;
  } else {
    const existing = await db().select({ id: cycleCounts.id })
      .from(cycleCounts)
      .where(and(eq(cycleCounts.tenantSlug, TENANT_SLUG), eq(cycleCounts.observaciones, ccObs)))
      .limit(1);
    newCCId = existing[0]?.id;
  }
  console.log(`   ✅ ${ccCount} cycle count inserted`);

  if (newCCId && repuestosList.length > 0) {
    const existingItems = await db()
      .select({ repuestoId: cycleCountItems.repuestoId })
      .from(cycleCountItems)
      .where(eq(cycleCountItems.cycleCountId, newCCId));
    const existingItemRepIds = new Set(existingItems.map((i) => i.repuestoId));
    const itemsToInsert = [];
    for (let i = 0; i < Math.min(4, repuestosList.length); i++) {
      const r = repuestosList[i]!;
      const stockSistema = r.stockActual ?? 5;
      const stockReal = stockSistema;
      itemsToInsert.push({
        cycleCountId: newCCId,
        repuestoId: r.id,
        stockSistema,
        stockReal,
        diferencia: stockReal - stockSistema,
        ajustado: false,
        tenantSlug: TENANT_SLUG,
      });
    }
    let ccItemCount = 0;
    for (const it of itemsToInsert) {
      if (!existingItemRepIds.has(it.repuestoId)) {
        await db().insert(cycleCountItems).values(it);
        ccItemCount++;
      }
    }
    console.log(`   ✅ ${ccItemCount} cycle count items inserted`);
    totalInserted += ccItemCount;
  }
  totalInserted += ccCount;

  // ── 6. COST_HISTORY ─────────────────────────────────
  console.log("\n6. Cost History...");
  const existingCH = await db()
    .select({ repuestoId: costHistory.repuestoId, tipo: costHistory.tipo })
    .from(costHistory)
    .where(eq(costHistory.tenantSlug, TENANT_SLUG));
  const existingCHKey = new Set(existingCH.map((ch) => `${ch.repuestoId}|${ch.tipo}`));

  const chToInsert = [];
  if (repuestosList.length > 0) {
    const r0 = repuestosList[0]!;
    chToInsert.push({
      repuestoId: r0.id,
      tipo: "INICIAL" as const,
      cantidadAnterior: 0,
      cantidadNueva: r0.stockActual ?? 50,
      cantidadFinal: r0.stockActual ?? 50,
      ppAnterior: "0",
      ppFinal: (r0.precioCosto ?? 100000).toString(),
      tenantSlug: TENANT_SLUG,
    });
    if (repuestosList[1]) {
      const r1 = repuestosList[1]!;
      chToInsert.push({
        repuestoId: r1.id,
        tipo: "COMPRA" as const,
        cantidadAnterior: (r1.stockActual ?? 10) - 5,
        cantidadNueva: 5,
        cantidadFinal: r1.stockActual ?? 10,
        ppAnterior: (r1.precioCosto ?? 100000).toString(),
        costoUnitarioNuevo: (r1.precioCosto ?? 100000).toString(),
        ppFinal: (r1.precioCosto ?? 100000).toString(),
        tenantSlug: TENANT_SLUG,
      });
    }
  }

  let chCount = 0;
  for (const ch of chToInsert) {
    const key = `${ch.repuestoId}|${ch.tipo}`;
    if (!existingCHKey.has(key)) {
      await db().insert(costHistory).values(ch);
      chCount++;
    }
  }
  console.log(`   ✅ ${chCount} inserted (${chToInsert.length - chCount} already existed)`);
  totalInserted += chCount;
  totalSkipped += (chToInsert.length - chCount);

  // ── 7. REVALUACIONES ─────────────────────────────────
  console.log("\n7. Revaluaciones...");
  const existingRev = await db()
    .select({ motivo: revaluaciones.motivo })
    .from(revaluaciones)
    .where(eq(revaluaciones.tenantSlug, TENANT_SLUG));
  const existingRevMotivos = new Set(existingRev.map((r) => r.motivo));

  const revToInsert = [];
  if (activosList.length > 0) {
    revToInsert.push({
      activoFijoId: activosList[0]!.id,
      fecha: new Date(),
      valorAnterior: "5000000",
      valorNuevo: "5500000",
      diferencia: "500000",
      motivo: "Revaluación demo 2026",
      tenantSlug: TENANT_SLUG,
    });
  }

  let revCount = 0;
  for (const r of revToInsert) {
    if (!existingRevMotivos.has(r.motivo)) {
      await db().insert(revaluaciones).values(r);
      revCount++;
    }
  }
  console.log(`   ✅ ${revCount} inserted (${revToInsert.length - revCount} already existed)`);
  totalInserted += revCount;
  totalSkipped += (revToInsert.length - revCount);

  // ── 8. SERVICE_BRAND_MAP ─────────────────────────────────
  console.log("\n8. Service Brand Map...");
  const existingSbm = await db()
    .select({ servicioId: serviceBrandMap.servicioId, marca: serviceBrandMap.marca })
    .from(serviceBrandMap)
    .where(sql`true`); // global table as per schema
  const existingSbmKey = new Set(existingSbm.map((s) => `${s.servicioId}|${s.marca}`));

  const sbmToInsert = [];
  if (serviciosList.length > 0) {
    sbmToInsert.push({
      servicioId: serviciosList[0]!.id,
      marca: "Toyota",
    });
    sbmToInsert.push({
      servicioId: serviciosList[0]!.id,
      marca: "Chevrolet",
    });
    if (serviciosList[1]) {
      sbmToInsert.push({
        servicioId: serviciosList[1]!.id,
        marca: "Toyota",
      });
    }
    if (serviciosList[2]) {
      sbmToInsert.push({
        servicioId: serviciosList[2]!.id,
        marca: "Hyundai",
      });
      sbmToInsert.push({
        servicioId: serviciosList[2]!.id,
        marca: "Kia",
      });
    }
  }

  let sbmCount = 0;
  for (const s of sbmToInsert) {
    const key = `${s.servicioId}|${s.marca}`;
    if (!existingSbmKey.has(key)) {
      await db().insert(serviceBrandMap).values(s);
      sbmCount++;
    }
  }
  console.log(`   ✅ ${sbmCount} inserted (${sbmToInsert.length - sbmCount} already existed)`);
  totalInserted += sbmCount;
  totalSkipped += (sbmToInsert.length - sbmCount);

  // ── 9. TOOL_INSTANCES ─────────────────────────────────
  console.log("\n9. Tool Instances...");
  const existingTi = await db()
    .select({ codigoInventario: toolInstances.codigoInventario, numeroSerie: toolInstances.numeroSerie })
    .from(toolInstances)
    .where(eq(toolInstances.tenantSlug, TENANT_SLUG));
  const existingTiKey = new Set(existingTi.map((t) => t.codigoInventario || t.numeroSerie));

  const tiToInsert = [];
  if (herramientasList.length > 0) {
    tiToInsert.push({
      herramientaId: herramientasList[0]!.id,
      numeroSerie: "SN-TOOL-001",
      codigoInventario: "INV-TOOL-001",
      costoAdquisicion: "150000",
      fechaAdquisicion: new Date().toISOString().slice(0, 10),
      valorActualLibros: "150000",
      estadoActual: "DISPONIBLE" as const,
      requiereCalibracion: false,
      activa: true,
      tenantSlug: TENANT_SLUG,
    });
    if (herramientasList[1]) {
      tiToInsert.push({
        herramientaId: herramientasList[1]!.id,
        numeroSerie: "SN-TOOL-002",
        codigoInventario: "INV-TOOL-002",
        costoAdquisicion: "200000",
        fechaAdquisicion: new Date().toISOString().slice(0, 10),
        valorActualLibros: "200000",
        estadoActual: "DISPONIBLE" as const,
        requiereCalibracion: false,
        activa: true,
        tenantSlug: TENANT_SLUG,
      });
    }
  }

  let tiCount = 0;
  for (const t of tiToInsert) {
    const key = t.codigoInventario || t.numeroSerie;
    if (!existingTiKey.has(key)) {
      await db().insert(toolInstances).values(t as any);
      tiCount++;
    }
  }
  console.log(`   ✅ ${tiCount} inserted (${tiToInsert.length - tiCount} already existed)`);
  totalInserted += tiCount;
  totalSkipped += (tiToInsert.length - tiCount);

  // Get tool instance IDs
  const toolInstancesList = await db()
    .select({ id: toolInstances.id, codigoInventario: toolInstances.codigoInventario })
    .from(toolInstances)
    .where(eq(toolInstances.tenantSlug, TENANT_SLUG))
    .limit(5);

  // ── 10. CONTROL_HERRAMIENTAS ─────────────────────────────────
  console.log("\n10. Control Herramientas...");
  const existingCh = await db()
    .select({ herramientaId: controlHerramientas.herramientaId, toolInstanceId: controlHerramientas.toolInstanceId, estado: controlHerramientas.estado })
    .from(controlHerramientas)
    .where(eq(controlHerramientas.tenantSlug, TENANT_SLUG));
  const existingChKey = new Set(existingCh.map((c) => `${c.herramientaId}|${c.toolInstanceId}|${c.estado}`));

  const chCtrlToInsert = [];
  if (herramientasList.length > 0 && toolInstancesList.length > 0 && otList.length > 0) {
    chCtrlToInsert.push({
      herramientaId: herramientasList[0]!.id,
      toolInstanceId: toolInstancesList[0]!.id,
      ordenTrabajoId: otList[0]!.id,
      mecanicoId: mechanic?.id || profileRows[0]?.id,
      mecanicoNombre: mechanic?.fullName || profileRows[0]?.fullName || "Mecánico Demo",
      fechaAsignacion: new Date(),
      condicionSalida: "Bueno",
      estado: "Asignado" as const,
      tenantSlug: TENANT_SLUG,
    });
  }

  let chCtrlCount = 0;
  for (const c of chCtrlToInsert) {
    const key = `${c.herramientaId}|${c.toolInstanceId}|${c.estado}`;
    if (!existingChKey.has(key)) {
      await db().insert(controlHerramientas).values(c as any);
      chCtrlCount++;
    }
  }
  console.log(`   ✅ ${chCtrlCount} inserted (${chCtrlToInsert.length - chCtrlCount} already existed)`);
  totalInserted += chCtrlCount;
  totalSkipped += (chCtrlToInsert.length - chCtrlCount);

  // ── 11. TOOL_MAINTENANCE_EVENTS ─────────────────────────────────
  console.log("\n11. Tool Maintenance Events...");
  const existingTme = await db()
    .select({ tipo: toolMaintenanceEvents.tipo, toolInstanceId: toolMaintenanceEvents.toolInstanceId })
    .from(toolMaintenanceEvents)
    .where(eq(toolMaintenanceEvents.tenantSlug, TENANT_SLUG));
  const existingTmeKey = new Set(existingTme.map((t) => `${t.toolInstanceId}|${t.tipo}`));

  const tmeToInsert = [];
  if (toolInstancesList.length > 0) {
    tmeToInsert.push({
      toolInstanceId: toolInstancesList[0]!.id,
      tipo: "INSPECCION" as const,
      estado: "COMPLETADO" as const,
      fechaInicio: new Date(),
      fechaFin: new Date(),
      proveedor: "Taller Interno",
      resultado: "OK",
      observaciones: "Inspección de rutina",
      tenantSlug: TENANT_SLUG,
    });
    if (toolInstancesList[1]) {
      tmeToInsert.push({
        toolInstanceId: toolInstancesList[1]!.id,
        tipo: "MANTENIMIENTO_PREVENTIVO" as const,
        estado: "PROGRAMADO" as const,
        fechaInicio: new Date(),
        proveedor: "Taller Interno",
        observaciones: "Mantenimiento preventivo programado",
        tenantSlug: TENANT_SLUG,
      });
    }
  }

  let tmeCount = 0;
  for (const t of tmeToInsert) {
    const key = `${t.toolInstanceId}|${t.tipo}`;
    if (!existingTmeKey.has(key)) {
      await db().insert(toolMaintenanceEvents).values(t as any);
      tmeCount++;
    }
  }
  console.log(`   ✅ ${tmeCount} inserted (${tmeToInsert.length - tmeCount} already existed)`);
  totalInserted += tmeCount;
  totalSkipped += (tmeToInsert.length - tmeCount);

  // ── 12. TOOL_DEPRECIATION_ENTRIES ─────────────────────────────────
  console.log("\n12. Tool Depreciation Entries...");
  const existingTde = await db()
    .select({ periodo: toolDepreciationEntries.periodo, toolInstanceId: toolDepreciationEntries.toolInstanceId })
    .from(toolDepreciationEntries)
    .where(eq(toolDepreciationEntries.tenantSlug, TENANT_SLUG));
  const existingTdeKey = new Set(existingTde.map((t) => `${t.toolInstanceId}|${t.periodo}`));

  const tdeToInsert = [];
  if (toolInstancesList.length > 0) {
    const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM
    tdeToInsert.push({
      toolInstanceId: toolInstancesList[0]!.id,
      fecha: new Date().toISOString().slice(0, 10),
      periodo,
      valorInicial: "150000",
      valorFinal: "147500",
      montoDepreciacion: "2500",
      tenantSlug: TENANT_SLUG,
    });
  }

  let tdeCount = 0;
  for (const t of tdeToInsert) {
    const key = `${t.toolInstanceId}|${t.periodo}`;
    if (!existingTdeKey.has(key)) {
      await db().insert(toolDepreciationEntries).values(t as any);
      tdeCount++;
    }
  }
  console.log(`   ✅ ${tdeCount} inserted (${tdeToInsert.length - tdeCount} already existed)`);
  totalInserted += tdeCount;
  totalSkipped += (tdeToInsert.length - tdeCount);

  console.log(`\n✅ Total: ${totalInserted} inserted, ${totalSkipped} already existed`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
