/**
 * Seed script: Historical Appointment Data for AI Scheduling Suggestions.
 *
 * Creates 90+ appointments over the last 90 days with realistic patterns:
 *   - Morning (08:00-10:00): High bookings (80%), low no-shows (5%) — "sweet spot"
 *   - Midday (11:00-13:00): Medium bookings (50%), medium no-shows (15%)
 *   - Afternoon (14:00-16:00): Low bookings (30%), high no-shows (25%)
 *
 * Also creates repeat clients with preferred time patterns for personalization testing.
 *
 * Usage: npx tsx scripts/seed-ai-scheduling.ts <tenant_slug>
 *
 * @module scripts/seed-ai-scheduling
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq, and } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import { agendamientos } from "../src/modules/scheduling/schema/agendamientos.js";
import type { AgendamientoEstado } from "../src/modules/scheduling/types.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-ai-scheduling.ts <tenant_slug>");
  process.exit(1);
}

// ─── Appointment generators ───────────────────

interface AppointmentSeed {
  clienteNombre: string;
  clientePhone: string;
  vehiculoChapa: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  fechaTurno: string;
  horaTurno: string;
  tipoServicio: "RAPIDO" | "PESADO";
  estado: AgendamientoEstado;
  diasAtras: number;
}

/**
 * Generates appointments across the last N days with realistic patterns.
 */
function generateAppointments(): AppointmentSeed[] {
  const appointments: AppointmentSeed[] = [];
  const today = new Date();
  // Client profiles for repeat testing
  const CLIENTS = [
    { name: "Juan Carlos Martínez", phone: "+595981234567", chapa: "ABC-123", marca: "Toyota", modelo: "Hilux", prefHour: 8 },
    { name: "María Fernanda González", phone: "+595982345678", chapa: "BCD-234", marca: "Toyota", modelo: "Corolla", prefHour: 10 },
    { name: "Roberto Ávila", phone: "+595983456789", chapa: "CDE-345", marca: "Ford", modelo: "Ranger", prefHour: 14 },
    { name: "Ana Lucía Ferreira", phone: "+595984567890", chapa: "DEF-456", marca: "Kia", modelo: "Sportage", prefHour: 9 },
    { name: "Pedro Benítez", phone: "+595985678901", chapa: "EFG-567", marca: "Chevrolet", modelo: "S10", prefHour: 15 },
  ];

  // Generate appointments for the last 90 days
  for (let dayOffset = 1; dayOffset <= 90; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dayOfWeek = date.getDay();

    // Skip Sundays
    if (dayOfWeek === 0) continue;

    // Saturdays: only morning (07:30-12:00), fewer appointments
    const isSaturday = dayOfWeek === 6;
    const appointmentsToday = isSaturday ? 2 : 4 + Math.floor(Math.random() * 3);

    for (let i = 0; i < appointmentsToday; i++) {
      const dateStr = date.toISOString().split("T")[0];

      // Pick a client (rotate through profiles)
      const client = CLIENTS[Math.floor(Math.random() * CLIENTS.length)];

      // Determine hour based on pattern:
      // - 40% chance: use preferred hour (creates pattern)
      // - 60% chance: random across the day
      let hour: number;
      if (Math.random() < 0.4) {
        hour = client.prefHour;
      } else if (isSaturday) {
        hour = 8 + Math.floor(Math.random() * 3); // 08:00-10:00 on Saturdays
      } else {
        const hours = [8, 9, 10, 11, 12, 14, 15, 16];
        hour = hours[Math.floor(Math.random() * hours.length)];
      }

      // 30-min slots
      const minute = Math.random() < 0.5 ? 0 : 30;
      const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

      // Determine service type
      const tipoServicio = Math.random() < 0.7 ? "RAPIDO" : "PESADO";

      // Determine state based on time patterns:
      // Morning: 85% confirmed/processed, 5% absent, 10% cancelled
      // Midday: 70% confirmed/processed, 15% absent, 15% cancelled
      // Afternoon: 55% confirmed/processed, 25% absent, 20% cancelled
      const rand = Math.random();
      let estado: AgendamientoEstado;
      if (hour >= 8 && hour <= 10) {
        // Morning — high success
        if (rand < 0.50) estado = "PROCESADO_EN_ERP";
        else if (rand < 0.85) estado = "CONFIRMADO";
        else if (rand < 0.90) estado = "AUSENTE";
        else if (rand < 0.95) estado = "CANCELADO";
        else estado = "RESERVADO";
      } else if (hour >= 11 && hour <= 13) {
        // Midday — medium
        if (rand < 0.35) estado = "PROCESADO_EN_ERP";
        else if (rand < 0.65) estado = "CONFIRMADO";
        else if (rand < 0.80) estado = "AUSENTE";
        else if (rand < 0.90) estado = "CANCELADO";
        else estado = "RESERVADO";
      } else {
        // Afternoon — more absences
        if (rand < 0.25) estado = "PROCESADO_EN_ERP";
        else if (rand < 0.55) estado = "CONFIRMADO";
        else if (rand < 0.80) estado = "AUSENTE";
        else if (rand < 0.92) estado = "CANCELADO";
        else estado = "RESERVADO";
      }

      appointments.push({
        clienteNombre: client.name,
        clientePhone: client.phone,
        vehiculoChapa: client.chapa,
        vehiculoMarca: client.marca,
        vehiculoModelo: client.modelo,
        fechaTurno: dateStr,
        horaTurno: time,
        tipoServicio: tipoServicio as "RAPIDO" | "PESADO",
        estado,
        diasAtras: dayOffset,
      });
    }
  }

  return appointments;
}

