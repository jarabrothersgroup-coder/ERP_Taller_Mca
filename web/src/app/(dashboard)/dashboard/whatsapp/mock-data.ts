import type { UIMappedWhatsAppMessage } from "@/lib/data-service";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WAMessageRecord extends UIMappedWhatsAppMessage {
  // WhatsApp message record UI type (extends UIMappedWhatsAppMessage)
}

const nombresClientes = [
  "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
  "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez",
];

const plantillas = ["RECEPCIONADO", "PRESUPUESTADO", "EN_REPARACION", "LISTO_ENTREGA", "FINALIZADO_RETIRADO", "CUSTOM"];

export function getMockMessages(): WAMessageRecord[] {
  return Array.from({ length: 24 }, (_, i) => {
    const statuses: WAMessageRecord["status"][] = ["SENT", "SENT", "SENT", "FAILED", "SENT", "PENDING", "SENT", "SENT"];
    const daysAgo = Math.floor(Math.random() * 14);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const template = plantillas[i % plantillas.length];
    const hasAttach = template === "PRESUPUESTADO" && i % 3 === 0;

    return {
      id: `wa-${String(i + 1).padStart(4, "0")}`,
      clienteName: nombresClientes[i % nombresClientes.length],
      phoneNumber: `+595 981 ${String(100000 + i * 7).slice(0, 6)}`,
      template,
      messageText: hasAttach
        ? "Presupuesto adjunto en PDF"
        : template === "RECEPCIONADO"
          ? "Su vehículo fue recibido en nuestro taller"
          : template === "PRESUPUESTADO"
            ? "Su presupuesto está listo"
            : template === "EN_REPARACION"
              ? "Su vehículo está en reparación"
              : template === "LISTO_ENTREGA"
                ? "Su vehículo está listo para retirar"
                : template === "FINALIZADO_RETIRADO"
                  ? "Gracias por su visita. Califique su experiencia"
                  : "Mensaje personalizado",
      status: statuses[i % statuses.length],
      sentAt: date.toLocaleDateString("es-PY") + " " + `${8 + (i % 9)}:${String((i * 7) % 60).padStart(2, "0")}`,
      hasAttachment: hasAttach,
      errorMessage: statuses[i % statuses.length] === "FAILED" ? "Error de conexión con Evolution API" : null,
    };
  });
}
