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

  // BAJO-04 FIX: Generic fallback — NEVER leak internals
  reply.status(500).send({
    error: "InternalServerError",
    message: "Ocurrió un error inesperado",
  });
}
