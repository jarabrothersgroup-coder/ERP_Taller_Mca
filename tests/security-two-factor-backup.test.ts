/**
 * T-21b — 2FA (TOTP) server-side + guards en backups destructivos (SEG-03)
 *
 * La auditoría 2026-09-25 encontró que `2fa/setup` generaba el secret y lo
 * descartaba (no había persistencia) y que /backup/execute|restore|purge no
 * tenían rol ni 2FA (el check de restore era un stub sólo en producción).
 *
 * Este archivo arranca la app REAL (buildApp + DB migrada) y verifica:
 *   1. enrolamiento persistido (secret cifrado, backup codes hasheados)
 *   2. guards fail-closed: sin admin → 403 · sin enrolamiento → 403 accionable ·
 *      código inválido/faltante → 403 · TOTP o backup code válido → pasa
 *   3. código de respaldo es de uso único (consumido tras usarlo)
 *
 * Fixtures propias bajo el tenant "e2e-2fa-backup" (limpias en afterAll).
 *
 * @module tests/security-two-factor-backup
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { generateToken } from "../src/shared/services/auth-jwt.js";
import { getDb } from "../src/shared/database/connection.js";
import { decryptSecret } from "../src/modules/enterprise/services/two-factor.service.js";

// ─── Constantes de fixture ────────────────────────────────

const TENANT = "e2e-2fa-backup";
const TENANT_ID = "00000000-0000-0000-0000-0000e2f00000";
const ADMIN_A_ID = "00000000-0000-0000-0000-0000e2f00001"; // nunca enrola → fail-closed
const ADMIN_B_ID = "00000000-0000-0000-0000-0000e2f00002"; // enrola en /2fa/setup
const MANAGER_ID = "00000000-0000-0000-0000-0000e2f00003";
const ADMIN_A_EMAIL = "admin-a@e2e-2fa-backup.test";
const ADMIN_B_EMAIL = "admin-b@e2e-2fa-backup.test";
const MANAGER_EMAIL = "manager@e2e-2fa-backup.test";
const TS = Date.now().toString(36);
const STAGING_DIR = `/tmp/backup-staging/e2e-2fa-${TS}`;

let app: FastifyInstance;
let bearerA: string;
let bearerB: string;
let bearerManager: string;
let totpSecret: string;
let backupCodes: string[];

// ─── Helpers ──────────────────────────────────────────────

function auth(bearer: string): Record<string, string> {
  return { authorization: `Bearer ${bearer}`, "x-tenant-slug": TENANT };
}

/** Ejecuta un bloque SQL con app.current_tenant = TENANT (fixtures/limpieza). */
async function asTenant<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const sql = getDb() as any;
  return sql.begin(async (tx: any) => {
    await tx`SELECT set_config('app.current_tenant', ${TENANT}, true)`;
    return fn(tx);
  });
}

/**
 * TOTP (RFC 6238, SHA1 · 6 dígitos · 30s) — misma especificación que
 * verifyTotp() en el service; implementado en el test para generar códigos
 * válidos/inválidos sin exponer un generador en producción.
 */
