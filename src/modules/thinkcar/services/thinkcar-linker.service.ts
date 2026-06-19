import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../../shared/database/drizzle.js";
import { vehiculos } from "../../workshop/schema/vehiculos.js";
import { ordenesTrabajo } from "../../workshop/schema/ordenes-trabajo.js";
import { thinkcarImports } from "../schema/index.js";
import type { ThinkcarImport } from "../schema/index.js";
import type { LinkingResult, ParsedReport } from "../types.js";

const ACTIVE_STATUSES = ["Presupuestado", "Aprobado", "En_Proceso"];

export async function findVehicleByVin(
  vin: string,
): Promise<{ id: string; clientId: string } | null> {
  const [vehicle] = await db()
    .select({ id: vehiculos.id, clientId: vehiculos.clientId })
    .from(vehiculos)
    .where(eq(vehiculos.vin, vin))
    .limit(1);
  return vehicle ?? null;
}

export async function findVehicleByPlate(
  plate: string,
): Promise<{ id: string; clientId: string } | null> {
  const [vehicle] = await db()
    .select({ id: vehiculos.id, clientId: vehiculos.clientId })
    .from(vehiculos)
    .where(eq(vehiculos.plate, plate))
    .limit(1);
  return vehicle ?? null;
}

export async function findVehicleByBrandModel(
  brand: string,
  model: string,
): Promise<{ id: string; clientId: string } | null> {
  const [vehicle] = await db()
    .select({ id: vehiculos.id, clientId: vehiculos.clientId })
    .from(vehiculos)
    .where(
      and(
        sql`LOWER(${vehiculos.brand}) = LOWER(${brand})`,
        sql`LOWER(${vehiculos.model}) LIKE LOWER(${'%' + model + '%'})`,
      ),
    )
    .limit(1);
  return vehicle ?? null;
}

export async function findActiveWorkOrder(
  vehicleId: string,
): Promise<{ id: string; clientId: string } | null> {
  const [orden] = await db()
    .select({ id: ordenesTrabajo.id, clientId: ordenesTrabajo.clientId })
    .from(ordenesTrabajo)
    .where(
      and(
        eq(ordenesTrabajo.vehicleId, vehicleId),
        inArray(ordenesTrabajo.status, ACTIVE_STATUSES as any),
      ),
    )
    .orderBy(ordenesTrabajo.createdAt)
    .limit(1);
  return orden ?? null;
}

export async function linkReportToVehicle(
  importId: string,
  vehicleId: string,
  clientId: string | null,
): Promise<void> {
  const setData: Record<string, any> = {
    vehicleId,
    status: "linked",
  };
  if (clientId) setData.clientId = clientId;

  await db()
    .update(thinkcarImports)
    .set({ ...setData, updatedAt: new Date() })
    .where(eq(thinkcarImports.id, importId));
}

export async function linkReportToWorkOrder(
  importId: string,
  ordenId: string,
  clientId: string | null,
): Promise<void> {
  const setData: Record<string, any> = {
    ordenTrabajoId: ordenId,
    status: "linked",
  };
  if (clientId) setData.clientId = clientId;

  await db()
    .update(thinkcarImports)
    .set({ ...setData, updatedAt: new Date() })
    .where(eq(thinkcarImports.id, importId));
}

export async function updateVehicleDtcs(
  vehicleId: string,
  dtcCodes: string[],
): Promise<void> {
  const [current] = await db()
    .select({ dtcCodes: vehiculos.dtcCodes })
    .from(vehiculos)
    .where(eq(vehiculos.id, vehicleId))
    .limit(1);
  if (!current) return;

  const merged = Array.from(
    new Set([...(current.dtcCodes ?? []), ...dtcCodes]),
  );
  await db()
    .update(vehiculos)
    .set({ dtcCodes: merged, updatedAt: new Date() })
    .where(eq(vehiculos.id, vehicleId));
}

export async function updateOrdenDtcs(
  ordenId: string,
  dtcCodes: string[],
  diagnosisNote?: string,
): Promise<void> {
  const [current] = await db()
    .select({ dtcCodes: ordenesTrabajo.dtcCodes, diagnosis: ordenesTrabajo.diagnosis })
    .from(ordenesTrabajo)
    .where(eq(ordenesTrabajo.id, ordenId))
    .limit(1);
  if (!current) return;

  const merged = Array.from(
    new Set([...(current.dtcCodes ?? []), ...dtcCodes]),
  );
  const updateData: Record<string, any> = {
    dtcCodes: merged,
    updatedAt: new Date(),
  };
  if (diagnosisNote && !current.diagnosis) {
    updateData.diagnosis = diagnosisNote;
  }

  await db()
    .update(ordenesTrabajo)
    .set(updateData)
    .where(eq(ordenesTrabajo.id, ordenId));
}

