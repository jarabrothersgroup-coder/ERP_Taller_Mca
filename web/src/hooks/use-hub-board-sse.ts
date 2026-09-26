/**
 * SSE hook for Hub board change pings (fetch-based).
 *
 * The backend stream (/workshop/hub/board/stream) carries only lightweight
 * `board_changed` pings — on each ping this hook invalidates the board
 * query so react-query refetches with fresh data.
 *
 * Uses fetch() + ReadableStream instead of EventSource because fetch can
 * send Authorization/X-Tenant-Slug headers (EventSource cannot), keeping
 * the existing JWT auth intact — no query-param tokens needed.
 *
 * @module hooks/use-hub-board-sse
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authHeaders } from "@/lib/api";

const STREAM_URL = "/workshop/hub/board/stream";
const HEARTBEAT_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 10;

/**
 * Subscribes to Hub board change pings and invalidates the board query.
 *
 * @param enabled - Whether the subscription is active (default true)
 */
export function useHubBoardSse(enabled = true): void {
  const qc = useQueryClient();

  // Stable refs so the connect callback doesn't churn across renders
  const qcRef = useRef(qc);
  qcRef.current = qc;

  const invalidate = useCallback(() => {
    qcRef.current.invalidateQueries({ queryKey: ["hub-board"] });
    qcRef.current.invalidateQueries({ queryKey: ["hub-active-orders"] });
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const controller = new AbortController();
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        // No data/heartbeat within window — connection is stale
        controller.abort();
      }, HEARTBEAT_TIMEOUT_MS);
    };

    const invalidateRef = invalidate;

    const connect = async (): Promise<void> => {
      try {
        const res = await fetch(STREAM_URL, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

        retry = 0;
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
            if (!dataLine) continue; // heartbeat comment or malformed
            try {
              const payload = JSON.parse(dataLine.slice(5).trim()) as {
                type?: string;
              };
              if (payload.type === "board_changed") invalidateRef();
            } catch {
              // malformed ping — ignore
            }
          }
        }
        // Server closed the stream (max-age rotation) — reconnect
        scheduleReconnect();
      } catch (err) {
        if (disposed || (err instanceof DOMException && err.name === "AbortError")) return;
        scheduleReconnect();
      }
    };

    const scheduleReconnect = () => {
      if (disposed || retry >= MAX_RETRIES) return;
      if (retryTimer) clearTimeout(retryTimer);
      const delay = Math.min(1000 * 2 ** retry, 30_000);
      retry += 1;
      retryTimer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      disposed = true;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
    };
  }, [enabled, invalidate]);
}
