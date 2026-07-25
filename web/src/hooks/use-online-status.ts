"use client";

import * as React from "react";

export type ConnectionStatus = "online" | "offline" | "checking";

export function useOnlineStatus(): ConnectionStatus {
  const [status, setStatus] = React.useState<ConnectionStatus>(
    () => (typeof navigator !== "undefined" && !navigator.onLine) ? "offline" : "online"
  );

  React.useEffect(() => {
    const handleOnline = () => setStatus("online");
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic health check (every 30s) to detect stale connections
    const interval = setInterval(async () => {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      try {
        const res = await fetch("/health/live", {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        setStatus(res.ok ? "online" : "offline");
      } catch {
        // Don't set offline on transient failures — only on navigator.onLine=false
        // This avoids false negatives on slow connections
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return status;
}
