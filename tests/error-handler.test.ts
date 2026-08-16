/**
 * Error Handler — Unit Tests
 *
 * Verifies the global error handler maps errors consistently:
 *   - AppError keeps its statusCode + message
 *   - Fastify validation errors → 400
 *   - Rate limit (429) → RateLimitError
 *   - Fastify JSON parse errors (statusCode 400) → 400 (not 500)
 *   - PostgreSQL unique violation (23505, wrapped in `cause`) → 409 ConflictError
 *   - Unknown errors → generic 500 (no internals leaked)
 *
 * @module tests/error-handler.test
 */

import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { errorHandler } from "../src/shared/middleware/error-handler.js";
import { AppError, ConflictError } from "../src/shared/errors/app-error.js";

async function sendError(error: unknown): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.get("/boom", () => {
    throw error;
  });
  const res = await app.inject({ method: "GET", url: "/boom" });
  return { statusCode: res.statusCode, body: res.json() };
}

describe("error-handler", () => {
  it("AppError keeps statusCode + message", async () => {
    const { statusCode, body } = await sendError(new ConflictError("Asiento duplicado"));
    expect(statusCode).toBe(409);
    expect(body.error).toBe("ConflictError");
    expect(body.message).toBe("Asiento duplicado");
  });

  it("Fastify validation errors → 400", async () => {
    const { statusCode, body } = await sendError({
      validation: [{ message: "required", path: "body" }],
    });
    expect(statusCode).toBe(400);
    expect(body.error).toBe("ValidationError");
  });

  it("rate limit (429) → RateLimitError", async () => {
    const { statusCode, body } = await sendError({ statusCode: 429, message: "too many" });
    expect(statusCode).toBe(429);
    expect(body.error).toBe("RateLimitError");
  });

  it("Fastify JSON parse error (statusCode 400) → 400, not 500", async () => {
    // Fastify's content-type parser rejects malformed JSON with
    // statusCode 400 (FST_ERR_CTP_INVALID_JSON_BODY) and no `validation`.
    const { statusCode, body } = await sendError({ statusCode: 400, message: "Invalid JSON" });
    expect(statusCode).toBe(400);
    expect(body.error).toBe("ValidationError");
  });

  it("PostgreSQL unique violation (23505 via cause) → 409 ConflictError", async () => {
    // postgres.js wraps the driver error in `cause` (see profiles.ts pattern).
    const { statusCode, body } = await sendError({
      cause: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    expect(statusCode).toBe(409);
    expect(body.error).toBe("ConflictError");
  });

  it("unknown errors → generic 500 without internals", async () => {
    const { statusCode, body } = await sendError(new Error("secreto interno: db-password=xyz"));
    expect(statusCode).toBe(500);
    expect(body.error).toBe("InternalServerError");
    expect(JSON.stringify(body)).not.toContain("secreto interno");
  });
});
