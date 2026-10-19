/**
 * Seed script: cobertura de las 16 tablas que quedaron sin datos.
 *
 * La lista original de "tablas sin seed" (missing.txt, 86 tablas) se derivó de
 * `tablas.txt` (119) − `covered.txt` (33). Ambas listas eran incompletas:
 *
 *   - 13 tablas nunca entraron a `tablas.txt` (nunca se evaluaron), y
 *     `digital_signatures` tampoco fue considerada.
 *   - `covered.txt` marcaba como "ya cubiertas" tablas que en realidad tenían
 *     0 filas y ningún seed (de ahí que `facturas` / `centros_costo` se colaran;
 *     ya resueltas en seed-finance-extra).
 *
 * Este script cierra esa brecha para el tenant indicado con datos combinados
 * deterministas e idempotentes (re-ejecutable: la 2ª corrida inserta 0 filas).
 *
 * Tablas cubiertas:
 *   fleet                → fleets
 *   almacén / inventario → transferencias_almacen, inventory_accounts_map
 *   marketing / loyalty  → marketing_campaigns, google_reviews,
 *                          loyalty_accounts, loyalty_rewards, loyalty_transactions
 *   taller               → digital_signatures
 *   fiscal               → sifen_contingencia_queue
 *   CRM                  → crm_sync_log
 *   plataforma / grupo   → tenant_groups, tenant_group_members,
 *                          consolidated_report_snapshots, analytics_events,
 *                          vehicle_manual_chunks
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/seed-coverage-extra.ts <tenant_slug>
 *
 * @module scripts/seed-coverage-extra
 */

import type { SQL } from "drizzle-orm";
import { db, sql } from "../src/shared/database/drizzle.js";
import { closeDb } from "../src/shared/database/connection.js";

const TENANT_SLUG = process.argv[2];
if (!TENANT_SLUG) {
  console.error("Usage: npx tsx scripts/seed-coverage-extra.ts <tenant_slug>");
  process.exit(1);
}

