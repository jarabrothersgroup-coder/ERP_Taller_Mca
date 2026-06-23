/**
 * Seed script: Sample Work Orders with Realistic Data.
 *
 * Creates vehicles linked to existing clients, then generates
 * work orders with various statuses (Presupuestado, Aprobado,
 * En_Proceso, Control_Calidad, Listo) for realistic demo data.
 *
 * Usage: npx tsx scripts/seed-work-orders.ts <tenant_slug>
 *
 * @module scripts/seed-work-orders
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq, and } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import {
  clients,
  vehiculos,
  ordenesTrabajo,
} from "../src/shared/database/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-work-orders.ts <tenant_slug>");
  process.exit(1);
}

interface VehicleDef {
  clientName: string;
  plate: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  engineType: "Nafta" | "Diésel" | "HEV" | "BEV";
  mileage: number;
}

interface WorkOrderDef {
  vehiclePlate: string;
  status: "Presupuestado" | "Aprobado" | "En_Proceso" | "Control_Calidad" | "Listo";
  description: string;
  diagnosis: string;
  totalCost: string;
}

const VEHICLES: VehicleDef[] = [
  // Toyota
  { clientName: "Juan Carlos Martínez", plate: "ABC-1234", vin: "1HGBH41JXMN109186", brand: "Toyota", model: "Hilux", year: 2020, engineType: "Diésel", mileage: 45000 },
  { clientName: "María Fernanda González", plate: "DEF-5678", vin: "2T1BURHE0JC034567", brand: "Toyota", model: "Corolla Cross", year: 2022, engineType: "HEV", mileage: 18000 },
  { clientName: "Carlos Alberto Pereira", plate: "GHI-9012", vin: "3N1AB7AP5KY234567", brand: "Toyota", model: "Hilux", year: 2021, engineType: "Diésel", mileage: 62000 },
  { clientName: "Roberto Carlos Ávila", plate: "JKL-3456", vin: "4T1BG12K5YU123456", brand: "Toyota", model: "Corolla", year: 2019, engineType: "Nafta", mileage: 35000 },
  { clientName: "Hugo Enrique Servín", plate: "MNO-7890", vin: "5YJSA1DN1DF123456", brand: "Toyota", model: "Hilux", year: 2023, engineType: "Diésel", mileage: 12000 },

  // Chevrolet
  { clientName: "Juan Pablo Escobar", plate: "PQR-1234", vin: "1G1JC524917123456", brand: "Chevrolet", model: "S10", year: 2023, engineType: "Diésel", mileage: 8000 },
  { clientName: "Ana Lucía Ferreira", plate: "STU-5678", vin: "2G1FK1EDX91123456", brand: "Chevrolet", model: "Onix", year: 2022, engineType: "Nafta", mileage: 22000 },
  { clientName: "Pedro Enrique Benítez", plate: "VWX-9012", vin: "3GNAXUEV0LS123456", brand: "Chevrolet", model: "Tracker", year: 2021, engineType: "Nafta", mileage: 28000 },

  // Hyundai
  { clientName: "Lucía Valentina Romero", plate: "YZA-3456", vin: "5NPEC4AC7JH123456", brand: "Hyundai", model: "Tucson", year: 2022, engineType: "Nafta", mileage: 15000 },
  { clientName: "Fernando Daniel Gómez", plate: "BCD-7890", vin: "KMHJ381SPHU123456", brand: "Hyundai", model: "Creta", year: 2021, engineType: "Nafta", mileage: 30000 },
  { clientName: "Nelson Antonio Paniagua", plate: "EFG-1234", vin: "KNAJN81DSP5123456", brand: "Hyundai", model: "Accent", year: 2020, engineType: "Nafta", mileage: 42000 },

  // Kia
  { clientName: "Rubén Darío Gauto", plate: "HIJ-5678", vin: "KNDPNCAC5L7123456", brand: "Kia", model: "Sportage", year: 2022, engineType: "Nafta", mileage: 20000 },
  { clientName: "Mirta Nidia Jara", plate: "KLM-9012", vin: "KNDJN81ABP7123456", brand: "Kia", model: "Picanto", year: 2021, engineType: "Nafta", mileage: 25000 },

  // VW
  { clientName: "Raúl Eduardo Torres", plate: "NOP-3456", vin: "3VW2K7AJ5FM123456", brand: "Volkswagen", model: "Amarok", year: 2021, engineType: "Diésel", mileage: 55000 },
  { clientName: "Gladys Mabel Acosta", plate: "QRS-7890", vin: "9BWDE45U0BP123456", brand: "Volkswagen", model: "Gol", year: 2020, engineType: "Nafta", mileage: 38000 },

  // Ford
  { clientName: "Roberto Andrés González", plate: "TUV-1234", vin: "1FTER4FH0LLA12345", brand: "Ford", model: "Ranger", year: 2022, engineType: "Diésel", mileage: 28000 },

  // Nissan
  { clientName: "Marcos Antonio Vega", plate: "WXY-5678", vin: "3N1CP3CU0LC123456", brand: "Nissan", model: "NP300", year: 2021, engineType: "Diésel", mileage: 40000 },

  // Honda
  { clientName: "Andrés Mauricio Ayala", plate: "ZAB-9012", vin: "2HKRW2H57MH123456", brand: "Honda", model: "CR-V", year: 2021, engineType: "Nafta", mileage: 25000 },

  // Mitsubishi
  { clientName: "Arnaldo Gabriel Medina", plate: "CDE-3456", vin: "4A4AT4AN0LE123456", brand: "Mitsubishi", model: "L200", year: 2020, engineType: "Diésel", mileage: 60000 },

  // BYD (EV)
  { clientName: "Sandra Milagros Espinoza", plate: "FGH-7890", vin: "LGXCE6CB5N0123456", brand: "BYD", model: "Yuan Plus", year: 2023, engineType: "BEV", mileage: 5000 },

  // Suzuki
  { clientName: "Óscar Fabián Ávalos", plate: "IJK-1234", vin: "JS3TD53V684123456", brand: "Suzuki", model: "Jimny", year: 2022, engineType: "Nafta", mileage: 12000 },
];

const WORK_ORDERS: WorkOrderDef[] = [
  { vehiclePlate: "ABC-1234", status: "Listo", description: "Service básico 45.000 km — cambio de aceite, filtro, inspección", diagnosis: "Cambio de aceite 5W30 sintético, filtro de aceite y aire. Neumáticos con desgaste uniforme. Frenos al 60%. Próximo service a los 50.000 km.", totalCost: "650000" },
  { vehiclePlate: "ABC-1234", status: "En_Proceso", description: "Cambio de pastillas delanteras y discos", diagnosis: "Pastillas delanteras al 15%, discos con rayones. Reemplazo recomendado urgente.", totalCost: "850000" },
  { vehiclePlate: "DEF-5678", status: "Listo", description: "Mantenimiento preventivo 18.000 km", diagnosis: "Service programado híbrido. Batería HV al 94%. Sistema de enfriamiento OK. Filtros nuevos.", totalCost: "450000" },
  { vehiclePlate: "GHI-9012", status: "Presupuestado", description: "Diagnóstico de ruido en suspensión delantera", diagnosis: "Ruido al pasar por badenes. sospecha de bieletas desgastadas. Pendiente inspección en elevador.", totalCost: "200000" },
  { vehiclePlate: "JKL-3456", status: "Aprobado", description: "Alineación y balanceo + cambio de filtro de aire", diagnosis: "Vehículo tirando a la izquierda. Neumáticos delanteros con desgaste irregular. Filtro de aire sucio.", totalCost: "350000" },
  { vehiclePlate: "MNO-7890", status: "Control_Calidad", description: "Service mayor 60.000 km — kit de distribución", diagnosis: "Reemplazo de correa dentada, tensor, bomba de agua. Aceite de caja nuevo. Verificación de torque.", totalCost: "3200000" },
  { vehiclePlate: "PQR-1234", status: "Listo", description: "Service express 8.000 km", diagnosis: "Cambio de aceite y filtro. Revisión de frenos OK. Neumáticos OK. Vehículo nuevo, sin observaciones.", totalCost: "380000" },
  { vehiclePlate: "PQR-1234", status: "En_Proceso", description: "Instalación de alfombras rígidas y protector de capot", diagnosis: "Accesorios solicitados por cliente. Alfombras OEM para S10, protector de capot anti-rayones.", totalCost: "900000" },
  { vehiclePlate: "STU-5678", status: "Presupuestado", description: "Recarga de gas A/C — aire no enfría", diagnosis: "A/C sopla aire tibio. Probable fuga de gas refrigerante. Pendiente prueba de presión.", totalCost: "250000" },
  { vehiclePlate: "VWX-9012", status: "Aprobado", description: "Cambio de amortiguadores delanteros (par)", diagnosis: "Amortiguadores con fugas de aceite. Vehículo rebota excesivamente en irregularidades.", totalCost: "1060000" },
  { vehiclePlate: "YZA-3456", status: "Listo", description: "Mantenimiento preventivo 15.000 km", diagnosis: "Service Hyundai programado. Aceite sintético, filtro, inspección de frenos y suspensión. Todo OK.", totalCost: "550000" },
  { vehiclePlate: "BCD-7890", status: "En_Proceso", description: "Limpieza de inyectores por ultrasonido", diagnosis: "Motor con tirones en bajas RPM. Inyectores con depósitos de carbonilla. Limpieza recomendada.", totalCost: "350000" },
  { vehiclePlate: "EFG-1234", status: "Control_Calidad", description: "Cambio de aceite de transmisión automática ATF", diagnosis: "Caja automática con cambios bruscos a 40-60 km/h. Aceite oscuro y con olor quemado.", totalCost: "750000" },
  { vehiclePlate: "HIJ-5678", status: "Presupuestado", description: "Diagnóstico eléctrico — luces delanteras intermitentes", diagnosis: "Faros delanteros parpadean aleatoriamente. Posible problema en relé o cableado. Pendiente revisión.", totalCost: "150000" },
  { vehiclePlate: "KLM-9012", status: "Listo", description: "Service básico 25.000 km", diagnosis: "Cambio de aceite y filtro. Inflado y rotación de neumáticos. Vehículo en buen estado general.", totalCost: "300000" },
  { vehiclePlate: "NOP-3456", status: "Aprobado", description: "Reparación de turbo — pérdida de potencia", diagnosis: "Turbo con juego axial. Aceite en el intercooler. Requiere desarme y reemplazo de sellos.", totalCost: "3800000" },
  { vehiclePlate: "QRS-7890", status: "Listo", description: "Cambio de pastillas traseras", diagnosis: "Pastillas traseras al 10%. Discos OK. Reemplazo completo de juego trasero.", totalCost: "250000" },
  { vehiclePlate: "TUV-1234", status: "En_Proceso", description: "Descarbonización EGR + limpieza de inyectores", diagnosis: "Motor con consumo excesivo de combustible. EGR tapada al 40%. Inyectores con pérdida de chorro.", totalCost: "1200000" },
  { vehiclePlate: "WXY-5678", status: "Presupuestado", description: "Cambio de kit de embrague", diagnosis: "Embrague patina en 3ra y 4ta velocidad. Disco gastado. Reemplazo de kit completo recomendado.", totalCost: "1800000" },
  { vehiclePlate: "ZAB-9012", status: "Listo", description: "Mantenimiento preventivo 25.000 km", diagnosis: "Service Honda programado. Aceite, filtros, inspección de frenos. Vehículo en excelente estado.", totalCost: "500000" },
  { vehiclePlate: "CDE-3456", status: "Aprobado", description: "Cambio de correa de distribución + bomba de agua", diagnosis: "Correa con 58.000 km. Recomendado cambio a los 60.000 km. Bomba de agua con fuga menor.", totalCost: "2800000" },
  { vehiclePlate: "FGH-7890", status: "Listo", description: "Diagnóstico HV/EV — chequeo de batería", diagnosis: "Chequeo preventivo de batería HV. Balance de celdas OK. Sistema de enfriamiento OK. BMS actualizado.", totalCost: "400000" },
  { vehiclePlate: "IJK-1234", status: "En_Proceso", description: "Alineación y balanceo 4 ruedas", diagnosis: "Vehículo nuevo, primer alineación. Llantas con desgaste normal. Ajuste de presión a 28 PSI.", totalCost: "350000" },
];

async function main() {
  console.log(`🌱 Seeding vehicles and work orders for tenant: ${TENANT_SLUG}\n`);

  // Get all clients for this tenant
  const clientRows = await db()
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.tenantSlug, TENANT_SLUG));
  const clientMap = new Map(clientRows.map((c) => [c.name, c.id]));

  // ── 1. Create Vehicles ──────────────────────
  const existingVehicles = await db()
    .select({ plate: vehiculos.plate })
    .from(vehiculos)
    .where(eq(vehiculos.tenantSlug, TENANT_SLUG));
  const existingPlates = new Set(existingVehicles.map((v) => v.plate));

  const vehicleIdMap = new Map<string, string>(); // plate -> id
  let vCount = 0;

  for (const v of VEHICLES) {
    const clientId = clientMap.get(v.clientName);
    if (!clientId) {
      console.log(`   ⚠️  Client not found: ${v.clientName}, skipping vehicle ${v.plate}`);
      continue;
    }
    if (existingPlates.has(v.plate)) {
      // Get existing vehicle ID
      const [existing] = await db()
        .select({ id: vehiculos.id })
        .from(vehiculos)
        .where(and(eq(vehiculos.plate, v.plate), eq(vehiculos.tenantSlug, TENANT_SLUG)));
      if (existing) vehicleIdMap.set(v.plate, existing.id);
      continue;
    }
    const [inserted] = await db()
      .insert(vehiculos)
      .values({
        clientId,
        plate: v.plate,
        vin: v.vin,
        brand: v.brand,
        model: v.model,
        year: v.year,
        engineType: v.engineType,
        mileage: v.mileage,
        tenantSlug: TENANT_SLUG,
      })
      .returning();
    if (inserted) {
      vehicleIdMap.set(v.plate, inserted.id);
      vCount++;
    }
  }
  console.log(`   ✅  Vehicles: ${vCount} inserted (${VEHICLES.length - vCount} already existed)`);

  // ── 2. Create Work Orders ───────────────────
  const existingOTs = await db()
    .select({ description: ordenesTrabajo.description })
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.tenantSlug, TENANT_SLUG));
  const existingOTDescs = new Set(existingOTs.map((o) => o.description));

  let otCount = 0;
  const statusCounts: Record<string, number> = {};

  for (const wo of WORK_ORDERS) {
    const vehicleId = vehicleIdMap.get(wo.vehiclePlate);
    if (!vehicleId) {
      console.log(`   ⚠️  Vehicle not found: ${wo.vehiclePlate}, skipping OT`);
      continue;
    }
    if (existingOTDescs.has(wo.description)) continue;

    // Get client ID from vehicle
    const [vehicle] = await db()
      .select({ clientId: vehiculos.clientId })
      .from(vehiculos)
      .where(eq(vehiculos.id, vehicleId));
    if (!vehicle) continue;

    await db().insert(ordenesTrabajo).values({
      vehicleId,
      clientId: vehicle.clientId,
      status: wo.status,
      description: wo.description,
      diagnosis: wo.diagnosis,
      totalCost: wo.totalCost,
      tenantSlug: TENANT_SLUG,
    });
    otCount++;
    statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1;
  }

  console.log(`   ✅  Work Orders: ${otCount} inserted`);
  console.log(`   📊 By status:`);
  for (const [status, n] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`       ${status}: ${n}`);
  }
  console.log(`\n🌱 Work orders seeding complete!`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
