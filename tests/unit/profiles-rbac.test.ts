/**
 * SEG-01 / T-21a — Profiles route security (auditoría 2026-09-25).
 *
 * Validates that /api/profiles can no longer be used for privilege escalation
 * or cross-tenant access:
 *   - 401 when there is no authenticated profile.
 *   - 403 when a non-admin tries to POST/PATCH/DELETE (GET stays authenticated-only).
 *   - 404 when the :id belongs to ANOTHER tenant (no existence leak).
 *   - 403 when an admin changes their own role/isActive or deletes themselves.
 *   - 400 for invalid roles and non-whitelisted fields.
 *   - 200/201 with legacy FE aliases (name → fullName, active → isActive).
 *
 * DB is mocked with a queue: each query terminal (limit/orderBy/returning)
 * pops the next pre-seeded result set, so tests stay offline and fast.
 *
 * @module tests/unit/profiles-rbac
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { errorHandler } from "../../src/shared/middleware/error-handler.js";
import { profileRoutes } from "../../src/modules/config/routes/profiles.js";

// ─── Mock DB (queued results per query terminal) ────────
// vi.mock is hoisted above module consts, so shared state lives in vi.hoisted.
const mocks = vi.hoisted(() => ({
  queryQueue: [] as unknown[][],
  txLog: [] as Array<Record<string, ReturnType<typeof vi.fn>>>,
}));
const queryQueue = mocks.queryQueue;

function buildMockTx() {
  function result(): Promise<unknown[]> & { limit: () => unknown; offset: () => unknown } {
    const rows = queryQueue.shift() ?? [];
    const p = Promise.resolve(rows);
    return Object.assign(p, { limit: () => result(), offset: () => result() });
  }
  const tx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn(() => result()),
    limit: vi.fn(() => result()),
    offset: vi.fn(() => result()),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(() => result()),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(buildMockTx())),
  } as Record<string, ReturnType<typeof vi.fn>>;
  mocks.txLog.push(tx);
  return tx;
}

vi.mock("../../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => buildMockTx()),
}));

// ─── Test fixtures ──────────────────────────────────────

const TENANT = "test-taller";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ROW = [{ id: TENANT_ID }];

interface TestProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  tenantId: string;
}

const admin: TestProfile = {
  id: "admin-id",
  email: "admin@test.com",
  fullName: "Admin Test",
  role: "admin",
  isActive: true,
  tenantId: TENANT_ID,
};

const mechanic: TestProfile = {
  id: "mech-id",
  email: "mech@test.com",
  fullName: "Mech Test",
  role: "mechanic",
  isActive: true,
  tenantId: TENANT_ID,
};

/** Injects the test profile via a dedicated header (set by a root onRequest hook). */
function headers(profile?: TestProfile | null): Record<string, string> {
  return {
    "x-tenant-slug": TENANT,
    ...(profile ? { "x-test-profile": JSON.stringify(profile) } : {}),
  };
}

function targetRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "target-id",
    email: "target@test.com",
    fullName: "Target",
    role: "mechanic",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: null,
    ...overrides,
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  // Simulates the global auth-gate: sets request.profile from the test header.
  // Registered on the ROOT scope, so it runs BEFORE the plugin's own hooks.
  app.addHook("onRequest", async (request) => {
    const raw = request.headers["x-test-profile"] as string | undefined;
    if (raw) request.profile = JSON.parse(raw);
  });
  await app.register(profileRoutes);
  await app.ready();
  return app;
}

