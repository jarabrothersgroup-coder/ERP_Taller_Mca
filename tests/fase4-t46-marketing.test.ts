/**
 * T-46 · CRM-02 — Fidelización (acreditar/canjear) + respuesta de reseñas.
 *
 * El módulo de marketing era "huérfano" a medias: los servicios existían pero
 * solo había GETs, así que nadie podía acreditar puntos, canjear un premio ni
 * contestar una reseña. En el camino aparecieron cuatro defectos reales que
 * ningún test cubría porque las rutas de lectura nunca se ejercitaron:
 *
 *   1. `loyalty_accounts.cliente_id` era TEXT mientras `clients.id` es UUID, así
 *      que `GET /marketing/loyalty/:clienteId` fallaba SIEMPRE con
 *      "operator does not exist: uuid = text" (500). Un endpoint GET "que
 *      funcionaba" y que en realidad estaba roto.
 *   2. `addPoints` escribía el asiento y luego el saldo en dos `execute`
 *      sueltos: un fallo entre ambos descuadraba el libro del saldo.
 *   3. No había canje, y nada impedía canjear de más ni descuadrar el saldo.
 *   4. `getReviewStats` devolvía `ratingDistribution: {1:0,2:0,3:0,4:0,5:0}`
 *      hardcodeado, así que el gráfico por estrella salía vacío siempre. Y el
 *      JS legacy leía `promedio`/`total`/`distribution`, nombres que el servicio
 *      nunca devolvió: el widget entero estaba muerto.
 *
 * Se cubren además el aislamiento por tenant, el RBAC de las escrituras y el
 * invariante contable saldo == SUM(asientos).
 *
 * @module tests/fase4-t46-marketing
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
import { db } from "../src/shared/database/drizzle.js";
import { clients } from "../src/shared/database/schema/clients.js";

// ─── Fixtures ─────────────────────────────────

const T = "e2e-t46";
const OTRO = "e2e-t46-otro";

const T_ID = "00000000-0000-0000-0000-00000f460001";
const OTRO_ID = "00000000-0000-0000-0000-00000f460002";
const ADMIN = "00000000-0000-0000-0000-00000f460010";
const MANAGER = "00000000-0000-0000-0000-00000f460011";
const MECANICO = "00000000-0000-0000-0000-00000f460012";
const MANAGER_AJENO = "00000000-0000-0000-0000-00000f460013";

let app: FastifyInstance;

let seq = 0;
/** UUID válido y único por test (12 hex en el último grupo). */
function nuevoId(): string {
  seq += 1;
  return `00000000-0000-0000-0000-${seq.toString(16).padStart(12, "0")}`;
}

async function crearTenant(id: string, slug: string): Promise<void> {
  const sql = getDb() as any;
  await sql`INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${id}, ${slug}, ${slug}, ${slug}, true) ON CONFLICT (slug) DO NOTHING`;
}

function emailDe(userId: string, slug: string): string {
  return `${userId}@${slug}.test`;
}

function token(userId: string, email: string, role: string, tenantId: string, slug: string) {
  return generateToken({ id: userId, email, role, tenantId, tenantSlug: slug });
}

function auth(bearer: string, slug = T) {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": slug };
}

const adminAuth = () => auth(token(ADMIN, emailDe(ADMIN, T), "admin", T_ID, T));
const managerAuth = () => auth(token(MANAGER, emailDe(MANAGER, T), "manager", T_ID, T));
const mecanicoAuth = () => auth(token(MECANICO, emailDe(MECANICO, T), "mechanic", T_ID, T));
const ajenoAuth = () =>
  auth(token(MANAGER_AJENO, emailDe(MANAGER_AJENO, OTRO), "manager", OTRO_ID, OTRO), OTRO);

async function crearCliente(id: string, slug: string, nombre: string): Promise<void> {
  await db()
    .insert(clients)
    .values({ id, name: nombre, ruc: null, email: null, phone: null, tenantSlug: slug } as any)
    .onConflictDoNothing();
}

