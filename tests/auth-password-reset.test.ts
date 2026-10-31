/**
 * S132-9 — Recuperación de contraseña real (DB-backed).
 *
 * Cubre el flujo completo:
 *   POST /api/auth/forgot-password → token de un solo uso (1 h) + email
 *   POST /api/auth/reset-password  → canje + nueva contraseña + login
 *
 * Invariantes que fija:
 *   - No hay enumeración de usuarios: la respuesta es idéntica exista o
 *     no la cuenta y no se emite token ni email para emails inexistentes.
 *   - Un token sólo sirve una vez, vence a la hora y está atado al taller.
 *   - Al emitir un token nuevo, el anterior queda inutilizado.
 *   - La contraseña se reemplaza de verdad (login con la nueva funciona,
 *     con la vieja falla).
 *   - Rate limit por ip+taller+email.
 *
 * Requiere DATABASE_URL con la migración 0038 aplicada. Se salta si falta.
 *
 * @module tests/auth-password-reset
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull, sql as rawSql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { tenants, profiles, passwordResetTokens } from "../src/shared/database/schema/index.js";
import { hashPassword } from "../src/modules/config/services/auth-utils.js";
import { hashResetToken } from "../src/modules/config/services/password-reset.service.js";
import { resetAttempts } from "../src/shared/services/rate-limiter.js";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";

const dbAvailable = !!process.env["DATABASE_URL"];

const TENANT_SLUG = `pwreset-${randomUUID().slice(0, 8)}`;
const OLD_PASSWORD = "ViejaPass123!";
const NEW_PASSWORD = "NuevaPass456!";

let sqlConn: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let app: FastifyInstance | null = null;
let tenantId = "";
const createdProfileIds: string[] = [];

/** Emails únicos por test (el rate limit es por email). */
function uniqueEmail(tag: string): string {
  return `${tag}-${randomUUID().slice(0, 8)}@example.test`;
}

async function createProfile(email: string): Promise<string> {
  const [row] = await db!
    .insert(profiles)
    .values({
      tenantId,
      email,
      fullName: `Test ${email}`,
      role: "admin",
      passwordHash: hashPassword(OLD_PASSWORD),
      isActive: true,
    })
    .returning({ id: profiles.id });
  createdProfileIds.push(row!.id);
  return row!.id;
}

function resetKey(tenantSlug: string, email: string): void {
  resetAttempts(`password-reset:127.0.0.1:${tenantSlug}:${email.toLowerCase()}`);
  resetAttempts(`password-reset:unknown:${tenantSlug}:${email.toLowerCase()}`);
}

async function post(url: string, payload: unknown) {
  return app!.inject({ method: "POST", url, payload });
}

