/**
 * Seed script: Workshop Tools & Equipment Catalog.
 *
 * Populates the herramientas table with realistic workshop equipment:
 *   - Herramientas Manuales (llaves, destornilladores, extractores)
 *   - Herramientas Eléctricas (taladros, amoladoras, impacto)
 *   - Equipos de Diagnóstico (scanners OBD2, multímetros)
 *   - Equipos de Taller (elevador, compresor, alineadora)
 *   - Herramientas de Precisión (torquímetros, micrómetros)
 *   - Seguridad (extintores, guantes, gafas)
 *
 * Pricing in Guaraníes (₲) based on Paraguayan market data.
 *
 * Usage: npx tsx scripts/seed-tools-equipment.ts
 *
 * @module scripts/seed-tools-equipment
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import { herramientas } from "../src/modules/inventory/schema/index.js";

interface ToolDef {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  marca: string;
  modelo: string;
  ubicacion: string;
  requiereCalibracion: boolean;
  vidaUtilAnos: number | null;
  costoReposicion: number;
}

const TOOLS: ToolDef[] = [
  // ═══════════════════════════════════════════════════════════════
  // HERRAMIENTAS MANUALES
  // ═══════════════════════════════════════════════════════════════
  { codigo: "HM-LLV-001", nombre: "Juego de Llaves Mixtas 6-32mm (20 piezas)", descripcion: "Llaves combinadas cromadas, acabado espejo", categoria: "Manuales", marca: "Truper", modelo: "MLJ-20", ubicacion: "Carro de Herramientas #1", requiereCalibracion: false, vidaUtilAnos: 10, costoReposicion: 450000 },
  { codigo: "HM-LLV-002", nombre: "Juego de Llaves Allen 1.5-10mm (9 piezas)", descripcion: "Llaves hexagonales SAE y métricas", categoria: "Manuales", marca: "Truper", modelo: "MLA-9", ubicacion: "Carro de Herramientas #1", requiereCalibracion: false, vidaUtilAnos: 8, costoReposicion: 120000 },
  { codigo: "HM-LLV-003", nombre: "Juego de Llaves de Tubo 8-32mm (14 piezas)", descripcion: "Llaves de tubo 12 puntos, cromadas", categoria: "Manuales", marca: "Bahco", modelo: "8010-14", ubicacion: "Carro de Herramientas #1", requiereCalibracion: false, vidaUtilAnos: 10, costoReposicion: 650000 },
  { codigo: "HM-DEST-001", nombre: "Juego de Destornilladores 6 piezas", descripcion: "Phillips y planos, puntas imantadas", categoria: "Manuales", marca: "Truper", modelo: "MDI-6", ubicacion: "Carro de Herramientas #1", requiereCalibracion: false, vidaUtilAnos: 8, costoReposicion: 85000 },
  { codigo: "HM-EXT-001", nombre: "Juego de Extractores de Fusibles y Terminales", descripcion: "12 piezas, para automotriz", categoria: "Manuales", marca: "LAUNCH", modelo: "EXT-12", ubicacion: "Carro de Herramientas #2", requiereCalibracion: false, vidaUtilAnos: 5, costoReposicion: 60000 },
  { codigo: "HM-MART-001", nombre: "Martillo de Machón 16oz", descripcion: "Cabeza forjada, mango de fibra de vidrio", categoria: "Manuales", marca: "Truper", modelo: "TR-65160", ubicacion: "Carro de Herramientas #2", requiereCalibracion: false, vidaUtilAnos: 10, costoReposicion: 80000 },
  { codigo: "HM-GRIPA-001", nombre: "Alicate Universal 8\"", descripcion: "Cromado, mango ergonómico", categoria: "Manuales", marca: "Bahco", modelo: "8701-200", ubicacion: "Carro de Herramientas #2", requiereCalibracion: false, vidaUtilAnos: 8, costoReposicion: 120000 },
  { codigo: "HM-GRIPA-002", nombre: "Alicate de Corte 6\"", descripcion: "Para cables y terminales", categoria: "Manuales", marca: "Bahco", modelo: "8621-150", ubicacion: "Carro de Herramientas #2", requiereCalibracion: false, vidaUtilAnos: 8, costoReposicion: 95000 },
  { codigo: "HM-PREC-001", nombre: "Juego de Socket 1/4\" y 1/2\" (40 piezas)", descripcion: "Impacto y mano, métricas", categoria: "Manuales", marca: "Bahco", modelo: "S49426-40", ubicacion: "Carro de Herramientas #3", requiereCalibracion: false, vidaUtilAnos: 10, costoReposicion: 850000 },
  { codigo: "HM-EXTR-001", nombre: "Extractor de Rulemanes 3 piezas", descripcion: "Para suspensión y tren delantero", categoria: "Manuales", marca: "OEM", modelo: "EXT-RUL-3", ubicacion: "Carro de Herramientas #3", requiereCalibracion: false, vidaUtilAnos: 8, costoReposicion: 250000 },

  // ═══════════════════════════════════════════════════════════════
  // HERRAMIENTAS ELÉCTRICAS
  // ═══════════════════════════════════════════════════════════════
  { codigo: "HE-IMP-001", nombre: "Llave de Impacto Neumática 1/2\"", descripcion: "Torque máximo 650 Nm, para rines", categoria: "Eléctricas", marca: "Ingersoll", modelo: "2135QXPA", ubicacion: "Bahía 1", requiereCalibracion: false, vidaUtilAnos: 7, costoReposicion: 1200000 },
  { codigo: "HE-IMP-002", nombre: "Llave de Impacto Eléctrica 1/2\"", descripcion: "Cordless, 20V, 400 Nm", categoria: "Eléctricas", marca: "LAUNCH", modelo: "IMP-20V", ubicacion: "Bahía 2", requiereCalibracion: false, vidaUtilAnos: 5, costoReposicion: 850000 },
  { codigo: "HE-TAL-001", nombre: "Taladro Percutor 1/2\"", descripcion: "750W, 2 velocidades, mandril 13mm", categoria: "Eléctricas", marca: "DeWalt", modelo: "DW505", ubicacion: "Carro de Herramientas #3", requiereCalibracion: false, vidaUtilAnos: 7, costoReposicion: 650000 },
  { codigo: "HE-AMO-001", nombre: "Amoladora Angular 4.5\"", descripcion: "850W, corte y pulido", categoria: "Eléctricas", marca: "Bosch", modelo: "GWS 8-115", ubicacion: "Carro de Herramientas #3", requiereCalibracion: false, vidaUtilAnos: 5, costoReposicion: 450000 },
  { codigo: "HE-NEU-001", nombre: "Llave Neumática 1/2\"", descripcion: "Para rines, 350 Nm", categoria: "Eléctricas", marca: "Matco", modelo: "MNW100", ubicacion: "Bahía 1", requiereCalibracion: false, vidaUtilAnos: 8, costoReposicion: 950000 },
  { codigo: "HE-SOP-001", nombre: "Gato Hidráulico 3 Toneladas", descripcion: "Piso, para elevación de vehículos", categoria: "Eléctricas", marca: "Bahco", modelo: "2703-03", ubicacion: "Almacén", requiereCalibracion: false, vidaUtilAnos: 10, costoReposicion: 550000 },
  { codigo: "HE-CMP-001", nombre: "Compresor de Aire 2HP 50L", descripcion: "Silencioso, para herramientas neumáticas", categoria: "Eléctricas", marca: "Schulz", modelo: "SRP 2050", ubicacion: "Sala de Máquinas", requiereCalibracion: false, vidaUtilAnos: 10, costoReposicion: 1800000 },

  // ═══════════════════════════════════════════════════════════════
  // EQUIPOS DE DIAGNÓSTICO
  // ═══════════════════════════════════════════════════════════════
  { codigo: "ED-SCN-001", nombre: "Scanner Automotriz LAUNCH X431 PRO S", descripcion: "Diagnóstico completo multimarcas, Bluetooth, Android", categoria: "Diagnóstico", marca: "LAUNCH", modelo: "X431 PRO S", ubicacion: "Estación de Diagnóstico", requiereCalibracion: false, vidaUtilAnos: 5, costoReposicion: 12000000 },
  { codigo: "ED-SCN-002", nombre: "Scanner LAUNCH CRP919E BT", descripcion: "Diagnóstico profesional Bluetooth, CANFD/DoIP", categoria: "Diagnóstico", marca: "LAUNCH", modelo: "CRP919E BT", ubicacion: "Estación de Diagnóstico", requiereCalibracion: false, vidaUtilAnos: 5, costoReposicion: 6899000 },
  { codigo: "ED-SCN-003", nombre: "Scanner THINKDIAG OBD2 Bluetooth", descripcion: "Multimarca, 100+ marcas, bidireccional", categoria: "Diagnóstico", marca: "THINKCAR", modelo: "THINKDIAG", ubicacion: "Estación de Diagnóstico", requiereCalibracion: false, vidaUtilAnos: 4, costoReposicion: 1355000 },
  { codigo: "ED-SCN-004", nombre: "Scanner LAUNCH CR 123i", descripcion: "Diagnóstico 4 sistemas, Android 8.1, táctil", categoria: "Diagnóstico", marca: "LAUNCH", modelo: "CRP123i", ubicacion: "Estación de Diagnóstico", requiereCalibracion: false, vidaUtilAnos: 4, costoReposicion: 1800000 },
  { codigo: "ED-SCN-005", nombre: "Scanner LAUNCH Creader 3001 OBDII", descripcion: "Lectura básica OBD2, multimarca", categoria: "Diagnóstico", marca: "LAUNCH", modelo: "Creader 3001", ubicacion: "Estación de Diagnóstico", requiereCalibracion: false, vidaUtilAnos: 3, costoReposicion: 399000 },
  { codigo: "ED-MULT-001", nombre: "Multímetro Digital Fluke 115", descripcion: "True RMS, CAT III 600V", categoria: "Diagnóstico", marca: "Fluke", modelo: "115", ubicacion: "Estación de Diagnóstico", requiereCalibracion: true, vidaUtilAnos: 10, costoReposicion: 1200000 },
  { codigo: "ED-MULT-002", nombre: "Multímetro Automotriz UNI-T UT61E", descripcion: "20000 cuentas, USB", categoria: "Diagnóstico", marca: "UNI-T", modelo: "UT61E", ubicacion: "Estación de Diagnóstico", requiereCalibracion: true, vidaUtilAnos: 8, costoReposicion: 650000 },
  { codigo: "ED-OSC-001", nombre: "Osciloscopio Automotriz Hantek 1008C", descripcion: "8 canales, 24MHz, para sensores", categoria: "Diagnóstico", marca: "Hantek", modelo: "1008C", ubicacion: "Estación de Diagnóstico", requiereCalibracion: true, vidaUtilAnos: 8, costoReposicion: 1500000 },

  // ═══════════════════════════════════════════════════════════════
  // EQUIPOS DE TALLER
  // ═══════════════════════════════════════════════════════════════
  { codigo: "ET-ELEV-001", nombre: "Elevador Hidráulico 2 Columnas 4T", descripcion: "Electrohidráulico, para autos y SUVs", categoria: "Taller", marca: "LAUNCH", modelo: "TL-2P04", ubicacion: "Bahía 1", requiereCalibracion: true, vidaUtilAnos: 15, costoReposicion: 8500000 },
  { codigo: "ET-ELEV-002", nombre: "Elevador Hidráulico 2 Columnas 4T", descripcion: "Electrohidráulico, Bahía 2", categoria: "Taller", marca: "LAUNCH", modelo: "TL-2P04", ubicacion: "Bahía 2", requiereCalibracion: true, vidaUtilAnos: 15, costoReposicion: 8500000 },
  { codigo: "ET-ELEV-003", nombre: "Elevador Tijera 2.5T", descripcion: "Para service rápido, compacto", categoria: "Taller", marca: "LAUNCH", modelo: "TL-250", ubicacion: "Bahía 3", requiereCalibracion: true, vidaUtilAnos: 12, costoReposicion: 4500000 },
  { codigo: "ET-ALIN-001", nombre: "Alineadora 3D LAUNCH X831W", descripcion: "Alineación y caída de dirección", categoria: "Taller", marca: "LAUNCH", modelo: "X831W", ubicacion: "Bahía 4", requiereCalibracion: true, vidaUtilAnos: 10, costoReposicion: 15000000 },
  { codigo: "ET-BALA-001", nombre: "Balanceadora de Llantas LAUNCH TWC02", descripcion: "Automática, con impresora", categoria: "Taller", marca: "LAUNCH", modelo: "TWC02", ubicacion: "Bahía 4", requiereCalibracion: true, vidaUtilAnos: 10, costoReposicion: 8000000 },
  { codigo: "ET-DESM-001", nombre: "Desmontadora de Llantas LAUNCH TWR01", descripcion: "Semiautomática, para llantas 10-24\"", categoria: "Taller", marca: "LAUNCH", modelo: "TWR01", ubicacion: "Bahía 4", requiereCalibracion: false, vidaUtilAnos: 12, costoReposicion: 6500000 },
  { codigo: "ET-COMP-001", nombre: "Compresor Industrial 5HP 200L", descripcion: "Para toda la planta neumática", categoria: "Taller", marca: "Schulz", modelo: "SRP 50200", ubicacion: "Sala de Máquinas", requiereCalibracion: false, vidaUtilAnos: 15, costoReposicion: 3500000 },
  { codigo: "ET-LIM-001", nombre: "Lavador de Inyectores por Ultrasonido", descripcion: "6 cilindros, para nafteros y diesel", categoria: "Taller", marca: "LAUNCH", modelo: "CN-601", ubicacion: "Bahía 3", requiereCalibracion: false, vidaUtilAnos: 8, costoReposicion: 2500000 },
  { codigo: "ET-BAN-001", nombre: "Banco de Prueba y Limpieza de Inyectores", descripcion: "Common rail, para diesel", categoria: "Taller", marca: "LAUNCH", modelo: "CRIN-01", ubicacion: "Bahía 3", requiereCalibracion: true, vidaUtilAnos: 8, costoReposicion: 4000000 },
  { codigo: "ET-CAB-001", nombre: "Cabina de Pintura Automotriz", descripcion: "Con extracción, filtros HEPA", categoria: "Taller", marca: "Global", modelo: "CAB-PAINT-01", ubicacion: "Zona de Pintura", requiereCalibracion: false, vidaUtilAnos: 20, costoReposicion: 25000000 },

  // ═══════════════════════════════════════════════════════════════
  // HERRAMIENTAS DE PRECISIÓN
  // ═══════════════════════════════════════════════════════════════
  { codigo: "HP-TORQ-001", nombre: "Torquímetro 1/2\" 40-200 Nm", descripcion: "Calibrado, para tensor de correa y bulones", categoria: "Precisión", marca: "Bahco", modelo: "6411-1A200", ubicacion: "Carro de Herramientas #4", requiereCalibracion: true, vidaUtilAnos: 10, costoReposicion: 850000 },
  { codigo: "HP-TORQ-002", nombre: "Torquímetro 1/4\" 5-25 Nm", descripcion: "Para componentes delicados", categoria: "Precisión", marca: "Bahco", modelo: "6411-1A25", ubicacion: "Carro de Herramientas #4", requiereCalibracion: true, vidaUtilAnos: 10, costoReposicion: 650000 },
  { codigo: "HP-MIC-001", nombre: "Micrómetro Externo 0-25mm", descripcion: "Precisión 0.01mm, para medición de discos", categoria: "Precisión", marca: "Mitutoyo", modelo: "103-135", ubicacion: "Carro de Herramientas #4", requiereCalibracion: true, vidaUtilAnos: 15, costoReposicion: 550000 },
  { codigo: "HP-REL-001", nombre: "Reloj Comparador 0-10mm", descripcion: "Para medición de ovalidad y radialidad", categoria: "Precisión", marca: "Mitutoyo", modelo: "513-404", ubicacion: "Carro de Herramientas #4", requiereCalibracion: true, vidaUtilAnos: 15, costoReposicion: 450000 },
  { codigo: "HP-CAL-001", nombre: "Calibrador Vernier 0-150mm", descripcion: "Precisión 0.02mm", categoria: "Precisión", marca: "Mitutoyo", modelo: "530-312", ubicacion: "Carro de Herramientas #4", requiereCalibracion: true, vidaUtilAnos: 15, costoReposicion: 350000 },

  // ═══════════════════════════════════════════════════════════════
  // SEGURIDAD Y PROTECCIÓN
  // ═══════════════════════════════════════════════════════════════
  { codigo: "SG-EXT-001", nombre: "Extintor ABC 10 lbs", descripcion: "Para fuego clase A, B, C", categoria: "Seguridad", marca: "CIS", modelo: "ABC-10", ubicacion: "Pared Bahía 1", requiereCalibracion: true, vidaUtilAnos: 5, costoReposicion: 180000 },
  { codigo: "SG-GUA-001", nombre: "Guantes Nitrilo (caja x100)", descripcion: "Resistentes a aceites y químicos", categoria: "Seguridad", marca: "3M", modelo: "N3000", ubicacion: "Almacén de Seguridad", requiereCalibracion: false, vidaUtilAnos: null, costoReposicion: 120000 },
  { codigo: "SG-GAF-001", nombre: "Gafas de Seguridad (12 unidades)", descripcion: "Antirrayones, lentes claros", categoria: "Seguridad", marca: "3M", modelo: "V82001", ubicacion: "Almacén de Seguridad", requiereCalibracion: false, vidaUtilAnos: null, costoReposicion: 85000 },
  { codigo: "SG-CAS-001", nombre: "Cascos de Seguridad (6 unidades)", descripcion: "Para zona de elevador", categoria: "Seguridad", marca: "3M", modelo: "H-700", ubicacion: "Almacén de Seguridad", requiereCalibracion: false, vidaUtilAnos: 3, costoReposicion: 250000 },
  { codigo: "SG-MAR-001", nombre: "Mascarilla con Filtro para Pintura", descripcion: "Respirador semifacial, filtros químicos", categoria: "Seguridad", marca: "3M", modelo: "6200+6001", ubicacion: "Almacén de Seguridad", requiereCalibracion: false, vidaUtilAnos: null, costoReposicion: 180000 },

  // ═══════════════════════════════════════════════════════════════
  // EQUIPOS ESPECIALIZADOS (HV/EV)
  // ═══════════════════════════════════════════════════════════════
  { codigo: "EV-MULT-001", nombre: "Multímetro CAT IV 1000V para HV", descripcion: "Para vehículos eléctricos e híbridos", categoria: "EV/HV", marca: "Fluke", modelo: "87V", ubicacion: "Estación HV", requiereCalibracion: true, vidaUtilAnos: 10, costoReposicion: 2200000 },
  { codigo: "EV-GUA-001", nombre: "Guantes Dielectricos Clase 0", descripcion: "1000V AC, para trabajo HV", categoria: "EV/HV", marca: "Milwaukee", modelo: "48-22-3078", ubicacion: "Estación HV", requiereCalibracion: false, vidaUtilAnos: 1, costoReposicion: 450000 },
  { codigo: "EV-INS-001", nombre: "Aislador Dieléctrico 1200x800mm", descripcion: "Para trabajo sobre baterías HV", categoria: "EV/HV", marca: "Custom", modelo: "AIS-1200", ubicacion: "Estación HV", requiereCalibracion: false, vidaUtilAnos: 10, costoReposicion: 350000 },
  { codigo: "EV-CUT-001", nombre: "Cortador de Circuito HV (Interlock)", descripcion: "Para desconexión de emergencia", categoria: "EV/HV", marca: "OEM", modelo: "HV-CUT-01", ubicacion: "Estación HV", requiereCalibracion: false, vidaUtilAnos: 5, costoReposicion: 250000 },
];

async function main() {
  console.log(`🌱 Seeding ${TOOLS.length} tools & equipment...\n`);

  const existing = await db()
    .select({ codigo: herramientas.codigo })
    .from(herramientas);
  const existingCodes = new Set(existing.map((t) => t.codigo));

  let count = 0;
  let skipped = 0;
  const byCategory: Record<string, number> = {};

  for (const t of TOOLS) {
    if (existingCodes.has(t.codigo)) {
      skipped++;
      continue;
    }
    await db().insert(herramientas).values({
      codigo: t.codigo,
      nombre: t.nombre,
      descripcion: t.descripcion,
      categoria: t.categoria,
      marca: t.marca,
      modelo: t.modelo,
      ubicacion: t.ubicacion,
      requiereCalibracion: t.requiereCalibracion,
      tieneSerialIndividual: true,
      vidaUtilAnos: t.vidaUtilAnos,
      metodoDepreciacion: t.vidaUtilAnos ? "LINEA_RECTA" : "SIN_DEPRECIAR",
      costoReposicion: String(t.costoReposicion),
      activo: true,
    });
    count++;
    byCategory[t.categoria] = (byCategory[t.categoria] || 0) + 1;
  }

  console.log(`   ✅  Tools inserted: ${count} (${skipped} already existed)`);
  console.log(`   📊 By category:`);
  for (const [cat, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`       ${cat}: ${n}`);
  }
  console.log(`\n🌱 Tools & equipment seeding complete!`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
