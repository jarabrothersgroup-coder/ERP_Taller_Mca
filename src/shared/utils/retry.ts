/**
 * Retry utility with exponential backoff.
 *
 * Provides a generic `withRetry` wrapper for operations that may
 * fail transiently (networking, mounting, device I/O).
 * RAM impact: negligible — no closures kept after resolution.
 *
 * @module shared/utils/retry
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial backoff delay in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum backoff delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
  /** Optional predicate to decide if an error is retryable (default: all errors) */
  isRetryable?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  onRetry: () => {},
  isRetryable: () => true,
};

/**
 * Wraps an async operation with exponential backoff retry.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the function if successful
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < opts.maxRetries && opts.isRetryable(lastError)) {
        const delay = Math.min(
          opts.baseDelayMs * Math.pow(2, attempt),
          opts.maxDelayMs,
        );
        opts.onRetry(attempt + 1, lastError);
        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Retry exhausted without error");
}

/**
 * Sleep helper that returns a promise resolved after `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
