/**
 * Security test: per-request tenant context closes the multi-tenant RLS leak.
 *
 * GAP (before fix): `rls.ts` set `app.current_tenant` with a SESSION-scoped
 * `set_config(..., false)` on the pooled singleton. A connection reused across
 * requests could carry a previous tenant's context into a request that didn't
 * re-apply the tenant → cross-tenant access.
 *
 * FIX: when `ENABLE_REQUEST_TENANT_CONTEXT` is on, `transaction-context.ts`
 * reserves a DEDICATED connection per request and sets `app.current_tenant`
 * session-scoped on it — overwritten at the start of every request and reset
 * before the connection is released. So the context cannot escape to another
 * request, even when the pooled connection is reused.
 *
 * This test builds a MINIMAL Fastify app (no auth/tenant middleware) so it
 * exercises only the transaction-context middleware + the `db()` resolution
 * path that production handlers use.
 *
 * Run with: ENABLE_REQUEST_TENANT_CONTEXT=true npx vitest run tests/security-tenant-isolation.test.ts
 */

process.env["ENABLE_REQUEST_TENANT_CONTEXT"] = "true";

import { describe, it, expect, beforeAll } from "vitest";
import Fastify from "fastify";

describe("Per-request tenant context: isolation", () => {
  /** @type {import("fastify").FastifyInstance} */
  let app;

  beforeAll(async () => {
    const { registerRequestTransactions } = await import(
      "../src/shared/middleware/transaction-context.js"
    );
    const { getRequestDb } = await import(
      "../src/shared/database/request-context.js"
    );
    const { getDb } = await import("../src/shared/database/connection.js");

    app = Fastify({ logger: false });

    // Simulate tenant resolution (normally done by the auth plugin).
    app.addHook("onRequest", (req, _reply, done) => {
      req.tenantSlug = req.headers["x-tenant-slug"];
      done();
    });

    await registerRequestTransactions(app);

    // Mirrors a production handler: uses db() which resolves to the
    // request-scoped connection when a tenant context is active, else the singleton.
    app.get("/ctx", async () => {
      const ctx = getRequestDb();
      const sql = ctx ? ctx.tx : getDb();
      const r = await sql`SELECT current_setting('app.current_tenant', true) AS t`;
      return { tenant: r[0].t };
    });

    await app.ready();
  });

  it("sets the tenant context for a tenant request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/ctx",
      headers: { "x-tenant-slug": "taller-a" },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).tenant).toBe("taller-a");
  });

  it("sets '' (allow-all) for a request without a tenant", async () => {
    // No tenant header → no tenant context → '' so RLS policies keep working.
    const res = await app.inject({ method: "GET", url: "/ctx" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).tenant).toBe("");
  });

  it("does NOT leak one tenant's context into another request", async () => {
    // First request sets 'taller-a' on its (reserved) connection.
    const r1 = await app.inject({
      method: "GET",
      url: "/ctx",
      headers: { "x-tenant-slug": "taller-a" },
    });
    expect(JSON.parse(r1.payload).tenant).toBe("taller-a");

    // Second request with a DIFFERENT tenant must see only its own context,
    // proving the previous tenant's value did not leak (the connection is
    // overwritten at the start of every request, and reset before release).
    const r2 = await app.inject({
      method: "GET",
      url: "/ctx",
      headers: { "x-tenant-slug": "taller-b" },
    });
    expect(JSON.parse(r2.payload).tenant).toBe("taller-b");

    // A subsequent non-tenant request must see '' (not taller-a / taller-b).
    const r3 = await app.inject({ method: "GET", url: "/ctx" });
    expect(JSON.parse(r3.payload).tenant).toBe("");
  });
});
