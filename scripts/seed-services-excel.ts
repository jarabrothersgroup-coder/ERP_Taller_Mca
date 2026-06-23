/**
 * Seed script: Excel Service Catalog — 40 services from Docs/ spreadsheets.
 *
 * Populates the advanced automotive service catalog extracted from:
 *   - Estructura_Tempario_Maestro_ERP_Automotriz.xlsx (20 traditional)
 *   - Maestro_ERP_Automotriz_Completo_2026.xlsx (20 advanced/EV/HEV)
 *   - Matriz_Complejidad_y_Costos_Automotriz_Paraguay.xlsx (pricing)
 *
 * Usage: npx tsx scripts/seed-services-excel.ts <tenant_slug>
 *
 * @module scripts/seed-services-excel
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import {
  serviceCategories,
  serviciosCatalogo,
  servicePricingRules,
  vehicleTypes,
  rhServiceHours,
} from "../src/modules/workshop/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-services-excel.ts <tenant_slug>");
  process.exit(1);
}

async function main() {
  console.log(`🌱 Seeding Excel catalog for tenant: ${TENANT_SLUG}\n`);

  // ── 1. New Service Categories (14) ──────────
  const categories = [
    { nombre: "Motor y Componentes", icono: "🔩", color: "#8B4513", orden: 9 },
    { nombre: "Transmisión y Embrague", icono: "⚙️", color: "#696969", orden: 10 },
    { nombre: "Tren Delantero", icono: "🏎️", color: "#4682B4", orden: 11 },
    { nombre: "Tren Trasero", icono: "🔧", color: "#708090", orden: 12 },
    { nombre: "Eléctrico", icono: "⚡", color: "#FFD700", orden: 13 },
    { nombre: "Electrónica", icono: "💻", color: "#00CED1", orden: 14 },
    { nombre: "Carrocería", icono: "🚗", color: "#CD853F", orden: 15 },
    { nombre: "Chasis", icono: "🔩", color: "#A0522D", orden: 16 },
    { nombre: "Vehículos Eléctricos (BEV)", icono: "🔋", color: "#00AA00", orden: 17 },
    { nombre: "Vehículos Híbridos", icono: "⚡", color: "#FF8C00", orden: 18 },
    { nombre: "Nuevos Combustibles", icono: "⛽", color: "#32CD32", orden: 19 },
    { nombre: "Frenos y Seguridad", icono: "🛑", color: "#DC143C", orden: 20 },
    { nombre: "Climatización (HVAC)", icono: "❄️", color: "#00BFFF", orden: 21 },
    { nombre: "Asistencia ADAS", icono: "📡", color: "#9400D3", orden: 22 },
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
  console.log(`   ✅  New Categories: ${catCount} inserted`);

  // ── 2. Service Catalog — 40 services ────────
  const services = [
    // ══════════════════════════════════════════════
    //  TEMPARIO MAESTRO — 20 Traditional Services
    // ══════════════════════════════════════════════

    // Motor y Componentes (4)
    { nombre: "Reemplazo de Junta de Tapa de Cilindros / Culata", descripcion: "Reemplazo completo de junta multilaminada de culata", categoria: "Motor y Componentes", codigo: "MEC-MOT-001", precioEstimado: "1850000", duracionEstimada: 390, thinkcarModulo: "ECM_RESET", descripcionTecnica: "Desmontaje completo de culata, cambio de junta multilaminada, torque de pernos según especificación OEM. Aplicable a motores GDI y convencionales." },
    { nombre: "Cambio de Kit de Correa / Cadena de Distribución", descripcion: "Kit completo de distribución con tensor y poleas", categoria: "Motor y Componentes", codigo: "MEC-MOT-002", precioEstimado: "1200000", duracionEstimada: 180, thinkcarModulo: "TIMING_REVIEW", descripcionTecnica: "Kit completo de distribución con tensor hidráulico, guías y poleas. Incluye alineación de marcas de fábrica y verificación de tensión." },
    { nombre: "Cambio de Inyectores (Nafta GDI / Diésel CRDI)", descripcion: "Extracción e inserción de inyectores de alta presión", categoria: "Motor y Componentes", codigo: "MEC-MOT-003", precioEstimado: "850000", duracionEstimada: 120, thinkcarModulo: "INJECTOR_CODING_THROTTLE_RELEARN", descripcionTecnica: "Extracción e inserción de inyectores de alta presión. Requiere codificación de aprendizaje EEPROM y verificación de presión rail." },
    { nombre: "Reemplazo de Bomba de Agua y Correa de Accesorios", descripcion: "Cambio de bomba de agua y correa de accesorios", categoria: "Motor y Componentes", codigo: "MEC-MOT-004", precioEstimado: "550000", duracionEstimada: 90, thinkcarModulo: "BELT_TENSION", descripcionTecnica: "Cambio de bomba de agua y correa de accesorios. Verificación de tensor automático y alineación de poleas." },

    // Transmisión y Embrague (3)
    { nombre: "Cambio de Kit de Embrague (Disco, Plato, Rulemán)", descripcion: "Kit completo de embrague con disco self-adjusting", categoria: "Transmisión y Embrague", codigo: "MEC-TRA-001", precioEstimado: "1500000", duracionEstimada: 240, thinkcarModulo: "CLUTCH_ADAPT", descripcionTecnica: "Kit completo de embrague con disco self-adjusting, plato y rulemán de agujas. Incluye sangrado hidráulico." },
    { nombre: "Mantenimiento de Fluido ATF/CVT y Filtro Interno", descripcion: "Cambio de fluido ATF/CVT y filtro interno", categoria: "Transmisión y Embrague", codigo: "MEC-TRA-002", precioEstimado: "650000", duracionEstimada: 90, thinkcarModulo: "TRANSMISSION_ADAPT", descripcionTecnica: "Cambio de fluido ATF/CVT por bomba de circulación. Reemplazo de filtro interno y verificación de niveles con escáner." },
    { nombre: "Reemplazo de Homocinética o Palier Completo", descripcion: "Reemplazo de junta homocinética o palier", categoria: "Transmisión y Embrague", codigo: "MEC-TRA-003", precioEstimado: "450000", duracionEstimada: 72, descripcionTecnica: "Reemplazo de junta homocinética o palier completo. Incluye retenes, grasa especial y verificación de holguras axiales." },

    // Tren Delantero (3)
    { nombre: "Cambio de Amortiguadores Delanteros (Par)", descripcion: "Reemplazo de amortiguadores delanteros en par", categoria: "Tren Delantero", codigo: "MEC-TRD-001", precioEstimado: "400000", duracionEstimada: 120, descripcionTecnica: "Reemplazo de amortiguadores delanteros en par. Verificación de muelles, bujes y rótulas superiores." },
    { nombre: "Reemplazo de Cremallera de Dirección", descripcion: "Reemplazo de cremallera de dirección asistida", categoria: "Tren Delantero", codigo: "MEC-TRD-002", precioEstimado: "1200000", duracionEstimada: 210, thinkcarModulo: "EPS_CALIBRATE", descripcionTecnica: "Reemplazo de cremallera de dirección asistida eléctrica/hidráulica. Calibración de sensor de par y alineación de ruedas." },
    { nombre: "Reemplazo de Parrillas de Suspensión / Bujes / Rótulas", descripcion: "Cambio de parrillas, bujes y rótulas", categoria: "Tren Delantero", codigo: "MEC-TRD-003", precioEstimado: "550000", duracionEstimada: 90, descripcionTecnica: "Cambio de parrillas de suspensión (brazos inferiores/superiores) con bujes de caucho-metal y rótulas de seguridad." },

    // Tren Trasero (2)
    { nombre: "Cambio de Amortiguadores Traseros / Espirales", descripcion: "Reemplazo de amortiguadores y/o muelles traseros", categoria: "Tren Trasero", codigo: "MEC-TRT-001", precioEstimado: "350000", duracionEstimada: 72, descripcionTecnica: "Reemplazo de amortiguadores y/o muelles espirales traseros. Verificación de brazos de torsión y bujes de eje." },
    { nombre: "Reemplazo de Bujes de Eje Trasero / Brazos Tensores", descripcion: "Cambio de bujes de eje o brazos tensores", categoria: "Tren Trasero", codigo: "MEC-TRT-002", precioEstimado: "750000", duracionEstimada: 150, descripcionTecnica: "Cambio de bujes de eje trasero o brazos tensores. Requiere desmontaje parcial del eje y prensado hidráulico." },

    // Eléctrico (2)
    { nombre: "Reemplazo de Alternador / Motor de Arranque", descripcion: "Reemplazo o reparación de alternador o motor de arranque", categoria: "Eléctrico", codigo: "ELE-ELC-001", precioEstimado: "550000", duracionEstimada: 108, thinkcarModulo: "ALTERNATOR_RELearn", descripcionTecnica: "Reemplazo de alternador o motor de arranque. Verificación de tensión de carga y circuito de excitación." },
    { nombre: "Cambio de Ópticas Faros Delanteros", descripcion: "Reemplazo de ópticas de faros con desmontaje de paragolpes", categoria: "Eléctrico", codigo: "ELE-ELC-002", precioEstimado: "650000", duracionEstimada: 72, thinkcarModulo: "HEADLIGHT_ADJUST", descripcionTecnica: "Reemplazo de ópticas de faros delanteros. Incluye desmontaje de paragolpes, conexión de harness y ajuste de alcance." },

    // Electrónica (2)
    { nombre: "Diagnóstico Avanzado y Cambio de Sensores Críticos", descripcion: "CKP, CMP, ABS — diagnóstico y reemplazo", categoria: "Electrónica", codigo: "ELE-ELN-001", precioEstimado: "350000", duracionEstimada: 60, thinkcarModulo: "FULL_SYSTEM_SCAN", descripcionTecnica: "Diagnóstico con escáner de nivel OEM. Cambio de sensores de posición de cigüeñal/culata o sensores de velocidad ABS. Verificación de señales con osciloscopio." },
    { nombre: "Calibración de Cámaras / Sensores de Carril / Radar ADAS", descripcion: "Calibración estática y dinámica de sistemas ADAS", categoria: "Electrónica", codigo: "ELE-ELN-002", precioEstimado: "850000", duracionEstimada: 90, thinkcarModulo: "ADAS_CALIBRATE", descripcionTecnica: "Calibración estática y dinámica de sistemas ADAS. Requiere lienzos de calibración, targets de referencia y espacio de 8m mínimo." },

    // Carrocería (2)
    { nombre: "Desmontaje y Montaje de Paragolpes / Guardabarros", descripcion: "Desmontaje y montaje de componentes de carrocería exterior", categoria: "Carrocería", codigo: "CAR-CRR-001", precioEstimado: "450000", duracionEstimada: 90, descripcionTecnica: "Desmontaje y montaje de componentes de carrocería exterior. Incluye clips, tornillería, alineación de gaps y verificación de pintura." },
    { nombre: "Cambio de Alzacristales Eléctrico o Cerradura de Puerta", descripcion: "Reemplazo de mecanismo de alzacristales o cerradura", categoria: "Carrocería", codigo: "CAR-CRR-002", precioEstimado: "400000", duracionEstimada: 78, descripcionTecnica: "Reemplazo de mecanismo de alzacristales eléctrico o cerradura de puerta. Verificación de funcionamiento eléctrico y mecánico." },

    // Chasis (2)
    { nombre: "Cambio de Soportes / Tacos de Motor y Caja", descripcion: "Cambio de soportes de motor y caja (set completo)", categoria: "Chasis", codigo: "CHA-CHS-001", precioEstimado: "850000", duracionEstimada: 150, thinkcarModulo: "ENGINE_MOUNT_RECAL", descripcionTecnica: "Cambio de soportes de motor y caja de cambios (set completo). Incluye alineación de motor y verificación de vibraciones." },
    { nombre: "Reemplazo de Silenciador, Catalizador o Tramo de Escape", descripcion: "Reemplazo de componentes del sistema de escape", categoria: "Chasis", codigo: "CHA-CHS-002", precioEstimado: "450000", duracionEstimada: 72, descripcionTecnica: "Reemplazo de silenciador, catalizador o tramo de escape. Verificación de fugas y cumplimiento normativa ambiental." },

    // ══════════════════════════════════════════════
    //  MAESTRO ERP — 20 Advanced/EV/HEV Services
    // ══════════════════════════════════════════════

    // Inyección Electrónica (3)
    { nombre: "Calibración de Cuerpo de Aceleración Motorizado", descripcion: "Diagnóstico y calibración drive-by-wire", categoria: "Especialidad Alta Performance", codigo: "INM-ELN-001", precioEstimado: "450000", duracionEstimada: 72, thinkcarModulo: "THROTTLE_RELEARN", descripcionTecnica: "Diagnóstico y calibración de cuerpo de aceleración motorizado drive-by-wire. Incluye relearn de posición de mariposa y verificación de señales TPS." },
    { nombre: "Limpieza Ultrasónica de Inyectores Nafta/Flex", descripcion: "Banco de pruebas + ultrasonido + cambio de sellos", categoria: "Especialidad Alta Performance", codigo: "INM-ELN-002", precioEstimado: "650000", duracionEstimada: 108, thinkcarModulo: "INJECTOR_CODING_THROTTLE_RELEARN", descripcionTecnica: "Limpieza de inyectores por ultrasonido en banco de pruebas. Verificación de caudal y patrón de spray. Cambio de sellos de alta presión." },
    { nombre: "Reemplazo de Sonda Lambda / Válvula EGR", descripcion: "Sensor O2 o EGR obstruida por hollín local", categoria: "Descarbonización y EGR", codigo: "INM-ELN-003", precioEstimado: "400000", duracionEstimada: 66, thinkcarModulo: "EGR_CALIBRATION", descripcionTecnica: "Reemplazo de sonda lambda pre/post catalizador o válvula EGR. Calibración de mezcla aire/combustible y verificación de emisiones." },

    // Vehículos Eléctricos BEV (4)
    { nombre: "Aislamiento y Balanceo de Pack de Batería Litio HV", descripcion: "Protocolo de seguridad HV + desmontaje + balanceo celdas", categoria: "Vehículos Eléctricos (BEV)", codigo: "EVO-BAT-001", precioEstimado: "3500000", duracionEstimada: 330, thinkcarModulo: "HV_ISOLATION_TEST", descripcionTecnica: "Protocolo de seguridad HV: aislamiento de batería, verificación de aislamiento con megóhmetro, desmontaje de pack y balanceo de celdas. Requiere EPP completo nivel B." },
    { nombre: "Servicio de Motor Síncrono de Imanes Permanentes (PMSM)", descripcion: "Reemplazo o servicio de motor + reductor axial", categoria: "Vehículos Eléctricos (BEV)", codigo: "EVO-MOT-002", precioEstimado: "2500000", duracionEstimada: 240, thinkcarModulo: "MOTOR_ADAPTIVE", descripcionTecnica: "Servicio o reemplazo de motor síncrono de imanes permanentes (PMSM). Incluye verificación de reductor axial, rodamientos y codificador de posición." },
    { nombre: "Servicio de Gestión Térmica de Batería HV", descripcion: "Refrigeración líquida/chiller de batería de tracción", categoria: "Vehículos Eléctricos (BEV)", codigo: "EVO-TRM-003", precioEstimado: "850000", duracionEstimada: 132, thinkcarModulo: "THERMAL_MANAGE", descripcionTecnica: "Servicio al circuito de refrigeración de batería HV. Incluye vacío, carga de refrigerante, verificación de chiller y sensores de temperatura." },
    { nombre: "Diagnóstico de Inversor DC-AC / Conversor DC-DC", descripcion: "Sustitución de inversor de potencia o conversor LT", categoria: "Vehículos Eléctricos (BEV)", codigo: "EVO-INV-004", precioEstimado: "1800000", duracionEstimada: 180, thinkcarModulo: "INVERTER_DIAG", descripcionTecnica: "Diagnóstico y sustitución de inversor de potencia o conversor DC-DC de baja tensión. Verificación de onda sinusoidal y eficiencia." },

    // Vehículos Híbridos (3)
    { nombre: "Servicio de Transeje e-CVT (MG1/MG2)", descripcion: "Desacople motor térmico + reemplazo + calibración e-CVT", categoria: "Vehículos Híbridos", codigo: "HYB-POW-001", precioEstimado: "3200000", duracionEstimada: 300, thinkcarModulo: "TRANSMISSION_ADAPTIVE", descripcionTecnica: "Desacople de motor térmico y servicio de transeje e-CVT con motores generadores MG1/MG2. Calibración de sincronización y verificación de modo EV." },
    { nombre: "Limpieza de Sistema de Enfriamiento de Batería Híbrida", descripcion: "Filtros + soplador + sensores + BMS", categoria: "Vehículos Híbridos", codigo: "HYB-BAT-002", precioEstimado: "550000", duracionEstimada: 90, thinkcarModulo: "BATTERY_COOLING", descripcionTecnica: "Limpieza profunda de sistema de enfriamiento de batería híbrida. Incluye filtros, soplador, sensores de temperatura y verificación de BMS." },
    { nombre: "Inspección de Cableado Naranja HV y Relés SMR", descripcion: "Cableado HV + relés SMR + interlock", categoria: "Vehículos Híbridos", codigo: "HYB-SFT-003", precioEstimado: "400000", duracionEstimada: 72, thinkcarModulo: "HV_ISOLATION_TEST", descripcionTecnica: "Inspección visual y eléctrica de cableado HV naranja, relés SMR (System Main Relay), fusibles HV y circuitos de interlock. Verificación de aislamiento." },

    // Nuevos Combustibles (4)
    { nombre: "Mantenimiento de Pila de Combustible de Hidrógeno", descripcion: "Purga PEM + filtros aire químico + humidificación", categoria: "Nuevos Combustibles", codigo: "H2O-CEL-001", precioEstimado: "2800000", duracionEstimada: 270, thinkcarModulo: "FUEL_CELL_PURGE", descripcionTecnica: "Mantenimiento de pila de combustible PEM. Incluye purga de membrana, cambio de filtros de aire químico, verificación de humidificación y presión de H2." },
    { nombre: "Prueba de Fuga de Tanque H2 a 700 bar", descripcion: "Helio trazador + válvulas solenoides + sensores P/T", categoria: "Nuevos Combustibles", codigo: "H2O-TNK-002", precioEstimado: "1200000", duracionEstimada: 150, thinkcarModulo: "H2_LEAK_TEST", descripcionTecnica: "Prueba de hermeticidad con helio trazador a 700 bar. Revisión de válvulas solenoides de llenado y descarga, sensores de presión y temperatura." },
    { nombre: "Sustitución de Bomba de Gas Licuado LPI", descripcion: "Bomba GLP fase líquida + regulador + inyectores gas", categoria: "Nuevos Combustibles", codigo: "GLP-LPI-003", precioEstimado: "1500000", duracionEstimada: 168, thinkcarModulo: "LPI_PUMP_RECAL", descripcionTecnica: "Sustitución de bomba de gas licuado LPI en fase líquida. Incluye verificación de regulador, inyectores de gas y sincronización ECU." },
    { nombre: "Sensor de Etanol + Inyectores Flex Fuel Sobredimensionados", descripcion: "Cambio de sensor O2 flex e inyectores Mercosur", categoria: "Nuevos Combustibles", codigo: "FLX-ETH-004", precioEstimado: "750000", duracionEstimada: 84, thinkcarModulo: "FLEX_FUEL_CAL", descripcionTecnica: "Cambio de sensor de concentración de etanol (O2 flex) e inyectores de mayor caudal para mezcla E85. Calibración de mapas de inyección." },

    // Frenos y Seguridad (2)
    { nombre: "Pastillas + Rectificado Discos + Purga Hidráulica ABS", descripcion: "Cambio de pastillas, rectificado y purga completa", categoria: "Frenos y Seguridad", codigo: "BRK-ABS-001", precioEstimado: "550000", duracionEstimada: 72, thinkcarModulo: "ABS_BLEEDING", descripcionTecnica: "Cambio de pastillas de freno, rectificado de discos y purga completa del circuito hidráulico con equipo de sangrado por presión." },
    { nombre: "Sustitución de Calipers EPB y Purga por Software", descripcion: "Freno de mano electrónico con motor integrado", categoria: "Frenos y Seguridad", codigo: "BRK-EPB-002", precioEstimado: "950000", duracionEstimada: 96, thinkcarModulo: "EPB_SERVICE", descripcionTecnica: "Sustitución de calipers EPB con motor integrado. Purga y aprendizaje por software. Requiere modo de servicio con escáner." },

    // Climatización HVAC (2)
    { nombre: "Recarga Gas R134a/R1234yf + Detección Fugas + Filtro", descripcion: "Recarga de gas refrigerante con equipo de recuperación", categoria: "Climatización (HVAC)", codigo: "VAC-HVC-001", precioEstimado: "450000", duracionEstimada: 78, thinkcarModulo: "AC_RECHARGE", descripcionTecnica: "Recarga de gas refrigerante R134a o R1234yf con equipo de recuperación. Detección de fugas con UV/gas trazador. Cambio de filtro de habitáculo y secador." },
    { nombre: "Cambio de Compresor A/C Scroll Eléctrico", descripcion: "Compresor HV con aceite dieléctrico POE", categoria: "Climatización (HVAC)", codigo: "VAC-HVC-002", precioEstimado: "1200000", duracionEstimada: 144, thinkcarModulo: "AC_COMPRESSOR", descripcionTecnica: "Cambio de compresor scroll eléctrico para HEV/EV. Requiere aceite dieléctrico POE, vacío profundo y calibración de presión de trabajo." },

    // Asistencia ADAS (2)
    { nombre: "Calibración de Radar de Proximidad y Cámaras de Carril", descripcion: "Calibración estática/dinámica ADAS con targets OEM", categoria: "Asistencia ADAS", codigo: "ADA-SCY-001", precioEstimado: "1500000", duracionEstimada: 120, thinkcarModulo: "ADAS_CALIBRATE", descripcionTecnica: "Sustitución de radar de proximidad o cámara de visión frontal. Calibración estática con targets y dinámica en ruta. Requiere lienzos y herramiental OEM." },
    { nombre: "Actualización de Firmware Gateway / Módulos OTA", descripcion: "Pasarelas de conectividad 4G/5G/WiFi", categoria: "Asistencia ADAS", codigo: "ADA-SCY-002", precioEstimado: "550000", duracionEstimada: 60, thinkcarModulo: "OTA_UPDATE", descripcionTecnica: "Actualización de firmware de gateway central y módulos de conectividad (4G/5G/WiFi). Verificación de versión y funcionalidad post-update." },
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
  console.log(`   ✅  Excel Services: ${servCount} inserted`);

  // ── 3. Pricing Rules — Multi-Dimensional ─────
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
  console.log(`   ✅  Excel Pricing Rules: ${prCount} inserted`);

  // ── 4. RH Service Hours ───────────────────────
  const existingRH = await db()
    .select({ servicioId: rhServiceHours.servicioId, vehicleTypeId: rhServiceHours.vehicleTypeId })
    .from(rhServiceHours)
    .where(eq(rhServiceHours.tenantSlug, TENANT_SLUG));
  const existingRHKeys = new Set(existingRH.map((r) => `${r.servicioId}:${r.vehicleTypeId}`));
  let rhCount = 0;

  for (const s of services) {
    const serv = servMap.get(s.codigo);
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
        complejidad: horas > 3 ? "COMPLEJA" : "NORMAL",
        horasEstimadas: String(horas),
        horasMinimas: String(Math.round(horas * 0.8 * 100) / 100),
        horasMaximas: String(Math.round(horas * 1.3 * 100) / 100),
        requiereEspecialista: horas > 3,
        tenantSlug: TENANT_SLUG,
      });
      rhCount++;
    }
  }
  console.log(`   ✅  RH Service Hours: ${rhCount} inserted`);
  console.log(`\n🌱 Excel catalog seeding complete!`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
