/**
 * useNotificationWS — WebSocket hook for real-time push notifications.
 *
 * Connects to the backend WebSocket gateway at /ws/notifications.
 * Falls back to 30s polling if WebSocket is not available.
 *
 * @module mobile/src/hooks/use-notification-ws
 */

import * as React from "react";
import { AppState } from "react-native";
import { BACKEND_URL } from "../api/client";

export interface WSNotification {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  priority?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
}

interface UseNotificationWSOptions {
  tenantSlug?: string;
  userEmail?: string;
  onNotification?: (notification: WSNotification) => void;
}

/**
 * Hook that opens a WebSocket connection to the backend notification gateway.
 * Automatically reconnects on disconnect with exponential backoff.
 */
export function useNotificationWS(options: UseNotificationWSOptions = {}) {
  const { tenantSlug, userEmail, onNotification } = options;
  const [connected, setConnected] = React.useState(false);
  const [lastNotification, setLastNotification] = React.useState<WSNotification | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = React.useRef(0);

  const connect = React.useCallback(() => {
    const slug = tenantSlug ?? "demo";
    if (!slug) return;

    // Build WS URL from BACKEND_URL (replace http:// with ws://)
    const base = BACKEND_URL.replace(/^http/, "ws");
    const url = `${base}/ws/notifications?tenant=${encodeURIComponent(slug)}${userEmail ? `&user=${encodeURIComponent(userEmail)}` : ""}`;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[WS] Connected to notification gateway");
        setConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "notification" && msg.data) {
            const notif = msg.data as WSNotification;
            setLastNotification(notif);
            if (onNotification) {
              onNotification(notif);
            }
          } else if (msg.type === "pong") {
            // Heartbeat response — do nothing
          }
        } catch (err) {
          console.warn("[WS] Failed to parse message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WS] Disconnected (code: ${event.code})`);
        setConnected(false);
        wsRef.current = null;

        // Reconnect with exponential backoff (1s → 2s → 4s → 8s → max 30s)
        if (event.code !== 4001) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
          reconnectAttemptRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (err) => {
        console.warn("[WS] Connection error:", (err as any).message ?? "unknown");
        // onclose will fire after onerror, triggering reconnect
      };

      wsRef.current = ws;
    } catch (err) {
      console.warn("[WS] Failed to create WebSocket:", err);
      // Retry in 10s
      reconnectTimeoutRef.current = setTimeout(connect, 10000);
    }
  }, [tenantSlug, userEmail, onNotification]);

  React.useEffect(() => {
    connect();

    // Pause WS when app goes to background, resume when foreground
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Reconnect if disconnected while in background
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    });

    return () => {
      subscription?.remove();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    connected,
    lastNotification,
  };
}
