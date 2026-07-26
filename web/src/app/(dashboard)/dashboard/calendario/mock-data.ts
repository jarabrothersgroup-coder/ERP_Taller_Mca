import type { UIMappedAppointment } from "@/lib/data-service";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppointmentRecord extends UIMappedAppointment {
  // Calendar appointment record UI type (extends UIMappedAppointment)
}

const clientNames = [
  "María González", "Pedro López", "Juan Pérez", "Lucía Fernández",
  "Carlos Ruiz", "Ana Martínez", "Roberto Sánchez", "Laura Gómez",
  "Sofía Medina", "Diego Acosta", "Valentina Ortiz", "Facundo Benítez",
];

const marcas = ["Toyota", "Hyundai", "Kia", "Volkswagen", "Chevrolet", "Nissan", "Ford", "Suzuki"];
const modelos = ["Corolla", "Tucson", "Sportage", "Gol", "Onix", "Frontier", "Ranger", "Swift"];

export function getMockAppointments(): AppointmentRecord[] {
  return Array.from({ length: 20 }, (_, i) => {
    const statuses: AppointmentRecord["estado"][] = [
      "RESERVADO", "CONFIRMADO", "CONFIRMADO", "RESERVADO",
      "PROCESADO_EN_ERP", "AUSENTE", "CANCELADO", "CONFIRMADO",
      "RESERVADO", "CONFIRMADO", "RESERVADO", "PROCESADO_EN_ERP",
      "CONFIRMADO", "CANCELADO", "CONFIRMADO", "RESERVADO",
      "CONFIRMADO", "RESERVADO", "AUSENTE", "CONFIRMADO",
    ];
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * 30) - 5);
    const hours = 7 + Math.floor(Math.random() * 9);
    const minutes = [0, 15, 30, 45][Math.floor(Math.random() * 4)];

    return {
      id: `appt-${String(i + 1).padStart(3, "0")}`,
      clienteNombre: clientNames[i % clientNames.length],
      clientePhone: `+595 981 ${String(100000 + i).slice(0, 6)}`,
      clienteEmail: i % 3 === 0 ? `${clientNames[i % clientNames.length].toLowerCase().replace(" ", ".")}@gmail.com` : null,
      vehiculoChapa: `ABC ${String(100 + i).slice(0, 3)}`,
      vehiculoMarca: marcas[i % marcas.length],
      vehiculoModelo: modelos[i % modelos.length],
      fechaTurno: date.toLocaleDateString("es-PY"),
      horaTurno: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      tipoServicio: i % 3 === 0 ? "PESADO" : "RAPIDO",
      estado: statuses[i % statuses.length],
      createdAt: date.toLocaleDateString("es-PY"),
    };
  });
}
