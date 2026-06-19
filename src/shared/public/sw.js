/**
 * Service Worker v2 — AutomotiveOS PWA
 *
 * Enhanced offline-first strategies:
 *   - Static assets: Cache-First (v2 cache with all new JS modules)
 *   - API GET: Network-First with IndexedDB fallback
 *   - API mutations: Queue for background sync
 *   - CDN: Stale-While-Revalidate
 *   - Background Sync: flush offline queue on reconnect
 *   - Version management: auto-cleanup old caches
 *
 * @module sw-v2
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `automotiveos-static-${CACHE_VERSION}`;
const API_CACHE = `automotiveos-api-${CACHE_VERSION}`;
const CDN_CACHE = `automotiveos-cdn-${CACHE_VERSION}`;
const OFFLINE_CACHE = `automotiveos-offline-${CACHE_VERSION}`;

// ─── Precache Manifest ─────────────────────────

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  '/app.js',
  // Core modules
  '/js/ux.js',
  '/js/i18n.js',
  '/js/a11y.js',
  '/js/sanitize.js',
  '/js/pwa.js',
  // Feature modules
  '/js/dashboard.js',
  '/js/ordenes.js',
  '/js/inventario.js',
  '/js/facturacion.js',
  '/js/contabilidad.js',
  '/js/tesoreria.js',
  '/js/usuarios.js',
  '/js/config.js',
  '/js/taller.js',
  '/js/ingreso.js',
  '/js/servicios.js',
  '/js/thinkcar.js',
  '/js/payroll.js',
  '/js/analytics.js',
  '/js/analytics-dashboard.js',
  '/js/budget.js',
  '/js/notifications.js',
  '/js/notification-bell.js',
  '/js/whatsapp.js',
  '/js/wa-templates.js',
  '/js/dvi.js',
  '/js/calendario.js',
  '/js/marketing.js',
  '/js/fleet.js',
  '/js/history.js',
  '/js/print.js',
  '/js/search.js',
  '/js/shortcuts.js',
  '/js/theme.js',
  '/js/mobile.js',
  '/js/charts.js',
  // Offline modules
  '/js/offline-db.js',
  '/js/offline-queue.js',
  // Sprint 50-52 modules
  '/js/ai-copilot.js',
  '/js/sifen-monitor.js',
  '/js/whatsapp-monitor.js',
  '/js/label-printing.js',
  '/js/backup-restore.js',
  '/js/security-hw.js',
  '/js/client-portal.js',
  '/js/inventory-batch.js',
  '/manifest.json',
];

// ─── CDN Origins ───────────────────────────────

const CDN_ORIGINS = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ─── Install ────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ───────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== API_CACHE &&
                key !== CDN_CACHE &&
                key !== OFFLINE_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch Strategies ──────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for caching (mutations handled by queue)
  if (request.method !== 'GET') {
    // Allow POST to /api/auth/login through (not queue-able)
    if (
      request.method === 'POST' &&
      url.pathname.startsWith('/api/auth/')
    ) {
      return; // Let it pass through normally
    }
    return;
  }

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // Locale API → Cache-First (translations rarely change)
  if (url.pathname.startsWith('/api/v1/locale')) {
    event.respondWith(cacheFirst(request, API_CACHE));
    return;
  }

  // API requests → Network-First with cache fallback
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/workshop/') ||
    url.pathname.startsWith('/finance/') ||
    url.pathname.startsWith('/thinkcar/') ||
    url.pathname.startsWith('/intelligence/') ||
    url.pathname === '/sync'
  ) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // CDN assets → Stale-While-Revalidate
  if (CDN_ORIGINS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, CDN_CACHE));
    return;
  }

  // Static assets → Cache-First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else → Network-First
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ─── Strategy: Cache-First ─────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

// ─── Strategy: Network-First ───────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return offline JSON for API calls
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'Sin conexión a internet — datos desde caché',
        _offline: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// ─── Strategy: Stale-While-Revalidate ──────────

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ─── Background Sync ───────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-offline-queue') {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  // Notify all clients to flush their queues
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_STARTED' });
  });
}

// ─── Message Handler ───────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(STATIC_CACHE).then((cache) => {
      cache.addAll(urls);
    });
  }
});

// ─── Push Notifications ────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {
    title: 'AutomotiveOS',
    body: 'Nueva notificación',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'automotiveos-notification',
      data: data.url || '/',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window' })
      .then((clients) => {
        for (const client of clients) {
          if (
            client.url.includes(self.location.origin) &&
            'focus' in client
          ) {
            return client.focus();
          }
        }
        return self.clients.openWindow(event.notification.data || '/');
      }),
  );
});
