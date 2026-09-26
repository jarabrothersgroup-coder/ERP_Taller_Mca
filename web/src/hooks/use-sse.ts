/**
 * SSE (Server-Sent Events) hook for real-time notifications.
 *
 * Connects to /api/notifications/stream and receives real-time push
 * notifications from the backend.
 *
 * Uses fetch() + ReadableStream instead of EventSource: EventSource cannot
 * send the Authorization / X-Tenant-Slug headers the API requires (the
 * backend only reads the JWT from the Authorization header), so a plain
 * EventSource connection would be rejected with 401.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Connection status tracking
 * - Notification event callback
 * - Heartbeat monitoring
 *
 * @module hooks/use-sse
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { authHeaders } from "@/lib/api";

export interface SseNotification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  entityType?: string;
  entityId?: string;
  priority: string;
  timestamp: string;
}

export type SseConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseSseOptions {
  /** SSE endpoint URL (default: /api/notifications/stream) */
  url?: string;
  /** Callback when a notification is received */
  onNotification?: (notification: SseNotification) => void;
  /** Callback when connection status changes */
  onStatusChange?: (status: SseConnectionStatus) => void;
  /** Whether to auto-connect (default: true) */
  enabled?: boolean;
  /** Max reconnect attempts (default: 10) */
  maxRetries?: number;
}

interface UseSseReturn {
  /** Current connection status */
  status: SseConnectionStatus;
  /** Last notification received */
  lastNotification: SseNotification | null;
  /** All notifications received during this session */
  notifications: SseNotification[];
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Clear notification history */
  clearNotifications: () => void;
}

const DEFAULT_URL = "/api/notifications/stream";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 60000;

/** Extract a SseNotification from a backend `data:` payload. */
function parseNotification(payload: unknown): SseNotification | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  // Backend frame: { type: "notification", data: {...}, timestamp }
  const inner = (obj.type === "notification" && obj.data && typeof obj.data === "object"
    ? obj.data
    : obj) as Record<string, unknown>;
  if (typeof inner.id !== "string" || typeof inner.titulo !== "string") return null;
  return {
    id: inner.id,
    tipo: String(inner.tipo ?? "info"),
    titulo: inner.titulo,
    mensaje: String(inner.mensaje ?? ""),
    entityType: inner.entityType ? String(inner.entityType) : undefined,
    entityId: inner.entityId ? String(inner.entityId) : undefined,
    priority: String(inner.priority ?? "media"),
    timestamp: String(inner.timestamp ?? new Date().toISOString()),
  };
}

export function useSse(options: UseSseOptions = {}): UseSseReturn {
  const {
    url = DEFAULT_URL,
    onNotification,
    onStatusChange,
    enabled = true,
    maxRetries = MAX_RETRIES,
  } = options;

  const [status, setStatus] = useState<SseConnectionStatus>("disconnected");
  const [lastNotification, setLastNotification] = useState<SseNotification | null>(null);
  const [notifications, setNotifications] = useState<SseNotification[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const stoppedRef = useRef(false);
  /** Monotonic connection epoch — stale read loops must not reconnect. */
  const epochRef = useRef(0);
  // connect() is referenced by scheduleReconnect before it is defined — keep
  // it in a ref so the backoff timer always calls the latest implementation.
  const connectRef = useRef<() => void>(() => {});

  // Stable callback refs so connect() doesn't churn across renders
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((newStatus: SseConnectionStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      // No heartbeat within the window — connection is stale, abort and let
      // the read loop fall through to scheduleReconnect().
      abortRef.current?.abort();
    }, HEARTBEAT_TIMEOUT_MS);
  }, []);

  const cleanup = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const scheduleReconnect = useCallback((epoch: number) => {
    if (!mountedRef.current || stoppedRef.current) return;
    if (epoch !== epochRef.current) return; // a newer connection superseded this one
    if (retryCountRef.current >= maxRetries) {
      updateStatus("error");
      return;
    }
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const delay = Math.min(
      BASE_DELAY_MS * Math.pow(2, retryCountRef.current),
      MAX_DELAY_MS,
    );
    retryCountRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      if (mountedRef.current && !stoppedRef.current) connectRef.current?.();
    }, delay);
  }, [maxRetries, updateStatus]);

  const connect = useCallback(() => {
    cleanup();
    if (!mountedRef.current || stoppedRef.current) return;

    const epoch = ++epochRef.current;
    updateStatus("connecting");
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async (): Promise<void> => {
      try {
        const res = await fetch(url, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
        if (epoch !== epochRef.current) return;

        retryCountRef.current = 0;
        updateStatus("connected");
        resetHeartbeat();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          resetHeartbeat();
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const dataLine = frame
              .split("\n")
              .find((l) => l.startsWith("data:"));
            if (!dataLine) continue; // heartbeat comment (:heartbeat …) or malformed

            let payload: unknown;
            try {
              payload = JSON.parse(dataLine.slice(5).trim());
            } catch {
              continue; // malformed frame — ignore
            }
            const parsed = parseNotification(payload);
            if (!parsed) continue; // "connected" ping or unknown frame

            setLastNotification(parsed);
            setNotifications((prev) => [parsed, ...prev].slice(0, 100)); // Keep last 100
            onNotificationRef.current?.(parsed);
          }
        }

        // Server closed the stream (restart / max-age rotation) — reconnect
        if (!controller.signal.aborted) scheduleReconnect(epoch);
      } catch {
        if (!mountedRef.current || stoppedRef.current) return;
        if (epoch !== epochRef.current) return; // superseded by a newer connect()
        if (controller.signal.aborted && retryTimerRef.current) return; // manual cleanup
        scheduleReconnect(epoch);
      }
    };

    void run();
  }, [cleanup, url, updateStatus, resetHeartbeat, scheduleReconnect]);

  connectRef.current = connect;

  const disconnect = useCallback(() => {
    stoppedRef.current = true;
    cleanup();
    updateStatus("disconnected");
    retryCountRef.current = maxRetries; // Prevent auto-reconnect
  }, [cleanup, updateStatus, maxRetries]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setLastNotification(null);
  }, []);

  // Auto-connect / disconnect on mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      stoppedRef.current = false;
      retryCountRef.current = 0;
      connect();
    }
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return {
    status,
    lastNotification,
    notifications,
    connect: () => {
      stoppedRef.current = false;
      retryCountRef.current = 0;
      connect();
    },
    disconnect,
    clearNotifications,
  };
}
