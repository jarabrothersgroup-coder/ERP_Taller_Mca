/**
 * Seed script: Service Catalog & Pricing (Sprint 33).
 *
 * Populates service categories, service catalog, pricing rules,
 * and RH service hours for a given tenant.
 *
 * Usage: npx tsx scripts/seed-services.ts <tenant_slug>
 *
 * @module scripts/seed-services
 */

import { db } from "../src/shared/database/drizzle.js";
import { sql, eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import {
  serviceCategories,
  serviciosCatalogo,
  servicePricingRules,
  rhServiceHours,
  vehicleTypes,
} from "../src/modules/workshop/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-services.ts <tenant_slug>");
  process.exit(1);
}

async function main() {
  console.log(`🌱 Seeding services for tenant: ${TENANT_SLUG}\n`);

  // ── 1. Service Categories ─────────────────
  const categories = [
    { nombre: "Mecánica Preventiva", icono: "🔧", color: "#3B82F6", orden: 1 },
    { nombre: "Electricidad y Diagnóstico", icono: "⚡", color: "#F59E0B", orden: 2 },
    { nombre: "Climatización y Confort", icono: "❄️", color: "#06B6D4", orden: 3 },
    { nombre: "Tren Delantero y Frenos", icono: "🛑", color: "#EF4444", orden: 4 },
    { nombre: "Especialidad Modernos/Chinos", icono: "🔌", color: "#8B5CF6", orden: 5 },
    { nombre: "Transmisión", icono: "⚙️", color: "#10B981", orden: 6 },
    { nombre: "Carrocería y Pintura", icono: "🎨", color: "#EC4899", orden: 7 },
    { nombre: "Sistemas Flotas", icono: "🚛", color: "#6366F1", orden: 8 },
  ];
  const existingCats = await db().select({ nombre: serviceCategories.nombre }).from(serviceCategories);
  const existingCatSet = new Set(existingCats.map((c) => c.nombre));
  let catCount = 0;
  for (const c of categories) {
    if (!existingCatSet.has(c.nombre)) {
      await db().insert(serviceCategories).values(c);
      catCount++;
    }
  }
  console.log(`   ✅  Service Categories: ${catCount} inserted`);

  // ── 2. Service Catalog ────────────────────
  const services = [
    { nombre: "Servicio Básico 5.000 km", descripcion: "Cambio de aceite y filtro, inspección de 25 puntos de seguridad, rotación de neumáticos", categoria: "Mecánica Preventiva", codigo: "MEC-05K", precioEstimado: "450000", duracionEstimada: 60 },
    { nombre: "Inspección Intermedia 10.000 km", descripcion: "Cambio de aceite, filtro de aire y hábitáculo, regulación de frenos, alineación y balanceo", categoria: "Mecánica Preventiva", codigo: "MEC-10K", precioEstimado: "650000", duracionEstimada: 90 },
    { nombre: "Afinación y Frenos 20.000 km", descripcion: "Todo lo del 10K + bujías, limpieza de inyectores, pastillas de freno delanteras", categoria: "Mecánica Preventiva", codigo: "MEC-20K", precioEstimado: "1100000", duracionEstimada: 120 },
    { nombre: "Mantenimiento Mayor 40.000 km", descripcion: "Cambio de todos los fluidos, filtro de combustible, limpieza EVAP, revisión de bujes", categoria: "Mecánica Preventiva", codigo: "MEC-40K", precioEstimado: "1800000", duracionEstimada: 180 },
    { nombre: "Transmisión y Correas 60.000 km", descripcion: "Aceite de caja, correa de accesorios, kit de distribución, bomba de agua", categoria: "Mecánica Preventiva", codigo: "MEC-60K", precioEstimado: "3000000", duracionEstimada: 240 },
    { nombre: "Diagnóstico Computarizado", descripcion: "Lectura de DTCs, análisis de parámetros en vivo, freeze frame", categoria: "Electricidad y Diagnóstico", codigo: "ELE-DIAG", precioEstimado: "150000", duracionEstimada: 30 },
    { nombre: "Recarga de Gas Refrigerante", descripcion: "Vacío del sistema, recarga de gas R134a/R1234yf, detección de fugas", categoria: "Climatización y Confort", codigo: "CLI-REC", precioEstimado: "250000", duracionEstimada: 45 },
    { nombre: "Cambio de Pastillas de Freno", descripcion: "Reemplazo de pastillas delanteras y/o traseras, limpieza de discos", categoria: "Tren Delantero y Frenos", codigo: "FRE-PAST", precioEstimado: "350000", duracionEstimada: 60 },
    { nombre: "Cambio de Aceite de Transmisión", descripcion: "Vaciado, limpieza y recarga de aceite ATF/CVT/DSG", categoria: "Transmisión", codigo: "TRANS-ACE", precioEstimado: "450000", duracionEstimada: 90 },
    { nombre: "Descarbonización EGR", descripcion: "Limpieza química por ultrasonido del sistema EGR y colector de admisión", categoria: "Especialidad Modernos/Chinos", codigo: "DESC-EGR", precioEstimado: "800000", duracionEstimada: 180 },
    { nombre: "Limpieza de Inyectores", descripcion: "Limpieza química de inyectores por ultrasonido, regulación del cuerpo de aceleración", categoria: "Especialidad Modernos/Chinos", codigo: "INY-QUI", precioEstimado: "300000", duracionEstimada: 60 },
    { nombre: "Servicio de Dirección Asistida", descripcion: "Cambio de fluido, revisión de bomba, inspección de terminales", categoria: "Tren Delantero y Frenos", codigo: "DIR-ASIST", precioEstimado: "400000", duracionEstimada: 90 },
    { nombre: "Preparación Carrocería", descripcion: "Trabajos de chapa, pintura, preparación para venta", categoria: "Carrocería y Pintura", codigo: "CAR-PINT", precioEstimado: "500000", duracionEstimada: 120 },
    { nombre: "Inspección de Flota", descripcion: "Chequeo estándar para vehículos de flota empresarial", categoria: "Sistemas Flotas", codigo: "FLOTA-INS", precioEstimado: "200000", duracionEstimada: 45 },
  ];

  const existingServs = await db()
    .select({ codigo: serviciosCatalogo.codigo })
    .from(serviciosCatalogo)
    .where(eq(serviciosCatalogo.tenantSlug, TENANT_SLUG));
  const existingServSet = new Set(existingServs.map((s) => s.codigo));
  let servCount = 0;
  for (const s of services) {
    if (!existingServSet.has(s.codigo)) {
      await db().insert(serviciosCatalogo).values({ ...s, tenantSlug: TENANT_SLUG });
      servCount++;
    }
  }
  console.log(`   ✅  Service Catalog: ${servCount} inserted`);

  // ── 3. Pricing Rules ──────────────────────
  const vtRows = await db().select({ id: vehicleTypes.id, nombre: vehicleTypes.nombre }).from(vehicleTypes);
  const vtMap = new Map(vtRows.map((v) => [v.nombre, v.id]));

  // Get inserted services
  const servRows = await db()
    .select({ id: serviciosCatalogo.id, codigo: serviciosCatalogo.codigo, precioEstimado: serviciosCatalogo.precioEstimado, duracionEstimada: serviciosCatalogo.duracionEstimada })
    .from(serviciosCatalogo)
    .where(eq(serviciosCatalogo.tenantSlug, TENANT_SLUG));
  const servMap = new Map(servRows.map((s) => [s.codigo, s]));

  // Pricing for km-interval services: AUTOMOVIL = base price, SUV/PICK_UP = 1.3x
  const kmServices = ["MEC-05K", "MEC-10K", "MEC-20K", "MEC-40K", "MEC-60K"];
  const pricingVehicleTypes = ["AUTOMOVIL", "SUV", "PICK_UP"];
  const multipliers: Record<string, number> = { AUTOMOVIL: 1.0, SUV: 1.3, PICK_UP: 1.3 };

  const existingPricing = await db()
    .select({ servicioId: servicePricingRules.servicioId, vehicleTypeId: servicePricingRules.vehicleTypeId })
    .from(servicePricingRules)
    .where(eq(servicePricingRules.tenantSlug, TENANT_SLUG));
  const existingPricingKeys = new Set(existingPricing.map((p) => `${p.servicioId}:${p.vehicleTypeId}`));
  let prCount = 0;

  for (const servCode of kmServices) {
    const serv = servMap.get(servCode);
    if (!serv) continue;
    const basePrice = Number(serv.precioEstimado) || 450000;
    const duracion = serv.duracionEstimada || 60;
    for (const vtName of pricingVehicleTypes) {
      const vtId = vtMap.get(vtName);
      if (!vtId) continue;
      const key = `${serv.id}:${vtId}`;
      if (existingPricingKeys.has(key)) continue;
      const precio = Math.round(basePrice * (multipliers[vtName] ?? 1));
      await db().insert(servicePricingRules).values({
        servicioId: serv.id,
        vehicleTypeId: vtId,
        precioVentaPyg: String(precio),
        precioCostoPyg: String(Math.round(precio * 0.4)),
        impuestoIvaPct: "10",
        tiempoEstimadoMin: duracion,
        complejidad: "NORMAL",
        activo: true,
        tenantSlug: TENANT_SLUG,
      });
      prCount++;
    }
  }
  console.log(`   ✅  Pricing Rules: ${prCount} inserted`);

  // ── 4. RH Service Hours ───────────────────
  const existingRH = await db()
    .select({ servicioId: rhServiceHours.servicioId, vehicleTypeId: rhServiceHours.vehicleTypeId })
    .from(rhServiceHours)
    .where(eq(rhServiceHours.tenantSlug, TENANT_SLUG));
  const existingRHKeys = new Set(existingRH.map((r) => `${r.servicioId}:${r.vehicleTypeId}`));
  let rhCount = 0;

  for (const servCode of kmServices) {
    const serv = servMap.get(servCode);
    if (!serv) continue;
    const horas = ((serv.duracionEstimada || 60) / 60);
    for (const vtName of pricingVehicleTypes) {
      const vtId = vtMap.get(vtName);
      if (!vtId) continue;
      const key = `${serv.id}:${vtId}`;
      if (existingRHKeys.has(key)) continue;
      await db().insert(rhServiceHours).values({
        servicioId: serv.id,
        vehicleTypeId: vtId,
        complejidad: "NORMAL",
        horasEstimadas: String(horas),
        horasMinimas: String(Math.round(horas * 0.8 * 100) / 100),
        horasMaximas: String(Math.round(horas * 1.3 * 100) / 100),
        requiereEspecialista: false,
        tenantSlug: TENANT_SLUG,
      });
      rhCount++;
    }
  }
  console.log(`   ✅  RH Service Hours: ${rhCount} inserted`);
  console.log("\n🌱 Service seeding complete!");
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
