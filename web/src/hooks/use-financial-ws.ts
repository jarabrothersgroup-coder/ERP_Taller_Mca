/**
 * useFinancialWebSocket — React hook for real-time financial data.
 *
 * Connects to /ws/financial-dashboard, subscribes to channels,
 * and returns live-updating data with auto-reconnect.
 *
 * @module hooks/use-financial-ws
 */

"use client";

import * as React from "react";

type Channel = "kpis" | "cashflow" | "invoices";

interface FinancialData {
  kpis?: any;
  cashflow?: any;
  invoices?: any;
}

interface UseFinancialWSResult {
  data: FinancialData;
  connected: boolean;
  error: string | null;
}

const WS_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useFinancialWebSocket(
  channels: Channel[] = ["kpis", "cashflow", "invoices"],
  enabled = true,
): UseFinancialWSResult {
  const [data, setData] = React.useState<FinancialData>({});
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const wsUrl = WS_BASE.replace(/^http/, "ws") + "/ws/financial-dashboard";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) { ws.close(); return; }
        setConnected(true);
        setError(null);
        ws.send(JSON.stringify({ type: "subscribe", channels }));
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "update" && msg.channel && msg.data) {
            setData((prev) => ({ ...prev, [msg.channel]: msg.data }));
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnected(false);
        // Auto-reconnect after 5s
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        setError("WebSocket connection error");
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, channels.join(",")]);

  return { data, connected, error };
}
