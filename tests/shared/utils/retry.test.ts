/**
 * Retry utility — Unit Tests
 *
 * @module tests/shared/utils/retry.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry, sleep } from "../../../src/shared/utils/retry.js";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds on retry", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("ok");

    vi.useFakeTimers();
    const promise = withRetry(fn, { baseDelayMs: 10, maxRetries: 3 });

    // Advance through the 2 retries
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent error"));
    vi.useFakeTimers();

    const promise = withRetry(fn, { baseDelayMs: 10, maxRetries: 2 });
    // Attach catch handler before advancing timers so the rejection
    // during advanceTimersByTimeAsync is not considered unhandled
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).rejects.toThrow("persistent error");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("skips retry for non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));
    const isRetryable = (err: Error) => err.message !== "fatal";

    await expect(
      withRetry(fn, { maxRetries: 3, isRetryable }),
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1); // no retry
  });

  it("calls onRetry callback on each retry", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    vi.useFakeTimers();
    const promise = withRetry(fn, { baseDelayMs: 10, maxRetries: 2, onRetry });
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it("wraps non-Error throws in Error", async () => {
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(withRetry(fn, { maxRetries: 0 })).rejects.toThrow("string error");
  });
});

describe("sleep", () => {
  it("resolves after specified time", async () => {
    vi.useFakeTimers();
    const promise = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
