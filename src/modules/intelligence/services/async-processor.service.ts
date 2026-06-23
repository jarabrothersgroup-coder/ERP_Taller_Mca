/**
 * Async File Processing Queue Service.
 *
 * Manages background processing jobs for heavy operations such as
 * OCR on large images and DTC report parsing of big files.
 *
 * Design principles:
 *   - **In-memory queue** — no Redis dependency (keeps RAM < 50MB)
 *   - **Single concurrent worker** — only one heavy job at a time
 *   - **Strict size limits** — files > 10MB are rejected upfront
 *   - **Auto-cleanup** — completed jobs expire after 30 minutes
 *   - **Streaming** — files are streamed, not buffered
 *
 * RAM discipline:
 *   - Job metadata: ~200 bytes per job
 *   - Active processing: ~5-10MB max (image chunk processing)
 *   - Cleanup interval: every 60s, removes expired jobs
 *   - Max concurrent large ops: 1 (prevents heap blow)
 *
 * @module intelligence/services/async-processor
 */

import { randomUUID } from "node:crypto";
import type { AsyncJob } from "../types.js";

// ─── Constants ───────────────────────────────────

/** Max number of completed/failed jobs kept in memory */
const MAX_STORED_JOBS = 50;

/** Time-to-live for completed/failed jobs (milliseconds) */
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Cleanup interval (milliseconds) */
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

/** Maximum file size accepted for processing (bytes) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Maximum image dimension for OCR (pixels, any side) */
export const MAX_IMAGE_DIMENSION = 4096;

// ─── Types ───────────────────────────────────────

/** Job processor function signature */
type ProcessorFn<TInput, TOutput> = (
  input: TInput,
  onProgress: (percent: number) => void,
) => Promise<TOutput>;

/** Queued job entry (internal) */
interface QueuedJob<TInput, TOutput> {
  job: AsyncJob<TOutput>;
  input: TInput;
  processor: ProcessorFn<TInput, TOutput>;
  createdAt: number; // Unix timestamp ms
}

// ─── Queue State ─────────────────────────────────

/** Map of job ID → queued job */
const jobs = new Map<string, QueuedJob<unknown, unknown>>();

/** Whether a job is currently being processed */
let isProcessing = false;

/** Cleanup timer handle */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// C-07 FIX: SETNX-style lock map — prevents concurrent processing of the same job type.
// Keys are job type identifiers (e.g., "ocr", "dtc_parse"), values are lock timestamps.
const processingLocks = new Map<string, number>();

/** Lock TTL — after this time, the lock is considered stale and can be acquired. */
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Public API ──────────────────────────────────

/**
 * Initializes the async processor background cleanup.
 * Should be called once when the module loads.
 */
export function initProcessor(): void {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredJobs, CLEANUP_INTERVAL_MS);
    // Allow the process to exit even if timer is active
    if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
      cleanupTimer.unref();
    }
  }
}

/**
 * Shuts down the processor, canceling pending jobs and cleanup.
 */
export function shutdownProcessor(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  // Mark all queued jobs as failed
  for (const [, entry] of jobs) {
    if (entry.job.status === "queued") {
      entry.job.status = "failed";
      entry.job.error = "Processor shutdown";
      entry.job.finishedAt = new Date().toISOString();
      entry.job.updatedAt = entry.job.finishedAt;
    }
  }

  isProcessing = false;
}

/**
 * Enqueues a job for async processing and returns immediately.
 * The job will be processed in FIFO order with concurrency 1.
 *
 * @typeParam TInput - Input data type
 * @typeParam TOutput - Result data type
 * @param type - Human-readable job type (e.g. "ocr:plate")
 * @param input - Input data for the processor
 * @param processor - Async function that processes the job
 * @returns The created job tracking object
 */
