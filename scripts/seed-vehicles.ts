/**
 * Seed script: Vehicle Master Data (Sprint 33).
 *
 * Global reference tables for the Paraguayan vehicle park:
 *   vehicleTypes, fuelTypes, mileageIntervals, vehiculosMarca, vehiculosModelo
 *
 * Usage: npx tsx scripts/seed-vehicles.ts
 *
 * @module scripts/seed-vehicles
 */

import { db } from "../src/shared/database/drizzle.js";
import { sql } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import {
  vehicleTypes,
  fuelTypes,
  mileageIntervals,
  vehiculosMarca,
  vehiculosModelo,
} from "../src/modules/workshop/schema/index.js";

async function main() {
  console.log("🌱 Seeding vehicle master data...\n");

  // ── 1. Vehicle Types ──────────────────────
  const vehicleTypeNames = [
    "AUTOMOVIL", "SUV", "PICK_UP", "CAMIONETA", "CAMION",
    "MOTOCICLETA", "VAN", "FURGON",
  ];
  const existingVT = await db().select({ nombre: vehicleTypes.nombre }).from(vehicleTypes);
  const existingVTSet = new Set(existingVT.map((v) => v.nombre));
  let vtCount = 0;
  for (const nombre of vehicleTypeNames) {
    if (!existingVTSet.has(nombre)) {
      await db().insert(vehicleTypes).values({ nombre });
      vtCount++;
    }
  }
  console.log(`   ✅  Vehicle Types: ${vtCount} inserted (${vehicleTypeNames.length - vtCount} already existed)`);

  // ── 2. Fuel Types ──────────────────────────
  const fuelTypeNames = ["NAFTA", "DIESEL", "FLEX", "HIBRIDO", "ELECTRICO", "GAS"];
  const existingFT = await db().select({ nombre: fuelTypes.nombre }).from(fuelTypes);
  const existingFTSet = new Set(existingFT.map((f) => f.nombre));
  let ftCount = 0;
  for (const nombre of fuelTypeNames) {
    if (!existingFTSet.has(nombre)) {
      await db().insert(fuelTypes).values({ nombre });
      ftCount++;
    }
  }
  console.log(`   ✅  Fuel Types: ${ftCount} inserted (${fuelTypeNames.length - ftCount} already existed)`);

  // ── 3. Mileage Intervals ──────────────────
  const intervals = [
    { kmDesde: 0, kmHasta: 5000, nombre: "5.000 km", orden: 1 },
    { kmDesde: 5001, kmHasta: 10000, nombre: "10.000 km", orden: 2 },
    { kmDesde: 10001, kmHasta: 20000, nombre: "20.000 km", orden: 3 },
    { kmDesde: 20001, kmHasta: 40000, nombre: "40.000 km", orden: 4 },
    { kmDesde: 40001, kmHasta: 60000, nombre: "60.000 km", orden: 5 },
    { kmDesde: 60001, kmHasta: null, nombre: "80.000+ km", orden: 6 },
  ];
  const existingMI = await db().select({ nombre: mileageIntervals.nombre }).from(mileageIntervals);
  const existingMISet = new Set(existingMI.map((m) => m.nombre));
  let miCount = 0;
  for (const iv of intervals) {
    if (!existingMISet.has(iv.nombre)) {
      await db().insert(mileageIntervals).values(iv);
      miCount++;
    }
  }
  console.log(`   ✅  Mileage Intervals: ${miCount} inserted (${intervals.length - miCount} already existed)`);

  // ── 4. Vehicle Brands ─────────────────────
  const brands = [
    { nombre: "Toyota", paisOrigen: "JAPON" },
    { nombre: "Kia", paisOrigen: "COREA DEL SUR" },
    { nombre: "Hyundai", paisOrigen: "COREA DEL SUR" },
    { nombre: "Chevrolet", paisOrigen: "ESTADOS UNIDOS" },
    { nombre: "Volkswagen", paisOrigen: "ALEMANIA" },
    { nombre: "Fiat", paisOrigen: "ITALIA" },
    { nombre: "Ford", paisOrigen: "ESTADOS UNIDOS" },
    { nombre: "Nissan", paisOrigen: "JAPON" },
    { nombre: "Honda", paisOrigen: "JAPON" },
    { nombre: "Mitsubishi", paisOrigen: "JAPON" },
    { nombre: "Suzuki", paisOrigen: "JAPON" },
    { nombre: "BYD", paisOrigen: "CHINA" },
    { nombre: "Changan", paisOrigen: "CHINA" },
    { nombre: "GWM", paisOrigen: "CHINA" },
    { nombre: "Geely", paisOrigen: "CHINA" },
  ];
  const existingBrands = await db().select({ id: vehiculosMarca.id, nombre: vehiculosMarca.nombre }).from(vehiculosMarca);
  const brandMap = new Map(existingBrands.map((b) => [b.nombre, b.id]));
  let brCount = 0;
  for (const b of brands) {
    if (!brandMap.has(b.nombre)) {
      const [inserted] = await db().insert(vehiculosMarca).values(b).returning();
      brandMap.set(b.nombre, inserted!.id);
      brCount++;
    }
  }
  console.log(`   ✅  Vehicle Brands: ${brCount} inserted (${brands.length - brCount} already existed)`);

  // ── 5. Vehicle Models ──────────────────────
  const typeRows = await db().select({ id: vehicleTypes.id, nombre: vehicleTypes.nombre }).from(vehicleTypes);
  const typeMap = new Map(typeRows.map((t) => [t.nombre, t.id]));

  interface ModelDef { marca: string; nombre: string; tipo: string; motorCc: string; combustibleDefault: string; }
  const models: ModelDef[] = [
    // Toyota
    { marca: "Toyota", nombre: "Corolla", tipo: "AUTOMOVIL", motorCc: "1.6", combustibleDefault: "NAFTA" },
    { marca: "Toyota", nombre: "Hilux", tipo: "PICK_UP", motorCc: "2.5", combustibleDefault: "DIESEL" },
    { marca: "Toyota", nombre: "Vitz", tipo: "AUTOMOVIL", motorCc: "1.0", combustibleDefault: "NAFTA" },
    { marca: "Toyota", nombre: "Corolla Cross", tipo: "SUV", motorCc: "1.8", combustibleDefault: "HIBRIDO" },
    { marca: "Toyota", nombre: "Prado", tipo: "SUV", motorCc: "2.7", combustibleDefault: "NAFTA" },
    { marca: "Toyota", nombre: "Yaris", tipo: "AUTOMOVIL", motorCc: "1.5", combustibleDefault: "NAFTA" },
    // Kia
    { marca: "Kia", nombre: "Picanto", tipo: "AUTOMOVIL", motorCc: "1.0", combustibleDefault: "NAFTA" },
    { marca: "Kia", nombre: "Soluto", tipo: "AUTOMOVIL", motorCc: "1.4", combustibleDefault: "NAFTA" },
    { marca: "Kia", nombre: "Seltos", tipo: "SUV", motorCc: "1.6", combustibleDefault: "NAFTA" },
    { marca: "Kia", nombre: "Sportage", tipo: "SUV", motorCc: "2.0", combustibleDefault: "NAFTA" },
    { marca: "Kia", nombre: "Sorento", tipo: "SUV", motorCc: "2.2", combustibleDefault: "DIESEL" },
    { marca: "Kia", nombre: "Morning", tipo: "AUTOMOVIL", motorCc: "1.2", combustibleDefault: "NAFTA" },
    // Hyundai
    { marca: "Hyundai", nombre: "Creta", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    { marca: "Hyundai", nombre: "Tucson", tipo: "SUV", motorCc: "2.0", combustibleDefault: "NAFTA" },
    { marca: "Hyundai", nombre: "Accent", tipo: "AUTOMOVIL", motorCc: "1.4", combustibleDefault: "NAFTA" },
    { marca: "Hyundai", nombre: "Elantra", tipo: "AUTOMOVIL", motorCc: "1.6", combustibleDefault: "NAFTA" },
    { marca: "Hyundai", nombre: "Santa Fe", tipo: "SUV", motorCc: "2.4", combustibleDefault: "NAFTA" },
    // Chevrolet
    { marca: "Chevrolet", nombre: "S10", tipo: "PICK_UP", motorCc: "2.8", combustibleDefault: "DIESEL" },
    { marca: "Chevrolet", nombre: "Onix", tipo: "AUTOMOVIL", motorCc: "1.0", combustibleDefault: "NAFTA" },
    { marca: "Chevrolet", nombre: "Tracker", tipo: "SUV", motorCc: "1.2", combustibleDefault: "NAFTA" },
    { marca: "Chevrolet", nombre: "Spark", tipo: "AUTOMOVIL", motorCc: "1.0", combustibleDefault: "NAFTA" },
    // Volkswagen
    { marca: "Volkswagen", nombre: "Gol", tipo: "AUTOMOVIL", motorCc: "1.6", combustibleDefault: "FLEX" },
    { marca: "Volkswagen", nombre: "Polo", tipo: "AUTOMOVIL", motorCc: "1.6", combustibleDefault: "FLEX" },
    { marca: "Volkswagen", nombre: "T-Cross", tipo: "SUV", motorCc: "1.4", combustibleDefault: "NAFTA" },
    { marca: "Volkswagen", nombre: "Amarok", tipo: "PICK_UP", motorCc: "2.0", combustibleDefault: "DIESEL" },
    // Fiat
    { marca: "Fiat", nombre: "Cronos", tipo: "AUTOMOVIL", motorCc: "1.3", combustibleDefault: "FLEX" },
    { marca: "Fiat", nombre: "Mobi", tipo: "AUTOMOVIL", motorCc: "1.0", combustibleDefault: "FLEX" },
    { marca: "Fiat", nombre: "Pulse", tipo: "SUV", motorCc: "1.0", combustibleDefault: "FLEX" },
    // Ford
    { marca: "Ford", nombre: "Ranger", tipo: "PICK_UP", motorCc: "2.2", combustibleDefault: "DIESEL" },
    { marca: "Ford", nombre: "EcoSport", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    { marca: "Ford", nombre: "Territory", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    // Nissan
    { marca: "Nissan", nombre: "March", tipo: "AUTOMOVIL", motorCc: "1.0", combustibleDefault: "NAFTA" },
    { marca: "Nissan", nombre: "Versa", tipo: "AUTOMOVIL", motorCc: "1.6", combustibleDefault: "NAFTA" },
    { marca: "Nissan", nombre: "Qashqai", tipo: "SUV", motorCc: "2.0", combustibleDefault: "NAFTA" },
    { marca: "Nissan", nombre: "Navara", tipo: "PICK_UP", motorCc: "2.5", combustibleDefault: "DIESEL" },
    // Honda
    { marca: "Honda", nombre: "City", tipo: "AUTOMOVIL", motorCc: "1.5", combustibleDefault: "NAFTA" },
    { marca: "Honda", nombre: "HR-V", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    { marca: "Honda", nombre: "CR-V", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    // Mitsubishi
    { marca: "Mitsubishi", nombre: "L200", tipo: "PICK_UP", motorCc: "2.4", combustibleDefault: "DIESEL" },
    { marca: "Mitsubishi", nombre: "ASX", tipo: "SUV", motorCc: "2.0", combustibleDefault: "NAFTA" },
    { marca: "Mitsubishi", nombre: "Outlander", tipo: "SUV", motorCc: "2.4", combustibleDefault: "NAFTA" },
    // Suzuki
    { marca: "Suzuki", nombre: "Swift", tipo: "AUTOMOVIL", motorCc: "1.2", combustibleDefault: "NAFTA" },
    { marca: "Suzuki", nombre: "Vitara", tipo: "SUV", motorCc: "1.4", combustibleDefault: "NAFTA" },
    { marca: "Suzuki", nombre: "Jimny", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    // BYD
    { marca: "BYD", nombre: "Yuan Plus", tipo: "SUV", motorCc: "0.0", combustibleDefault: "ELECTRICO" },
    { marca: "BYD", nombre: "Dolphin", tipo: "AUTOMOVIL", motorCc: "0.0", combustibleDefault: "ELECTRICO" },
    { marca: "BYD", nombre: "Song Plus", tipo: "SUV", motorCc: "1.5", combustibleDefault: "HIBRIDO" },
    // Changan
    { marca: "Changan", nombre: "CS35", tipo: "SUV", motorCc: "1.6", combustibleDefault: "NAFTA" },
    { marca: "Changan", nombre: "CS55", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    { marca: "Changan", nombre: "Alsvin", tipo: "AUTOMOVIL", motorCc: "1.5", combustibleDefault: "NAFTA" },
    // GWM
    { marca: "GWM", nombre: "Haval Jolion", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    { marca: "GWM", nombre: "Haval H6", tipo: "SUV", motorCc: "2.0", combustibleDefault: "NAFTA" },
    { marca: "GWM", nombre: "Poer", tipo: "PICK_UP", motorCc: "2.0", combustibleDefault: "DIESEL" },
    // Geely
    { marca: "Geely", nombre: "Coolray", tipo: "SUV", motorCc: "1.5", combustibleDefault: "NAFTA" },
    { marca: "Geely", nombre: "Azkarra", tipo: "SUV", motorCc: "1.5", combustibleDefault: "HIBRIDO" },
  ];

  const existingModels = await db()
    .select({ marcaId: vehiculosModelo.marcaId, nombre: vehiculosModelo.nombre })
    .from(vehiculosModelo);
  const existingModelKeys = new Set(existingModels.map((m) => `${m.marcaId}:${m.nombre}`));
  let moCount = 0;
  for (const m of models) {
    const marcaId = brandMap.get(m.marca);
    const vehicleTypeId = typeMap.get(m.tipo);
    if (!marcaId || !vehicleTypeId) continue;
    const key = `${marcaId}:${m.nombre}`;
    if (!existingModelKeys.has(key)) {
      await db().insert(vehiculosModelo).values({
        marcaId,
        vehicleTypeId,
        nombre: m.nombre,
        motorCc: m.motorCc,
        combustibleDefault: m.combustibleDefault,
      });
      moCount++;
    }
  }
  console.log(`   ✅  Vehicle Models: ${moCount} inserted (${models.length - moCount} already existed)`);
  console.log("\n🌱 Vehicle master data seeding complete!");
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
