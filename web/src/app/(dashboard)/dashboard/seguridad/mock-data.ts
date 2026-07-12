import type { UIMappedAuditEntry } from "@/lib/data-service";

export interface AuditRecord extends UIMappedAuditEntry {}

const acciones = ["CREAR", "MODIFICAR", "ANULAR", "PAGAR", "EMITIR"] as const;
const entidades = ["OT", "FACTURA", "ASIENTO", "PAGO", "REPUESTO", "USUARIO", "CLIENTE"] as const;

export function getMockAudit(): AuditRecord[] {
  return Array.from({ length: 35 }, (_, i) => {
    const accion = acciones[i % acciones.length];
    const entidad = entidades[i % entidades.length];
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const descMap: Record<string, string> = {
      CREAR: `Creación de ${entidad.toLowerCase()} #${String(100 + i).padStart(3, "0")}`,
      MODIFICAR: `Actualización de datos de ${entidad.toLowerCase()}`,
      ANULAR: `Anulación de ${entidad.toLowerCase()} #${String(100 + i).padStart(3, "0")}`,
      PAGAR: `Pago registrado para ${entidad.toLowerCase()}`,
      EMITIR: `Emisión de ${entidad.toLowerCase()} electrónica`,
    };

    return {
      id: `aud-${String(i + 1).padStart(4, "0")}`,
      usuario: ["Juan Jara", "María López", "Carlos M.", "Ana R.", "Sistema"][i % 5],
      accion,
      entidad,
      entidadId: `${entidad.slice(0, 3)}-${String(100 + i).padStart(3, "0")}`,
      descripcion: descMap[accion] ?? "Operación registrada",
      valorAnterior: i % 5 === 0 ? "Pendiente" : null,
      valorNuevo: i % 5 === 0 ? "Aprobado" : null,
      createdAt: date.toLocaleDateString("es-PY") + " " + `${8 + (i % 8)}:${String((i * 13) % 60).padStart(2, "0")}`,
    };
  });
}
