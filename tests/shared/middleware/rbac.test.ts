/**
 * RBAC Middleware — Unit Tests
 *
 * Tests resolveProfile, requireRole hierarchy, and convenience exports.
 *
 * @module tests/shared/middleware/rbac.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock db() ─────────────────────────────────

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock("../../../src/shared/database/drizzle.js", () => ({
  db: vi.fn(() => mockDb),
}));

vi.mock("../../../src/shared/database/schema/profiles.js", () => ({
  profiles: {
    id: "profiles.id",
    email: "profiles.email",
    fullName: "profiles.full_name",
    role: "profiles.role",
    isActive: "profiles.is_active",
    tenantId: "profiles.tenant_id",
  },
}));

vi.mock("../../../src/shared/errors/app-error.js", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(msg: string) { super(msg); this.name = "UnauthorizedError"; }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg: string) { super(msg); this.name = "ForbiddenError"; }
  },
}));

const { resolveProfile, requireRole, requireAdmin, requireManager, requireMechanic } = await import(
  "../../../src/shared/middleware/rbac.js"
);

// ─── Helpers ───────────────────────────────────

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    tenantSlug: "test-tenant",
    profile: undefined,
    ...overrides,
  } as any;
}

function makeReply() {
  return {} as any;
}

function mockProfileResult(profile: any) {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(profile ? [profile] : []),
  };
  mockSelect.mockReturnValue(chainable);
  return chainable;
}

// ─── Tests ─────────────────────────────────────

describe("resolveProfile", () => {
  // NOTE: we do NOT use vi.clearAllMocks() here because it wipes
  // the db mock implementation. Each test sets its own mock via mockProfileResult().

  it("skips when no X-User-Email header", async () => {
    vi.clearAllMocks();
    const req = makeRequest({ headers: {} });
    await resolveProfile(req, makeReply());
    expect(req.profile).toBeUndefined();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("skips when no tenantSlug", async () => {
    vi.clearAllMocks();
    const req = makeRequest({ headers: { "x-user-email": "test@test.com" }, tenantSlug: undefined });
    await resolveProfile(req, makeReply());
    expect(req.profile).toBeUndefined();
  });

  it("resolves profile from DB when email header present", async () => {
    vi.clearAllMocks();
    const fakeProfile = { id: "p1", email: "mech@test.com", fullName: "Mechanic", role: "mechanic", isActive: true, tenantId: "t1" };
    mockProfileResult(fakeProfile);

    const req = makeRequest({
      headers: { "x-user-email": "mech@test.com" },
      tenantSlug: "test-tenant",
    });
    await resolveProfile(req, makeReply());

    expect(req.profile).toEqual(fakeProfile);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("sets profile to undefined when user not found", async () => {
    vi.clearAllMocks();
    mockProfileResult(null);

    const req = makeRequest({
      headers: { "x-user-email": "ghost@test.com" },
      tenantSlug: "test-tenant",
    });
    await resolveProfile(req, makeReply());

    expect(req.profile).toBeUndefined();
  });

  it("does not block request when user inactive (filtered by DB)", async () => {
    vi.clearAllMocks();
    mockProfileResult(null);

    const req = makeRequest({
      headers: { "x-user-email": "inactive@test.com" },
      tenantSlug: "test-tenant",
    });
    await resolveProfile(req, makeReply());

    expect(req.profile).toBeUndefined();
  });
});

describe("requireRole", () => {
  it("throws UnauthorizedError when no profile", async () => {
    const hook = requireRole("admin");
    const req = makeRequest({ profile: undefined });
    await expect(hook(req, makeReply())).rejects.toThrow("Autenticación requerida");
  });

  it("allows admin when requireRole('admin')", async () => {
    const hook = requireRole("admin");
    const req = makeRequest({ profile: { role: "admin" } });
    await expect(hook(req, makeReply())).resolves.toBeUndefined();
  });

  it("rejects mechanic when requireRole('admin')", async () => {
    const hook = requireRole("admin");
    const req = makeRequest({ profile: { role: "mechanic" } });
    await expect(hook(req, makeReply())).rejects.toThrow("Acceso denegado");
  });

  it("allows manager when requireRole('manager')", async () => {
    const hook = requireRole("manager");
    const req = makeRequest({ profile: { role: "manager" } });
    await expect(hook(req, makeReply())).resolves.toBeUndefined();
  });

  it("allows admin when requireRole('manager') — hierarchy", async () => {
    const hook = requireRole("manager");
    const req = makeRequest({ profile: { role: "admin" } });
    await expect(hook(req, makeReply())).resolves.toBeUndefined();
  });

  it("allows mechanic when requireRole('user') — hierarchy", async () => {
    const hook = requireRole("user");
    const req = makeRequest({ profile: { role: "mechanic" } });
    await expect(hook(req, makeReply())).resolves.toBeUndefined();
  });

  it("rejects user when requireRole('mechanic')", async () => {
    const hook = requireRole("mechanic");
    const req = makeRequest({ profile: { role: "user" } });
    await expect(hook(req, makeReply())).rejects.toThrow("Acceso denegado");
  });

  it("allows when role matches any in multi-role list", async () => {
    const hook = requireRole("manager", "admin");
    const req = makeRequest({ profile: { role: "manager" } });
    await expect(hook(req, makeReply())).resolves.toBeUndefined();
  });

  it("rejects when role is below all in multi-role list", async () => {
    const hook = requireRole("manager", "admin");
    const req = makeRequest({ profile: { role: "mechanic" } });
    await expect(hook(req, makeReply())).rejects.toThrow("Acceso denegado");
  });
});

describe("convenience hooks", () => {
  it("requireAdmin rejects non-admin", async () => {
    const req = makeRequest({ profile: { role: "manager" } });
    await expect(requireAdmin(req, makeReply())).rejects.toThrow("Acceso denegado");
  });

  it("requireAdmin allows admin", async () => {
    const req = makeRequest({ profile: { role: "admin" } });
    await expect(requireAdmin(req, makeReply())).resolves.toBeUndefined();
  });

  it("requireManager rejects mechanic", async () => {
    const req = makeRequest({ profile: { role: "mechanic" } });
    await expect(requireManager(req, makeReply())).rejects.toThrow("Acceso denegado");
  });

  it("requireManager allows manager", async () => {
    const req = makeRequest({ profile: { role: "manager" } });
    await expect(requireManager(req, makeReply())).resolves.toBeUndefined();
  });

  it("requireMechanic rejects user", async () => {
    const req = makeRequest({ profile: { role: "user" } });
    await expect(requireMechanic(req, makeReply())).rejects.toThrow("Acceso denegado");
  });

  it("requireMechanic allows mechanic", async () => {
    const req = makeRequest({ profile: { role: "mechanic" } });
    await expect(requireMechanic(req, makeReply())).resolves.toBeUndefined();
  });
});