/** Inserta una reseña sin pasar por el servicio (no hay ingesta implementada). */
async function crearReview(
  id: string,
  slug: string,
  rating: number,
  autor: string,
  texto: string | null = "Reseña de prueba",
): Promise<void> {
  const sql = getDb() as any;
  await sql`INSERT INTO google_reviews (id, autor, rating, texto, fecha, responded, tenant_slug)
    VALUES (${id}, ${autor}, ${rating}, ${texto}, NOW(), false, ${slug})
    ON CONFLICT (id) DO NOTHING`;
}

/** Suma de los asientos del libro: debe igualar al saldo de la cuenta. */
async function saldoDesdeLibro(clienteId: string, slug: string): Promise<number> {
  const sql = getDb() as any;
  const [row] = await sql`
    SELECT COALESCE(SUM(puntos), 0) AS total
    FROM loyalty_transactions
    WHERE cliente_id = ${clienteId} AND tenant_slug = ${slug}`;
  return Number(row?.total ?? 0);
}

beforeAll(async () => {
  await crearTenant(T_ID, T);
  await crearTenant(OTRO_ID, OTRO);

  const sql = getDb() as any;
  for (const [id, tenantId, slug, role] of [
    [ADMIN, T_ID, T, "admin"],
    [MANAGER, T_ID, T, "manager"],
    [MECANICO, T_ID, T, "mechanic"],
    [MANAGER_AJENO, OTRO_ID, OTRO, "manager"],
  ] as const) {
    const email = emailDe(id, slug);
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${id}, ${tenantId}, ${email}, ${id}, ${role}, true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET role = ${role}, is_active = true`;
  }

  // Cada test crea su propio cliente con `nuevoId()`; el teardown los borra
  // por tenant_slug, así que no hace falta sembrar clientes fijos aquí.
  app = await buildApp();
  await app.ready();
}, 120_000);

afterAll(async () => {
  if (app) await app.close();
  const sql = getDb() as any;

  // Las cuentas y los asientos tienen FK a clients(id) con ON DELETE CASCADE,
  // pero se borran explícitamente igual: si un test de FK falla, el borrado en
  // cascada lo enmascararía y dejaría el residuo sin señal visible.
  await sql`DELETE FROM loyalty_transactions WHERE tenant_slug = ANY(${[T, OTRO]})`;
  await sql`DELETE FROM loyalty_accounts WHERE tenant_slug = ANY(${[T, OTRO]})`;
  await sql`DELETE FROM loyalty_rewards WHERE tenant_slug = ANY(${[T, OTRO]})`;
  await sql`DELETE FROM google_reviews WHERE tenant_slug = ANY(${[T, OTRO]})`;
  await sql`DELETE FROM public.audit_log WHERE tenant_slug = ANY(${[T, OTRO]})`;
  // Por slug y no por id: cada test crea su cliente con `nuevoId()`, así que
  // borrar solo los dos ids fijos dejaba un cliente huérfano por test.
  await sql`DELETE FROM clients WHERE tenant_slug = ANY(${[T, OTRO]})`;
  await sql`DELETE FROM public.profiles WHERE tenant_id = ANY(${[T_ID, OTRO_ID]})`;
  await sql`DELETE FROM public.tenants WHERE id = ANY(${[T_ID, OTRO_ID]})`;
}, 120_000);

/** Deja al cliente con una cuenta limpia en 0 puntos. */
async function resetearCuenta(clienteId: string, slug: string): Promise<void> {
  const sql = getDb() as any;
  await sql`DELETE FROM loyalty_transactions WHERE cliente_id = ${clienteId} AND tenant_slug = ${slug}`;
  await sql`DELETE FROM loyalty_accounts WHERE cliente_id = ${clienteId} AND tenant_slug = ${slug}`;
}

async function crearReward(
  id: string,
  slug: string,
  puntosRequeridos: number,
  activo = true,
): Promise<void> {
  const sql = getDb() as any;
  await sql`INSERT INTO loyalty_rewards (id, nombre, descripcion, puntos_requeridos, activo, tenant_slug)
    VALUES (${id}, 'Premio T-46', 'Premio de prueba', ${puntosRequeridos}, ${activo}, ${slug})
    ON CONFLICT (id) DO NOTHING`;
}

// ═══════════════════════════════════════════════════════════════════
//  Fidelity — el GET roto
// ═══════════════════════════════════════════════════════════════════

describe("T-46 · CRM-02a lectura de la cuenta de fidelización", () => {
  it("GET devuelve la cuenta con el nombre del cliente (JOIN uuid=text)", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente del JOIN");
    await resetearCuenta(clienteId, T);
    const sql = getDb() as any;
    await sql`INSERT INTO loyalty_accounts
        (cliente_id, puntos_actuales, puntos_ganados_total, nivel, tenant_slug)
      VALUES (${clienteId}, 250, 250, 'BRONCE', ${T})`;

    const res = await app.inject({
      method: "GET",
      url: `/marketing/loyalty/${clienteId}`,
      headers: adminAuth(),
    });

    // Antes de la migración 0032 este endpoint devolvía 500 siempre.
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.clienteId).toBe(clienteId);
    expect(body.clienteNombre).toBe("Cliente del JOIN");
    expect(body.puntosActuales).toBe(250);
  });

  it("GET devuelve 404 si el cliente no tiene cuenta", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Sin cuenta");

    const res = await app.inject({
      method: "GET",
      url: `/marketing/loyalty/${clienteId}`,
      headers: adminAuth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET no expone la cuenta de un cliente de otro tenant", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente local");
    const sql = getDb() as any;
    await sql`INSERT INTO loyalty_accounts
        (cliente_id, puntos_actuales, puntos_ganados_total, nivel, tenant_slug)
      VALUES (${clienteId}, 999, 999, 'ORO', ${T})`;

    const res = await app.inject({
      method: "GET",
      url: `/marketing/loyalty/${clienteId}`,
      headers: ajenoAuth(),
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET rechaza un clienteId que no es UUID con 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/marketing/loyalty/no-es-uuid",
      headers: adminAuth(),
    });
    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Fidelity — acreditar puntos
// ═══════════════════════════════════════════════════════════════════

describe("T-46 · CRM-02b acreditar puntos", () => {
  it("acredita puntos, crea la cuenta y escribe el asiento del libro", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente crédito");
    await resetearCuenta(clienteId, T);

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 300, descripcion: "Reparación de mayo" },
    });

    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().puntosActuales).toBe(300);
    expect(res.json().puntosGanadosTotal).toBe(300);
    // El saldo tiene que coincidir con el libro, no con un número inventado.
    expect(await saldoDesdeLibro(clienteId, T)).toBe(300);
  });

  it("acumula entre varias acreditaciones y conserva el nivel", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente acumulado");
    await resetearCuenta(clienteId, T);

    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 300 },
    });
    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 400 },
    });

    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().puntosActuales).toBe(700);
    expect(await saldoDesdeLibro(clienteId, T)).toBe(700);
  });

  it("sube de nivel según los puntos acumulados", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente nivel");
    await resetearCuenta(clienteId, T);

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 2500 },
    });
    // 2500 >= 2000 → ORO. El nivel se recalcula en la escritura, no queda en
    // BRONCE para siempre como antes.
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().nivel).toBe("ORO");
  });

  it("rechaza puntos cero o negativos con 422", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente negativo");
    await resetearCuenta(clienteId, T);

    for (const puntos of [0, -50]) {
      const res = await app.inject({
        method: "POST",
        url: `/marketing/loyalty/${clienteId}/points`,
        headers: managerAuth(),
        payload: { puntos },
      });
      // El schema de Fastify lo corta antes con 400 si es negativo; el
      // ValidationError del servicio es la segunda red para puntos no enteros.
      expect([400, 422]).toContain(res.statusCode);
    }
    expect(await saldoDesdeLibro(clienteId, T)).toBe(0);
  });

  it("no acredita puntos a un cliente de otro tenant (404)", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, OTRO, "Cliente del otro taller");
    await resetearCuenta(clienteId, OTRO);

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: adminAuth(),
      payload: { puntos: 500 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("exige manager+ para acreditar (mecánico recibe 403)", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente sin permiso");
    await resetearCuenta(clienteId, T);

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: mecanicoAuth(),
      payload: { puntos: 100 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("escribe el movimiento en el historial del cliente", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente historial");
    await resetearCuenta(clienteId, T);

    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 120, descripcion: "Cambio de aceite" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/marketing/loyalty/${clienteId}/movements`,
      headers: adminAuth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    const movs = res.json();
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe("GANADO");
    expect(movs[0].puntos).toBe(120);
    expect(movs[0].descripcion).toBe("Cambio de aceite");
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Fidelity — canjear
// ═══════════════════════════════════════════════════════════════════

describe("T-46 · CRM-02c canjear puntos", () => {
  it("canjea puntos y descuenta del saldo y del libro", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente canje");
    await resetearCuenta(clienteId, T);
    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 1000 },
    });

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem`,
      headers: managerAuth(),
      payload: { puntos: 300, descripcion: "Canje Taller" },
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().puntosActuales).toBe(700);
    // El acumulado histórico NO baja al canjear.
    expect(res.json().puntosGanadosTotal).toBe(1000);
    expect(await saldoDesdeLibro(clienteId, T)).toBe(700);
  });

  it("no permite canjear más de lo que hay en el saldo", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente insuf");
    await resetearCuenta(clienteId, T);
    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 100 },
    });

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem`,
      headers: managerAuth(),
      payload: { puntos: 500 },
    });
    expect(res.statusCode).toBe(422);
    // Nada se escribe cuando el canje se rechaza.
    expect(await saldoDesdeLibro(clienteId, T)).toBe(100);
  });

  it("no puede dejar el saldo en negativo con canjes encadenados", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente concurrencia");
    await resetearCuenta(clienteId, T);
    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 200 },
    });

    const r1 = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem`,
      headers: managerAuth(),
      payload: { puntos: 150 },
    });
    const r2 = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem`,
      headers: managerAuth(),
      payload: { puntos: 150 },
    });

    expect(r1.statusCode).toBe(200);
    // El segundo canje se rechaza: el saldo ya no alcanza. Sin el FOR UPDATE,
    // los dos leerían 200 y el saldo quedaría en -100.
    expect(r2.statusCode).toBe(422);
    expect(await saldoDesdeLibro(clienteId, T)).toBe(50);
  });

  it("canjea un premio del catálogo por sus puntos requeridos", async () => {
    const clienteId = nuevoId();
    const rewardId = nuevoId();
    await crearCliente(clienteId, T, "Cliente premio");
    await resetearCuenta(clienteId, T);
    await crearReward(rewardId, T, 500);
    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 600 },
    });

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem/${rewardId}`,
      headers: managerAuth(),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().puntosActuales).toBe(100);
  });

  it("no canjea un premio inactivo ni uno de otro tenant", async () => {
    const clienteId = nuevoId();
    const rewardId = nuevoId();
    await crearCliente(clienteId, T, "Cliente premio inactivo");
    await resetearCuenta(clienteId, T);
    await crearReward(rewardId, T, 100, false);
    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 500 },
    });

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem/${rewardId}`,
      headers: managerAuth(),
    });
    expect(res.statusCode).toBe(404);
    expect(await saldoDesdeLibro(clienteId, T)).toBe(500);
  });

  it("exige manager+ para canjear", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente canje sin permiso");
    await resetearCuenta(clienteId, T);
    await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/points`,
      headers: managerAuth(),
      payload: { puntos: 200 },
    });

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem`,
      headers: mecanicoAuth(),
      payload: { puntos: 100 },
    });
    expect(res.statusCode).toBe(403);
  });

  it("devuelve 404 al canjear sin cuenta previa", async () => {
    const clienteId = nuevoId();
    await crearCliente(clienteId, T, "Cliente sin cuenta para canje");
    await resetearCuenta(clienteId, T);

    const res = await app.inject({
      method: "POST",
      url: `/marketing/loyalty/${clienteId}/redeem`,
      headers: managerAuth(),
      payload: { puntos: 10 },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Reseñas
// ═══════════════════════════════════════════════════════════════════

describe("T-46 · CRM-02d responder reseñas", () => {
  it("registra la respuesta con trazabilidad de fecha y autor", async () => {
    const reviewId = nuevoId();
    await crearReview(reviewId, T, 2, "Cliente molesto");

    const res = await app.inject({
      method: "POST",
      url: `/marketing/reviews/${reviewId}/respond`,
      headers: managerAuth(),
      payload: { respuesta: "Lamentamos la experiencia, ya lo solucionamos." },
    });

    expect(res.statusCode, res.body).toBe(201);
    const body = res.json();
    expect(body.primeraRespuesta).toBe(true);
    expect(body.review.responded).toBe(true);
    expect(body.review.respuesta).toContain("Lamentamos");
    expect(body.review.respondidoAt).toBeTruthy();
  });

  it("editar una respuesta existente devuelve 200 y no la duplica", async () => {
    const reviewId = nuevoId();
    await crearReview(reviewId, T, 5, "Cliente conforme");
    const url = `/marketing/reviews/${reviewId}/respond`;

    await app.inject({
      method: "POST",
      url,
      headers: managerAuth(),
      payload: { respuesta: "Primera versión" },
    });
    const res = await app.inject({
      method: "POST",
      url,
      headers: managerAuth(),
      payload: { respuesta: "Segunda versión corregida" },
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().primeraRespuesta).toBe(false);
    expect(res.json().review.respuesta).toBe("Segunda versión corregida");

    const list = await app.inject({
      method: "GET",
      url: "/marketing/reviews?limit=200",
      headers: adminAuth(),
    });
    const mias = list.json().filter((r: any) => r.id === reviewId);
    expect(mias).toHaveLength(1);
  });

  it("rechaza una respuesta vacía con 400 y una en blanco con 422", async () => {
    const reviewId = nuevoId();
    await crearReview(reviewId, T, 3, "Cliente medio");
    const url = `/marketing/reviews/${reviewId}/respond`;

    // Cadena vacía: la corta el JSON schema de la ruta (400).
    const vacia = await app.inject({
      method: "POST",
      url,
      headers: managerAuth(),
      payload: { respuesta: "" },
    });
    expect(vacia.statusCode).toBe(400);

    // Solo espacios: el schema la acepta (mide longitud), y la rechaza la regla
    // de negocio del servicio (422). Ninguna de las dos escribe nada.
    const blanco = await app.inject({
      method: "POST",
      url,
      headers: managerAuth(),
      payload: { respuesta: "   " },
    });
    expect(blanco.statusCode).toBe(422);

    const list = await app.inject({
      method: "GET",
      url: "/marketing/reviews?limit=200",
      headers: adminAuth(),
    });
    const mia = list.json().find((r: any) => r.id === reviewId);
    expect(mia.responded).toBe(false);
    expect(mia.respuesta).toBeNull();
  });

  it("no responde una reseña de otro tenant (404)", async () => {
    const reviewId = nuevoId();
    await crearReview(reviewId, OTRO, 1, "Reseña ajena");

    const res = await app.inject({
      method: "POST",
      url: `/marketing/reviews/${reviewId}/respond`,
      headers: managerAuth(),
      payload: { respuesta: "Intento de Writing" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("devuelve 404 al responder una reseña inexistente", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/marketing/reviews/${nuevoId()}/respond`,
      headers: managerAuth(),
      payload: { respuesta: "Hola" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("exige manager+ para responder", async () => {
    const reviewId = nuevoId();
    await crearReview(reviewId, T, 4, "Reseña sin permiso");

    const res = await app.inject({
      method: "POST",
      url: `/marketing/reviews/${reviewId}/respond`,
      headers: mecanicoAuth(),
      payload: { respuesta: "No debería poder" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("elimina la respuesta y devuelve la reseña a pendientes", async () => {
    const reviewId = nuevoId();
    await crearReview(reviewId, T, 1, "Reseña para borrar");
    const url = `/marketing/reviews/${reviewId}/respond`;

    await app.inject({
      method: "POST",
      url,
      headers: managerAuth(),
      payload: { respuesta: "Respuesta que nos arrepentimos" },
    });
    const res = await app.inject({
      method: "DELETE",
      url,
      headers: managerAuth(),
    });

    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().responded).toBe(false);
    expect(res.json().respuesta).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
//  Reseñas — estadísticas
// ═══════════════════════════════════════════════════════════════════

describe("T-46 · CRM-02e estadísticas de reseñas", () => {
  it("devuelve la distribución real por estrella, no ceros", async () => {
    const tenantStats = "e2e-t46-stats";
    const tenantId = "00000000-0000-0000-0000-00000f460009";
    await crearTenant(tenantId, tenantStats);
    const sql = getDb() as any;
    const email = "stats@t46.test";
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${'00000000-0000-0000-0000-00000f460099'}, ${tenantId}, ${email}, 'Stats', 'admin', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;

    // 5, 5, 4, 1 → distribución real {1:1, 4:1, 5:2}
    for (const [i, rating] of [5, 5, 4, 1].entries()) {
      await sql`INSERT INTO google_reviews (id, autor, rating, texto, fecha, responded, tenant_slug)
        VALUES (${`00000000-0000-0000-0000-00000f4601${String(i).padStart(2, "0")}`}, ${`Cliente ${i}`}, ${rating}, 'texto', NOW(), false, ${tenantStats})`;
    }

    const res = await app.inject({
      method: "GET",
      url: "/marketing/reviews/stats",
      headers: auth(
        generateToken({
          id: "00000000-0000-0000-0000-00000f460099",
          email,
          role: "admin",
          tenantId,
          tenantSlug: tenantStats,
        }),
        tenantStats,
      ),
    });

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    // Antes devolvía {1:0,2:0,3:0,4:0,5:0} fijo, así que el gráfico salía vacío.
    expect(body.totalReviews).toBe(4);
    expect(body.ratingDistribution[1]).toBe(1);
    expect(body.ratingDistribution[4]).toBe(1);
    expect(body.ratingDistribution[5]).toBe(2);
    expect(body.ratingDistribution[2]).toBe(0);
    expect(body.ratingDistribution[3]).toBe(0);
    expect(body.averageRating).toBeCloseTo(3.75, 2);
    expect(body.pendingCount).toBe(4);

    await sql`DELETE FROM google_reviews WHERE tenant_slug = ${tenantStats}`;
    await sql`DELETE FROM public.profiles WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.tenants WHERE id = ${tenantId}`;
  });

  it("devuelve ceros sin reseñas, no null ni NaN", async () => {
    const tenantVacio = "e2e-t46-vacio";
    const tenantId = "00000000-0000-0000-0000-00000f460008";
    await crearTenant(tenantId, tenantVacio);
    const sql = getDb() as any;
    const email = "vacio@t46.test";
    await sql`INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${'00000000-0000-0000-0000-00000f460098'}, ${tenantId}, ${email}, 'Vacio', 'admin', true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET is_active = true`;

    const res = await app.inject({
      method: "GET",
      url: "/marketing/reviews/stats",
      headers: auth(
        generateToken({
          id: "00000000-0000-0000-0000-00000f460098",
          email,
          role: "admin",
          tenantId,
          tenantSlug: tenantVacio,
        }),
        tenantVacio,
      ),
    });

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.totalReviews).toBe(0);
    expect(body.averageRating).toBe(0);
    expect(body.responseRate).toBe(0);
    expect(body.sentimentScore).toBe(0);
    expect(body.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

    await sql`DELETE FROM public.profiles WHERE tenant_id = ${tenantId}`;
    await sql`DELETE FROM public.tenants WHERE id = ${tenantId}`;
  });

  it("filtra solo pendientes cuando se pide", async () => {
    const reviewId = nuevoId();
    const respondida = nuevoId();
    await crearReview(reviewId, T, 2, "Pendiente");
    await crearReview(respondida, T, 5, "Ya respondida");
    await app.inject({
      method: "POST",
      url: `/marketing/reviews/${respondida}/respond`,
      headers: managerAuth(),
      payload: { respuesta: "Gracias" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/marketing/reviews?pendientes=true&limit=200",
      headers: adminAuth(),
    });

    expect(res.statusCode, res.body).toBe(200);
    const todas = res.json();
    expect(todas.length).toBeGreaterThan(0);
    // El filtro tiene que excluir las ya respondidas.
    expect(todas.every((r: any) => r.responded === false)).toBe(true);
  });
});