/** UUID determinista `0000000G-0000-4000-8000-00000000000N` (G = grupo/tabla). */
function uid(group: number, n: number): string {
  return `${String(group).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const GROUP_ID = `tg-${TENANT_SLUG}-seed`;

interface SummaryRow {
  table: string;
  inserted: number;
  candidates: number;
}
const summary: SummaryRow[] = [];

/** Acumula el resultado de una (o varias) inserción(es) para el resumen final. */
function record(table: string, inserted: number, candidates: number): void {
  summary.push({ table, inserted, candidates });
}

/** Ejecuta un INSERT ... RETURNING id y devuelve la cantidad realmente insertada. */
async function exec(q: SQL): Promise<number> {
  const res = (await db().execute(q)) as unknown as unknown[];
  return Array.isArray(res) ? res.length : 0;
}

async function run(table: string, candidates: number, q: SQL): Promise<void> {
  let inserted = 0;
  try {
    inserted = await exec(q);
  } catch (err) {
    console.log(`   ⚠️  ${table}: ${(err as Error).message}`);
  }
  record(table, inserted, candidates);
  console.log(`   ✅ ${table}: ${inserted} inserted (${candidates - inserted} already existed)`);
}

async function setTenantContext(): Promise<void> {
  try {
    const safe = String(TENANT_SLUG).replace(/[^a-zA-Z0-9_-]/g, "");
    await db().execute(sql`SELECT set_config('app.current_tenant', ${safe}, false)`);
  } catch {
    // Ignorar si el backend no soporta la config (p. ej. rol superuser).
  }
}

async function main(): Promise<void> {
  console.log(`🌱 Seeding coverage-extra data for tenant: ${TENANT_SLUG}\n`);
  await setTenantContext();

  // ── Resolver claves foráneas desde los datos base del demo ────────────
  const clients = (await db().execute(
    sql`SELECT id, name FROM clients WHERE tenant_slug = ${TENANT_SLUG} ORDER BY created_at ASC LIMIT 5`,
  )) as unknown as Array<{ id: string; name: string }>;

  const vehicles = (await db().execute(
    sql`SELECT id FROM vehiculos WHERE tenant_slug = ${TENANT_SLUG} ORDER BY created_at ASC LIMIT 5`,
  )) as unknown as Array<{ id: string }>;

  const orders = (await db().execute(
    sql`SELECT id, description FROM ordenes_trabajo WHERE tenant_slug = ${TENANT_SLUG} ORDER BY created_at ASC LIMIT 5`,
  )) as unknown as Array<{ id: string; description: string | null }>;

  const almacenes = (await db().execute(
    sql`SELECT id, nombre FROM almacenes WHERE tenant_slug = ${TENANT_SLUG} AND activo = true ORDER BY created_at ASC LIMIT 5`,
  )) as unknown as Array<{ id: string; nombre: string }>;

  const repuestos = (await db().execute(
    sql`SELECT id, descripcion FROM repuestos WHERE tenant_slug = ${TENANT_SLUG} ORDER BY created_at ASC LIMIT 5`,
  )) as unknown as Array<{ id: string; descripcion: string | null }>;

  // plan_cuentas es global (no tenant-scoped); cuentas del PUC paraguayo.
  const cuentas = (await db().execute(
    sql`SELECT id, codigo FROM plan_cuentas WHERE codigo IN ('1.1.3.01', '6.1.01.001', '2.1.01.001')`,
  )) as unknown as Array<{ id: string; codigo: string }>;
  const cuentaInventario = cuentas.find((c) => c.codigo === "1.1.3.01")?.id;
  const cuentaGasto = cuentas.find((c) => c.codigo === "6.1.01.001")?.id;
  const cuentaProveedor = cuentas.find((c) => c.codigo === "2.1.01.001")?.id;

  const fiscalDocs = (await db().execute(
    sql`SELECT id FROM fiscal_documentos ORDER BY created_at ASC LIMIT 1`,
  )) as unknown as Array<{ id: string }>;
  const documentoId = fiscalDocs[0]?.id ?? uid(13, 99);

  const profiles = (await db().execute(
    sql`SELECT id FROM profiles WHERE tenant_id = (SELECT id FROM tenants WHERE slug = ${TENANT_SLUG}) ORDER BY created_at ASC LIMIT 1`,
  )) as unknown as Array<{ id: string }>;
  const profileId = profiles[0]?.id ?? null;

  // Drizzle parametriza cada `${...}`; el cast (`::jsonb` / `::timestamptz`)
  // va en el SQL, NO dentro del valor. Por eso helpers devuelven el valor puro.
  const ISO = (s: string): string => s;
  const J = (v: unknown): string => JSON.stringify(v);

  // ── 1. tenant_groups + tenant_group_members ───────────────────────────
  console.log("\n1. Grupos de tenants...");
  await run(
    "tenant_groups",
    1,
    sql`INSERT INTO tenant_groups (id, name, description, owner_tenant_slug, is_active, created_at, updated_at)
        VALUES (${GROUP_ID}, 'Grupo Consolidado Demo', 'Grupo de consolidación (matriz + sucursal) para demo',
                ${TENANT_SLUG}, true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING RETURNING id`,
  );

  await run(
    "tenant_group_members",
    1,
    sql`INSERT INTO tenant_group_members (id, group_id, tenant_slug, role_in_group, joined_at, is_active)
        VALUES (${`tgm-${GROUP_ID}-${TENANT_SLUG}`}, ${GROUP_ID}, ${TENANT_SLUG}, 'OWNER', NOW(), true)
        ON CONFLICT (id) DO NOTHING RETURNING id`,
  );

  // ── 2. consolidated_report_snapshots (FK → tenant_groups) ─────────────
  console.log("\n2. Snapshots de reportes consolidados...");
  const snapshots = [
    { id: `crs-${TENANT_SLUG}-2026-09-balance`, tipo: "BALANCE", mes: 9, data: { activo: 185000000, pasivo: 92000000, patrimonio: 93000000 } },
    { id: `crs-${TENANT_SLUG}-2026-09-pnl`, tipo: "PNL", mes: 9, data: { ingresos: 42000000, costos: 18500000, resultado: 23500000 } },
  ];
  for (const s of snapshots) {
    await run(
      "consolidated_report_snapshots",
      1,
      sql`INSERT INTO consolidated_report_snapshots (id, group_id, report_type, period_anho, period_mes, snapshot_data, created_at)
          VALUES (${s.id}, ${GROUP_ID}, ${s.tipo}, 2026, ${s.mes}, ${J(s.data)}::jsonb, NOW())
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 3. analytics_events ───────────────────────────────────────────────
  console.log("\n3. Eventos de analítica...");
  const events = [
    { g: 3, n: 1, type: "page_view", name: "dashboard.view", props: { path: "/dashboard/hub" } },
    { g: 3, n: 2, type: "work_order", name: "work_order.created", props: { source: "hub" } },
    { g: 3, n: 3, type: "billing", name: "invoice.issued", props: { tipo: "MANUAL" } },
  ];
  for (const e of events) {
    await run(
      "analytics_events",
      1,
      sql`INSERT INTO analytics_events (id, tenant_slug, event_type, event_name, user_id, properties, metadata, created_at)
          VALUES (${uid(e.g, e.n)}, ${TENANT_SLUG}, ${e.type}, ${e.name}, ${profileId}, ${J(e.props)}::jsonb, ${J({ source: "seed" })}::jsonb, NOW())
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 4. fleets ─────────────────────────────────────────────────────────
  console.log("\n4. Flotas (clientes corporativos)...");
  const fleets = [
    { g: 4, n: 1, nombre: "Flota Distribuidora del Sur", empresa: "Distribuidora del Sur S.A.", ruc: "80045678-9", tipo: "CORPORATIVO", desc: "12.50" },
    { g: 4, n: 2, nombre: "Flota Transporte Guaraní", empresa: "Transporte Guaraní S.R.L.", ruc: "80098765-3", tipo: "PREMIUM", desc: "18.00" },
  ];
  for (const f of fleets) {
    await run(
      "fleets",
      1,
      sql`INSERT INTO fleets (id, nombre, empresa, contacto, telefono, email, ruc, contrato_tipo, descuento_porcentaje, activa, tenant_slug, created_at, updated_at)
          VALUES (${uid(f.g, f.n)}, ${f.nombre}, ${f.empresa}, 'Dpto. de Compras', '+595 21 555-0100', ${`compras@${f.ruc.replace(/[^0-9]/g, "")}.com.py`},
                  ${f.ruc}, ${f.tipo}, ${f.desc}, true, ${TENANT_SLUG}, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 5. google_reviews ─────────────────────────────────────────────────
  console.log("\n5. Reseñas de Google...");
  const reviews = [
    { g: 5, n: 1, autor: "Lucía Benítez", rating: 5, texto: "Excelente atención y rapidez. Muy recomendado.", responded: true },
    { g: 5, n: 2, autor: "Marcos Villalba", rating: 4, texto: "Buen trabajo, aunque tardaron un poco más de lo previsto.", responded: false },
    { g: 5, n: 3, autor: "Sofía Cabañas", rating: 5, texto: "El diagnóstico fue preciso y transparente.", responded: false },
  ];
  for (const r of reviews) {
    await run(
      "google_reviews",
      1,
      sql`INSERT INTO google_reviews (id, autor, rating, texto, fecha, responded, respuesta, tenant_slug, respondido_at, respondido_por)
          VALUES (${uid(r.g, r.n)}, ${r.autor}, ${r.rating}, ${r.texto}, ${ISO("2026-09-20T14:30:00.000Z")},
                  ${r.responded}, ${r.responded ? "¡Gracias por tu comentario, " + r.autor.split(" ")[0] + "!" : null},
                  ${TENANT_SLUG}, ${r.responded ? ISO("2026-09-21T09:00:00.000Z") : null}, ${r.responded ? profileId : null})
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 6. inventory_accounts_map (FK → plan_cuentas) ─────────────────────
  console.log("\n6. Mapa de cuentas de inventario...");
  if (!cuentaInventario || !cuentaGasto) {
    console.log("   ⏭️  Skipped: faltan cuentas del PUC (1.1.3.01 / 6.1.01.001)");
    summary.push({ table: "inventory_accounts_map", inserted: 0, candidates: 0 });
  } else {
    const maps = [
      { g: 6, n: 1, categoria: "Filtros" },
      { g: 6, n: 2, categoria: "*" },
    ];
    for (const m of maps) {
      await run(
        "inventory_accounts_map",
        1,
        sql`INSERT INTO inventory_accounts_map (id, categoria, cuenta_inventario_id, cuenta_gasto_id, cuenta_proveedor_id, tenant_slug, created_at)
            VALUES (${uid(m.g, m.n)}, ${m.categoria}, ${cuentaInventario}, ${cuentaGasto}, ${cuentaProveedor ?? null}, ${TENANT_SLUG}, NOW())
            ON CONFLICT (id) DO NOTHING RETURNING id`,
      );
    }
  }

  // ── 7. loyalty_rewards ────────────────────────────────────────────────
  console.log("\n7. Recompensas de fidelidad...");
  const rewards = [
    { g: 7, n: 1, nombre: "Cambio de aceite gratis", desc: "Canjeable en el próximo service", pts: 500 },
    { g: 7, n: 2, nombre: "10% en repuestos", desc: "Descuento en repuestos originales", pts: 300 },
    { g: 7, n: 3, nombre: "Alineación y balanceo", desc: "Servicio de alineación sin costo", pts: 800 },
  ];
  for (const r of rewards) {
    await run(
      "loyalty_rewards",
      1,
      sql`INSERT INTO loyalty_rewards (id, nombre, descripcion, puntos_requeridos, activo, tenant_slug, created_at, updated_at)
          VALUES (${uid(r.g, r.n)}, ${r.nombre}, ${r.desc}, ${r.pts}, true, ${TENANT_SLUG}, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 8. loyalty_accounts (FK → clients, UNIQUE cliente_id+tenant) ──────
  console.log("\n8. Cuentas de fidelidad...");
  const niveles = ["BRONCE", "PLATA", "ORO"];
  if (clients.length === 0) {
    console.log("   ⏭️  Skipped: no hay clientes para el tenant");
    summary.push({ table: "loyalty_accounts", inserted: 0, candidates: 0 });
  } else {
    for (let i = 0; i < Math.min(clients.length, 3); i++) {
      const puntosGanados = 500 + i * 450;
      await run(
        "loyalty_accounts",
        1,
        sql`INSERT INTO loyalty_accounts (id, cliente_id, puntos_actuales, puntos_ganados_total, nivel, tenant_slug, created_at, updated_at)
            VALUES (${uid(8, i + 1)}, ${clients[i].id}, ${puntosGanados - i * 200}, ${puntosGanados}, ${niveles[i]}, ${TENANT_SLUG}, NOW(), NOW())
            ON CONFLICT (cliente_id, tenant_slug) DO NOTHING RETURNING id`,
      );
    }
  }

  // ── 9. loyalty_transactions (FK → clients) ────────────────────────────
  console.log("\n9. Transacciones de fidelidad...");
  const txDefs = [
    { tipo: "GANADO", puntos: 500, desc: "Compra de service 10.000 km" },
    { tipo: "GANADO", puntos: 300, desc: "Compra de repuestos" },
    { tipo: "CANJEADO", puntos: -300, desc: "Canje 10% en repuestos" },
    { tipo: "EXPIRADO", puntos: -100, desc: "Puntos vencidos por inactividad" },
  ];
  if (clients.length === 0) {
    console.log("   ⏭️  Skipped: no hay clientes para el tenant");
    summary.push({ table: "loyalty_transactions", inserted: 0, candidates: 0 });
  } else {
    for (let i = 0; i < txDefs.length; i++) {
      const t = txDefs[i];
      await run(
        "loyalty_transactions",
        1,
        sql`INSERT INTO loyalty_transactions (id, cliente_id, tipo, puntos, descripcion, tenant_slug, fecha)
            VALUES (${uid(9, i + 1)}, ${clients[i % clients.length].id}, ${t.tipo}, ${t.puntos}, ${t.desc}, ${TENANT_SLUG}, ${ISO("2026-09-25T12:00:00.000Z")})
            ON CONFLICT (id) DO NOTHING RETURNING id`,
      );
    }
  }

  // ── 10. marketing_campaigns ───────────────────────────────────────────
  console.log("\n10. Campañas de marketing...");
  const campaigns = [
    { g: 10, n: 1, nombre: "Promo cambio de aceite", tipo: "whatsapp", estado: "ENVIADA", segmento: "Clientes con service > 6 meses", mensaje: "¡Hola {{nombre}}! Aprovechá 20% de descuento en cambio de aceite este mes." },
    { g: 10, n: 2, nombre: "Recordatorio revisión anual", tipo: "email", estado: "PROGRAMADA", segmento: "Todos los clientes", mensaje: "Tu vehículo cumple un año: agendá tu revisión anual sin cargo." },
    { g: 10, n: 3, nombre: "Encuesta de satisfacción", tipo: "sms", estado: "BORRADOR", segmento: "Clientes con OT cerrada", mensaje: "¿Cómo calificás tu última visita? Respondé del 1 al 5." },
  ];
  for (const c of campaigns) {
    const enviada = c.estado === "ENVIADA";
    await run(
      "marketing_campaigns",
      1,
      sql`INSERT INTO marketing_campaigns (id, nombre, tipo, mensaje, programada_at, segmento, estado, enviada_at, destinatarios, enviados, fallidos, tenant_slug, created_at, updated_at)
          VALUES (${uid(c.g, c.n)}, ${c.nombre}, ${c.tipo}, ${c.mensaje},
                  ${ISO(enviada ? "2026-09-10T09:00:00.000Z" : "2026-10-05T09:00:00.000Z")}, ${c.segmento}, ${c.estado},
                  ${enviada ? ISO("2026-09-10T09:05:00.000Z") : null}, ${enviada ? 120 : 0}, ${enviada ? 118 : 0}, ${enviada ? 2 : 0},
                  ${TENANT_SLUG}, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 11. crm_sync_log (enum crm_sync_operation / crm_sync_status) ──────
  console.log("\n11. Log de sincronización con CRM...");
  const syncs = [
    { g: 11, n: 1, op: "upsert_contact", st: "success", err: null as string | null },
    { g: 11, n: 2, op: "add_note", st: "success", err: null },
    { g: 11, n: 3, op: "update_vehicle", st: "failed", err: "Twenty API timeout (504)" },
    { g: 11, n: 4, op: "create_contact", st: "pending", err: null },
  ];
  for (let i = 0; i < syncs.length; i++) {
    const s = syncs[i];
    const client = clients[i % Math.max(clients.length, 1)];
    const order = orders[i % Math.max(orders.length, 1)];
    await run(
      "crm_sync_log",
      1,
      sql`INSERT INTO crm_sync_log (id, operation, direction, orden_id, client_id, client_name,
            twenty_contact_id, twenty_object_name, twenty_record_id, status, error_message,
            request_payload, response_payload, tenant_slug, created_at, completed_at)
          VALUES (${uid(s.g, s.n)}, ${s.op}::crm_sync_operation, 'erp_to_crm', ${order?.id ?? null}, ${client?.id ?? null}, ${client?.name ?? null},
                  ${`twenty-c-${String(s.n).padStart(4, "0")}`}, 'Contact', ${`rec_${s.n}00${s.n}`}, ${s.st}::crm_sync_status, ${s.err},
                  ${J({ clientId: client?.id ?? null })}::jsonb, ${J({ ok: s.st !== "failed" })}::jsonb, ${TENANT_SLUG}, NOW(),
                  ${s.st === "pending" ? null : ISO("2026-09-22T16:00:00.000Z")})
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 12. digital_signatures (FK → ordenes_trabajo) ─────────────────────
  console.log("\n12. Firmas digitales...");
  const firmaSample =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
  const sigs = [
    { g: 12, n: 1, tipo: "RECEPCION", obs: "Autorización de ingreso y diagnóstico" },
    { g: 12, n: 2, tipo: "ENTREGA", obs: "Conformidad de entrega del vehículo" },
  ];
  if (orders.length === 0) {
    console.log("   ⏭️  Skipped: no hay órdenes de trabajo para el tenant");
    summary.push({ table: "digital_signatures", inserted: 0, candidates: 0 });
  } else {
    for (let i = 0; i < sigs.length; i++) {
      const s = sigs[i];
      const order = orders[i % orders.length];
      await run(
        "digital_signatures",
        1,
        sql`INSERT INTO digital_signatures (id, orden_trabajo_id, tipo, firma_base64, cliente_nombre, cliente_documento, observaciones, tenant_slug, created_at)
            VALUES (${uid(s.g, s.n)}, ${order.id}, ${s.tipo}, ${firmaSample}, ${clients[i % Math.max(clients.length, 1)]?.name ?? "Cliente Demo"},
                    ${`${1000000 + i * 111111}-${i}`}, ${s.obs}, ${TENANT_SLUG}, NOW())
            ON CONFLICT (id) DO NOTHING RETURNING id`,
      );
    }
  }

  // ── 13. sifen_contingencia_queue ──────────────────────────────────────
  console.log("\n13. Cola de contingencia SIFEN...");
  const conting = [
    { g: 13, n: 1, estado: "PENDIENTE", intentos: 0, num: "0000001", err: null as string | null },
    { g: 13, n: 2, estado: "ERROR", intentos: 3, num: "0000002", err: "SIFEN no disponible" },
  ];
  for (const c of conting) {
    await run(
      "sifen_contingencia_queue",
      1,
      sql`INSERT INTO sifen_contingencia_queue (id, tenant_slug, documento_id, cdc_original, xml_original, xml_firmado,
            serie_contingencia, numero_contingencia, dte_tipo, total_documento, estado, cdc_asignado, created_at, enviado_at, error_message, intentos)
          VALUES (${uid(c.g, c.n)}, ${TENANT_SLUG}, ${documentoId}, ${`0180012345600100101000010${c.num}202609101123456789`},
                  ${`<rDE><Id>contingencia-${c.num}</Id></rDE>`}, ${null},
                  'K10', ${c.num}, 'FACTURA', '550000.00', ${c.estado}, ${c.estado === "ERROR" ? null : `CD-${c.num}`},
                  NOW(), ${c.estado === "ERROR" ? null : ISO("2026-09-10T11:30:00.000Z")}, ${c.err}, ${c.intentos})
          ON CONFLICT (id) DO NOTHING RETURNING id`,
    );
  }

  // ── 14. transferencias_almacen ────────────────────────────────────────
  console.log("\n14. Transferencias entre almacenes...");
  if (repuestos.length === 0 || almacenes.length < 2) {
    console.log("   ⏭️  Skipped: se requieren repuestos y al menos 2 almacenes");
    summary.push({ table: "transferencias_almacen", inserted: 0, candidates: 0 });
  } else {
    const trDefs = [
      { g: 14, n: 1, cant: 4, motivo: "Reposición de stock para service programado", orden: orders[0]?.id ?? null },
      { g: 14, n: 2, cant: 2, motivo: "Traspaso por pedido urgente de cliente", orden: null },
    ];
    for (let i = 0; i < trDefs.length; i++) {
      const t = trDefs[i];
      await run(
        "transferencias_almacen",
        1,
        sql`INSERT INTO transferencias_almacen (id, repuesto_id, cantidad, almacen_origen_id, almacen_destino_id, orden_trabajo_id, motivo, estado, tenant_slug, created_at, created_by)
            VALUES (${uid(t.g, t.n)}, ${repuestos[i % repuestos.length].id}, ${t.cant},
                    ${almacenes[0].id}, ${almacenes[1].id}, ${t.orden}, ${t.motivo}, 'COMPLETADA', ${TENANT_SLUG}, NOW(), ${profileId})
            ON CONFLICT (id) DO NOTHING RETURNING id`,
      );
    }
  }

  // ── 15. vehicle_manual_chunks ─────────────────────────────────────────
  console.log("\n15. Fragmentos de manual de vehículo...");
  if (vehicles.length === 0) {
    console.log("   ⏭️  Skipped: no hay vehículos para el tenant");
    summary.push({ table: "vehicle_manual_chunks", inserted: 0, candidates: 0 });
  } else {
    const chunks = [
      { g: 15, n: 1, page: 42, section: "Mantenimiento — Aceite", content: "Cambio de aceite de motor cada 10.000 km o 12 meses, lo que ocurra primero. Capacidad: 4.2 L. Aceite recomendado: 5W-30 sintético." },
      { g: 15, n: 2, page: 78, section: "Frenos — Discos y pastillas", content: "Espesor mínimo de pastilla delantera: 3 mm. Espesor mínimo de disco: 22 mm. Reemplazar ambas pastillas del mismo eje simultáneamente." },
      { g: 15, n: 3, page: 103, section: "Neumáticos — Presión", content: "Presión recomendada en frío: 32 PSI (delanteros) y 30 PSI (traseros). Rotar cada 8.000 km." },
    ];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      // embedding queda NULL a propósito: evitar vectores sintéticos que
      // contaminarían la búsqueda semántica del RAG con vecinos sin sentido.
      await run(
        "vehicle_manual_chunks",
        1,
        sql`INSERT INTO vehicle_manual_chunks (id, vehicle_id, content, page_number, section, metadata, embedding)
            VALUES (${uid(c.g, c.n)}, ${vehicles[i % vehicles.length].id}, ${c.content}, ${c.page}, ${c.section},
                    ${`manual-${c.section}`}, NULL)
            ON CONFLICT (id) DO NOTHING RETURNING id`,
      );
    }
  }

  // ── Resumen ───────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  const perTable = new Map<string, { inserted: number; candidates: number }>();
  for (const r of summary) {
    const prev = perTable.get(r.table) ?? { inserted: 0, candidates: 0 };
    prev.inserted += r.inserted;
    prev.candidates += r.candidates;
    perTable.set(r.table, prev);
  }
  const inserted = [...perTable.values()].reduce((a, r) => a + r.inserted, 0);
  const candidates = [...perTable.values()].reduce((a, r) => a + r.candidates, 0);
  console.log(`   Tablas evaluadas: ${perTable.size}`);
  console.log(`   Filas insertadas: ${inserted} (de ${candidates} candidatas)`);
  console.log("─────────────────────────────────────────────\n");
}

try {
  await main();
} catch (err) {
  console.error("❌ Error en seed-coverage-extra:", err);
  await closeDb();
  process.exit(1);
}
await closeDb();
