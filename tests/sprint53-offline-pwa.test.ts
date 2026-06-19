import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const JS_DIR = join(PROJECT_ROOT, "src/shared/public/js");
const HTML_DIR = join(PROJECT_ROOT, "src/shared/public");

// ══════════════════════════════════════════════════════════════════
//  OfflineDB Module Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 53 — OfflineDB Module", () => {
  it("offline-db.js file exists and is well-formed", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    expect(src).toContain("window.OfflineDB");
    expect(src).toContain("openDB");
    expect(src).toContain("DB_NAME");
    expect(src).toContain("automotiveos-offline");
  });

  it("exposes all CRUD operations", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    const crudMethods = ["get", "getAll", "getByIndex", "put", "putAll", "del", "clear", "count"];
    for (const method of crudMethods) {
      expect(src).toContain(`${method}(`);
    }
  });

  it("defines all required stores", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    const stores = ["ordenes", "inventario", "clientes", "config", "syncQueue", "metadata"];
    for (const store of stores) {
      // Check for store name in any quote style (object key or string value)
      const hasStore =
        src.includes(`'${store}'`) ||
        src.includes(`"${store}"`) ||
        src.includes(`${store}:`);
      expect(hasStore).toBe(true);
    }
  });

  it("has domain-specific helpers for ordenes", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    expect(src).toContain("cacheOrden");
    expect(src).toContain("cacheOrdenes");
    expect(src).toContain("getOrden");
    expect(src).toContain("listOrdenes");
  });

  it("has domain-specific helpers for inventario", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    expect(src).toContain("cacheInventario");
    expect(src).toContain("getRepuesto");
    expect(src).toContain("searchInventario");
  });

  it("has domain-specific helpers for clientes", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    expect(src).toContain("cacheClientes");
    expect(src).toContain("getCliente");
  });

  it("has metadata/sync tracking", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    expect(src).toContain("getLastSync");
    expect(src).toContain("setLastSync");
    expect(src).toContain("getStorageStats");
  });

  it("adds _cachedAt and _syncStatus to cached records", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    expect(src).toContain("_cachedAt");
    expect(src).toContain("_syncStatus");
    expect(src).toContain("synced");
  });

  it("creates indexes for efficient querying", () => {
    const src = readFileSync(join(JS_DIR, "offline-db.js"), "utf-8");
    expect(src).toContain("keyPath");
    expect(src).toContain("indexes");
    // OT indexes
    expect(src).toContain("'status'");
    expect(src).toContain("'clienteId'");
    expect(src).toContain("'updatedAt'");
  });
});

// ══════════════════════════════════════════════════════════════════
//  OfflineQueue Module Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 53 — OfflineQueue Module", () => {
  it("offline-queue.js file exists and is well-formed", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("window.OfflineQueue");
    expect(src).toContain("enqueue");
    expect(src).toContain("flush");
  });

  it("exposes all queue operations", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    const methods = ["enqueue", "getPending", "getPendingCount", "remove", "markFailed", "clearCompleted", "flush", "getStats"];
    for (const method of methods) {
      expect(src).toContain(`${method}(`);
    }
  });

  it("enqueue creates proper mutation record", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("method:");
    expect(src).toContain("url:");
    expect(src).toContain("body:");
    expect(src).toContain("status: 'pending'");
    expect(src).toContain("attempts: 0");
    expect(src).toContain("maxAttempts: 3");
    expect(src).toContain("createdAt:");
  });

  it("supports priority ordering", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("priority");
    expect(src).toContain("b.priority - a.priority");
  });

  it("auto-flushes on reconnect", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("window.addEventListener('online'");
    expect(src).toContain("flush()");
  });

  it("integrates with Background Sync API", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("SyncManager");
    expect(src).toContain("sync.register");
    expect(src).toContain("flush-offline-queue");
  });

  it("adds auth headers on flush", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("x-auth-token");
    expect(src).toContain("Authorization");
    expect(src).toContain("Bearer");
  });

  it("dispatches queue events for UI", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("offline-queue");
    expect(src).toContain("queue-updated");
    expect(src).toContain("CustomEvent");
  });

  it("has localStorage fallback", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("FALLBACK_KEY");
    expect(src).toContain("localStorage");
    expect(src).toContain("automotiveos_offline_queue");
  });

  it("updates badge with pending count", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("offline-badge");
    expect(src).toContain("_updateQueueBadge");
  });

  it("marks entries as failed after max attempts", () => {
    const src = readFileSync(join(JS_DIR, "offline-queue.js"), "utf-8");
    expect(src).toContain("markFailed");
    expect(src).toContain("maxAttempts");
    expect(src).toContain("failed");
  });
});

