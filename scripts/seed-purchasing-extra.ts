/**
 * Seed script: Purchasing extra data.
 *
 * Poblates tablas de Compras: proveedores, compras, compra_detalles,
 * purchase_orders, purchase_order_items, trabajos_terceros
 *
 * Usage: npx tsx scripts/seed-purchasing-extra.ts <tenant_slug>
 *
 * @module scripts/seed-purchasing-extra
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq, and, sql } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";

import { proveedores } from "../src/modules/workshop/schema/proveedores.js";
import { compras, compraDetalles } from "../src/modules/finance/schema/compras.js";
import { purchaseOrders, purchaseOrderItems } from "../src/modules/inventory/schema/purchase-orders.js";
import { trabajosTerceros } from "../src/modules/workshop/schema/trabajos-terceros.js";

import { repuestos } from "../src/modules/inventory/schema/repuestos.js";
import { ordenesTrabajo } from "../src/modules/workshop/schema/ordenes-trabajo.js";
import { almacenes } from "../src/modules/inventory/schema/almacenes.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-purchasing-extra.ts <tenant_slug>");
  process.exit(1);
}

async function getOrCreateAlmacenPrincipal(tenantSlug: string) {
  const existing = await db()
    .select()
    .from(almacenes)
    .where(and(eq(almacenes.tenantSlug, tenantSlug)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const codigo = "PRINCIPAL";
  const existingByCode = await db()
    .select()
    .from(almacenes)
    .where(and(eq(almacenes.tenantSlug, tenantSlug), eq(almacenes.codigo, codigo)))
    .limit(1);

  if (existingByCode.length > 0) {
    return existingByCode[0];
  }

  const [inserted] = await db()
    .insert(almacenes)
    .values({
      codigo,
      nombre: "Almacén Principal",
      direccion: "Depósito Central",
      activo: true,
      tenantSlug,
    })
    .returning();

  return inserted;
}

async function main() {
  console.log("Seeding purchasing extra data for tenant: " + TENANT_SLUG);

  await getOrCreateAlmacenPrincipal(TENANT_SLUG);

  const proveedoresDefs = [
    {
      nombre: "Repuestos Yguazú S.A.",
      ruc: "80012345-6",
      telefono: "+595981123456",
      email: "ventas@rpyguazu.com.py",
      direccion: "Av. Brasil 1234, Asunción",
      tipo: "REPUESTOS",
      especialidades: JSON.stringify(["Filtros", "Frenos", "Motor"]),
      calificacion: 5,
      notas: "Proveedor principal de repuestos",
      activo: true,
      tenantSlug: TENANT_SLUG,
    },
    {
      nombre: "Taller de Pintura El Chero",
      ruc: "80023456-7",
      telefono: "+595982234567",
      email: "info@elchero.com.py",
      direccion: "Ruta 1 Km 14, San Lorenzo",
      tipo: "SERVICIOS",
      especialidades: JSON.stringify(["Pintura", "Chapistería"]),
      calificacion: 4,
      activo: true,
      tenantSlug: TENANT_SLUG,
    },
    {
      nombre: "Distribuidora AutoPartes CDE",
      ruc: "80034567-8",
      telefono: "+595983345678",
      email: "compras@autopartescde.com.py",
      direccion: "Av. Aviadores del Chaco 5678, Ciudad del Este",
      tipo: "REPUESTOS",
      especialidades: JSON.stringify(["Eléctrico", "Suspensión"]),
      calificacion: 5,
      activo: true,
      tenantSlug: TENANT_SLUG,
    },
    {
      nombre: "Servicios A/C Paraguay",
      ruc: "80045678-9",
      telefono: "+595984456789",
      email: "ac@serviciosac.com.py",
      direccion: "Capiatá, Central",
      tipo: "SERVICIOS",
      especialidades: JSON.stringify(["Aire Acondicionado"]),
      calificacion: 4,
      activo: true,
      tenantSlug: TENANT_SLUG,
    },
    {
      nombre: "Ferretería Automotriz Luque",
      ruc: "80056789-0",
      telefono: "+595985567890",
      email: "ventas@ferrauto.com.py",
      direccion: "Ruta 1 Km 20, Luque",
      tipo: "AMBOS",
      especialidades: JSON.stringify(["Insumos"]),
      calificacion: 4,
      activo: true,
      tenantSlug: TENANT_SLUG,
    },
  ];

  const existingProv = await db()
    .select({ nombre: proveedores.nombre })
    .from(proveedores)
    .where(and(eq(proveedores.tenantSlug, TENANT_SLUG)));

  const existingProvNames = new Set(existingProv.map((p) => p.nombre));
  let provCount = 0;
  for (const p of proveedoresDefs) {
    if (existingProvNames.has(p.nombre)) continue;
    await db().insert(proveedores).values(p as any);
    provCount++;
  }

  const allProveedores = await db()
    .select({ id: proveedores.id, nombre: proveedores.nombre })
    .from(proveedores)
    .where(and(eq(proveedores.tenantSlug, TENANT_SLUG)));

  console.log("Proveedores: " + provCount + " inserted");

  const existingCompras = await db()
    .select({ numeroFactura: compras.numeroFactura })
    .from(compras)
    .where(and(eq(compras.tenantSlug, TENANT_SLUG)));
  const existingCompNums = new Set(existingCompras.map((c) => c.numeroFactura));

  const repuestosDemo = await db()
    .select({ id: repuestos.id, codigo: repuestos.codigo })
    .from(repuestos)
    .where(and(eq(repuestos.tenantSlug, TENANT_SLUG), eq(repuestos.activo, true)))
    .limit(15);

  const repuestosByCodigo = new Map<string, string>();
  for (const r of repuestosDemo) {
    if (r.codigo) repuestosByCodigo.set(r.codigo, r.id);
  }

  const compraDefs = [
    {
      numeroFactura: "COMP-2026-001",
      proveedorNombre: allProveedores[0]?.nombre || "Repuestos Yguazú S.A.",
      estadoPago: "PENDIENTE" as const,
      notas: "Compra de filtros y pastillas",
      detalles: [
        { codigo: repuestosDemo[0]?.codigo, cantidad: "4", precioUnitario: "55000.00" },
        { codigo: repuestosDemo[1]?.codigo, cantidad: "2", precioUnitario: "150000.00" },
      ],
    },
    {
      numeroFactura: "COMP-2026-002",
      proveedorNombre: allProveedores[1]?.nombre || "Taller de Pintura El Chero",
      estadoPago: "PARCIAL" as const,
      notas: "Servicios",
      detalles: [
        { descripcion: "Preparación y pintura", cantidad: "1", precioUnitario: "1500000.00" },
      ],
    },
    {
      numeroFactura: "COMP-2026-003",
      proveedorNombre: allProveedores[2]?.nombre || "Distribuidora AutoPartes CDE",
      estadoPago: "PAGADO" as const,
      notas: "Repuestos",
      detalles: [
        { codigo: repuestosDemo[2]?.codigo, cantidad: "1", precioUnitario: "650000.00" },
      ],
    },
  ];

  let comprasCount = 0;
  let detCount = 0;
  for (const cdef of compraDefs) {
    if (existingCompNums.has(cdef.numeroFactura)) continue;
    const proveedorId = allProveedores.find((p) => p.nombre === cdef.proveedorNombre)?.id || null;
    let totalCompra = 0;
    for (const d of cdef.detalles) {
      totalCompra += Number(d.cantidad) * Number(d.precioUnitario);
    }
    const [compraIns] = await db()
      .insert(compras)
      .values({
        numeroFactura: cdef.numeroFactura,
        proveedorId,
        proveedorNombre: cdef.proveedorNombre,
        total: totalCompra.toFixed(2),
        estadoPago: cdef.estadoPago,
        notas: cdef.notas,
        tenantSlug: TENANT_SLUG,
      })
      .returning();
    if (compraIns) {
      comprasCount++;
      for (const d of cdef.detalles) {
        const qty = Number(d.cantidad);
        const pu = Number(d.precioUnitario);
        const subtotal = qty * pu;
        await db().insert(compraDetalles).values({
          compraId: compraIns.id,
          descripcion: d.descripcion || (d.codigo ? d.codigo : "Item"),
          cantidad: d.cantidad,
          precioUnitario: pu.toFixed(2),
          subtotal: subtotal.toFixed(2),
        } as any);
        detCount++;
      }
    }
  }
  console.log("Compras: " + comprasCount + " inserted, Detalles: " + detCount + " inserted");

  const existingPOs = await db()
    .select({ numero: purchaseOrders.numero })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.tenantSlug, TENANT_SLUG)));
  const existingPONums = new Set(existingPOs.map((po) => po.numero));

  const poDefs = [
    {
      numero: "OC-2026-0001",
      proveedor: allProveedores[0]?.nombre || "Repuestos Yguazú S.A.",
      estado: "PENDIENTE",
      notas: "OC urgente",
      items: [
        { codigo: repuestosDemo[0]?.codigo, cantidad: 10, costoUnitario: "55000.00" },
        { codigo: repuestosDemo[1]?.codigo, cantidad: 4, costoUnitario: "145000.00" },
      ],
    },
    {
      numero: "OC-2026-0002",
      proveedor: allProveedores[2]?.nombre || "Distribuidora AutoPartes CDE",
      estado: "RECIBIDA",
      notas: "Recibida completa",
      items: [
        { codigo: repuestosDemo[2]?.codigo, cantidad: 2, costoUnitario: "620000.00" },
      ],
    },
  ];

  let poCount = 0;
  let poiCount = 0;
  for (const podef of poDefs) {
    if (existingPONums.has(podef.numero)) continue;
    let totalOc = 0;
    for (const item of podef.items) {
      totalOc += item.cantidad * Number(item.costoUnitario);
    }
    const [poIns] = await db()
      .insert(purchaseOrders)
      .values({
        numero: podef.numero,
        proveedor: podef.proveedor,
        estado: podef.estado,
        totalOc: totalOc.toFixed(2),
        notas: podef.notas,
        tenantSlug: TENANT_SLUG,
      })
      .returning();
    if (poIns) {
      poCount++;
      for (const item of podef.items) {
        const repId = item.codigo ? repuestosByCodigo.get(item.codigo) : repuestosDemo[0]?.id;
        if (!repId) continue;
        const subtotal = item.cantidad * Number(item.costoUnitario);
        await db().insert(purchaseOrderItems).values({
          ordenCompraId: poIns.id,
          repuestoId: repId,
          cantidad: item.cantidad,
          cantidadRecibida: podef.estado === "RECIBIDA" ? item.cantidad : 0,
          costoUnitario: item.costoUnitario,
          subtotal: subtotal.toFixed(2),
          tenantSlug: TENANT_SLUG,
        });
        poiCount++;
      }
    }
  }
  console.log("POs: " + poCount + " inserted, PO Items: " + poiCount + " inserted");

  const otsDemo = await db()
    .select({ id: ordenesTrabajo.id })
    .from(ordenesTrabajo)
    .where(and(eq(ordenesTrabajo.tenantSlug, TENANT_SLUG)))
    .limit(5);

  const existingTT = await db()
    .select({ ordenTrabajoId: trabajosTerceros.ordenTrabajoId, descripcion: trabajosTerceros.descripcion })
    .from(trabajosTerceros);
  const existingTTKey = new Set(existingTT.map((t) => t.ordenTrabajoId + '|' + t.descripcion));

  const ttDefs = [
    {
      ordenTrabajoId: otsDemo[0]?.id,
      proveedor: allProveedores[1]?.nombre || "Taller de Pintura El Chero",
      descripcion: "Pulido y encerado exterior",
      costo: "450000.00",
      estado: "Pendiente" as const,
    },
    {
      ordenTrabajoId: otsDemo[1]?.id,
      proveedor: allProveedores[3]?.nombre || "Servicios A/C Paraguay",
      descripcion: "Recarga de gas y limpieza de evaporador",
      costo: "850000.00",
      estado: "En_Proceso" as const,
    },
    {
      ordenTrabajoId: otsDemo[2]?.id,
      proveedor: allProveedores[1]?.nombre || "Taller de Pintura El Chero",
      descripcion: "Arreglo de abolladura pequeña",
      costo: "280000.00",
      estado: "Completado" as const,
    },
  ];

  let ttCount = 0;
  for (const tt of ttDefs) {
    if (!tt.ordenTrabajoId) continue;
    const key = tt.ordenTrabajoId + '|' + tt.descripcion;
    if (existingTTKey.has(key)) continue;
    await db().insert(trabajosTerceros).values({
      ordenTrabajoId: tt.ordenTrabajoId,
      proveedor: tt.proveedor,
      descripcion: tt.descripcion,
      costo: tt.costo,
      estado: tt.estado,
    } as any);
    ttCount++;
  }
  console.log("Trabajos Terceros: " + ttCount + " inserted");

  console.log("Seed complete for tenant: " + TENANT_SLUG);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