// ─── Main ─────────────────────────────────────

async function main() {
  console.log(`🧠 Seeding AI Scheduling data for tenant: ${TENANT_SLUG}\n`);

  const appointments = generateAppointments();

  // Check existing
  const [existingRow] = await db()
    .select({ total: agendamientos.id })
    .from(agendamientos)
    .where(eq(agendamientos.tenantSlug, TENANT_SLUG))
    .limit(1);

  const exists = !!existingRow;

  if (exists) {
    console.log("   ⚠️  Tenant already has appointment data. Skipping seed.");
    console.log("   💡  To re-seed, delete existing data first.");
    await closeDb();
    return;
  }

  // Batch insert
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < appointments.length; i += BATCH_SIZE) {
    const batch = appointments.slice(i, i + BATCH_SIZE);
    const values = batch.map((a) => ({
      clienteNombre: a.clienteNombre,
      clientePhone: a.clientePhone,
      vehiculoChapa: a.vehiculoChapa,
      vehiculoMarca: a.vehiculoMarca,
      vehiculoModelo: a.vehiculoModelo,
      fechaTurno: a.fechaTurno,
      horaTurno: a.horaTurno,
      tipoServicio: a.tipoServicio,
      duracionHoras: a.tipoServicio === "RAPIDO" ? 1 : 4,
      estado: a.estado,
      tenantSlug: TENANT_SLUG,
      createdAt: new Date(Date.now() - a.diasAtras * 86400000),
    }));

    await db().insert(agendamientos).values(values);
    inserted += batch.length;
    process.stdout.write(`\r   📊 Inserted ${inserted}/${appointments.length} appointments`);
  }

  console.log(`\n\n✅ Seed complete! ${inserted} appointments created.`);
  console.log(`   📅 Span: Last 90 days`);

  // Summary by hour
  const hourCounts = new Map<string, { total: number; noShows: number; confirmedOrProcessed: number }>();
  for (const a of appointments) {
    const key = a.horaTurno.split(":")[0];
    const bucket = hourCounts.get(key) || { total: 0, noShows: 0, confirmedOrProcessed: 0 };
    bucket.total++;
    if (a.estado === "AUSENTE" || a.estado === "CANCELADO") bucket.noShows++;
    if (a.estado === "CONFIRMADO" || a.estado === "PROCESADO_EN_ERP") bucket.confirmedOrProcessed++;
    hourCounts.set(key, bucket);
  }

  console.log(`\n   📈 Pattern by hour:`);
  for (const [hour, stats] of [...hourCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const noShowPct = stats.total > 0 ? ((stats.noShows / stats.total) * 100).toFixed(0) : "0";
    const confirmedPct = stats.total > 0 ? ((stats.confirmedOrProcessed / stats.total) * 100).toFixed(0) : "0";
    const bar = "█".repeat(Math.round(stats.total / 3));
    console.log(`   ${hour}:00  ${bar} ${stats.total} citas | ✅ ${confirmedPct}% confirm | ❌ ${noShowPct}% ausentes`);
  }

  console.log(`\n   👤 Repeat clients:`);
  for (const client of [
    { name: "Juan Carlos", phone: "+595981234567", pref: "08:00" },
    { name: "María Fernanda", phone: "+595982345678", pref: "10:00" },
    { name: "Roberto Ávila", phone: "+595983456789", pref: "14:00" },
  ]) {
    const count = appointments.filter((a) => a.clientePhone === client.phone).length;
    console.log(`   🧑 ${client.name}: ${count} visitas (prefiere ${client.pref})`);
  }
}

main()
  .catch((err) => { console.error("\n❌ Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