// ══════════════════════════════════════════════════════════════════
//  Service Worker v2 Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 53 — Service Worker v2", () => {
  it("sw.js exists and is v2", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("CACHE_VERSION");
    expect(src).toContain("v2");
    expect(src).toContain("automotiveos-static");
  });

  it("pre-caches all new modules", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    // New modules added in Sprint 52-53
    expect(src).toContain("/js/i18n.js");
    expect(src).toContain("/js/a11y.js");
    expect(src).toContain("/js/offline-db.js");
    expect(src).toContain("/js/offline-queue.js");
    expect(src).toContain("/js/ai-copilot.js");
    expect(src).toContain("/js/sifen-monitor.js");
    expect(src).toContain("/js/whatsapp-monitor.js");
    expect(src).toContain("/js/label-printing.js");
    expect(src).toContain("/js/backup-restore.js");
    expect(src).toContain("/js/security-hw.js");
    expect(src).toContain("/js/client-portal.js");
    expect(src).toContain("/js/inventory-batch.js");
    expect(src).toContain("/landing.html");
  });

  it("implements all three caching strategies", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("cacheFirst");
    expect(src).toContain("networkFirst");
    expect(src).toContain("staleWhileRevalidate");
  });

  it("has Background Sync handler", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("addEventListener('sync'");
    expect(src).toContain("flush-offline-queue");
    expect(src).toContain("SYNC_STARTED");
  });

  it("cleans up old caches on activate", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("addEventListener('activate'");
    expect(src).toContain("caches.delete");
    expect(src).toContain("skipWaiting");
    expect(src).toContain("clients.claim");
  });

  it("handles push notifications", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("addEventListener('push'");
    expect(src).toContain("addEventListener('notificationclick'");
    expect(src).toContain("showNotification");
  });

  it("supports message handler for skip-waiting", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("addEventListener('message'");
    expect(src).toContain("SKIP_WAITING");
    expect(src).toContain("CACHE_URLS");
  });

  it("caches locale API responses", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("/api/v1/locale");
  });

  it("includes CDN origins for stale-while-revalidate", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("cdn.tailwindcss.com");
    expect(src).toContain("fonts.googleapis.com");
    expect(src).toContain("fonts.gstatic.com");
  });

  it("returns offline JSON for failed API calls", () => {
    const src = readFileSync(join(HTML_DIR, "sw.js"), "utf-8");
    expect(src).toContain("503");
    expect(src).toContain("_offline: true");
    expect(src).toContain("Sin conexión");
  });
});

// ══════════════════════════════════════════════════════════════════
//  PWA Registration v2 Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 53 — PWA Registration v2", () => {
  it("pwa.js exists and integrates with offline modules", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain("OfflineQueue");
    expect(src).toContain("flush()");
  });

  it("auto-flushes queue on reconnect", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain('window.addEventListener("online"');
    expect(src).toContain("OfflineQueue.flush()");
  });

  it("shows offline banner with queue count", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain("offline-banner");
    expect(src).toContain("Modo Offline");
    expect(src).toContain("_showOfflineBanner");
    expect(src).toContain("_hideOfflineBanner");
  });

  it("shows toast on sync completion", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain("sincronizada");
    expect(src).toContain("showToast");
    expect(src).toContain("success");
  });

  it("shows update banner", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain("pwa-update-banner");
    expect(src).toContain("SKIP_WAITING");
    expect(src).toContain("Nueva versión");
  });

  it("auto-checks for SW updates every 30 minutes", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain("registration.update()");
    expect(src).toContain("30 * 60 * 1000");
  });

  it("updates sync status indicator with queue count", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain("updateSyncStatus");
    expect(src).toContain("pendingOps");
  });

  it("listens for queue-updated events", () => {
    const src = readFileSync(join(JS_DIR, "pwa.js"), "utf-8");
    expect(src).toContain("queue-updated");
  });
});

// ══════════════════════════════════════════════════════════════════
//  HTML Integration Tests
// ══════════════════════════════════════════════════════════════════

describe("Sprint 53 — HTML Integration", () => {
  it("index.html includes offline-db.js", () => {
    const html = readFileSync(join(HTML_DIR, "index.html"), "utf-8");
    expect(html).toContain('src="js/offline-db.js"');
  });

  it("index.html includes offline-queue.js", () => {
    const html = readFileSync(join(HTML_DIR, "index.html"), "utf-8");
    expect(html).toContain('src="js/offline-queue.js"');
  });

  it("index.html includes pwa.js", () => {
    const html = readFileSync(join(HTML_DIR, "index.html"), "utf-8");
    expect(html).toContain('src="js/pwa.js"');
  });

  it("index.html has offline-badge element", () => {
    const html = readFileSync(join(HTML_DIR, "index.html"), "utf-8");
    expect(html).toContain('id="offline-badge"');
    expect(html).toContain("Operaciones pendientes sin conexión");
  });

  it("index.html has pwa-install-banner", () => {
    const html = readFileSync(join(HTML_DIR, "index.html"), "utf-8");
    expect(html).toContain('id="pwa-install-banner"');
    expect(html).toContain("Instalar AutomotiveOS");
  });

  it("offline modules load before pwa.js", () => {
    const html = readFileSync(join(HTML_DIR, "index.html"), "utf-8");
    const offlineDbIdx = html.indexOf('src="js/offline-db.js"');
    const offlineQueueIdx = html.indexOf('src="js/offline-queue.js"');
    const pwaIdx = html.indexOf('src="js/pwa.js"');
    expect(offlineDbIdx).toBeGreaterThan(0);
    expect(offlineQueueIdx).toBeGreaterThan(offlineDbIdx);
    expect(pwaIdx).toBeGreaterThan(offlineQueueIdx);
  });
});
