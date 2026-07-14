"use client";

import React, { useEffect } from "react";

/**
 * Service Worker Registration Component.
 *
 * Registers the PWA service worker on the client side and sets up
 * basic connectivity monitoring. Renders nothing visually.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.log("[PWA] Service Worker not supported in this browser");
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (process.env.NODE_ENV !== "production") {
          console.log("[PWA] Service Worker registered:", registration.scope);
        }

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration?.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                if (process.env.NODE_ENV !== "production") {
                  console.log("[PWA] New version available — refresh to update");
                }
                // Notify the app about the update
                window.dispatchEvent(new CustomEvent("sw-update-available"));
              }
            }
          });
        });
      } catch (error) {
        console.warn("[PWA] Service Worker registration failed:", error);
      }
    };

    // Register after the page loads
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}

/**
 * Hook to check if the app is currently online.
 * Uses useSyncExternalStore for reactive updates when connectivity changes.
 *
 * @returns {boolean} true if the browser reports being online
 */
export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(
    (callback) => {
      window.addEventListener("online", callback);
      window.addEventListener("offline", callback);
      return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
      };
    },
    () =>
      typeof navigator !== "undefined" ? navigator.onLine : true,
    () => true,
  );
}

/**
 * Hook to listen for service worker updates.
 * Returns a function to trigger the update.
 */
export function useServiceWorkerUpdate() {
  useEffect(() => {
    const handler = () => {
      // Notify the service worker to skip waiting
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SKIP_WAITING",
        });
      }
    };

    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);
}
