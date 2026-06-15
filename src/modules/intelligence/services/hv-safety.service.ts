/**
 * High-Voltage (HV) Safety Protocol Generator.
 *
 * Generates step-by-step safety protocols for mechanics working on
 * Battery Electric Vehicles (BEV) and Hybrid Electric Vehicles (HEV).
 *
 * Complies with:
 *   - Ley 1034/83 (Paraguay) — safety regulations for electrical work
 *   - ISO 6469 (Electric vehicles — safety specifications)
 *   - NFPA 70E (Standard for Electrical Safety in the Workplace)
 *   - IEC 60900 (Live working — hand tools for HV)
 *
 * RAM discipline: generates protocol as a plain object (~2KB per protocol).
 * No network calls — protocol is generated from built-in templates.
 *
 * @module intelligence/services/hv-safety
 */

import type {
  HvSafetyProtocol,
  HvSafetyStep,
  PpeItem,
} from "../types.js";

// ─── HV Voltage Tiers ────────────────────────────

/**
 * Voltage classification for PPE selection.
 */
type VoltageTier = "low" | "medium" | "high" | "ultra";

function classifyVoltage(voltage: number): VoltageTier {
  if (voltage < 60) return "low";
  if (voltage < 400) return "medium"; // Most HEVs (200-300V)
  if (voltage < 800) return "high";   // Most BEVs (400-800V)
  return "ultra";                      // New-gen 800V+ systems
}

function getGloveClass(tier: VoltageTier): string {
  switch (tier) {
    case "low": return "Clase 00 (máx. 500V AC / 750V DC)";
    case "medium": return "Clase 0 (máx. 1000V AC / 1500V DC)";
    case "high": return "Clase 1 (máx. 7500V AC / 11250V DC)";
    case "ultra": return "Clase 2 (máx. 17000V AC / 25500V DC)";
  }
}

// ─── Protocol Generation ─────────────────────────

/**
 * Generates a complete HV safety disconnect protocol.
 *
 * @param request - Vehicle and battery parameters
 * @returns Complete HV safety protocol
 */
