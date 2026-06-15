/**
 * Thinkcar Ingestion Health Monitor.
 *
 * Tracks per-channel health status for the three ingestion channels
 * (USB MTP, Email IMAP, Bluetooth RFCOMM). Used by the plugin to
 * report channel health and by the frontend for the Thinkcar review queue.
 *
 * RAM impact: negligible (~1 KB) — three status objects in memory.
 *
 * @module thinkcar/services/thinkcar-health
 */

export type IngestionChannel = "usb" | "email" | "bluetooth";

export interface ChannelHealth {
  channel: IngestionChannel;
  isHealthy: boolean;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  totalProcessed: number;
  totalErrors: number;
}

const DEFAULT_HEALTH = (channel: IngestionChannel): ChannelHealth => ({
  channel,
  isHealthy: true,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  consecutiveFailures: 0,
  totalProcessed: 0,
  totalErrors: 0,
});

/** Singleton health registry */
const _health: Map<IngestionChannel, ChannelHealth> = new Map();

function getHealth(channel: IngestionChannel): ChannelHealth {
  let h = _health.get(channel);
  if (!h) {
    h = DEFAULT_HEALTH(channel);
    _health.set(channel, h);
  }
  return h;
}

/**
 * Records a successful ingestion for the given channel.
 */
export function recordSuccess(channel: IngestionChannel): void {
  const h = getHealth(channel);
  h.isHealthy = true;
  h.lastSuccessAt = Date.now();
  h.consecutiveFailures = 0;
  h.totalProcessed++;
}

/**
 * Records a failed ingestion for the given channel.
 * Marks unhealthy after 3 consecutive failures.
 */
export function recordError(channel: IngestionChannel, errorMessage: string): void {
  const h = getHealth(channel);
  h.lastErrorAt = Date.now();
  h.lastErrorMessage = errorMessage;
  h.consecutiveFailures++;
  h.totalErrors++;
  if (h.consecutiveFailures >= 3) {
    h.isHealthy = false;
  }
}

/**
 * Returns the current health status for all channels.
 */
export function getAllHealth(): ChannelHealth[] {
  return (["usb", "email", "bluetooth"] as IngestionChannel[]).map(getHealth);
}

/**
 * Returns the health status for a single channel.
 */
export function getChannelHealth(channel: IngestionChannel): ChannelHealth {
  return { ...getHealth(channel) };
}

/**
 * Resets health counters (used when a channel recovers after being unhealthy).
 */
export function resetChannelHealth(channel: IngestionChannel): void {
  _health.set(channel, DEFAULT_HEALTH(channel));
}
