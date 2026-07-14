/**
 * Service Worker — AutomotiveOS ERP Web (Next.js PWA).
 *
 * Caching strategy:
 *   - Static assets (JS, CSS, fonts): Cache-first (stale-while-revalidate)
 *   - Next.js page data (_next/data/*): Network-first with cache fallback
 *   - API calls: Network-first with cache fallback
 *   - Dashboard shell: Cache-first (precached on install)
 *
 * @version 1.0.0
 */

const CACHE_VERSION = "autoos-web-v1";
const STATIC_CACHE = "autoos-static-v1";
const DATA_CACHE = "autoos-data-v1";
const API_CACHE = "autoos-api-v1";

const SHELL_URLS = [
  "/dashboard",
  "/dashboard/taller",
  "/dashboard/clientes",
  "/dashboard/inventario",
  "/dashboard/facturacion",
  "/dashboard/vehiculos",
  "/dashboard/tesoreria",
  "/offline",
];

/* ─── Install: Precache the app shell ────────── */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(SHELL_URLS).catch((err) => {
        console.warn("[SW] Shell precache incomplete:", err);
      });
    }),
  );
  self.skipWaiting();
});

/* ─── Activate: Clean old caches ─────────────── */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

/* ─── Helpers ────────────────────────────────── */

function isNav(req) {
  return req.mode === "navigate";
}

function isApi(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/workshop/") ||
    url.pathname.startsWith("/inventory/") ||
    url.pathname.startsWith("/finance/") ||
    url.pathname.startsWith("/whatsapp/") ||
    url.pathname.startsWith("/billing/") ||
    url.pathname.startsWith("/scheduling/") ||
    url.pathname.startsWith("/fleet") ||
    url.pathname.startsWith("/audit") ||
    url.pathname.startsWith("/dvi") ||
    url.pathname.startsWith("/thinkcar")
  );
}

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico|webp)$/)
  );
}

function isData(url) {
  return url.pathname.startsWith("/_next/data/");
}

/* ─── Fetch Strategy ─────────────────────────── */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET" || url.protocol !== "https:" && url.protocol !== "http:") return;

  /* ── API calls: Network-first with cache fallback ─ */
  if (isApi(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ offline: true }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }))),
    );
    return;
  }

  /* ── Navigation requests: Network-first, fallback to cache, then offline page ─ */
  if (isNav(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/offline");
        }),
    );
    return;
  }

  /* ── Next.js data requests: Network-first ─ */
  if (isData(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  /* ── Static assets: Cache-first ─ */
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      }),
    );
    return;
  }

  /* ── Everything else: Network-only ─ */
  event.respondWith(fetch(request));
});

/* ─── Background Sync ────────────────────────── */

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-operations") {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_STARTED" });
  });
}

/* ─── Push Notifications ─────────────────────── */

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "AutomotiveOS";
  const options = {
    body: data.body || "Nueva notificación del taller",
    icon: "/assets/icons/icon-192x192.png",
    badge: "/assets/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/dashboard" },
    actions: [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Cerrar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});

/* ─── Message Handling ───────────────────────── */

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CLEAR_CACHES") {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    });
  }
});