export function enqueueJob<TInput, TOutput>(
  type: string,
  input: TInput,
  processor: ProcessorFn<TInput, TOutput>,
): AsyncJob<TOutput> {
  const id = randomUUID();
  const now = new Date().toISOString();

  const job: AsyncJob<TOutput> = {
    id,
    type,
    status: "queued",
    progress: null,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };

  const entry: QueuedJob<TInput, TOutput> = {
    job,
    input,
    processor,
    createdAt: Date.now(),
  };

  jobs.set(id, entry as QueuedJob<unknown, unknown>);

  // Try to process immediately if idle
  processNext().catch(() => {
    /* errors handled within processNext */
  });

  return job;
}

/**
 * Retrieves a job by ID.
 *
 * @param id - Job UUID
 * @returns The job or null if not found
 */
export function getJob<T = unknown>(id: string): AsyncJob<T> | null {
  const entry = jobs.get(id);
  if (!entry) return null;
  return entry.job as AsyncJob<T>;
}

/**
 * Returns the current number of pending jobs.
 */
export function pendingCount(): number {
  let count = 0;
  for (const entry of jobs.values()) {
    if (entry.job.status === "queued" || entry.job.status === "processing") {
      count++;
    }
  }
  return count;
}

// ─── Internal Processing ─────────────────────────

/**
 * Processes the next job in the queue (FIFO).
 * Only one job runs at a time to manage RAM.
 *
 * C-07 FIX: Uses SETNX-style lock per job type to prevent cache stampede.
 * If two identical job types are enqueued simultaneously, only one processes
 * at a time. The lock expires after LOCK_TTL_MS to prevent deadlocks.
 */
async function processNext(): Promise<void> {
  if (isProcessing) return;

  // Find the next queued job (oldest first)
  const nextEntry = findNextQueued();
  if (!nextEntry) return;

  // C-07: Acquire SETNX-style lock for this job type
  const lockKey = nextEntry.job.type;
  const now = Date.now();
  const lockTimestamp = processingLocks.get(lockKey);
  if (lockTimestamp && now - lockTimestamp < LOCK_TTL_MS) {
    // Lock is held by another processing instance — skip this job
    return;
  }
  processingLocks.set(lockKey, now);

  isProcessing = true;
  const { job, input, processor } = nextEntry;

  job.status = "processing";
  job.updatedAt = new Date().toISOString();

  try {
    const result = await processor(input, (percent: number) => {
      job.progress = Math.min(100, Math.max(0, percent));
      job.updatedAt = new Date().toISOString();
    });

    job.status = "completed";
    job.result = result;
    job.progress = 100;
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Unknown processing error";
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
  } finally {
    // C-07: Release lock
    processingLocks.delete(lockKey);
    isProcessing = false;

    // Process next job in queue (if any)
    processNext().catch(() => {
      /* ignore */
    });
  }
}

/**
 * Finds the oldest queued job.
 */
function findNextQueued(): QueuedJob<unknown, unknown> | null {
  let oldest: QueuedJob<unknown, unknown> | null = null;
  let oldestTime = Infinity;

  for (const entry of jobs.values()) {
    if (entry.job.status === "queued" && entry.createdAt < oldestTime) {
      oldest = entry;
      oldestTime = entry.createdAt;
    }
  }

  return oldest;
}

/**
 * Removes expired completed/failed jobs to free memory.
 */
function cleanupExpiredJobs(): void {
  const now = Date.now();

  for (const [id, entry] of jobs) {
    if (entry.job.status === "completed" || entry.job.status === "failed") {
      if (now - entry.createdAt > JOB_TTL_MS) {
        jobs.delete(id);
      }
    }
  }

  // Enforce MAX_STORED_JOBS limit (remove oldest completed/failed)
  if (jobs.size > MAX_STORED_JOBS) {
    const sorted = Array.from(jobs.entries())
      .filter(([, e]) => e.job.status === "completed" || e.job.status === "failed")
      .sort(([, a], [, b]) => a.createdAt - b.createdAt);

    const toRemove = jobs.size - MAX_STORED_JOBS;
    for (let i = 0; i < Math.min(toRemove, sorted.length); i++) {
      jobs.delete(sorted[i]![0]);
    }
  }
}