beforeAll(async () => {
  if (!dbAvailable) return;

  sqlConn = postgres(process.env["DATABASE_URL"]!, {
    max: 2,
    connect_timeout: 5,
    ssl: process.env["DATABASE_URL"]!.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
  db = drizzle(sqlConn);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Taller ${TENANT_SLUG}`,
      slug: TENANT_SLUG,
      schemaName: `tenant_${TENANT_SLUG}`.replace(/-/g, "_"),
      ruc: "80000001-2",
    })
    .returning({ id: tenants.id });
  tenantId = tenant!.id;

  app = await buildApp();
}, 60_000);

afterAll(async () => {
  if (app) await app.close();
  if (!db || !sqlConn) return;
  // password_reset_tokens cae por ON DELETE CASCADE de profiles.
  for (const id of createdProfileIds) {
    await db.delete(profiles).where(eq(profiles.id, id)).catch(() => {});
  }
  await db.delete(tenants).where(eq(tenants.id, tenantId)).catch(() => {});
  await sqlConn.end({ timeout: 5 }).catch(() => {});
});

describe.skipIf(!dbAvailable)("S132-9 · recuperación de contraseña", () => {
  it("email inexistente: respuesta uniforme, sin token y sin email", async () => {
    const email = uniqueEmail("fantasma");
    resetKey(TENANT_SLUG, email);

    const res = await post("/api/auth/forgot-password", {
      tenantSlug: TENANT_SLUG,
      email,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/Si existe una cuenta/i);

    const tokens = await db!
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tenantSlug, TENANT_SLUG));
    expect(tokens).toHaveLength(0);
  });

  it("email existente: emite token de 1 h, guarda sólo el hash y envía el email", async () => {
    const email = uniqueEmail("real");
    resetKey(TENANT_SLUG, email);
    const profileId = await createProfile(email);

    const res = await post("/api/auth/forgot-password", {
      tenantSlug: TENANT_SLUG,
      email,
    });
    expect(res.statusCode).toBe(200);

    const rows = await db!
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.profileId, profileId),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.tenantSlug).toBe(TENANT_SLUG);
    // Sólo el hash: 64 hex, nunca el token en claro.
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    const ttlMinutes = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(ttlMinutes).toBeGreaterThan(55);
    expect(ttlMinutes).toBeLessThanOrEqual(60);

    // El email quedó registrado para auditoría.
    const log = await db!.execute(
      rawSql`SELECT count(*)::int AS n FROM email_log
             WHERE entity_type = 'password_reset' AND entity_id = ${profileId}`,
    );
    expect(Number((log as unknown as Array<{ n: number }>)[0]!.n)).toBe(1);
  });

  it("un pedido nuevo invalida el token anterior", async () => {
    const email = uniqueEmail("doble");
    resetKey(TENANT_SLUG, email);
    const profileId = await createProfile(email);

    const first = await post("/api/auth/forgot-password", {
      tenantSlug: TENANT_SLUG,
      email,
    });
    expect(first.statusCode).toBe(200);

    const second = await post("/api/auth/forgot-password", {
      tenantSlug: TENANT_SLUG,
      email,
    });
    expect(second.statusCode).toBe(200);

    const pending = await db!
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.profileId, profileId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
    expect(pending).toHaveLength(1);
  });

  it("canje válido: cambia la contraseña y permite login con la nueva", async () => {
    const email = uniqueEmail("canje");
    resetKey(TENANT_SLUG, email);
    const profileId = await createProfile(email);

    // Token conocido insertado directo (el de la ruta es opaco por diseño).
    const plainToken = `token-prueba-${randomUUID()}`;
    await db!.insert(passwordResetTokens).values({
      profileId,
      tenantSlug: TENANT_SLUG,
      tokenHash: hashResetToken(plainToken),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });

    const res = await post("/api/auth/reset-password", {
      tenantSlug: TENANT_SLUG,
      token: plainToken,
      password: NEW_PASSWORD,
    });
    expect(res.statusCode).toBe(200);

    // Token consumido (usado) y login con la contraseña nueva.
    const [row] = await db!
      .select({ usedAt: passwordResetTokens.usedAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, hashResetToken(plainToken)));
    expect(row!.usedAt).not.toBeNull();

    const okLogin = await post("/api/auth/login", {
      tenantSlug: TENANT_SLUG,
      email,
      password: NEW_PASSWORD,
    });
    expect(okLogin.statusCode).toBe(200);
    expect(okLogin.json().token).toBeTruthy();

    const oldLogin = await post("/api/auth/login", {
      tenantSlug: TENANT_SLUG,
      email,
      password: OLD_PASSWORD,
    });
    expect(oldLogin.statusCode).toBe(401);
  });

  it("token ya usado: rechazado con mensaje genérico", async () => {
    const email = uniqueEmail("reuso");
    resetKey(TENANT_SLUG, email);
    const profileId = await createProfile(email);

    const plainToken = `token-reuso-${randomUUID()}`;
    await db!.insert(passwordResetTokens).values({
      profileId,
      tenantSlug: TENANT_SLUG,
      tokenHash: hashResetToken(plainToken),
      expiresAt: new Date(Date.now() + 30 * 60_000),
      usedAt: new Date(),
    });

    const res = await post("/api/auth/reset-password", {
      tenantSlug: TENANT_SLUG,
      token: plainToken,
      password: NEW_PASSWORD,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().message).toMatch(/inválido o expiró/i);
  });

  it("token vencido: rechazado", async () => {
    const email = uniqueEmail("vencido");
    resetKey(TENANT_SLUG, email);
    const profileId = await createProfile(email);

    const plainToken = `token-vencido-${randomUUID()}`;
    await db!.insert(passwordResetTokens).values({
      profileId,
      tenantSlug: TENANT_SLUG,
      tokenHash: hashResetToken(plainToken),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await post("/api/auth/reset-password", {
      tenantSlug: TENANT_SLUG,
      token: plainToken,
      password: NEW_PASSWORD,
    });
    expect(res.statusCode).toBe(422);
  });

  it("token de otro taller: rechazado (el token está atado al slug)", async () => {
    const email = uniqueEmail("otropatio");
    resetKey(TENANT_SLUG, email);
    const profileId = await createProfile(email);

    const plainToken = `token-otro-${randomUUID()}`;
    await db!.insert(passwordResetTokens).values({
      profileId,
      tenantSlug: TENANT_SLUG,
      tokenHash: hashResetToken(plainToken),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });

    const res = await post("/api/auth/reset-password", {
      tenantSlug: "taller-que-no-es",
      token: plainToken,
      password: NEW_PASSWORD,
    });
    expect(res.statusCode).toBe(422);
  });

  it("contraseña corta: rechazada por la política (mínimo 8)", async () => {
    const email = uniqueEmail("corta");
    resetKey(TENANT_SLUG, email);
    const profileId = await createProfile(email);

    const plainToken = `token-corta-${randomUUID()}`;
    await db!.insert(passwordResetTokens).values({
      profileId,
      tenantSlug: TENANT_SLUG,
      tokenHash: hashResetToken(plainToken),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });

    const res = await post("/api/auth/reset-password", {
      tenantSlug: TENANT_SLUG,
      token: plainToken,
      password: "corta",
    });
    expect(res.statusCode).toBe(422);

    // El token NO se consumió: la validación falla antes del canje.
    const [row] = await db!
      .select({ usedAt: passwordResetTokens.usedAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, hashResetToken(plainToken)));
    expect(row!.usedAt).toBeNull();
  });

  it("rate limit: 4º pedido del mismo ip+taller+email → 429", async () => {
    const email = uniqueEmail("flood");
    resetKey(TENANT_SLUG, email);
    await createProfile(email);

    const codes: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await post("/api/auth/forgot-password", {
        tenantSlug: TENANT_SLUG,
        email,
      });
      codes.push(res.statusCode);
    }

    expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
    expect(codes[3]).toBe(429);
  });
});
