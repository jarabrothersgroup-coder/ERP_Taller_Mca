import { getDtcDefinition } from "../utils/dtc-database.js";

const NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin";

export interface VehicleDataInput {
  vin?: string;
  brand: string;
  model: string;
  year: number;
}

export interface SafetyProtocol {
  isHighVoltage: boolean;
  requiredSteps: string[];
  alertLevel: "GREEN" | "ORANGE" | "RED";
}

export async function analyzeVehicleSafety(input: VehicleDataInput): Promise<SafetyProtocol> {
  let fuelType = "CONVENCIONAL";

  if (input.vin && input.vin.length === 17) {
    try {
      const response = await fetch(`${NHTSA_URL}/${input.vin}?format=json`, {
        signal: AbortSignal.timeout(3000),
      });
      const data: any = await response.json();
      const results: any[] = data.Results ?? [];
      const fuelTypeField = results.find(
        (item: any) => item.Variable === "Fuel Type - Primary",
      );
      if (fuelTypeField?.Value) {
        fuelType = fuelTypeField.Value.toUpperCase();
      }
    } catch {
      fuelType = "UNKNOWN";
    }
  }

  const isElectricOrHybrid =
    fuelType.includes("ELECTRIC") ||
    fuelType.includes("HYBRID") ||
    input.brand.toUpperCase() === "BYD" ||
    (input.brand.toUpperCase() === "TOYOTA" &&
      input.model.toUpperCase().includes("HYBRID"));

  if (isElectricOrHybrid) {
    return {
      isHighVoltage: true,
      alertLevel: "RED",
      requiredSteps: [
        "EQUIPAMIENTO: Uso obligatorio de guantes dieléctricos Clase 0 (hasta 1000V) y protector facial.",
        "DESCONEXIÓN: Localizar y extraer el Conector de Servicio de Alta Tensión (Service Plug).",
        "VERIFICACIÓN: Esperar 10 minutos para descarga de condensadores y medir ausencia de tensión (<60V DC) en bornes del inversor.",
        "BLOQUEO: Firmar digitalmente el acta de Lockout/Tagout en el ERP para habilitar las tareas del mecánico.",
      ],
    };
  }

  return {
    isHighVoltage: false,
    alertLevel: "GREEN",
    requiredSteps: [
      "Inspección visual de fluidos estándar.",
      "Verificación de batería de accesorios de 12V.",
    ],
  };
}

export function parseDtcError(dtcCode: string): { severity: string; action: string } {
  const def = getDtcDefinition(dtcCode);

  if (dtcCode === "P0AA6") {
    return {
      severity: "CRÍTICA / PELIGRO",
      action:
        "Fuga de aislamiento detectada en el sistema de batería de alta tensión. Inspeccionar circuito del inversor antes de energizar.",
    };
  }

  if (def) {
    return {
      severity: def.severity === "Emergency" ? "CRÍTICA" : "ESTÁNDAR",
      action: def.suggestions[0] ?? "Efectuar diagnóstico guiado por código OBD-II genérico.",
    };
  }

  return {
    severity: "ESTÁNDAR",
    action: "Efectuar diagnóstico guiado por código OBD-II genérico.",
  };
}