export async function generateHvProtocol(
  request: {
    brand: string;
    model: string;
    year?: number | null;
    plate?: string | null;
    hvBatteryVoltage: number;
    batteryType?: string | null;
  },
): Promise<HvSafetyProtocol> {
  const {
    brand,
    model,
    year,
    plate,
    hvBatteryVoltage,
    batteryType,
  } = request;

  const tier = classifyVoltage(hvBatteryVoltage);
  const gloveClass = getGloveClass(tier);

  // ── Risk Assessment ──
  const riskAssessment = generateRiskAssessment(brand, model, hvBatteryVoltage, tier);

  // ── PPE ──
  const ppe: PpeItem[] = [
    {
      item: `Guantes aislantes ${gloveClass}`,
      standard: "IEC 60900 / ASTM D120",
      checkProcedure: `Inspeccionar visualmente antes de usar. Realizar prueba de inflado ` +
        `(llenar de aire y verificar fugas). Fecha de certificación vigente.`,
    },
    {
      item: "Overoles de algodón antiestático (sin metal)",
      standard: "IEC 61482-2",
      checkProcedure: "Verificar ausencia de partes metálicas expuestas (cierres, botones).",
    },
    {
      item: "Protector facial (pantalla de policarbonato)",
      standard: "ANSI Z87.1",
      checkProcedure: "Inspeccionar por rayaduras o daños que reduzcan visibilidad.",
    },
    {
      item: "Calzado aislante (sin metal, suela de goma)",
      standard: "IEC 61340-5-1 / ASTM F2413",
      checkProcedure: "Verificar suela en buen estado, sin clavos ni elementos conductores.",
    },
    {
      item: "Herramientas aisladas (categoría Vde / IEC 60900)",
      standard: "IEC 60900",
      checkProcedure: "Verificar marcación Vde en cada herramienta. No usar herramientas estándar.",
    },
    {
      item: "Multímetro CAT III 1000V (con puntas aisladas)",
      standard: "IEC 61010 CAT III",
      checkProcedure: "Verificar funcionamiento previo en rango DC. Puntas con protección.",
    },
    {
      item: "Señalización: cono de seguridad + cartel 'PELIGRO ALTA TENSIÓN'",
      standard: "NFPA 70E / Ley 1034/83",
      checkProcedure: "Ubicar en perímetro de seguridad de 3m alrededor del vehículo.",
    },
  ];

  // Add specific PPE for ultra-high voltage
  if (tier === "ultra") {
    ppe.push({
      item: "Traje de protección de arco eléctrico (cal/cm² según cálculo)",
      standard: "NFPA 70E / ASTM F1959",
      checkProcedure: "Verificar clasificación cal/cm² adecuada para tensión de trabajo.",
    });
  }

  // ── Disconnect Procedure ──
  const disconnectProcedure = generateDisconnectProcedure(
    tier,
    hvBatteryVoltage,
    batteryType ?? null,
  );

  // ── Voltage Verification ──
  const voltageVerification = generateVoltageVerification(tier, hvBatteryVoltage);

  // ── Wait Time ──
  const waitTimeMinutes = tier === "ultra" ? 15 : tier === "high" ? 10 : tier === "medium" ? 5 : 0;

  // ── Emergency Contacts ──
  const emergencyContacts = [
    "Emergencias Médicas: *Sistema 911 (Bomberos/Ambulancia)*",
    "Centro de Información Toxicológica: *(021) 222 333* (Paraguay)",
    "Fabricante del vehículo: *Asistencia técnica oficial*",
    "Proveedor de batería HV: *Número de servicio de emergencia en documentación del vehículo*",
  ];

  return {
    vehicle: {
      brand,
      model,
      year: year ?? null,
      plate: plate ?? null,
      hvBatteryVoltage,
      batteryType: batteryType ?? null,
    },
    riskAssessment,
    ppe,
    disconnectProcedure,
    waitTimeMinutes,
    voltageVerification,
    emergencyContacts,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Private Helpers ─────────────────────────────

function generateRiskAssessment(
  brand: string,
  model: string,
  voltage: number,
  tier: VoltageTier,
): string {
  const riskLevel = tier === "low" ? "Bajo" :
    tier === "medium" ? "Medio" :
    tier === "high" ? "Alto" : "MUY ALTO";

  return `⚠️ **RIESGO ${riskLevel.toUpperCase()}** — Vehículo: ${brand} ${model}. ` +
    `Sistema de tracción de ${voltage}V DC (${tier === "low" ? "baja" : tier === "medium" ? "media" : tier === "high" ? "alta" : "ultra-alta"} tensión). ` +
    `Riesgos asociados: descarga eléctrica letal, arco eléctrico, cortocircuito, incendio de batería de litio (thermal runaway). ` +
    `SOLO personal certificado en seguridad HV con formación específica en el modelo del vehículo debe realizar estos procedimientos. ` +
    `Trabajo siempre en equipo de 2 personas (mínimo).`;
}

function generateDisconnectProcedure(
  tier: VoltageTier,
  voltage: number,
  _batteryType: string | null,
): HvSafetyStep[] {
  const steps: HvSafetyStep[] = [];

  steps.push({
    order: 1,
    action: "Estacionar vehículo en zona designada para trabajos HV",
    warning: "Zona debe tener piso aislante, ventilación (gases de batería) y extintor Clase C / D (fuegos eléctricos).",
    verification: "Verificar señalización de perímetro de seguridad colocada.",
  });

  steps.push({
    order: 2,
    action: "Apagar vehículo completamente y retirar llave / tarjeta de proximidad",
    warning: "En HEV, el motor de combustión puede encenderse automáticamente si la batería HV está baja.",
    verification: "Verificar que el tablero está apagado y el indicador READY/EV está OFF.",
  });

  steps.push({
    order: 3,
    action: "Esperar tiempo de descarga de capacitores del inversor",
    warning: "Los capacitores del inversor/convertidor DC-DC pueden retener carga letal hasta 10 minutos.",
    verification: `Esperar mínimo ${tier === "ultra" ? "15" : tier === "high" ? "10" : tier === "medium" ? "5" : "1"} minutos.`,
  });

  steps.push({
    order: 4,
    action: "Usar EPP completo (guantes, protector facial, overol antiestático) antes de tocar cualquier componente HV",
    warning: "Guantes aislantes deben ser probados (inflado) antes de cada uso. NO usar guantes húmedos o dañados.",
    verification: "Autoinspección cruzada: cada operario verifica el EPP del otro.",
  });

  steps.push({
    order: 5,
    action: "Medir tensión en bornes principales de la batería HV (conector de servicio)",
    warning: "Usar multímetro CAT III en modo DC. Puntas en contacto firme. No tocar puntas metálicas.",
    verification: `Lectura esperada: ~${voltage}V DC. Registrar valor.`,
  });

  steps.push({
    order: 6,
    action: "Desconectar conector de servicio (Service Disconnect) de la batería HV",
    warning: "Algunos conectores requieren herramienta especial. NO forzar. Si hay resistencia, revisar procedimiento del fabricante.",
    verification: "Verificar que el conector está físicamente separado y asegurado.",
  });

  if (tier !== "low") {
    steps.push({
      order: 7,
      action: "Esperar 5 minutos adicionales tras el service disconnect",
      warning: "Los capacitores internos del pack pueden mantener carga residual.",
      verification: "Temporizar 5 minutos.",
    });

    steps.push({
      order: 8,
      action: "Medir tensión en bornes de entrada del inversor (lado DC) para confirmar 0V",
      warning: "Si hay tensión residual > 5V DC, hay una falla en el circuito de descarga. No continuar hasta resolver.",
      verification: "Lectura debe ser < 5V DC. Registrar valor.",
    });

    steps.push({
      order: 9,
      action: "Medir tensión entre cada borne HV y chasis (tierra) para confirmar 0V",
      warning: "Tensión entre borne HV y chasis indica falla de aislamiento (fuga a masa).",
      verification: "Lectura debe ser < 5V DC en ambas mediciones.",
    });

    steps.push({
      order: 10,
      action: "Colocar señalización de 'BLOQUEO / TAG OUT' (LOTO) en la llave del vehículo y conector de servicio",
      warning: "Solo el técnico asignado puede retirar el candado. Registrar en hoja de trabajo.",
      verification: "Verificar que candado y etiqueta están colocados correctamente.",
    });
  }

  steps.push({
    order: steps.length + 1,
    action: "Registrar todas las mediciones en la orden de trabajo",
    warning: "Los registros de voltaje son evidencia legal de cumplimiento del protocolo de seguridad.",
    verification: "Firmar y fechar en la orden de trabajo.",
  });

  return steps;
}

function generateVoltageVerification(
  tier: VoltageTier,
  voltage: number,
): string {
  const steps = [
    `1. **Medición 1** — Entre bornes positivo (+) y negativo (-) del conector de servicio de la batería HV. ` +
      `Esperado: ~${voltage}V DC (antes de desconexión).`,
    `2. **Medición 2** — Entre positivo (+) y chasis (punto de tierra certificado). Esperado: < 5V DC.`,
    `3. **Medición 3** — Entre negativo (-) y chasis (punto de tierra certificado). Esperado: < 5V DC.`,
    `4. **Medición 4** — Post-service disconnect: repetir mediciones 1-3. Todas deben ser < 5V DC.`,
    `5. **Registro** — Anotar todas las lecturas en el formulario de seguridad HV.`,
  ];

  if (tier === "high" || tier === "ultra") {
    steps.push(
      `6. **Medición de aislamiento** (si se sospecha fuga): usar megóhmetro a 500V/1000V. ` +
        `Aislamiento mínimo aceptable: 500Ω/V (ISO 6469).`,
    );
  }

  return steps.join("\n");
}
