/**
 * SSE (Server-Sent Events) hook for real-time notifications.
 *
 * Connects to the /workshop/notifications/sse/stream endpoint
 * and receives real-time push notifications from the backend.
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
  /** SSE endpoint URL (default: /workshop/notifications/sse/stream) */
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

const DEFAULT_URL = "/workshop/notifications/sse/stream";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 60000;

/**
 * Hook for subscribing to Server-Sent Events for real-time notifications.
 *
 * @example
 * ```tsx
 * const { status, notifications, lastNotification } = useSse({
 *   onNotification: (n) => toast.info(n.titulo),
 * });
 * ```
 */
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

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Stable callback refs
  const onNotificationRef = useRef(onNotification);
  const onStatusChangeRef = useRef(onStatusChange);
  onNotificationRef.current = onNotification;
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((newStatus: SseConnectionStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
    }
    heartbeatTimerRef.current = setTimeout(() => {
      // No heartbeat received — connection might be stale
      console.warn("[SSE] Heartbeat timeout, reconnecting...");
      eventSourceRef.current?.close();
      // Will auto-reconnect via onerror
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
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    if (!mountedRef.current) return;

    updateStatus("connecting");

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        retryCountRef.current = 0;
        updateStatus("connected");
        resetHeartbeat();
      };

      es.addEventListener("notification", (event) => {
        if (!mountedRef.current) return;
        resetHeartbeat();

        try {
          const notification: SseNotification = JSON.parse(event.data);
          setLastNotification(notification);
          setNotifications((prev) => [notification, ...prev].slice(0, 100)); // Keep last 100
          onNotificationRef.current?.(notification);
        } catch (err) {
          console.error("[SSE] Failed to parse notification:", err);
        }
      });

      es.addEventListener("heartbeat", () => {
        resetHeartbeat();
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        es.close();
        eventSourceRef.current = null;

        if (retryCountRef.current < maxRetries) {
          updateStatus("disconnected");
          const delay = Math.min(
            BASE_DELAY_MS * Math.pow(2, retryCountRef.current),
            MAX_DELAY_MS,
          );
          retryCountRef.current++;

          retryTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, delay);
        } else {
          updateStatus("error");
        }
      };
    } catch (err) {
      console.error("[SSE] Failed to create EventSource:", err);
      updateStatus("error");
    }
  }, [url, maxRetries, cleanup, updateStatus, resetHeartbeat]);

  const disconnect = useCallback(() => {
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
    connect,
    disconnect,
    clearNotifications,
  };
}
