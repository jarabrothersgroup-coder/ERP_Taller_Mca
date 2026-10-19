/**
 * Seed script: Workshop extra tables population (Sprint X).
 *
 * Poblates las tablas del dominio Taller/Órdenes de Trabajo que no tienen seed:
 * orden_servicios, orden_repuestos, orden_estado_historial, ingreso_checklist,
 * mantenimientos_programados, diagnostic_reports, dvi_inspections, dvi_items, dvi_photos
 *
 * Usage: npx tsx scripts/seed-workshop-extra.ts <tenant_slug>
 *
 * @module scripts/seed-workshop-extra
 */

import { db, sql } from "../src/shared/database/drizzle.js";
import { closeDb } from "../src/shared/database/connection.js";
import {
  ordenServicios,
  ordenRepuestos,
  ingresoChecklist,
} from "../src/shared/database/schema/index.js";
import {
  ordenEstadoHistorial,
  mantenimientosProgramados,
} from "../src/modules/workshop/schema/index.js";
import { diagnosticReports } from "../src/modules/intelligence/schema/index.js";
import {
  dviInspections,
  dviItems,
  dviPhotos,
} from "../src/modules/dvi/schema/dvi.js";
import { and, eq } from "drizzle-orm";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-workshop-extra.ts <tenant_slug>");
  process.exit(1);
}

async function setTenantContext() {
  try {
    const safeSlug = String(TENANT_SLUG).replace(/[^a-zA-Z0-9_-]/g, "");
    await db().execute(sql`SELECT set_config('app.current_tenant', ${safeSlug}, false)`);
  } catch (err) {
    // Ignore if not supported
  }
}

