/**
 * Application error classes for structured error handling.
 *
 * @module shared/errors/app-error
 */

/**
 * Base application error with HTTP status code support.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 Bad Request */
export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400);
  }
}

/** 401 Unauthorized */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

/** 403 Forbidden */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

/** 404 Not Found */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

/** 409 Conflict */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409);
  }
}

/** 422 Unprocessable Entity — validation errors */
export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message = "Validation failed", details: Record<string, string[]> = {}) {
    super(message, 422);
    this.details = details;
  }
}

/** 429 Too Many Requests */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}
