/**
 * Global Fastify error handler.
 *
 * Catches all errors, formats them consistently, and NEVER leaks
 * internal details regardless of environment.
 *
 * OWASP Top 10 2021 — A05:2021 Security Misconfiguration
 *
 * @module shared/middleware/error-handler
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error.js";

interface HandlerError {
  statusCode?: number;
  validation?: Array<{ message: string; path: string }>;
  message?: string;
  name?: string;
}

/**
 * Global Fastify error handler.
 * Must be registered after all routes.
 *
 * Security: NEVER exposes internal error messages, stack traces,
 * or implementation details to the client.
 */
export async function errorHandler(
  error: HandlerError,
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Handle known operational errors — safe to show message
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
      ...("details" in error && error.details
        ? { details: error.details }
        : {}),
    });
    return;
  }

  // Handle Fastify validation errors — generic message only
  if (error.validation) {
    reply.status(400).send({
      error: "ValidationError",
      message: "Datos de entrada inválidos",
    });
    return;
  }

  // Handle rate limit
  if (error.statusCode === 429) {
    reply.status(429).send({
      error: "RateLimitError",
      message: "Demasiadas solicitudes. Intente más tarde.",
    });
    return;
  }

  // Client errors (4xx) that aren't AppError/validation — e.g. Fastify's
  // JSON body parser rejects malformed JSON with statusCode 400
  // (FST_ERR_CTP_INVALID_JSON_BODY). Without this branch those would be
  // misclassified as 500, masking a client bug as a server fault.
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    reply.status(error.statusCode).send({
      error: "ValidationError",
      message: "Datos de entrada inválidos",
    });
    return;
  }

  // PostgreSQL unique violation (23505) — e.g. the idempotency index on
  // asientos_contables (0020/0022) rejecting a duplicate documento_ref.
  // postgres.js wraps the driver error in `cause`, so unwrap one level
  // (same pattern as profiles.ts). Maps to 409 so clients can distinguish
  // a duplicate from a genuine server fault.
  const driver = (error as unknown as { cause?: { code?: string } }).cause;
  if (driver?.code === "23505") {
    reply.status(409).send({
      error: "ConflictError",
      message: "Ya existe un registro con los mismos datos (violación de unicidad)",
    });
    return;
  }

  // PostgreSQL foreign-key violation (23503) — the client referenced a row
  // that does not exist: an OT, un cliente, un producto. Without this branch
  // every such request returns an opaque 500 and looks like a server fault,
  // when in fact it is a client error — a bad id in the body or the URL.
  // T-48 lo detectó con POST /workshop/signatures apuntando a una OT
  // inexistente; la FK hacía lo correcto, el mapeo no.
  // 422 y no 404: el recurso referenciado es inválido dentro de la petición,
  // no es lo que se pidió consultar.
  if (driver?.code === "23503") {
    reply.status(422).send({
      error: "ValidationError",
      message: "Una de las referencias enviadas no existe",
    });
    return;
  }

  // BAJO-04 FIX: Generic fallback — NEVER leak internals
  reply.status(500).send({
    error: "InternalServerError",
    message: "Ocurrió un error inesperado",
  });
}
