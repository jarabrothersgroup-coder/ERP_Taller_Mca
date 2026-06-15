/**
 * Service Worker — AutomotiveOS PWA
 *
 * Cache strategies:
 *   - Static assets (JS/CSS/HTML): Cache-First
 *   - API requests: Network-First with cache fallback
 *   - CDN (Tailwind, Google Fonts): Cache-First with stale-while-revalidate
 *
 * @module sw
 */

const CACHE_NAME = 'automotiveos-v1';
const STATIC_CACHE = 'automotiveos-static-v1';
const API_CACHE = 'automotiveos-api-v1';
const CDN_CACHE = 'automotiveos-cdn-v1';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/js/ux.js',
  '/js/analytics.js',
  '/js/budget.js',
  '/js/servicios.js',
  '/js/dashboard.js',
  '/js/usuarios.js',
  '/js/config.js',
  '/js/taller.js',
  '/js/ingreso.js',
  '/js/ordenes.js',
  '/js/facturacion.js',
  '/js/thinkcar.js',
  '/js/inventario.js',
  '/js/contabilidad.js',
  '/js/tesoreria.js',
  '/js/notifications.js',
  '/js/payroll.js',
  '/js/history.js',
  '/js/print.js',
  '/js/search.js',
  '/js/pwa.js',
  '/manifest.json',
];

// CDN assets to cache
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
];

// ─── Install ────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE && key !== CDN_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch Strategies ──────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // API requests → Network-First
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/workshop/') ||
      url.pathname.startsWith('/finance/') || url.pathname.startsWith('/thinkcar/') ||
      url.pathname === '/sync') {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // CDN assets → Cache-First with stale-while-revalidate
  if (url.hostname === 'cdn.tailwindcss.com' || url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
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
    // Offline and not cached — return offline page for HTML
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
      JSON.stringify({ error: 'Offline', message: 'Sin conexión a internet' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Strategy: Stale-While-Revalidate ──────────

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fetch in background and update cache
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ─── Background Sync (when available) ──────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-offline-queue') {
    event.waitUntil(flushOfflineQueue());
  }
});

async function flushOfflineQueue() {
  // Notify all clients that sync is happening
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_STARTED' });
  });
}

// ─── Push Notifications ────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'AutomotiveOS', body: 'Nueva notificación' };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'automotiveos-notification',
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window or open new
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(event.notification.data || '/');
    })
  );
});
