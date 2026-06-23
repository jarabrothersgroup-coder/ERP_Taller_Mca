/**
 * Seed script: 50 Realistic Paraguayan Clients for Live Demo.
 *
 * Creates 50 clients with real Paraguayan names, RUCs, phones (+595),
 * addresses from major cities (Asunción, San Lorenzo, Capiatá, Luque,
 * Fernando de la Mora, Coronel Oviedo, Ciudad del Este, Encarnación).
 *
 * Usage: npx tsx scripts/seed-clients.ts <tenant_slug>
 *
 * @module scripts/seed-clients
 */

import { db } from "../src/shared/database/drizzle.js";
import { eq } from "drizzle-orm";
import { closeDb } from "../src/shared/database/connection.js";
import { clients } from "../src/shared/database/schema/index.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-clients.ts <tenant_slug>");
  process.exit(1);
}

interface ClientDef {
  name: string;
  email: string;
  phone: string;
  ruc: string;
  address: string;
  notes?: string;
}

const CLIENTS: ClientDef[] = [
  // ── Asunción (15) ────────────────────────────
  { name: "Juan Carlos Martínez", email: "jcmartinez@gmail.com", phone: "+595981234567", ruc: "1234567-8", address: "Av. Mariscal López 1234, Asunción", notes: "Cliente frecuente — Hilux 2020" },
  { name: "María Fernanda González", email: "mfgonzalez@hotmail.com", phone: "+595982345678", ruc: "2345678-9", address: "Av. Brasil 567, Asunción", notes: "Corolla Cross híbrido" },
  { name: "Roberto Carlos Ávila", email: "rcavila@yahoo.com", phone: "+595983456789", ruc: "3456789-0", address: "Dr. Gasperi 890, Asunción" },
  { name: "Ana Lucía Ferreira", email: "anaferreira@gmail.com", phone: "+595984567890", ruc: "4567890-1", address: "Av. Defensores del Chaco 2345, Asunción" },
  { name: "Pedro Enrique Benítez", email: "pebenitez@outlook.com", phone: "+595985678901", ruc: "5678901-2", address: "Sepúlveda 678, Asunción" },
  { name: "Lucía Valentina Romero", email: "lvromero@gmail.com", phone: "+595986789012", ruc: "6789012-3", address: "Av. General Haenish 1456, Asunción" },
  { name: "Fernando Daniel Gómez", email: "fdgomez@hotmail.com", phone: "+595987890123", ruc: "7890123-4", address: "Av. Sacramento 901, Asunción" },
  { name: "Carolina Belén López", email: "clopez@yahoo.com", phone: "+595988901234", ruc: "8901234-5", address: "Av. Mcal. Estigarribia 3456, Asunción" },
  { name: "Miguel Ángel Rojas", email: "marojas@gmail.com", phone: "+595989012345", ruc: "9012345-6", address: "Humaitá 1234, Asunción" },
  { name: "Patricia Soledad Cabrera", email: "pscabrera@outlook.com", phone: "+595990123456", ruc: "0123456-7", address: "Av. Artigas 5678, Asunción" },
  { name: "Raúl Eduardo Torres", email: "retorres@gmail.com", phone: "+595991234567", ruc: "1122334-5", address: "Pettirossi 2345, Asunción" },
  { name: "Gladys Mabel Acosta", email: "gmacosta@hotmail.com", phone: "+595992345678", ruc: "2233445-6", address: "Av. Abai 890, Asunción" },
  { name: "Hugo Alfredo Velázquez", email: "havelazquez@gmail.com", phone: "+595993456789", ruc: "3344556-7", address: "Eusebio Ayala 4567, Asunción" },
  { name: "Sandra Milagros Espinoza", email: "smespinoza@yahoo.com", phone: "+595994567890", ruc: "4455667-8", address: "Av. Mariscal López 9012, Asunción" },
  { name: "Oscar Daniel Medina", email: "odmedina@gmail.com", phone: "+595995678901", ruc: "5566778-9", address: "Av. Primer Presidente 3456, Asunción" },

  // ── San Lorenzo (8) ──────────────────────────
  { name: "Carlos Alberto Pereira", email: "capereira@gmail.com", phone: "+595971234567", ruc: "6677889-0", address: "Ruta 1 Km 12, San Lorenzo", notes: "Flota de 3 Hilux" },
  { name: "Mirta Nidia Jara", email: "mnjara@hotmail.com", phone: "+595972345678", ruc: "7788990-1", address: "Av. San Martín 1567, San Lorenzo" },
  { name: "Raquel Elizabeth Paredes", email: "reparedes@gmail.com", phone: "+595973456789", ruc: "8899001-2", address: "Defensores del Chaco 2345, San Lorenzo" },
  { name: "Jorge Luis Achá", email: "jlacha@yahoo.com", phone: "+595974567890", ruc: "9900112-3", address: "Av. Mariano R. Alonso 890, San Lorenzo" },
  { name: "Silvia Patricia Aquino", email: "spaquino@gmail.com", phone: "+595975678901", ruc: "1011123-4", address: "Ruta 1 Km 14, San Lorenzo" },
  { name: "Eduardo Raúl Maidana", email: "ermaidana@outlook.com", phone: "+595976789012", ruc: "1122134-5", address: "Av. Mariano R. Alonso 1234, San Lorenzo" },
  { name: "Nora Beatriz Espínola", email: "nbespinola@gmail.com", phone: "+595977890123", ruc: "1233245-6", address: "Av. San Martín 2345, San Lorenzo" },
  { name: "Alfredo Ramón Benítez", email: "arbenitez@hotmail.com", phone: "+595978901234", ruc: "1344356-7", address: "Ruta 1 Km 16, San Lorenzo" },

  // ── Capiatá (5) ──────────────────────────────
  { name: "Mauricio Nicolás Gamarra", email: "mngamarra@gmail.com", phone: "+595961234567", ruc: "1455467-8", address: "Ruta 3 Km 38, Capiatá", notes: "Camioneta Ford Ranger" },
  { name: "Elizabeth Soledad Benítez", email: "esbenitez@yahoo.com", phone: "+595962345678", ruc: "1566578-9", address: "Av. Capiatá 1234, Capiatá" },
  { name: "Ramón Alberto Flecha", email: "raflecha@gmail.com", phone: "+595963456789", ruc: "1677689-0", address: "Ruta 3 Km 40, Capiatá" },
  { name: "Mabel Cristina Vergara", email: "mcvergara@outlook.com", phone: "+595964567890", ruc: "1788790-1", address: "Calle 12 de Junio 567, Capiatá" },
  { name: "Víctor Hugo Torales", email: "vhtorales@gmail.com", phone: "+595965678901", ruc: "1899801-2", address: "Ruta 3 Km 42, Capiatá" },

  // ── Luque (5) ────────────────────────────────
  { name: "Rubén Darío Gauto", email: "rdgauto@gmail.com", phone: "+595951234567", ruc: "1900912-3", address: "Av. Mariscal López 2345, Luque", notes: "SUV Hyundai Tucson" },
  { name: "Graciela Mabel Ovelar", email: "gmovelar@hotmail.com", phone: "+595952345678", ruc: "2011023-4", address: "Ruta 1 Km 20, Luque" },
  { name: "Domingo Alcides Mereles", email: "dameleles@yahoo.com", phone: "+595953456789", ruc: "2122134-5", address: "Av. Mariscal López 3456, Luque" },
  { name: "Liliana Maria Espínola", email: "lmespinola@gmail.com", phone: "+595954567890", ruc: "2233245-6", address: "Loma Plata 1234, Luque" },
  { name: "Aldo Nelson Cáceres", email: "ancaceres@outlook.com", phone: "+595955678901", ruc: "2344356-7", address: "Ruta 1 Km 22, Luque" },

  // ── Fernando de la Mora (4) ──────────────────
  { name: "Nelson Antonio Paniagua", email: "napaniagua@gmail.com", phone: "+595941234567", ruc: "2455467-8", address: "Av. Fernando de la Mora 1234, Fdo. de la Mora", notes: "Kia Sportage 2022" },
  { name: "Mónica Judith Cáceres", email: "monicaceres@hotmail.com", phone: "+595942345678", ruc: "2566578-9", address: "Av. Defensores del Chaco 5678, Fdo. de la Mora" },
  { name: "Pedro Ignacio Gonzales", email: "pigonales@gmail.com", phone: "+595943456789", ruc: "2677689-0", address: "Av. Artigas 9012, Fdo. de la Mora" },
  { name: "Rosa Amelia Quiroz", email: "raquiroz@yahoo.com", phone: "+595944567890", ruc: "2788790-1", address: "Av. Mariscal López 4567, Fdo. de la Mora" },

  // ── Coronel Oviedo (4) ───────────────────────
  { name: "Hugo Enrique Servín", email: "heservin@gmail.com", phone: "+595931234567", ruc: "2899801-2", address: "Ruta 2 Km 135, Coronel Oviedo", notes: "Camioneta Toyota Hilux — flota de 5" },
  { name: "Teresa María Benítez", email: "tmbenitez@hotmail.com", phone: "+595932345678", ruc: "2900912-3", address: "Av. San Blas 1234, Coronel Oviedo" },
  { name: "Gustavo Adolfo Ramírez", email: "garamirez@gmail.com", phone: "+595933456789", ruc: "3011023-4", address: "Ruta 2 Km 138, Coronel Oviedo" },
  { name: "Celia Pilar Aquino", email: "cpaquino@yahoo.com", phone: "+595934567890", ruc: "3122134-5", address: "Av. Mariscal López 2345, Coronel Oviedo" },

  // ── Ciudad del Este (5) ──────────────────────
  { name: "Juan Pablo Escobar", email: "jpescobar@gmail.com", phone: "+595981122334", ruc: "3233245-6", address: "Av. Monseñor Rodríguez 1234, CDE", notes: "Chevrolet S10 2023" },
  { name: "Marcos Antonio Vega", email: "mavega@hotmail.com", phone: "+595982233445", ruc: "3344356-7", address: "Av. Aviadores del Chaco 5678, CDE" },
  { name: "Daniela Soledad Flores", email: "dsflores@gmail.com", phone: "+595983344556", ruc: "3455467-8", address: "Ruta 7 Km 10, CDE" },
  { name: "Sergio Daniel Molinas", email: "sdmolinas@yahoo.com", phone: "+595984455667", ruc: "3566578-9", address: "Barrio San Rafael 1234, CDE" },
  { name: "Paola Andrea Fleitas", email: "pafleitas@outlook.com", phone: "+595985566778", ruc: "3677689-0", address: "Av. Mariscal López 3456, CDE" },

  // ── Encarnación (4) ──────────────────────────
  { name: "Andrés Mauricio Ayala", email: "amayala@gmail.com", phone: "+595971122334", ruc: "3788790-1", address: "Av. San Blas 1234, Encarnación", notes: "Honda CR-V 2021" },
  { name: "Verónica Elizabeth Benítez", email: "vebenitez@hotmail.com", phone: "+595972233445", ruc: "3899801-2", address: "Ruta 6 Km 3, Encarnación" },
  { name: "Claudio René Martínez", email: "crmartinez@gmail.com", phone: "+595973344556", ruc: "3900912-3", address: "Av. San Juan 2345, Encarnación" },
  { name: "Lourdes Mercedes Gómez", email: "lmgomez@yahoo.com", phone: "+595974455667", ruc: "4011023-4", address: "Barrio La Merced 567, Encarnación" },

  // ── Ciudad del Este / Hernandarias (2) ───────
  { name: "Arnaldo Gabriel Medina", email: "agmedina@gmail.com", phone: "+595961122334", ruc: "4122134-5", address: "Ruta 7 Km 15, Hernandarias", notes: "Volkswagen Amarok" },
  { name: "Mirtha Graciela Duarte", email: "mgduarte@hotmail.com", phone: "+595962233445", ruc: "4233245-6", address: "Av. San Martín 890, Hernandarias" },

  // ── Villarrica / Gral. Artigas (2) ───────────
  { name: "Óscar Fabián Ávalos", email: "ofavalos@gmail.com", phone: "+595951122334", ruc: "4344356-7", address: "Av. Villarrica 1234, Gral. Artigas", notes: "Suzuki Jimny" },
  { name: "Elsie Mabel Ibarra", email: "emibarra@yahoo.com", phone: "+595952233445", ruc: "4455467-8", address: "Ruta 9 Km 50, Villarrica" },

  // ── Pedro Juan Caballero (1) ─────────────────
  { name: "Roberto Andrés González", email: "ragonzalez@gmail.com", phone: "+595941122334", ruc: "4566578-9", address: "Av. Capitán Bado 1234, Pedro Juan Caballero", notes: "Ford Ranger diesel" },
];

async function main() {
  console.log(`🌱 Seeding 50 clients for tenant: ${TENANT_SLUG}\n`);

  const existing = await db()
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.tenantSlug, TENANT_SLUG));
  const existingNames = new Set(existing.map((c) => c.name));

  let count = 0;
  let skipped = 0;

  for (const c of CLIENTS) {
    if (existingNames.has(c.name)) {
      skipped++;
      continue;
    }
    await db().insert(clients).values({
      name: c.name,
      email: c.email,
      phone: c.phone,
      ruc: c.ruc,
      address: c.address,
      notes: c.notes || null,
      tenantSlug: TENANT_SLUG,
    });
    count++;
  }

  console.log(`   ✅  Clients: ${count} inserted (${skipped} already existed)`);
  console.log(`   📍 Cities: Asunción (15), San Lorenzo (8), Capiatá (5), Luque (5),`);
  console.log(`              Fdo. de la Mora (4), Coronel Oviedo (4), CDE (5),`);
  console.log(`              Encarnación (4), Hernandarias (2), Villarrica (2), PJC (1)`);
  console.log(`\n🌱 Client seeding complete!`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => closeDb());