function totp(secretBase32: string, atMs: number = Date.now()): string {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const c of cleaned) bits += CHARS.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i++) {
    key[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }

  const counter = Math.floor(atMs / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(0, 0);
  msg.writeUInt32BE(counter, 4);

  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

function bearerFor(
  id: string,
  email: string,
  role: "admin" | "manager",
): string {
  return generateToken({ id, email, role, tenantId: TENANT_ID, tenantSlug: TENANT });
}

// ─── Setup ────────────────────────────────────────────────

beforeAll(async () => {
  const sql = getDb() as any;

  await sql`
    INSERT INTO tenants (id, name, slug, schema_name, is_active)
    VALUES (${TENANT_ID}, 'E2E 2FA Backup', ${TENANT}, 'tenant_e2e_2fa_backup', true)
    ON CONFLICT (slug) DO NOTHING
  `;
  const profiles = [
    [ADMIN_A_ID, ADMIN_A_EMAIL, "Admin A (sin 2FA)", "admin"],
    [ADMIN_B_ID, ADMIN_B_EMAIL, "Admin B (con 2FA)", "admin"],
    [MANAGER_ID, MANAGER_EMAIL, "Manager E2E", "manager"],
  ] as const;
  for (const [id, email, fullName, role] of profiles) {
    await sql`
      INSERT INTO profiles (id, tenant_id, email, full_name, role, is_active)
      VALUES (${id}, ${TENANT_ID}, ${email}, ${fullName}, ${role}, true)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = true
    `;
  }

  bearerA = bearerFor(ADMIN_A_ID, ADMIN_A_EMAIL, "admin");
  bearerB = bearerFor(ADMIN_B_ID, ADMIN_B_EMAIL, "admin");
  bearerManager = bearerFor(MANAGER_ID, MANAGER_EMAIL, "manager");

  mkdirSync(STAGING_DIR, { recursive: true });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  try {
    const sql = getDb() as any;
    await sql`DELETE FROM profiles WHERE tenant_id = ${TENANT_ID}`;
    await sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`;
  } catch (err) {
    console.error("[security-two-factor-backup] cleanup falló:", err);
  }
  try {
    rmSync(STAGING_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  if (app) await app.close();
  const handles = (process as any)._getActiveHandles?.() ?? [];
  for (const h of handles) {
    if (h && typeof h.unref === "function") {
      try {
        h.unref();
      } catch {
        /* ignore */
      }
    }
  }
});

// ─── Tests ────────────────────────────────────────────────

describe("T-21b — 2FA server-side + guards de backup (SEG-03)", () => {
  it("GET /2fa/status sin enrolamiento → enabled:false", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/2fa/status",
      headers: auth(bearerA),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().enabled).toBe(false);
  });

  it("manager → 403 en /2fa/setup (requireAdmin)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/2fa/setup",
      headers: auth(bearerManager),
      payload: {},
    });
    expect(res.statusCode, res.body).toBe(403);
  });

  it("POST /2fa/setup persiste el enrolamiento (secret cifrado + hashes)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/2fa/setup",
      headers: auth(bearerB),
      payload: {},
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.secret).toMatch(/^[A-Z2-7]+$/);
    expect(Array.isArray(body.backupCodes)).toBe(true);
    expect(body.backupCodes).toHaveLength(10);
    totpSecret = body.secret;
    backupCodes = body.backupCodes;

    const rows = await asTenant((tx) =>
      tx`SELECT secret_encrypted, backup_codes_hash, enabled_at
         FROM two_factor_secrets
         WHERE tenant_slug = ${TENANT} AND profile_id = ${ADMIN_B_ID}`,
    );
    expect(rows).toHaveLength(1);
    // Secret NUNCA en plaintext y reversible sólo con TOKEN_SECRET
    expect(rows[0].secret_encrypted).not.toBe(totpSecret);
    expect(decryptSecret(rows[0].secret_encrypted)).toBe(totpSecret);
    // Backup codes hasheados (scrypt salt:hash), no en claro
    expect(rows[0].backup_codes_hash).toHaveLength(10);
    expect(rows[0].backup_codes_hash[0]).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(rows[0].backup_codes_hash).not.toContain(backupCodes[0]);
    expect(rows[0].enabled_at).toBeTruthy();
  });

  it("GET /2fa/status tras setup → enabled:true", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/2fa/status",
      headers: auth(bearerB),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().enabled).toBe(true);
  });

  it("admin SIN enrolamiento → 403 accionable en /backup/restore (fail-closed)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/backup/restore",
      headers: auth(bearerA),
      payload: {
        backupFilePath: `${STAGING_DIR}/no-existe.dump`,
        twoFactorCode: totp(totpSecret),
      },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.body).toMatch(/2fa\/setup/);
  });

  it("código inválido → 403 en /backup/restore", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/backup/restore",
      headers: auth(bearerB),
      payload: {
        backupFilePath: `${STAGING_DIR}/no-existe.dump`,
        twoFactorCode: "abc123", // no numérico → verifyTotp rechaza
      },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.body).toMatch(/inválido/i);
  });

  it("sin código → 403 en /backup/execute (fail-closed)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/backup/execute",
      headers: auth(bearerB),
      payload: {},
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.body).toMatch(/2FA/i);
  });

  it("código TOTP válido → /backup/purge ejecuta (200)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/backup/purge",
      headers: auth(bearerB),
      payload: { path: STAGING_DIR, twoFactorCode: totp(totpSecret) },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(typeof res.json().purged).toBe("number");
  });

  it("backup code válido → pasa el guard y queda consumido (uso único)", async () => {
    const code = backupCodes[0];

    const primero = await app.inject({
      method: "POST",
      url: "/backup/purge",
      headers: auth(bearerB),
      payload: { path: STAGING_DIR, twoFactorCode: code },
    });
    expect(primero.statusCode, primero.body).toBe(200);

    const segundo = await app.inject({
      method: "POST",
      url: "/backup/purge",
      headers: auth(bearerB),
      payload: { path: STAGING_DIR, twoFactorCode: code },
    });
    expect(segundo.statusCode, segundo.body).toBe(403);
    expect(segundo.body).toMatch(/inválido/i);
  });

  it("código TOTP válido → pasa el guard de /backup/restore (no 401/403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/backup/restore",
      headers: auth(bearerB),
      payload: {
        backupFilePath: `${STAGING_DIR}/no-existe.dump`,
        twoFactorCode: totp(totpSecret),
      },
    });
    // El guard dejó pasar: el engine devuelve success:false (archivo
    // inexistente), pero jamás debe responder 401/403 con código correcto.
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
    expect(res.json().success).toBe(false);
    expect(res.json().error).toMatch(/no-existe\.dump/);
  });
});
