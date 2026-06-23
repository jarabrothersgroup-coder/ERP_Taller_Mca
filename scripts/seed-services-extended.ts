/**
 * Seed script: Extended Service Catalog — Complete + Specialized Maintenance.
 *
 * Adds 30+ services to the existing catalog covering:
 *   - Light maintenance (oil changes, filters, brakes)
 *   - Medium maintenance (suspension, transmission, electrical)
 *   - Heavy maintenance (engine, turbo, EGR, timing)
 *   - Specialized (EV/HEV, A/C, bodywork, fleet)
 *   - Emergency / Roadside assistance
 *
 * Usage: npx tsx scripts/seed-services-extended.ts <tenant_slug>
 *
 * @module scripts/seed-services-extended
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import {
  serviceCategories,
  serviciosCatalogo,
  servicePricingRules,
  vehicleTypes,
} from "../src/modules/workshop/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-services-extended.ts <tenant_slug>");
  process.exit(1);
}

async function main() {
  console.log(`🌱 Seeding extended services for tenant: ${TENANT_SLUG}\n`);

  // ── 1. Additional Service Categories ─────────
  const extraCategories = [
    { nombre: "Mantenimiento Ligero", icono: "🛢️", color: "#22C55E", orden: 9 },
    { nombre: "Mantenimiento Pesado", icono: "🔨", color: "#DC2626", orden: 10 },
    { nombre: "Emergencias y Asistencia", icono: "🚨", color: "#F97316", orden: 11 },
    { nombre: "EV/HEV Especializado", icono: "🔋", color: "#84CC16", orden: 12 },
  ];
  const existingCats = await db().select({ nombre: serviceCategories.nombre }).from(serviceCategories);
  const existingCatSet = new Set(existingCats.map((c) => c.nombre));
  let catCount = 0;
  for (const c of extraCategories) {
    if (!existingCatSet.has(c.nombre)) {
      await db().insert(serviceCategories).values(c);
      catCount++;
    }
  }
  console.log(`   ✅  Extra Categories: ${catCount} inserted`);

  // ── 2. Extended Service Catalog ──────────────
  const services = [
    // ── Mantenimiento Ligero (aceites, filtros, frenos básicos) ──
    { nombre: "Cambio de Aceite y Filtro", descripcion: "Cambio de aceite motor, filtro de aceite, inspección visual de 15 puntos", categoria: "Mantenimiento Ligero", codigo: "LIG-OIL-001", precioEstimado: "280000", duracionEstimada: 30 },
    { nombre: "Cambio de Filtro de Aire", descripcion: "Reemplazo de filtro de aire del motor, limpiado de caja", categoria: "Mantenimiento Ligero", codigo: "LIG-AIR-001", precioEstimado: "150000", duracionEstimada: 15 },
    { nombre: "Cambio de Líquido de Frenos", descripcion: "Purgado y recarga de líquido de frenos DOT4", categoria: "Mantenimiento Ligero", codigo: "LIG-BRK-001", precioEstimado: "200000", duracionEstimada: 30 },
    { nombre: "Cambio de Bujías", descripcion: "Reemplazo de juego de bujías (4/6/8 según motor)", categoria: "Mantenimiento Ligero", codigo: "LIG-SPK-001", precioEstimado: "250000", duracionEstimada: 45 },
    { nombre: "Inflado y Rotación de Neumáticos", descripcion: "Inflado a presión correcta, rotación 4 ruedas, inspección visual", categoria: "Mantenimiento Ligero", codigo: "LIG-TIR-001", precioEstimado: "120000", duracionEstimada: 20 },
    { nombre: "Limpieza de Inyectores por Ultrasonido", descripcion: "Limpieza de 4 inyectores por ultrasonido, prueba de flujo", categoria: "Mantenimiento Ligero", codigo: "LIG-INJ-001", precioEstimado: "300000", duracionEstimada: 60 },
    { nombre: "Cambio de Filtro de Hábitáculo", descripcion: "Reemplazo de filtro de aire acondicionado/cabina", categoria: "Mantenimiento Ligero", codigo: "LIG-CAB-001", precioEstimado: "100000", duracionEstimada: 10 },
    { nombre: "Service Express 5.000 km", descripcion: "Aceite + filtro + inspección rápida de 20 puntos", categoria: "Mantenimiento Ligero", codigo: "LIG-EXP-001", precioEstimado: "350000", duracionEstimada: 30 },

    // ── Mantenimiento Medio (suspensión, transmisión, eléctrico) ──
    { nombre: "Alineación y Balanceo 4 Ruedas", descripcion: "Alineación computarizada + balanceo de 4 llantas", categoria: "Tren Delantero y Frenos", codigo: "MED-ALI-001", precioEstimado: "350000", duracionEstimada: 60 },
    { nombre: "Cambio de Amortiguadores (par)", descripcion: "Reemplazo de amortiguadores delanteros o traseros", categoria: "Tren Delantero y Frenos", codigo: "MED-SUS-001", precioEstimado: "800000", duracionEstimada: 90 },
    { nombre: "Cambio de Pastillas y Discos", descripcion: "Reemplazo completo de pastillas + discos delanteros", categoria: "Tren Delantero y Frenos", codigo: "MED-BRK-001", precioEstimado: "650000", duracionEstimada: 90 },
    { nombre: "Cambio de Correa de Accesorios", descripcion: "Reemplazo de correa serpentina + tensor + polea", categoria: "Mecánica Preventiva", codigo: "MED-BLT-001", precioEstimado: "450000", duracionEstimada: 60 },
    { nombre: "Diagnóstico Eléctrico Completo", descripcion: "Revisión de sistema eléctrico, alternador, batería, fusibles", categoria: "Electricidad y Diagnóstico", codigo: "MED-ELE-001", precioEstimado: "250000", duracionEstimada: 60 },
    { nombre: "Cambio de Aceite de Transmisión Automática", descripcion: "Vaciado, limpieza, recarga ATF/CVT/DSG + filtro", categoria: "Transmisión", codigo: "MED-ATF-001", precioEstimado: "650000", duracionEstimada: 90 },
    { nombre: "Reparación de Dirección Asistida", descripcion: "Cambio de bomba, mangueras, fluido de dirección", categoria: "Tren Delantero y Frenos", codigo: "MED-DIR-001", precioEstimado: "900000", duracionEstimada: 120 },
    { nombre: "Cambio de Batería y Prueba de Sistema", descripcion: "Reemplazo de batería + prueba de carga del alternador", categoria: "Electricidad y Diagnóstico", codigo: "MED-BAT-001", precioEstimado: "400000", duracionEstimada: 30 },
    { nombre: "Regeneración de Filtros DPF", descripcion: "Limpieza/regeneración de filtro de partículas diesel", categoria: "Especialidad Modernos/Chinos", codigo: "MED-DPF-001", precioEstimado: "800000", duracionEstimada: 120 },
    { nombre: "Cambio de Kit de Embrague", descripcion: "Reemplazo de disco, presión y rodamiento de empuje", categoria: "Transmisión", codigo: "MED-EMB-001", precioEstimado: "1500000", duracionEstimada: 240 },
    { nombre: "Limpieza de Mariposa y Cuerpo de Aceleración", descripcion: "Limpieza química de cuerpo de aceleración y mariposa", categoria: "Especialidad Modernos/Chinos", codigo: "MED-THL-001", precioEstimado: "250000", duracionEstimada: 45 },

    // ── Mantenimiento Pesado (motor, turbo, EGR, distribución) ──
    { nombre: "Descarbonización de Motor Completa", descripcion: "Limpieza de admisión, EGR, inyectores, turbo, DPF", categoria: "Mantenimiento Pesado", codigo: "PES-DESC-001", precioEstimado: "1800000", duracionEstimada: 360 },
    { nombre: "Cambio de Kit de Distribución", descripcion: "Correa/cadena dentada + tensor + bomba de agua", categoria: "Mantenimiento Pesado", codigo: "PES-DIST-001", precioEstimado: "2500000", duracionEstimada: 300 },
    { nombre: "Reparación de Turbo", descripcion: "Desarme, limpieza, reemplazo de sellos y cojinetes", categoria: "Mantenimiento Pesado", codigo: "PES-TUR-001", precioEstimado: "3500000", duracionEstimada: 480 },
    { nombre: "Reparación de Motor (sobre)", descripcion: "Desarme completo, rectificación, reensamblaje", categoria: "Mantenimiento Pesado", codigo: "PES-MOT-001", precioEstimado: "8000000", duracionEstimada: 960 },
    { nombre: "Reparación de Transmisión Automática", descripcion: "Desarme, reemplazo de solenoides, bandas, empaques", categoria: "Mantenimiento Pesado", codigo: "PES-TRANS-001", precioEstimado: "5000000", duracionEstimada: 720 },
    { nombre: "Cambio de Bomba de Agua", descripcion: "Reemplazo de bomba de agua + termostato + líquido refrigerante", categoria: "Mantenimiento Pesado", codigo: "PES-WP-001", precioEstimado: "800000", duracionEstimada: 120 },
    { nombre: "Reparación de Diferencial", descripcion: "Desarme, cambio de cojinetes, ajuste de holgura", categoria: "Mantenimiento Pesado", codigo: "PES-DIF-001", precioEstimado: "2000000", duracionEstimada: 360 },
    { nombre: "Reparación de Caja de Cambios Manual", descripcion: "Desarme, reemplazo de sincronizadores, rulemanes", categoria: "Mantenimiento Pesado", codigo: "PES-CJAM-001", precioEstimado: "3000000", duracionEstimada: 480 },

    // ── EV/HEV Especializado ──
    { nombre: "Diagnóstico HV/EV Seguro", descripcion: "Análisis de batería HV, inversor, motor, con protocolo de seguridad", categoria: "EV/HEV Especializado", codigo: "EV-DIAG-001", precioEstimado: "400000", duracionEstimada: 60 },
    { nombre: "Reemplazo de Módulo de Batería HV", descripcion: "Diagnóstico + reemplazo de módulo dañado de batería de alto voltaje", categoria: "EV/HEV Especializado", codigo: "EV-BAT-001", precioEstimado: "5000000", duracionEstimada: 240 },
    { nombre: "Mantenimiento de Sistema de Enfriamiento HV", descripcion: "Revisión de circuito de refrigeración de batería e inversor", categoria: "EV/HEV Especializado", codigo: "EV-COOL-001", precioEstimado: "350000", duracionEstimada: 90 },
    { nombre: "Calibración de Sensores de Batería", descripcion: "Re-calibración de BMS, balanceo de celdas", categoria: "EV/HEV Especializado", codigo: "EV-BMS-001", precioEstimado: "600000", duracionEstimada: 120 },

    // ── Emergencias y Asistencia ──
    { nombre: "Asistencia en Ruta 24hs", descripcion: "Servicio de grúa y asistencia mecánica a domicilio", categoria: "Emergencias y Asistencia", codigo: "EMG-RUTA-001", precioEstimado: "500000", duracionEstimada: 120 },
    { nombre: "Service Móvil a Domicilio", descripcion: "Cambio de aceite y filtro en ubicación del cliente", categoria: "Emergencias y Asistencia", codigo: "EMG-DOM-001", precioEstimado: "400000", duracionEstimada: 45 },
    { nombre: "Arranque con Cables / Batería", descripcion: "Asistencia de arranque con cables o carga de batería", categoria: "Emergencias y Asistencia", codigo: "EMG-ARR-001", precioEstimado: "150000", duracionEstimada: 20 },
    { nombre: "Cambio de Neumático en Ruta", descripcion: "Cambio de llanta pinchada con repuesto del cliente", categoria: "Emergencias y Asistencia", codigo: "EMG-LLT-001", precioEstimado: "100000", duracionEstimada: 20 },

    // ── Carrocería y Pintura adicionales ──
    { nombre: "Pintura Parcial (1 pieza)", descripcion: "Pintura de 1 pieza de carrocería con acabado OEM", categoria: "Carrocería y Pintura", codigo: "CAR-PP-001", precioEstimado: "800000", duracionEstimada: 240 },
    { nombre: "Pintura Completa", descripcion: "Pintura completa del vehículo con desarme parcial", categoria: "Carrocería y Pintura", codigo: "CAR-PC-001", precioEstimado: "5000000", duracionEstimada: 960 },
    { nombre: "Reparación de Grandine (Granizo)", descripcion: "Painless repair de abolladuras por granizo", categoria: "Carrocería y Pintura", codigo: "CAR-PDR-001", precioEstimado: "300000", duracionEstimada: 120 },
    { nombre: "Soldadura y Chapa", descripcion: "Reparación de chapa, soldadura, alineación de estructura", categoria: "Carrocería y Pintura", codigo: "CAR-CHP-001", precioEstimado: "1500000", duracionEstimada: 480 },

    // ── Sistemas Flotas adicionales ──
    { nombre: "Mantenimiento Preventivo Flota (por unidad)", descripcion: "Service programado para vehículos de flota empresarial", categoria: "Sistemas Flotas", codigo: "FLOTA-SVC-001", precioEstimado: "350000", duracionEstimada: 60 },
    { nombre: "Inspección Pre-Compra Flota", descripcion: "Chequeo completo antes de adquisición de vehículo usado", categoria: "Sistemas Flotas", codigo: "FLOTA-PRE-001", precioEstimado: "250000", duracionEstimada: 45 },
    { nombre: "Instalación de GPS y Rastreo", descripcion: "Instalación de dispositivo GPS para gestión de flota", categoria: "Sistemas Flotas", codigo: "FLOTA-GPS-001", precioEstimado: "200000", duracionEstimada: 60 },

    // ── Climatización adicionales ──
    { nombre: "Reparación de Compresor A/C", descripcion: "Desarme y reparación de compresor de aire acondicionado", categoria: "Climatización y Confort", codigo: "CLI-CMP-001", precioEstimado: "1200000", duracionEstimada: 180 },
    { nombre: "Detección de Fugas A/C", descripcion: "Prueba de presión con nitrógeno + detector de fugas", categoria: "Climatización y Confort", codigo: "CLI-FUGA-001", precioEstimado: "200000", duracionEstimada: 45 },
    { nombre: "Cambio de Condensador A/C", descripcion: "Reemplazo de condensador + recarga de gas", categoria: "Climatización y Confort", codigo: "CLI-CON-001", precioEstimado: "900000", duracionEstimada: 120 },
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
  console.log(`   ✅  Extended Services: ${servCount} inserted`);

  // ── 3. Pricing Rules for Extended Services ───
  const vtRows = await db().select({ id: vehicleTypes.id, nombre: vehicleTypes.nombre }).from(vehicleTypes);
  const vtMap = new Map(vtRows.map((v) => [v.nombre, v.id]));

  const servRows = await db()
    .select({ id: serviciosCatalogo.id, codigo: serviciosCatalogo.codigo, precioEstimado: serviciosCatalogo.precioEstimado, duracionEstimada: serviciosCatalogo.duracionEstimada })
    .from(serviciosCatalogo)
    .where(eq(serviciosCatalogo.tenantSlug, TENANT_SLUG));
  const servMap = new Map(servRows.map((s) => [s.codigo, s]));

  const pricingVehicleTypes = ["AUTOMOVIL", "SUV", "PICK_UP"];
  const multipliers: Record<string, number> = { AUTOMOVIL: 1.0, SUV: 1.3, PICK_UP: 1.3 };

  const existingPricing = await db()
    .select({ servicioId: servicePricingRules.servicioId, vehicleTypeId: servicePricingRules.vehicleTypeId })
    .from(servicePricingRules)
    .where(eq(servicePricingRules.tenantSlug, TENANT_SLUG));
  const existingPricingKeys = new Set(existingPricing.map((p) => `${p.servicioId}:${p.vehicleTypeId}`));
  let prCount = 0;

  for (const s of services) {
    const serv = servMap.get(s.codigo);
    if (!serv) continue;
    const basePrice = Number(serv.precioEstimado) || 300000;
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
        complejidad: duracion > 180 ? "COMPLEJA" : "NORMAL",
        activo: true,
        tenantSlug: TENANT_SLUG,
      });
      prCount++;
    }
  }
  console.log(`   ✅  Extended Pricing Rules: ${prCount} inserted`);
  console.log(`\n🌱 Extended service seeding complete!`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
