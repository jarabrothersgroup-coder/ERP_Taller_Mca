import { getDb, closeDb } from "./connection.js";

const TENANT_SLUG = process.argv[2] || "taller-el-chero";
const SCHEMA_NAME = `tenant_${TENANT_SLUG.replace(/[^a-zA-Z0-9_]/g, "_")}`;

async function seed(): Promise<void> {
  const sql = getDb();

  console.log(`Seeding data for tenant: ${TENANT_SLUG} (schema: ${SCHEMA_NAME})\n`);

  // ── 1. Resolve tenant ──────────────────────────────────────────
  const [tenant] = await sql`
    SELECT id, slug, schema_name FROM public.tenants WHERE slug = ${TENANT_SLUG}
  `;
  if (!tenant) {
    console.error(`Tenant "${TENANT_SLUG}" not found. Run migration + create tenant first.`);
    process.exit(1);
  }
  console.log(`   [OK] Tenant resolved: ${tenant.slug} (${tenant.id})`);

  // ── 2. Mechanics (profiles) ────────────────────────────────────
  const mechanics = [
    { email: "juan.perez@taller.com", fullName: "Juan Pérez", role: "mechanic" },
    { email: "pedro.gonzalez@taller.com", fullName: "Pedro González", role: "mechanic" },
    { email: "carlos.ramirez@taller.com", fullName: "Carlos Ramírez", role: "mechanic" },
  ];

  const profileIds: string[] = [];
  for (const m of mechanics) {
    const [existing] = await sql`
      SELECT id FROM public.profiles WHERE email = ${m.email}
    `;
    if (existing) {
      profileIds.push(existing.id);
      console.log(`   [SKIP] Profile exists: ${m.fullName}`);
    } else {
      const [inserted] = await sql`
        INSERT INTO public.profiles (tenant_id, email, full_name, role, is_active)
        VALUES (${tenant.id}, ${m.email}, ${m.fullName}, ${m.role}, true)
        RETURNING id
      `;
      profileIds.push(inserted.id);
      console.log(`   [OK] Profile: ${m.fullName} (${m.role})`);
    }
  }

  // ── 3. Clients ─────────────────────────────────────────────────
  const clientData = [
    { name: "Carlos Martínez", email: "carlos.martinez@email.com", phone: "+595 981 111 222", ruc: "12345678-1", address: "Av. Mcal. López 1234, Asunción" },
    { name: "María López", email: "maria.lopez@email.com", phone: "+595 982 333 444", ruc: "87654321-2", address: "Calle Estrella 567, Coronel Oviedo" },
  ];

  const clientIds: string[] = [];
  for (const c of clientData) {
    const [existing] = await sql`
      SELECT id FROM ${sql(SCHEMA_NAME)}.clients WHERE ruc = ${c.ruc}
    `;
    if (existing) {
      clientIds.push(existing.id);
      console.log(`   [SKIP] Client exists: ${c.name}`);
    } else {
      const [inserted] = await sql`
        INSERT INTO ${sql(SCHEMA_NAME)}.clients (id, name, email, phone, ruc, address, created_at, updated_at)
        VALUES (gen_random_uuid(), ${c.name}, ${c.email}, ${c.phone}, ${c.ruc}, ${c.address}, now(), now())
        RETURNING id
      `;
      clientIds.push(inserted.id);
      console.log(`   [OK] Client: ${c.name}`);
    }
  }

  // ── 4. Vehicles ────────────────────────────────────────────────
  // engine_type CHECK: 'combustion' | 'hybrid' | 'electric'
  const vehicleData = [
    {
      clientId: clientIds[0],
      plate: "ABC-1234",
      vin: "JTDKB3RU7M1234567",
      brand: "Toyota",
      model: "Prius",
      year: 2022,
      engineType: "hybrid",
      hvBatteryVoltage: 201.6,
      dtcCodes: ["P0A80", "P3000"],
      notes: "Reemplazo batería HV programado",
    },
    {
      clientId: clientIds[1],
      plate: "DEF-5678",
      vin: "LC0E6X4C1N1234567",
      brand: "BYD",
      model: "Seal",
      year: 2024,
      engineType: "electric",
      hvBatteryVoltage: 569,
      dtcCodes: ["P1A00"],
      notes: "Actualización de software BMS",
    },
  ];

  const vehicleIds: string[] = [];
  for (const v of vehicleData) {
    const [existing] = await sql`
      SELECT id FROM ${sql(SCHEMA_NAME)}.vehicles WHERE vin = ${v.vin}
    `;
    if (existing) {
      vehicleIds.push(existing.id);
      console.log(`   [SKIP] Vehicle exists: ${v.brand} ${v.model} (${v.plate})`);
    } else {
      const [inserted] = await sql`
        INSERT INTO ${sql(SCHEMA_NAME)}.vehicles
          (id, client_id, plate, vin, brand, model, year, engine_type, hv_battery_voltage, dtc_codes, notes, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${v.clientId}, ${v.plate}, ${v.vin}, ${v.brand}, ${v.model}, ${v.year}, ${v.engineType}, ${v.hvBatteryVoltage}, ${sql.array(v.dtcCodes)}, ${v.notes}, now(), now())
        RETURNING id
      `;
      vehicleIds.push(inserted.id);
      console.log(`   [OK] Vehicle: ${v.brand} ${v.model} (${v.engineType})`);
    }
  }

  // ── 5. Work Orders ─────────────────────────────────────────────
  // status CHECK: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  // NOTE: work_orders table does NOT have hv_lockout_signed columns
  const otData = [
    {
      vehicleId: vehicleIds[0],
      clientId: clientIds[0],
      status: "in_progress",
      description: "Reemplazo batería de alta tensión y diagnóstico completo del sistema híbrido",
      diagnosis: "Código P0A80 detectado por scanner Launch X431. Resistencia interna de batería HV fuera de especificación. Celda N°14 con voltaje 0.8V por debajo del promedio. Se recomienda reemplazo completo del pack HV.",
      dtcCodes: ["P0A80", "P3000"],
      hvAlert: true,
      totalCost: "4500000",
    },
    {
      vehicleId: vehicleIds[1],
      clientId: clientIds[1],
      status: "in_progress",
      description: "Actualización de firmware BMS y verificación de sistema de gestión térmica",
      diagnosis: "Código P1A00 intermitente reportado por cliente. Actualización BMS disponible según boletín técnico BYD. Verificar sistema de refrigeración de batería.",
      dtcCodes: ["P1A00"],
      hvAlert: true,
      totalCost: "1200000",
    },
  ];

  const otIds: string[] = [];
  for (const ot of otData) {
    const [inserted] = await sql`
      INSERT INTO ${sql(SCHEMA_NAME)}.work_orders
        (id, vehicle_id, client_id, status, description, diagnosis, dtc_codes, hv_alert, total_cost, created_at, updated_at)
      VALUES
        (gen_random_uuid(), ${ot.vehicleId}, ${ot.clientId}, ${ot.status}, ${ot.description}, ${ot.diagnosis}, ${sql.array(ot.dtcCodes)}, ${ot.hvAlert}, ${ot.totalCost}, now(), now())
      RETURNING id
    `;
    otIds.push(inserted.id);
    console.log(`   [OK] Work order: ${ot.status} — ${inserted.id.slice(0, 8)}…`);
  }

  // ── 6. Chart of Accounts (Plan de Cuentas) ──────────────────────
  // Estructura jerárquica codificada (4-5 niveles) para taller mecánico.
  // Reglas:
  //   1 = Activo | 2 = Pasivo | 3 = Patrimonio | 4 = Ingresos | 5 = Costos | 6 = Gastos
  //   Cuentas de Costo (5) y Gasto (6) EXIGEN centro_costo_id + orden_trabajo_id
  //   en cada línea de asiento (dimensión obligatoria).
  const planCuentasData = [
    // ════════════════════════════════════════════════
    // 1. ACTIVOS
    // ════════════════════════════════════════════════
    { codigo: "1", nombre: "ACTIVO", tipo: "ACTIVO", nivel: 1, aceptaMovimientos: false },
    // 1.1 Activo Corriente
    { codigo: "1.1", nombre: "ACTIVO CORRIENTE", tipo: "ACTIVO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "1" },
    // 1.1.1 Efectivo y Equivalentes
    { codigo: "1.1.1", nombre: "EFECTIVO Y EQUIVALENTES", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "1.1" },
    { codigo: "1.1.1.01", nombre: "Caja Chica Taller", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.1" },
    { codigo: "1.1.1.02", nombre: "Caja General (Recaudaciones por entregar)", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.1" },
    { codigo: "1.1.1.03", nombre: "Bancos Nacionales (Cuenta Corriente Operativa)", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.1" },
    { codigo: "1.1.1.04", nombre: "Pasarelas de Pago / Tarjetas por Acreditar", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.1" },
    // 1.1.2 Cuentas por Cobrar
    { codigo: "1.1.2", nombre: "CUENTAS POR COBRAR COMERCIALES", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "1.1" },
    { codigo: "1.1.2.01", nombre: "Clientes Particulares", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.2" },
    { codigo: "1.1.2.02", nombre: "Clientes Corporativos / Flotas", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.2" },
    { codigo: "1.1.2.03", nombre: "(-) Provisión por Cuentas Incobrables", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.2" },
    { codigo: "1.1.2.50", nombre: "IVA Crédito Fiscal (Compras y Servicios)", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.2" },
    { codigo: "1.1.2.51", nombre: "Anticipo a Proveedores", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.2" },
    // 1.1.3 Inventarios
    { codigo: "1.1.3", nombre: "INVENTARIOS (Repuestos e Insumos)", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "1.1" },
    { codigo: "1.1.3.01", nombre: "Inventario de Repuestos Nuevos", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.3" },
    { codigo: "1.1.3.02", nombre: "Inventario de Repuestos Usados / Recuperados", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.3" },
    { codigo: "1.1.3.03", nombre: "Inventario de Lubricantes, Fluidos y Químicos", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.3" },
    { codigo: "1.1.3.04", nombre: "Inventario de Consumibles de Taller", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.3" },
    { codigo: "1.1.3.05", nombre: "Mercancías en Tránsito (Compras internacionales)", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.3" },
    { codigo: "1.1.3.06", nombre: "(-) Provisión por Obsolescencia de Inventario", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.1.3" },
    // 1.2 Activo No Corriente
    { codigo: "1.2", nombre: "ACTIVO NO CORRIENTE", tipo: "ACTIVO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "1" },
    // 1.2.1 PP&E
    { codigo: "1.2.1", nombre: "PROPIEDADES, PLANTA Y EQUIPO", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "1.2" },
    { codigo: "1.2.1.01", nombre: "Terrenos / Edificios del Taller", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.1" },
    { codigo: "1.2.1.02", nombre: "Maquinaria Pesada (Elevadores, alineadoras)", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.1" },
    { codigo: "1.2.1.03", nombre: "Herramientas Especializadas del Taller (x Serie)", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.1" },
    { codigo: "1.2.1.04", nombre: "Equipos de Diagnóstico y Escáners", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.1" },
    { codigo: "1.2.1.05", nombre: "Vehículos de Asistencia / Grúas", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.1" },
    { codigo: "1.2.1.06", nombre: "Muebles y Enseres de Oficina", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.1" },
    // 1.2.2 Depreciación Acumulada
    { codigo: "1.2.2", nombre: "(-) DEPRECIACIÓN ACUMULADA", tipo: "ACTIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "1.2" },
    { codigo: "1.2.2.01", nombre: "Depreciación Acumulada Maquinaria", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.2" },
    { codigo: "1.2.2.02", nombre: "Depreciación Acumulada Herramientas", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.2" },
    { codigo: "1.2.2.03", nombre: "Depreciación Acumulada Equipos de Diagnóstico", tipo: "ACTIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "1.2.2" },

    // ════════════════════════════════════════════════
    // 2. PASIVOS
    // ════════════════════════════════════════════════
    { codigo: "2", nombre: "PASIVO", tipo: "PASIVO", nivel: 1, aceptaMovimientos: false },
    { codigo: "2.1", nombre: "PASIVO CORRIENTE", tipo: "PASIVO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "2" },
    // 2.1.1 Cuentas por Pagar
    { codigo: "2.1.1", nombre: "CUENTAS POR PAGAR COMERCIALES", tipo: "PASIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "2.1" },
    { codigo: "2.1.1.01", nombre: "Proveedores de Repuestos Nacionales", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.1" },
    { codigo: "2.1.1.02", nombre: "Proveedores de Repuestos Internacionales", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.1" },
    { codigo: "2.1.1.03", nombre: "Acreedores Varios (Servicios Tercerizados)", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.1" },
    // 2.1.2 Obligaciones Fiscales
    { codigo: "2.1.2", nombre: "OBLIGACIONES FISCALES / IMPUESTOS", tipo: "PASIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "2.1" },
    { codigo: "2.1.2.01", nombre: "IVA Débito Fiscal por Pagar", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.2" },
    { codigo: "2.1.2.02", nombre: "Retenciones de Impuestos Realizadas", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.2" },
    { codigo: "2.1.2.50", nombre: "Retención Impuesto a la Renta (Autofacturas)", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.2" },
    { codigo: "2.1.2.51", nombre: "Retención IVA (Autofacturas)", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.2" },
    // 2.1.3 Obligaciones Laborales
    { codigo: "2.1.3", nombre: "OBLIGACIONES LABORALES", tipo: "PASIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "2.1" },
    { codigo: "2.1.3.01", nombre: "Sueldos y Salarios por Pagar", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.3" },
    { codigo: "2.1.3.02", nombre: "Provisiones de Ley (Vacaciones, Aguinaldos)", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.3" },
    { codigo: "2.1.3.03", nombre: "IPS y Cargas Sociales por Pagar", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.3" },
    // 2.1.4 Cuentas de Control / Puente
    { codigo: "2.1.4", nombre: "CUENTAS DE CONTROL / PUENTE", tipo: "PASIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "2.1" },
    { codigo: "2.1.4.01", nombre: "Recepción de Mercancías por Facturar", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.4" },
    { codigo: "2.1.4.02", nombre: "Anticipos de Clientes", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.1.4" },
    // 2.2 Pasivo No Corriente
    { codigo: "2.2", nombre: "PASIVO NO CORRIENTE", tipo: "PASIVO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "2" },
    { codigo: "2.2.1", nombre: "DEUDAS A LARGO PLAZO", tipo: "PASIVO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "2.2" },
    { codigo: "2.2.1.01", nombre: "Préstamos Bancarios por Pagar L/P", tipo: "PASIVO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "2.2.1" },

    // ════════════════════════════════════════════════
    // 3. PATRIMONIO
    // ════════════════════════════════════════════════
    { codigo: "3", nombre: "PATRIMONIO NETO", tipo: "PATRIMONIO", nivel: 1, aceptaMovimientos: false },
    { codigo: "3.1", nombre: "CAPITAL Y RESERVAS", tipo: "PATRIMONIO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "3" },
    { codigo: "3.1.1", nombre: "CAPITAL SOCIAL Y RESULTADOS", tipo: "PATRIMONIO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "3.1" },
    { codigo: "3.1.1.01", nombre: "Capital Social (Aportes de Socios)", tipo: "PATRIMONIO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "3.1.1" },
    { codigo: "3.1.1.02", nombre: "Reserva Legal", tipo: "PATRIMONIO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "3.1.1" },
    { codigo: "3.1.1.03", nombre: "Resultados Acumulados de Ejercicios Anteriores", tipo: "PATRIMONIO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "3.1.1" },
    { codigo: "3.1.1.04", nombre: "Ajustes por Carga Inicial / Puesta en Marcha", tipo: "PATRIMONIO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "3.1.1" },
    { codigo: "3.1.1.05", nombre: "Utilidad / Pérdida del Ejercicio Actual", tipo: "PATRIMONIO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "3.1.1" },

    // ════════════════════════════════════════════════
    // 4. INGRESOS
    // ════════════════════════════════════════════════
    { codigo: "4", nombre: "INGRESOS", tipo: "INGRESO", nivel: 1, aceptaMovimientos: false },
    { codigo: "4.1", nombre: "INGRESOS OPERACIONALES", tipo: "INGRESO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "4" },
    // 4.1.1 Venta de Servicios
    { codigo: "4.1.1", nombre: "VENTA DE SERVICIOS DE TALLER", tipo: "INGRESO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "4.1" },
    { codigo: "4.1.1.01", nombre: "Ingresos por Mano de Obra (Mecánica General)", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.1.1" },
    { codigo: "4.1.1.02", nombre: "Ingresos por Servicios Especializados (Diagnóstico)", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.1.1" },
    { codigo: "4.1.1.03", nombre: "Ingresos por Desabolladura y Pintura", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.1.1" },
    { codigo: "4.1.1.04", nombre: "Ingresos por Servicios Tercerizados Reclutados", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.1.1" },
    // 4.1.2 Venta de Bienes
    { codigo: "4.1.2", nombre: "VENTA DE BIENES", tipo: "INGRESO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "4.1" },
    { codigo: "4.1.2.01", nombre: "Ingresos por Venta de Repuestos Nuevos", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.1.2" },
    { codigo: "4.1.2.02", nombre: "Ingresos por Venta de Repuestos Usados", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.1.2" },
    { codigo: "4.1.2.03", nombre: "Ingresos por Venta de Lubricantes y Aditivos", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.1.2" },
    // 4.2 Ingresos No Operacionales
    { codigo: "4.2", nombre: "INGRESOS NO OPERACIONALES", tipo: "INGRESO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "4" },
    { codigo: "4.2.1", nombre: "OTROS INGRESOS", tipo: "INGRESO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "4.2" },
    { codigo: "4.2.1.01", nombre: "Venta de Chatarra / Desechos Reciclables", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.2.1" },
    { codigo: "4.2.1.02", nombre: "Descuentos Obtenidos en Compras", tipo: "INGRESO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "4.2.1" },

    // ════════════════════════════════════════════════
    // 5. COSTOS DE VENTA Y OPERACIÓN
    // ════════════════════════════════════════════════
    { codigo: "5", nombre: "COSTOS DE VENTA Y OPERACIÓN", tipo: "COSTO", nivel: 1, aceptaMovimientos: false },
    { codigo: "5.1", nombre: "COSTOS DIRECTOS DEL TALLER", tipo: "COSTO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "5" },
    // 5.1.1 Costo de Repuestos e Insumos
    { codigo: "5.1.1", nombre: "COSTO DE REPUESTOS E INSUMOS (PPP)", tipo: "COSTO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "5.1" },
    { codigo: "5.1.1.01", nombre: "Costo de Repuestos Nuevos Aplicados a OT", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.1" },
    { codigo: "5.1.1.02", nombre: "Costo de Repuestos Usados Aplicados a OT", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.1" },
    { codigo: "5.1.1.03", nombre: "Costo de Lubricantes y Fluidos Consumidos", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.1" },
    // 5.1.2 Costo de Mano de Obra Directa
    { codigo: "5.1.2", nombre: "COSTO DE MANO DE OBRA DIRECTA", tipo: "COSTO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "5.1" },
    { codigo: "5.1.2.01", nombre: "Salarios de Mecánicos / Técnicos", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.2" },
    { codigo: "5.1.2.02", nombre: "Comisiones / Bonos por Productividad", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.2" },
    // 5.1.3 Costos Indirectos de Taller
    { codigo: "5.1.3", nombre: "COSTOS INDIRECTOS DE TALLER", tipo: "COSTO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "5.1" },
    { codigo: "5.1.3.01", nombre: "Costo de Servicios Tercerizados (Tornos, rectificaciones)", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.3" },
    { codigo: "5.1.3.02", nombre: "Mantenimiento y Calibración de Herramientas", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.3" },
    { codigo: "5.1.3.03", nombre: "Insumos de Limpieza y Seguridad Industrial", tipo: "COSTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "5.1.3" },

    // ════════════════════════════════════════════════
    // 6. GASTOS (Administrativos y Ventas)
    // ════════════════════════════════════════════════
    { codigo: "6", nombre: "GASTOS", tipo: "GASTO", nivel: 1, aceptaMovimientos: false },
    { codigo: "6.1", nombre: "GASTOS DE ADMINISTRACIÓN", tipo: "GASTO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "6" },
    { codigo: "6.1.1", nombre: "GASTOS ADMINISTRATIVOS", tipo: "GASTO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "6.1" },
    { codigo: "6.1.1.01", nombre: "Sueldos Administrativos (Gerencia, Recepción, Contab.)", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.02", nombre: "Alquileres de Locales / Oficinas", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.03", nombre: "Servicios Básicos (Luz trifásica, Agua, Internet)", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.04", nombre: "Gasto por Depreciación de Maquinaria y Herramientas", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.05", nombre: "Gasto por Pérdida / Rotura de Herramientas (Bajas)", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.06", nombre: "Licencias de Software (ERP, Diagramas, Base datos)", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.07", nombre: "Cargas Sociales Patronales (IPS)", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.08", nombre: "Gastos por Impuestos y Tasas (Municipales, DNIT)", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    { codigo: "6.1.1.90", nombre: "Gastos por Donaciones y Responsabilidad Social", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.1.1" },
    // 6.2 Gastos de Ventas
    { codigo: "6.2", nombre: "GASTOS DE VENTAS Y MARKETING", tipo: "GASTO", nivel: 2, aceptaMovimientos: false, cuentaPadre: "6" },
    { codigo: "6.2.1", nombre: "VENTAS Y MARKETING", tipo: "GASTO", nivel: 3, aceptaMovimientos: false, cuentaPadre: "6.2" },
    { codigo: "6.2.1.01", nombre: "Publicidad, Redes Sociales y Promociones", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.2.1" },
    { codigo: "6.2.1.02", nombre: "Comisiones de Asesores de Servicio (Service Advisors)", tipo: "GASTO", nivel: 4, aceptaMovimientos: true, cuentaPadre: "6.2.1" },
  ];

  for (const cta of planCuentasData) {
    const [existing] = await sql`
      SELECT id FROM public.plan_cuentas WHERE codigo = ${cta.codigo}
    `;
    if (existing) {
      console.log(`   [SKIP] Plan cuenta: ${cta.codigo} — ${cta.nombre}`);
    } else {
      // Resolve parent ID if specified
      let cuentaPadreId = null;
      if (cta.cuentaPadre) {
        const [padre] = await sql`
          SELECT id FROM public.plan_cuentas WHERE codigo = ${cta.cuentaPadre}
        `;
        cuentaPadreId = padre ? padre.id : null;
      }
      await sql`
        INSERT INTO public.plan_cuentas
          (id, codigo, nombre, tipo, nivel, acepta_movimientos, cuenta_padre_id, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${cta.codigo}, ${cta.nombre}, ${cta.tipo}, ${cta.nivel}, ${cta.aceptaMovimientos}, ${cuentaPadreId}, now(), now())
      `;
      console.log(`   [OK] Plan cuenta: ${cta.codigo} — ${cta.nombre}`);
    }
  }

  // ── 7. Inventory Accounts Map ───────────────────────────────────
  // Maps inventory categories to Chart of Accounts entries.
  // The '*' entry serves as the fallback/default for any category
  // without a specific mapping. Used by resolveAssetAccount() and
  // stock movement auto-journaling.
  //
  // New definitive chart codes:
  //   Inventario (repuestos): 1.1.3.01 — Inventario de Repuestos Nuevos
  //   Costo (repuestos):      5.1.1.01 — Costo de Repuestos Nuevos Aplicados a OT
  //   Proveedor:              2.1.1.01 — Proveedores de Repuestos Nacionales
  //   Inventario (herr.):     1.2.1.03 — Herramientas Especializadas del Taller
  //   Costo (herr.):          5.1.3.02 — Mantenimiento y Calibración de Herramientas

  // Resolve account IDs by codigo once
  const [cuentaInventario] = await sql`
    SELECT id FROM public.plan_cuentas WHERE codigo = '1.1.3.01'
  `;
  const [cuentaGasto] = await sql`
    SELECT id FROM public.plan_cuentas WHERE codigo = '5.1.1.01'
  `;
  const [cuentaProveedor] = await sql`
    SELECT id FROM public.plan_cuentas WHERE codigo = '2.1.1.01'
  `;
  const [cuentaHerramientas] = await sql`
    SELECT id FROM public.plan_cuentas WHERE codigo = '1.2.1.03'
  `;
  const [cuentaGastoHerramientas] = await sql`
    SELECT id FROM public.plan_cuentas WHERE codigo = '5.1.3.02'
  `;

  const inventoryMapData = [
    { categoria: "*",        cuentaInventarioId: cuentaInventario.id, cuentaGastoId: cuentaGasto.id, cuentaProveedorId: cuentaProveedor.id },
    { categoria: "Filtros",  cuentaInventarioId: cuentaInventario.id, cuentaGastoId: cuentaGasto.id, cuentaProveedorId: cuentaProveedor.id },
    { categoria: "Frenos",   cuentaInventarioId: cuentaInventario.id, cuentaGastoId: cuentaGasto.id, cuentaProveedorId: cuentaProveedor.id },
    { categoria: "Motor",    cuentaInventarioId: cuentaInventario.id, cuentaGastoId: cuentaGasto.id, cuentaProveedorId: cuentaProveedor.id },
    { categoria: "Eléctrico", cuentaInventarioId: cuentaInventario.id, cuentaGastoId: cuentaGasto.id, cuentaProveedorId: cuentaProveedor.id },
    { categoria: "Lubricantes", cuentaInventarioId: cuentaInventario.id, cuentaGastoId: cuentaGasto.id, cuentaProveedorId: cuentaProveedor.id },
    { categoria: "Transmisión", cuentaInventarioId: cuentaInventario.id, cuentaGastoId: cuentaGasto.id, cuentaProveedorId: cuentaProveedor.id },
    { categoria: "Herramientas", cuentaInventarioId: cuentaHerramientas.id, cuentaGastoId: cuentaGastoHerramientas.id, cuentaProveedorId: cuentaProveedor.id },
  ];

  for (const map of inventoryMapData) {
    const [existing] = await sql`
      SELECT id FROM public.inventory_accounts_map
      WHERE categoria = ${map.categoria} AND tenant_slug = ${TENANT_SLUG}
    `;
    if (existing) {
      await sql`
        UPDATE public.inventory_accounts_map
        SET cuenta_inventario_id = ${map.cuentaInventarioId},
            cuenta_gasto_id = ${map.cuentaGastoId},
            cuenta_proveedor_id = ${map.cuentaProveedorId}
        WHERE id = ${existing.id}
      `;
      console.log(`   [UPD] Inv acct map: ${map.categoria}`);
    } else {
      await sql`
        INSERT INTO public.inventory_accounts_map
          (id, categoria, cuenta_inventario_id, cuenta_gasto_id, cuenta_proveedor_id, tenant_slug, created_at)
        VALUES
          (gen_random_uuid(), ${map.categoria}, ${map.cuentaInventarioId}, ${map.cuentaGastoId}, ${map.cuentaProveedorId}, ${TENANT_SLUG}, now())
      `;
      console.log(`   [OK] Inv acct map: ${map.categoria}`);
    }
  }

  // ── 7c. Centros de Costo ──────────────────────────────────────────
  // Jerarquía de centros de costo para dimensión analítica.
  // Cuentas de COSTO (5) y GASTO (6) exigen centro_costo_id en cada asiento.
  const centrosCostoData = [
    { codigo: "TALLER", nombre: "Taller", descripcion: "Operaciones del taller" },
    { codigo: "MECANICA", nombre: "Mecánica Rápida", descripcion: "Servicios exprés (cambio de aceite, filtros, frenos)", centroPadre: "TALLER" },
    { codigo: "DIAGNOSTICO", nombre: "Diagnóstico Avanzado", descripcion: "Escáner, DTC, eléctrica y electrónica", centroPadre: "TALLER" },
    { codigo: "CARROCERIA", nombre: "Carrocería y Pintura", descripcion: "Desabolladura, pintura, preparación", centroPadre: "TALLER" },
    { codigo: "REPUESTOS", nombre: "Repuestos y Almacén", descripcion: "Gestión de inventario y logística", centroPadre: "TALLER" },
    { codigo: "ADMIN", nombre: "Administración", descripcion: "Gerencia, contabilidad, RRHH" },
    { codigo: "VENTAS", nombre: "Ventas y Marketing", descripcion: "Atención al cliente, publicidad, asesores de servicio" },
  ];

  for (const cc of centrosCostoData) {
    const [existing] = await sql`
      SELECT id FROM public.centros_costo
      WHERE codigo = ${cc.codigo} AND tenant_slug = ${TENANT_SLUG}
    `;
    if (existing) {
      console.log(`   [SKIP] Centro costo: ${cc.codigo} — ${cc.nombre}`);
    } else {
      let centroPadreId = null;
      if (cc.centroPadre) {
        const [padre] = await sql`
          SELECT id FROM public.centros_costo
          WHERE codigo = ${cc.centroPadre} AND tenant_slug = ${TENANT_SLUG}
        `;
        centroPadreId = padre ? padre.id : null;
      }
      await sql`
        INSERT INTO public.centros_costo
          (id, codigo, nombre, descripcion, centro_padre_id, tenant_slug, created_at)
        VALUES
          (gen_random_uuid(), ${cc.codigo}, ${cc.nombre}, ${cc.descripcion}, ${centroPadreId}, ${TENANT_SLUG}, now())
      `;
      console.log(`   [OK] Centro costo: ${cc.codigo} — ${cc.nombre}`);
    }
  }

  // ── 8. Inventory items (spare parts with barcodes) ─────────────
  const inventoryData = [
    { name: "Filtro de aceite", sku: "FIL-001", barcode: "7791234567890", quantity: 25, unitPrice: "75000", minStock: 10, category: "Filtros" },
    { name: "Pastillas de freno delanteras", sku: "FRENO-001", barcode: "7791234567891", quantity: 15, unitPrice: "210000", minStock: 5, category: "Frenos" },
    { name: "Bujías Iridium", sku: "BUG-001", barcode: "7791234567892", quantity: 40, unitPrice: "65000", minStock: 10, category: "Motor" },
    { name: "Correa de distribución", sku: "COR-001", barcode: "7791234567893", quantity: 8, unitPrice: "320000", minStock: 3, category: "Motor" },
    { name: "Kit de embrague", sku: "EMB-001", barcode: "7791234567894", quantity: 3, unitPrice: "950000", minStock: 2, category: "Transmisión" },
    { name: "Batería HV Toyota Prius Gen4", sku: "BAT-HV-001", barcode: "7791234567895", quantity: 1, unitPrice: "5200000", minStock: 1, category: "Eléctrico" },
    { name: "Refrigerante para batería HV", sku: "REF-BAT-001", barcode: "7791234567896", quantity: 10, unitPrice: "150000", minStock: 3, category: "Eléctrico" },
    { name: "Service plug HV (conector seguridad)", sku: "CON-HV-001", barcode: "7791234567897", quantity: 4, unitPrice: "280000", minStock: 2, category: "Eléctrico" },
    { name: "Filtro de aire acondicionado", sku: "FIL-AC-001", barcode: "7791234567898", quantity: 20, unitPrice: "58000", minStock: 8, category: "Filtros" },
    { name: "Aceite motor 5W-30 sintético 5L", sku: "ACE-001", barcode: "7791234567899", quantity: 30, unitPrice: "165000", minStock: 10, category: "Lubricantes" },
    // Workshop tools (stored in inventory_items as they share the same schema)
    { name: "Scanner Launch X431 V+", sku: "SCAN-001", barcode: "7791234567800", quantity: 1, unitPrice: "8500000", minStock: 1, category: "Herramientas" },
    { name: "Multímetro alta tensión Fluke 1587 FC", sku: "MULT-HV-001", barcode: "7791234567801", quantity: 1, unitPrice: "3200000", minStock: 1, category: "Herramientas" },
    { name: "Juego llaves aisladas 1000V 10pz", sku: "LLAVE-AIS-001", barcode: "7791234567802", quantity: 2, unitPrice: "850000", minStock: 1, category: "Herramientas" },
    { name: "Elevador para vehículos HV", sku: "ELE-HV-001", barcode: "7791234567803", quantity: 1, unitPrice: "15000000", minStock: 1, category: "Herramientas" },
    { name: "Scanner Thinkcar ThinkTool Pro", sku: "SCAN-THINK-001", barcode: "7791234567804", quantity: 1, unitPrice: "4200000", minStock: 1, category: "Herramientas" },
  ];

  // Track inventory item IDs for tool checkout
  const toolItemIds: string[] = [];

  for (const item of inventoryData) {
    const [existing] = await sql`
      SELECT id FROM ${sql(SCHEMA_NAME)}.inventory_items WHERE sku = ${item.sku}
    `;
    if (existing) {
      if (item.category === "Herramientas") toolItemIds.push(existing.id);
      console.log(`   [SKIP] Inventory: ${item.name}`);
    } else {
      const [inserted] = await sql`
        INSERT INTO ${sql(SCHEMA_NAME)}.inventory_items
          (id, name, sku, barcode, quantity, unit_price, min_stock, category, created_at)
        VALUES
          (gen_random_uuid(), ${item.name}, ${item.sku}, ${item.barcode}, ${item.quantity}, ${item.unitPrice}, ${item.minStock}, ${item.category}, now())
        RETURNING id
      `;
      if (item.category === "Herramientas") toolItemIds.push(inserted.id);
      console.log(`   [OK] Inventory: ${item.sku} — ${item.name}`);
    }
  }

  // ── 9. Tool checkouts ──────────────────────────────────────────
  // Assign the scanner to a mechanic for the Prius work order
  if (toolItemIds.length > 0 && profileIds.length > 0 && otIds.length > 0) {
    const [existingCheckout] = await sql`
      SELECT id FROM ${sql(SCHEMA_NAME)}.tool_checkouts
      WHERE tool_id = ${toolItemIds[0]} AND work_order_id = ${otIds[0]} AND checked_in IS NULL
    `;
    if (!existingCheckout) {
      await sql`
        INSERT INTO ${sql(SCHEMA_NAME)}.tool_checkouts
          (id, tool_id, mechanic_id, work_order_id, checked_out)
        VALUES
          (gen_random_uuid(), ${toolItemIds[0]}, ${profileIds[0]}, ${otIds[0]}, now())
      `;
      console.log(`   [OK] Tool checkout: Scanner assigned to OT #${otIds[0].slice(0, 8)}…`);
    } else {
      console.log(`   [SKIP] Tool checkout already exists`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────
  console.log(`\nSeed summary:`);
  console.log(`   Profiles:        ${mechanics.length}`);
  console.log(`   Clients:         ${clientData.length}`);
  console.log(`   Vehicles:        ${vehicleData.length}`);
  console.log(`   Work orders:     ${otData.length}`);
  console.log(`   Inventory items: ${inventoryData.length}`);
  console.log(`   Tool checkouts:  1`);
  console.log(`\nReady. Use header: X-Tenant-Slug: ${TENANT_SLUG}`);
}

seed()
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  })
  .finally(() => closeDb());
