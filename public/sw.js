/**
 * Service Worker — AutomotiveOS Cloud ERP PWA.
 *
 * Provides:
 *   - Offline caching for static assets
 *   - Background sync for pending operations
 *   - Push notification support
 *   - Cache-first strategy for static assets
 *   - Network-first strategy for API calls
 *
 * @module pwa/service-worker
 */

const CACHE_NAME = "autoos-erp-v1";
const STATIC_CACHE = "autoos-static-v1";
const API_CACHE = "autoos-api-v1";

const STATIC_ASSETS = [
  "/dashboard",
  "/assets/icons/icon-192x192.png",
  "/assets/icons/icon-512x512.png",
  "/shared/styles.css",
];

// ─── Install ──────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

// ─── Fetch Strategy ───────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/whatsapp/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(API_CACHE).then((cache) => {
            cache.put(request, cloned);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        }),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const cloned = response.clone();
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, cloned);
        });
        return response;
      });
    }),
  );
});

// ─── Background Sync ──────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-operations") {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  // Sync pending WhatsApp messages, stock operations, etc.
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_STARTED" });
  });
}

// ─── Push Notifications ───────────────────────

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "AutoOS ERP";
  const options = {
    body: data.body || "Nueva notificación",
    icon: "/assets/icons/icon-192x192.png",
    badge: "/assets/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: data.url || "/dashboard",
    actions: [
      { action: "open", title: "Abrir", icon: "/assets/icons/icon-72x72.png" },
      { action: "dismiss", title: "Cerrar", icon: "/assets/icons/icon-72x72.png" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  event.waitUntil(
    self.clients.openWindow(event.notification.data),
  );
});