async function main() {
  console.log(`🌱 Seeding workshop extra data for tenant: ${TENANT_SLUG}\n`);

  await setTenantContext();

  // ── Fetch base data ────────────────────────────────────────────────
  const ordenes = (await db().execute(
    sql`SELECT id, vehicle_id, client_id, status, description FROM ordenes_trabajo WHERE tenant_slug = ${TENANT_SLUG} ORDER BY created_at ASC`,
  )) as any[];

  const servicios = (await db().execute(
    sql`SELECT id, nombre, precio_estimado, duracion_estimada FROM servicios_catalogo WHERE tenant_slug = ${TENANT_SLUG} AND activo = true`,
  )) as any[];

  const repuestos = (await db().execute(
    sql`SELECT id, codigo, descripcion, precio_venta, precio_costo FROM repuestos WHERE tenant_slug = ${TENANT_SLUG}`,
  )) as any[];

  const vehiculos = (await db().execute(
    sql`SELECT id, plate, brand, model, kilometraje FROM vehiculos WHERE tenant_slug = ${TENANT_SLUG}`,
  )) as any[];

  let ingresos = (await db().execute(sql`SELECT id, vehicle_id, orden_trabajo_id FROM ingresos`)) as any[];

  // Create ingresos if empty (ingresos table has no tenant_slug column)
  if (ingresos.length === 0 && vehiculos.length > 0 && ordenes.length > 0) {
    const n = Math.min(vehiculos.length, ordenes.length, 3);
    for (let i = 0; i < n; i++) {
      const v = vehiculos[i];
      const ot = ordenes[i];
      if (!v || !v.id) continue;
      const km = v.kilometraje == null ? 50000 : Number(v.kilometraje);
      await db().execute(
        sql`INSERT INTO ingresos (vehicle_id, orden_trabajo_id, kilometraje, nivel_combustible, estado_exterior, observaciones) VALUES (${v.id}, ${ot.id}, ${km}, '3/4', 'Bueno', 'Ingreso generado por seed')`,
      );
    }
    ingresos = (await db().execute(sql`SELECT id, vehicle_id, orden_trabajo_id FROM ingresos`)) as any[];
  }

  console.log(`   Found: ${ordenes.length} OT, ${servicios.length} servicios, ${repuestos.length} repuestos, ${vehiculos.length} vehículos, ${ingresos.length} ingresos\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  // ── 1. orden_servicios ─────────────────────────────────────────────
  console.log("   [1/9] orden_servicios");
  const otForServicios = ordenes.slice(0, 3);
  let ins1 = 0,
    sk1 = 0;
  for (let i = 0; i < otForServicios.length && i < servicios.length; i++) {
    const ot = otForServicios[i];
    const srv = servicios[i];
    const cantidad = i === 0 ? 1 : i + 1;
    const precio = parseFloat(String(srv.precioEstimado || "0")) || 100000;
    const subtotal = cantidad * precio;

    const existing = await db()
      .select({ id: ordenServicios.id })
      .from(ordenServicios)
      .where(
        and(
          eq(ordenServicios.ordenTrabajoId, ot.id),
          eq(ordenServicios.servicioId, srv.id),
          eq(ordenServicios.tenantSlug, TENANT_SLUG),
        ),
      );

    if (existing.length === 0) {
      await db().insert(ordenServicios).values({
        ordenTrabajoId: ot.id,
        servicioId: srv.id,
        servicioNombre: srv.nombre,
        cantidad,
        precioUnitario: String(precio.toFixed(2)),
        subtotal: String(subtotal.toFixed(2)),
        duracionEstimada: srv.duracionEstimada,
        tenantSlug: TENANT_SLUG,
      });
      ins1++;
    } else {
      sk1++;
    }
  }
  totalInserted += ins1;
  totalSkipped += sk1;
  console.log(`        +${ins1} / ~${sk1} existentes`);

  // ── 2. orden_repuestos ────────────────────────────────────────────
  console.log("   [2/9] orden_repuestos");
  const otForRep = ordenes.slice(0, 3);
  let ins2 = 0,
    sk2 = 0;
  for (let i = 0; i < otForRep.length && i < repuestos.length; i++) {
    const ot = otForRep[i];
    const rep = repuestos[i];
    const cantidad = 1;
    const precio = parseFloat(String(rep.precioVenta || rep.precioCosto || "0")) || 10000;
    const subtotal = cantidad * precio;

    const existing = await db()
      .select({ id: ordenRepuestos.id })
      .from(ordenRepuestos)
      .where(
        and(
          eq(ordenRepuestos.ordenTrabajoId, ot.id),
          eq(ordenRepuestos.repuestoId, rep.id),
          eq(ordenRepuestos.tenantSlug, TENANT_SLUG),
        ),
      );

    if (existing.length === 0) {
      await db().insert(ordenRepuestos).values({
        ordenTrabajoId: ot.id,
        repuestoId: rep.id,
        repuestoNombre: rep.descripcion,
        codigo: rep.codigo,
        cantidad,
        precioUnitario: String(precio.toFixed(2)),
        subtotal: String(subtotal.toFixed(2)),
        tenantSlug: TENANT_SLUG,
      });
      ins2++;
    } else {
      sk2++;
    }
  }
  totalInserted += ins2;
  totalSkipped += sk2;
  console.log(`        +${ins2} / ~${sk2} existentes`);

  // ── 3. orden_estado_historial ─────────────────────────────────────
  console.log("   [3/9] orden_estado_historial");
  let ins3 = 0,
    sk3 = 0;
  for (let i = 0; i < ordenes.length && i < 4; i++) {
    const ot = ordenes[i];
    const transiciones = [
      { anterior: null, nuevo: "RECIBIDA", obs: "Recepción inicial" },
      { anterior: "RECIBIDA", nuevo: "EN_PROCESO", obs: "Taller comenzó trabajo" },
      { anterior: "EN_PROCESO", nuevo: "LISTO", obs: "Trabajos finalizados" },
    ];
    for (let t = 0; t < transiciones.length; t++) {
      const tr = transiciones[t];
      const existing = await db()
        .select({ id: ordenEstadoHistorial.id })
        .from(ordenEstadoHistorial)
        .where(
          and(
            eq(ordenEstadoHistorial.ordenTrabajoId, ot.id),
            eq(ordenEstadoHistorial.estadoNuevo, tr.nuevo),
          ),
        );
      if (existing.length === 0) {
        await db().insert(ordenEstadoHistorial).values({
          ordenTrabajoId: ot.id,
          estadoAnterior: tr.anterior,
          estadoNuevo: tr.nuevo,
          observaciones: tr.obs,
        });
        ins3++;
      } else {
        sk3++;
      }
    }
  }
  totalInserted += ins3;
  totalSkipped += sk3;
  console.log(`        +${ins3} / ~${sk3} existentes`);

  // ── 4. ingreso_checklist ───────────────────────────────────────────
  console.log("   [4/9] ingreso_checklist");
  let ins4 = 0,
    sk4 = 0;
  for (let i = 0; i < ingresos.length && i < 2; i++) {
    const ing = ingresos[i];
    const existing = await db()
      .select({ id: ingresoChecklist.id })
      .from(ingresoChecklist)
      .where(eq(ingresoChecklist.ingresoId, ing.id));
    if (existing.length === 0) {
      await db().insert(ingresoChecklist).values({
        ingresoId: ing.id,
        panels: {
          delantero: { estado: "OK", notas: "Sin golpes visibles" },
          trasero: { estado: "OK" },
          lateralIzq: { estado: "OK" },
          lateralDer: { estado: "OK" },
        } as any,
        neumaticos: {
          delanteraIzq: { presion: 32, estado: "OK" },
          delanteraDer: { presion: 32, estado: "OK" },
          traseraIzq: { presion: 30, estado: "OK" },
          traseraDer: { presion: 30, estado: "OK" },
        } as any,
        nivelCombustibleExacto: "0.75",
        kilometrajeFoto: true,
        accesorios: {
          llantaAuxilio: true,
          kitHerramientas: true,
          radio: true,
        } as any,
        observacionesCliente: "Cliente presenta leve rayón lateral derecho",
        clienteConforme: true,
        tenantSlug: TENANT_SLUG,
      });
      ins4++;
    } else {
      sk4++;
    }
  }
  totalInserted += ins4;
  totalSkipped += sk4;
  console.log(`        +${ins4} / ~${sk4} existentes`);

  // ── 5. mantenimientos_programados ─────────────────────────────────
  console.log("   [5/9] mantenimientos_programados");
  let ins5 = 0,
    sk5 = 0;
  const hoy = new Date();
  for (let i = 0; i < vehiculos.length && i < 3; i++) {
    const v = vehiculos[i];
    const km = v.kilometraje ? parseInt(v.kilometraje) : 50000;
    const targets = [
      { servicio: "Cambio de aceite", kmObj: km + 5000, fecha: new Date(hoy.getTime() + 90 * 86400000) },
      { servicio: "Revisión de frenos", kmObj: km + 10000, fecha: new Date(hoy.getTime() + 180 * 86400000) },
      { servicio: "Cambio de filtros", kmObj: km + 8000, fecha: new Date(hoy.getTime() + 120 * 86400000) },
    ];
    for (let t = 0; t < targets.length; t++) {
      const trg = targets[t];
      const existing = await db()
        .select({ id: mantenimientosProgramados.id })
        .from(mantenimientosProgramados)
        .where(
          and(
            eq(mantenimientosProgramados.vehiculoId, v.id),
            eq(mantenimientosProgramados.servicio, trg.servicio),
            eq(mantenimientosProgramados.tenantSlug, TENANT_SLUG),
          ),
        );
      if (existing.length === 0) {
        await db().insert(mantenimientosProgramados).values({
          vehiculoId: v.id,
          servicio: trg.servicio,
          kmObjetivo: trg.kmObj,
          fechaObjetivo: trg.fecha.toISOString().split('T')[0],
          estado: "PENDIENTE",
          origen: "MANUAL",
          tenantSlug: TENANT_SLUG,
        } as any);
        ins5++;
      } else {
        sk5++;
      }
    }
  }
  totalInserted += ins5;
  totalSkipped += sk5;
  console.log(`        +${ins5} / ~${sk5} existentes`);

  // ── 6. diagnostic_reports ──────────────────────────────────────────
  console.log("   [6/9] diagnostic_reports");
  let ins6 = 0,
    sk6 = 0;
  for (let i = 0; i < vehiculos.length && i < 2 && ordenes.length > 0; i++) {
    const v = vehiculos[i];
    const ot = ordenes[i] || ordenes[0];
    const chk = await db()
      .select({ id: diagnosticReports.id })
      .from(diagnosticReports)
      .where(and(eq(diagnosticReports.vehicleId, v.id), eq(diagnosticReports.ordenTrabajoId, ot.id)));
    if (chk.length === 0) {
      await db().insert(diagnosticReports).values({
        vehicleId: v.id,
        ordenTrabajoId: ot.id,
        scannerBrand: "Launch X431",
        scanReport: { dtcs: ["P0171", "P0300"], ecu: "ECM", raw: "mock" } as any,
        diagnosisResult: {
          summary: "Leve inconsistencia mezcla",
          recommended: ["Revisar MAF", "Revisar bujías"],
        } as any,
        odometer: v.kilometraje || 50000,
        dtcCount: 2,
        criticalCount: 0,
        hvProtocolGenerated: "no",
        notes: "Diagnóstico de prueba - seed workshop extra",
      } as any);
      ins6++;
    } else {
      sk6++;
    }
  }
  totalInserted += ins6;
  totalSkipped += sk6;
  console.log(`        +${ins6} / ~${sk6} existentes`);

  // ── 7. dvi_inspections + items + photos ────────────────────────────
  console.log("   [7-9] dvi_inspections, dvi_items, dvi_photos");
  let insDvi = 0,
    skDvi = 0;
  let insItems = 0,
    insPhotos = 0;
  for (let i = 0; i < ordenes.length && i < 2; i++) {
    const ot = ordenes[i];
    const existingDvi = await db()
      .select({ id: dviInspections.id })
      .from(dviInspections)
      .where(
        and(
          eq(dviInspections.ordenTrabajoId, ot.id),
          eq(dviInspections.tenantSlug, TENANT_SLUG),
        ),
      );
    if (existingDvi.length === 0) {
      const [dvi] = await db()
        .insert(dviInspections)
        .values({
          ordenTrabajoId: ot.id,
          healthScore: 85,
          condicionGeneral: "BUENO",
          observaciones: "Inspección digital realizada",
          inspector: "Técnico Demo",
          tenantSlug: TENANT_SLUG,
        })
        .returning();
      insDvi++;
      // insert items
      const items = [
        { cat: "FRENOS", desc: "Pastillas delanteras", estado: "OK", peso: 10 },
        { cat: "NEUMATICOS", desc: "Presión y desgaste", estado: "OK", peso: 8 },
        { cat: "ELECTRICO", desc: "Luces y bocina", estado: "REQUIERE_ATENCION", peso: 6, notas: "Bombilla trasera derecha" },
      ];
      for (const it of items) {
        await db().insert(dviItems).values({
          dviId: dvi.id,
          categoria: it.cat,
          descripcion: it.desc,
          estado: it.estado as any,
          peso: it.peso,
          notas: it.notas || null,
          tenantSlug: TENANT_SLUG,
        });
        insItems++;
      }
      // insert photos
      const photos = [
        { cat: "EXTERIOR", url: "https://example.com/dvi/ext1.jpg", caption: "Vista frontal", orden: 0 },
        { cat: "INTERIOR", url: "https://example.com/dvi/int1.jpg", caption: "Tablero", orden: 1 },
      ];
      for (const p of photos) {
        await db().insert(dviPhotos).values({
          dviId: dvi.id,
          categoria: p.cat,
          url: p.url,
          nombreArchivo: p.url.split("/").pop(),
          caption: p.caption,
          orden: p.orden,
          tenantSlug: TENANT_SLUG,
        });
        insPhotos++;
      }
    } else {
      skDvi++;
    }
  }
  totalInserted += insDvi + insItems + insPhotos;
  totalSkipped += skDvi;
  console.log(`        +DVI:${insDvi} +Items:${insItems} +Photos:${insPhotos} / ~${skDvi} DVI existentes`);

  console.log(`\n   📊 Totales: +${totalInserted} insertados (${totalSkipped} ya existían / saltados)`);
  console.log(`\n🌱 Workshop extra seeding complete!`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
