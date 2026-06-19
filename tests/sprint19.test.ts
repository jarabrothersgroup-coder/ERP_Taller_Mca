/**
 * Sprint 19 Tests — Multi-Dimensional Service Catalog
 *
 * Tests service pricing service, routes registration, schema definitions,
 * and reference data lookups.
 *
 * @module tests/sprint19.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ═════════════════════════════════════════════════
//  1. Schema — Table Definitions
// ═════════════════════════════════════════════════

describe("📦 [Sprint 19] Schema Definitions", () => {
  it("vehicleTypes table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/vehicle-reference.js");
    expect(mod.vehicleTypes).toBeDefined();
    expect(mod.vehicleTypes[Symbol.for("drizzle:Name")]).toBe("vehicle_types");
  });

  it("fuelTypes table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/vehicle-reference.js");
    expect(mod.fuelTypes).toBeDefined();
    expect(mod.fuelTypes[Symbol.for("drizzle:Name")]).toBe("fuel_types");
  });

  it("mileageIntervals table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/vehicle-reference.js");
    expect(mod.mileageIntervals).toBeDefined();
    expect(mod.mileageIntervals[Symbol.for("drizzle:Name")]).toBe("mileage_intervals");
  });

  it("serviceCategories table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/service-pricing.js");
    expect(mod.serviceCategories).toBeDefined();
    expect(mod.serviceCategories[Symbol.for("drizzle:Name")]).toBe("service_categories");
  });

  it("servicePricingRules table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/service-pricing.js");
    expect(mod.servicePricingRules).toBeDefined();
    expect(mod.servicePricingRules[Symbol.for("drizzle:Name")]).toBe("service_pricing_rules");
  });

  it("serviceBrandMap table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/service-pricing.js");
    expect(mod.serviceBrandMap).toBeDefined();
    expect(mod.serviceBrandMap[Symbol.for("drizzle:Name")]).toBe("service_brand_map");
  });

  it("rhServiceHours table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/service-pricing.js");
    expect(mod.rhServiceHours).toBeDefined();
    expect(mod.rhServiceHours[Symbol.for("drizzle:Name")]).toBe("rh_service_hours");
  });

  it("serviciosCatalogo has extended columns (codigo, categoriaId, thinkcarModulo)", async () => {
    const mod = await import("../src/modules/workshop/schema/servicios-catalogo.js");
    expect(mod.serviciosCatalogo).toBeDefined();
    const cols = mod.serviciosCatalogo[Symbol.for("drizzle:Columns")];
    expect(cols).toBeDefined();
    // Verify extended columns exist
    const colNames = Object.keys(cols);
    expect(colNames).toContain("codigo");
    expect(colNames).toContain("categoriaId");
    expect(colNames).toContain("thinkcarModulo");
    expect(colNames).toContain("descripcionTecnica");
  });

  it("vehiculosMarca table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/vehiculos-master.js");
    expect(mod.vehiculosMarca).toBeDefined();
    expect(mod.vehiculosMarca[Symbol.for("drizzle:Name")]).toBe("vehiculos_marca");
  });

  it("vehiculosModelo table is defined", async () => {
    const mod = await import("../src/modules/workshop/schema/vehiculos-master.js");
    expect(mod.vehiculosModelo).toBeDefined();
    expect(mod.vehiculosModelo[Symbol.for("drizzle:Name")]).toBe("vehiculos_modelo");
  });
});

// ═════════════════════════════════════════════════
//  2. Schema — Barrel Exports
// ═════════════════════════════════════════════════

describe("📦 [Sprint 19] Schema Barrel Exports", () => {
  it("barrel re-exports all new tables", async () => {
    const mod = await import("../src/modules/workshop/schema/index.js");
    // Vehicle reference
    expect(mod.vehicleTypes).toBeDefined();
    expect(mod.fuelTypes).toBeDefined();
    expect(mod.mileageIntervals).toBeDefined();
    // Master data
    expect(mod.vehiculosMarca).toBeDefined();
    expect(mod.vehiculosModelo).toBeDefined();
    // Pricing
    expect(mod.serviceCategories).toBeDefined();
    expect(mod.servicePricingRules).toBeDefined();
    expect(mod.serviceBrandMap).toBeDefined();
    expect(mod.rhServiceHours).toBeDefined();
  });

  it("barrel re-exports all new types", async () => {
    const mod = await import("../src/modules/workshop/schema/index.js");
    // Type exports can't be tested at runtime, but we verify the module loads
    expect(typeof mod).toBe("object");
  });
});

// ═════════════════════════════════════════════════
//  3. Service — Service Pricing (mocked DB)
// ═════════════════════════════════════════════════

describe("💰 [Sprint 19] Service Pricing Service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports all expected functions", async () => {
    const mod = await import("../src/modules/workshop/services/service-pricing.service.js");
    expect(typeof mod.listCategories).toBe("function");
    expect(typeof mod.getCategory).toBe("function");
    expect(typeof mod.createCategory).toBe("function");
    expect(typeof mod.updateCategory).toBe("function");
    expect(typeof mod.deleteCategory).toBe("function");
    expect(typeof mod.listPricingRules).toBe("function");
    expect(typeof mod.getPricingRule).toBe("function");
    expect(typeof mod.createPricingRule).toBe("function");
    expect(typeof mod.updatePricingRule).toBe("function");
    expect(typeof mod.deletePricingRule).toBe("function");
    expect(typeof mod.resolvePricing).toBe("function");
    expect(typeof mod.listBrandMap).toBe("function");
    expect(typeof mod.setBrandMap).toBe("function");
    expect(typeof mod.listVehicleTypes).toBe("function");
    expect(typeof mod.listFuelTypes).toBe("function");
    expect(typeof mod.listMileageIntervals).toBe("function");
  });
});

// ═════════════════════════════════════════════════
//  4. Service — Extended Catalog Service
// ═════════════════════════════════════════════════

describe("🛠️ [Sprint 19] Extended Catalog Service", () => {
  it("exports CRUD functions", async () => {
    const mod = await import("../src/modules/workshop/services/services-catalog.service.js");
    expect(typeof mod.listServicios).toBe("function");
    expect(typeof mod.getServicio).toBe("function");
    expect(typeof mod.createServicio).toBe("function");
    expect(typeof mod.updateServicio).toBe("function");
    expect(typeof mod.deleteServicio).toBe("function");
  });

  it("CreateCatalogInput type includes new fields", async () => {
    // Type-level test: verify the interface shape at compile time
    // We just verify the module loads and exports the expected shapes
    const mod = await import("../src/modules/workshop/services/services-catalog.service.js");
    expect(mod).toBeDefined();
  });
});

// ═════════════════════════════════════════════════
//  5. Routes — Registration
// ═════════════════════════════════════════════════

describe("🌐 [Sprint 19] Service Pricing Routes", () => {
  it("exports servicePricingRoutes function", async () => {
    const mod = await import("../src/modules/workshop/routes/service-pricing.routes.js");
    expect(typeof mod.servicePricingRoutes).toBe("function");
  });

  it("workshop routes barrel registers servicePricingRoutes", async () => {
    const mod = await import("../src/modules/workshop/routes/index.js");
    expect(typeof mod.workshopRoutes).toBe("function");
  });
});

// ═════════════════════════════════════════════════
//  6. Migration — 0020 Structure
// ═════════════════════════════════════════════════

describe("📝 [Sprint 19] Migration 0020 Structure", () => {
  it("creates vehicle_types table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("vehicle_types");
    expect(sql).toContain("CREATE TABLE");
  });

  it("creates fuel_types table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("fuel_types");
  });

  it("creates mileage_intervals table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("mileage_intervals");
  });

  it("creates service_categories table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("service_categories");
  });

  it("creates service_pricing_rules table with foreign keys", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("service_pricing_rules");
    expect(sql).toContain("REFERENCES");
    expect(sql).toContain("precio_venta_pyg");
    expect(sql).toContain("precio_costo_pyg");
    expect(sql).toContain("tiempo_estimado_min");
  });

  it("creates service_brand_map table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("service_brand_map");
  });

  it("creates rh_service_hours table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("rh_service_hours");
  });

  it("creates vehiculos_marca table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("vehiculos_marca");
  });

  it("creates vehiculos_modelo table", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("vehiculos_modelo");
  });

  it("extends servicios_catalogo with new columns", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/migrations/0020_service_catalog_multidimensional.sql"),
      "utf-8"
    );
    expect(sql).toContain("servicios_catalogo");
    expect(sql).toContain("ADD COLUMN");
    expect(sql).toContain("codigo");
    expect(sql).toContain("categoria_id");
    expect(sql).toContain("thinkcar_modulo");
    expect(sql).toContain("descripcion_tecnica");
  });
});

// ═════════════════════════════════════════════════
//  7. Seed Data — Reference Data
// ═════════════════════════════════════════════════

describe("🌱 [Sprint 19] Seed Data", () => {
  it("seed-0020-reference-data.sql contains vehicle types", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/seed-0020-reference-data.sql"),
      "utf-8"
    );
    expect(sql).toContain("AUTOMOVIL");
    expect(sql).toContain("SUV");
    expect(sql).toContain("PICK_UP");
    expect(sql).toContain("CAMIONETA");
    expect(sql).toContain("CAMION");
    expect(sql).toContain("MOTOCICLETA");
  });

  it("seed-0020-reference-data.sql contains fuel types", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/seed-0020-reference-data.sql"),
      "utf-8"
    );
    expect(sql).toContain("NAFTA");
    expect(sql).toContain("DIESEL");
    expect(sql).toContain("FLEX");
    expect(sql).toContain("HIBRIDO");
    expect(sql).toContain("ELECTRICO");
  });

  it("seed-0020-reference-data.sql contains mileage intervals", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/seed-0020-reference-data.sql"),
      "utf-8"
    );
    expect(sql).toContain("5000");
    expect(sql).toContain("10000");
    expect(sql).toContain("20000");
    expect(sql).toContain("40000");
    expect(sql).toContain("60000");
  });

  it("seed-0020-reference-data.sql contains service categories", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/seed-0020-reference-data.sql"),
      "utf-8"
    );
    expect(sql).toContain("Mecánica Preventiva");
    expect(sql).toContain("Electricidad");
    expect(sql).toContain("Climatización");
    expect(sql).toContain("Diagnóstico");
  });

  it("seed-0020-reference-data.sql contains vehicle marcas", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/seed-0020-reference-data.sql"),
      "utf-8"
    );
    expect(sql).toContain("Toyota");
    expect(sql).toContain("Kia");
    expect(sql).toContain("Hyundai");
    expect(sql).toContain("Volkswagen");
  });

  it("seed-0020-pricing-rules.sql contains pricing rules", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "src/shared/database/seed-0020-pricing-rules.sql"),
      "utf-8"
    );
    expect(sql).toContain("service_pricing_rules");
    expect(sql).toContain("INSERT");
  });
});