export async function markManualReview(
  importId: string,
  reason: string,
): Promise<void> {
  await db()
    .update(thinkcarImports)
    .set({
      status: "manual_review",
      errorMessage: reason,
      pendingAssignment: true,
      updatedAt: new Date(),
    })
    .where(eq(thinkcarImports.id, importId));
}

const MILEAGE_DIFF_THRESHOLD = 500;

export async function compareAndAlertMileage(
  vehicleId: string,
  scannedOdometer: number | null,
): Promise<string | null> {
  if (!scannedOdometer || scannedOdometer <= 0) return null;

  const [vehicle] = await db()
    .select({ kilometraje: vehiculos.kilometraje })
    .from(vehiculos)
    .where(eq(vehiculos.id, vehicleId))
    .limit(1);

  if (!vehicle) return null;

  const currentKm = vehicle.kilometraje;
  if (!currentKm || currentKm <= 0) {
    await db()
      .update(vehiculos)
      .set({ kilometraje: scannedOdometer, updatedAt: new Date() })
      .where(eq(vehiculos.id, vehicleId));
    return null;
  }

  const diff = Math.abs(scannedOdometer - currentKm);

  if (scannedOdometer > currentKm) {
    await db()
      .update(vehiculos)
      .set({ kilometraje: scannedOdometer, updatedAt: new Date() })
      .where(eq(vehiculos.id, vehicleId));
  }

  if (diff > MILEAGE_DIFF_THRESHOLD) {
    return `Alerta: Kilometraje verificado por OBD2 — Diferencia de ${diff.toLocaleString("es-PY")} km entre el registrado (${currentKm.toLocaleString("es-PY")} km) y el escaneado (${scannedOdometer.toLocaleString("es-PY")} km)`;
  }

  return null;
}

export async function smartLink(
  importRecord: ThinkcarImport,
  parsed?: ParsedReport,
): Promise<LinkingResult> {
  const { vin, brand, model, dtcCodes } = importRecord;
  const odometer = parsed?.odometer ?? null;

  if (vin && vin.length >= 10) {
    const vehicle = await findVehicleByVin(vin);
    if (vehicle) {
      await linkReportToVehicle(importRecord.id, vehicle.id, vehicle.clientId);
      await updateVehicleDtcs(vehicle.id, dtcCodes ?? []);

      const mileageAlert = await compareAndAlertMileage(vehicle.id, odometer);

      const orden = await findActiveWorkOrder(vehicle.id);
      if (orden) {
        await linkReportToWorkOrder(
          importRecord.id,
          orden.id,
          orden.clientId,
        );
        await updateOrdenDtcs(
          orden.id,
          dtcCodes ?? [],
          `Diagnóstico Thinkcar importado automáticamente el ${new Date().toISOString().split("T")[0]}`,
        );
        return {
          status: "linked",
          vehicleId: vehicle.id,
          ordenTrabajoId: orden.id,
          clientId: vehicle.clientId,
          message: `Vinculado al vehículo ${vin} y a la OT activa #${orden.id.slice(0, 8)}`,
          mileageAlert,
        };
      }

      return {
        status: "linked",
        vehicleId: vehicle.id,
        ordenTrabajoId: null,
        clientId: vehicle.clientId,
        message: `Vinculado al vehículo ${vin}. No se encontró OT activa.`,
        mileageAlert,
      };
    }
  }

  if (brand && model) {
    const vehicle = await findVehicleByBrandModel(brand, model);
    if (vehicle) {
      await linkReportToVehicle(importRecord.id, vehicle.id, vehicle.clientId);
      await updateVehicleDtcs(vehicle.id, dtcCodes ?? []);

      const mileageAlert = await compareAndAlertMileage(vehicle.id, odometer);

      return {
        status: "linked",
        vehicleId: vehicle.id,
        ordenTrabajoId: null,
        clientId: vehicle.clientId,
        message: `Vinculado por marca/modelo ${brand} ${model}. Verificar VIN manualmente.`,
        mileageAlert,
      };
    }
  }

  await markManualReview(
    importRecord.id,
    !vin
      ? "VIN vacío o no disponible en el reporte"
      : `Vehículo con VIN ${vin} no encontrado en el sistema`,
  );

  return {
    status: "manual_review",
    vehicleId: null,
    ordenTrabajoId: null,
    clientId: null,
    message: `No se pudo vincular automáticamente. En cola de revisión manual.`,
  };
}
