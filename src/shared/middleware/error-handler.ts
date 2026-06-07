/**
 * Global Fastify error handler.
 *
 * Catches all errors, formats them consistently, and prevents
 * leaking stack traces in production.
 *
 * @module shared/middleware/error-handler
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error.js";
import { env } from "../../config/env.js";

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
 * Catches known AppError instances, Fastify validation errors,
 * and falls back to a generic 500 in production.
 */
export async function errorHandler(
  error: HandlerError,
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Handle known operational errors
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

  // Handle Fastify validation errors
  if (error.validation) {
    reply.status(400).send({
      error: "ValidationError",
      message: "Request validation failed",
      details: error.validation,
    });
    return;
  }

  // Handle rate limit
  if (error.statusCode === 429) {
    reply.status(429).send({
      error: "RateLimitError",
      message: "Too many requests, please try again later",
    });
    return;
  }

  // Generic fallback — never leak internals in production
  reply.status(500).send({
    error: "InternalServerError",
    message:
      env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error.message ?? "Unknown error",
  });
}