describe("SEG-01: /api/profiles — auth, RBAC y aislamiento de tenant", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    queryQueue.length = 0;
    mocks.txLog.length = 0;
  });

  // ─── 401 — Autenticación ──────────────────────────

  it("GET sin perfil autenticado → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/profiles", headers: headers(null) });
    expect(res.statusCode).toBe(401);
  });

  it("POST sin perfil autenticado → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/profiles",
      headers: headers(null),
      payload: { email: "x@test.com", fullName: "X", role: "mechanic" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("PATCH sin perfil autenticado → 401", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/some-id",
      headers: headers(null),
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("DELETE sin perfil autenticado → 401", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/profiles/some-id",
      headers: headers(null),
    });
    expect(res.statusCode).toBe(401);
  });

  // ─── 403 — RBAC (solo admin muta) ─────────────────

  it("GET autenticado (mechanic) → 200", async () => {
    queryQueue.push([...TENANT_ROW], [targetRow()]);
    const res = await app.inject({ method: "GET", url: "/api/profiles", headers: headers(mechanic) });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]!.full_name).toBe("Target");
  });

  it("POST de mechanic → 403 (no crea perfiles)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/profiles",
      headers: headers(mechanic),
      payload: { email: "x@test.com", fullName: "X", role: "admin" },
    });
    expect(res.statusCode).toBe(403);
    expect(queryQueue).toHaveLength(0); // rechazado antes de tocar la DB
  });

  it("PATCH de mechanic → 403 (no escala privilegios)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/other-id",
      headers: headers(mechanic),
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(403);
    expect(queryQueue).toHaveLength(0);
  });

  it("DELETE de mechanic → 403", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/profiles/other-id",
      headers: headers(mechanic),
    });
    expect(res.statusCode).toBe(403);
    expect(queryQueue).toHaveLength(0);
  });

  // ─── 200/201 — Admin puede operar dentro de su tenant ──

  it("POST de admin con rol válido → 201", async () => {
    queryQueue.push(
      [...TENANT_ROW],
      [targetRow({ id: "new-id", email: "n@test.com", fullName: "Nuevo" })],
    );
    const res = await app.inject({
      method: "POST",
      url: "/api/profiles",
      headers: headers(admin),
      payload: { email: "n@test.com", fullName: "Nuevo", role: "mechanic" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as Record<string, unknown>;
    expect(body.id).toBe("new-id");
    expect(body.full_name).toBe("Nuevo");
  });

  it("PATCH de admin sobre otro perfil → 200", async () => {
    queryQueue.push(
      [...TENANT_ROW],
      [targetRow({ role: "mechanic" })],
      [targetRow({ role: "manager" })],
    );
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/target-id",
      headers: headers(admin),
      payload: { role: "manager" },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as Record<string, unknown>).role).toBe("manager");
  });

  it("PATCH acepta alias legados del FE (name → fullName, active → isActive)", async () => {
    queryQueue.push(
      [...TENANT_ROW],
      [targetRow()],
      [targetRow({ fullName: "Renombrado", isActive: false })],
    );
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/target-id",
      headers: headers(admin),
      payload: { name: "Renombrado", active: false },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body.full_name).toBe("Renombrado");
    expect(body.is_active).toBe(false);
  });

  it("DELETE de admin sobre otro perfil → 200 (soft-delete)", async () => {
    queryQueue.push([...TENANT_ROW], [{ id: "target-id" }]);
    const res = await app.inject({
      method: "DELETE",
      url: "/api/profiles/target-id",
      headers: headers(admin),
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as Record<string, unknown>).ok).toBe(true);
  });

  // ─── 404 — Cross-tenant (sin leak de existencia) ──────

  it("PATCH sobre un perfil de OTRO tenant → 404", async () => {
    queryQueue.push([...TENANT_ROW], []); // lookup tenant-scoped no encuentra nada
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/foreign-id",
      headers: headers(admin),
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE sobre un perfil de OTRO tenant → 404", async () => {
    queryQueue.push([...TENANT_ROW], []);
    const res = await app.inject({
      method: "DELETE",
      url: "/api/profiles/foreign-id",
      headers: headers(admin),
    });
    expect(res.statusCode).toBe(404);
  });

  // ─── Auto-escalación bloqueada ────────────────────

  it("admin NO puede cambiar su propio rol → 403", async () => {
    queryQueue.push([...TENANT_ROW], [targetRow({ id: admin.id, role: "admin" })]);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/profiles/${admin.id}`,
      headers: headers(admin),
      payload: { role: "manager" },
    });
    expect(res.statusCode).toBe(403);
    expect((res.json() as Record<string, string>).message).toContain("propio rol");
  });

  it("admin NO puede desactivarse a sí mismo → 403", async () => {
    queryQueue.push([...TENANT_ROW], [targetRow({ id: admin.id, isActive: true })]);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/profiles/${admin.id}`,
      headers: headers(admin),
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin NO puede eliminarse a sí mismo → 403", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/profiles/${admin.id}`,
      headers: headers(admin),
    });
    expect(res.statusCode).toBe(403);
    expect(queryQueue).toHaveLength(0);
  });

  // ─── Whitelist de campos y roles ───────────────────

  it("POST con rol inválido → 400", async () => {
    queryQueue.push([...TENANT_ROW]); // por si el lookup de tenant ocurre primero
    const res = await app.inject({
      method: "POST",
      url: "/api/profiles",
      headers: headers(admin),
      payload: { email: "x@test.com", fullName: "X", role: "superadmin" },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as Record<string, string>).message).toContain("Rol inválido");
  });

  it("PATCH con rol inválido → 400", async () => {
    queryQueue.push([...TENANT_ROW], [targetRow()]);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/target-id",
      headers: headers(admin),
      payload: { role: "superadmin" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PATCH ignora campos fuera de la whitelist (tenantId/password nunca se aplican)", async () => {
    queryQueue.push([...TENANT_ROW], [targetRow()], [targetRow({ isActive: false })]);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/target-id",
      headers: headers(admin),
      payload: { tenantId: "otro-tenant", password: "hack", isActive: false },
    });
    expect(res.statusCode).toBe(200);
    // El único update() de la petición debe llevar SOLO campos whitelistados.
    const updates = mocks.txLog.filter((tx) => tx.update?.mock.calls.length > 0);
    expect(updates).toHaveLength(1);
    const applied = updates[0]!.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(applied).not.toHaveProperty("tenantId");
    expect(applied).not.toHaveProperty("password");
    expect(applied).toHaveProperty("isActive", false);
  });

  it("PATCH sin ningún campo válido → 400", async () => {
    queryQueue.push([...TENANT_ROW], [targetRow()]);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/target-id",
      headers: headers(admin),
      payload: { password: "hack", foo: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as Record<string, string>).message).toContain("campos válidos");
  });

  it("PATCH con isActive no booleano → 400", async () => {
    queryQueue.push([...TENANT_ROW], [targetRow()]);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/profiles/target-id",
      headers: headers(admin),
      payload: { isActive: "yes" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Structural guards (registro estático) ──────────────

describe("SEG-01: profiles.ts — guards estructurales", () => {
  const fileUrl = new URL("../../src/modules/config/routes/profiles.ts", import.meta.url);

  it("POST/PATCH/DELETE exigen requireAdmin; GET exige requireAuth", async () => {
    const content = await readFile(fileURLToPath(fileUrl), "utf8");
    expect(content.match(/preHandler: requireAdmin/g) ?? []).toHaveLength(3);
    expect(content).toContain("preHandler: requireAuth");
    expect(content).toContain("requireAuth, requireAdmin");
  });

  it("todos los lookup por id están scopeados al tenant", async () => {
    const content = await readFile(fileURLToPath(fileUrl), "utf8");
    // Lookup sin filtro de tenant (el bug original) no debe volver a existir.
    expect(content).not.toContain("where(eq(profiles.id, id))");
    const tenantFilters = content.match(/eq\(profiles\.tenantId, tenantId\)/g) ?? [];
    expect(tenantFilters.length).toBeGreaterThanOrEqual(3);
    // Tenant resolution centralizada + resolveProfile en cada request.
    expect(content).toContain("tenantIdOrThrow");
    expect(content).toContain('app.addHook("onRequest", resolveProfile)');
  });

  it("whitelist de campos y validación de rol", async () => {
    const content = await readFile(fileURLToPath(fileUrl), "utf8");
    expect(content).toContain("VALID_ROLES");
    expect(content).toContain("assertValidRole");
    expect(content).toContain("No puedes eliminar tu propio perfil");
    expect(content).toContain("No puedes modificar tu propio rol");
  });
});
