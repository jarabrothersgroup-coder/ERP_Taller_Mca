/**
 * PWA Registration v2 — Progressive Web App setup.
 *
 * Registers service worker, handles install prompt,
 * integrates offline queue, and provides sync UI.
 *
 * @module pwa/pwa-registration
 */

// ─── Service Worker Registration ──────────────

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("[PWA] Service Worker v2 registrado:", registration.scope);

      // Check for updates every 30 minutes
      setInterval(() => registration.update(), 30 * 60 * 1000);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("[PWA] Nueva versión activada");
              _showUpdateBanner();
            }
          });
        }
      });
    } catch (err) {
      console.warn("[PWA] Error registrando Service Worker:", err);
    }
  });
}

// ─── Update Banner ────────────────────────────

function _showUpdateBanner() {
  let banner = document.getElementById("pwa-update-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "pwa-update-banner";
    banner.className =
      "fixed top-0 left-0 right-0 bg-blue-600 text-white p-3 flex items-center justify-between z-50";
    banner.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="text-lg">🔄</span>
        <span class="text-sm font-medium">Nueva versión disponible</span>
      </div>
      <button id="pwa-update-btn" class="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-semibold hover:bg-gray-100 transition">
        Actualizar
      </button>
    `;
    document.body.appendChild(banner);

    document
      .getElementById("pwa-update-btn")
      ?.addEventListener("click", () => {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.controller?.postMessage({ type: "SKIP_WAITING" });
        }
        window.location.reload();
      });
  }
  banner.classList.remove("hidden");
}

// ─── Install Prompt ───────────────────────────

let deferredPrompt = null;

const installBanner = document.getElementById("pwa-install-banner");
const installBtn = document.getElementById("pwa-install-btn");
const dismissBtn = document.getElementById("pwa-dismiss-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log("[PWA] Install prompt disponible");
  if (installBanner) installBanner.classList.remove("hidden");
});

installBtn?.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("[PWA] User choice:", outcome);
    deferredPrompt = null;
    if (installBanner) installBanner.classList.add("hidden");
  }
});

dismissBtn?.addEventListener("click", () => {
  if (installBanner) installBanner.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  console.log("[PWA] App installed");
  if (installBanner) installBanner.classList.add("hidden");
  deferredPrompt = null;
});

// ─── Offline Detection ────────────────────────

const offlineBadge = document.getElementById("offline-badge");
let _offlineBanner = null;

function updateOfflineUI(online) {
  if (!online) {
    document.body.classList.add("offline");
    _showOfflineBanner();
  } else {
    document.body.classList.remove("offline");
    _hideOfflineBanner();
    // Auto-flush queue on reconnect
    if (window.OfflineQueue) {
      setTimeout(() => {
        window.OfflineQueue.flush().then(({ success, failed }) => {
          if (success > 0) {
            _showToast(
              `✅ ${success} operación${success > 1 ? "es" : ""} sincronizada${success > 1 ? "s" : ""}`,
              "success",
            );
          }
          if (failed > 0) {
            _showToast(
              `⚠️ ${failed} operación${failed > 1 ? "es" : ""} fallida — se reintentará`,
              "warning",
            );
          }
        });
      }, 1500);
    }
  }
}

function _showOfflineBanner() {
  if (_offlineBanner) return;
  _offlineBanner = document.createElement("div");
  _offlineBanner.id = "offline-banner";
  _offlineBanner.className =
    "fixed bottom-16 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-yellow-900/95 border border-yellow-700 text-yellow-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm z-40 flex items-center gap-3 transition-all duration-300";
  _offlineBanner.innerHTML = `
    <span class="text-xl flex-shrink-0">📡</span>
    <div class="flex-1">
      <p class="text-sm font-semibold">Modo Offline</p>
      <p class="text-xs text-yellow-400" id="offline-queue-msg">Las operaciones se sincronizarán al reconectar</p>
    </div>
    <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
  `;
  document.body.appendChild(_offlineBanner);

  // Animate in
  requestAnimationFrame(() => {
    _offlineBanner.style.transform = "translateY(0)";
    _offlineBanner.style.opacity = "1";
  });

  _updateOfflineQueueMsg();
}

function _hideOfflineBanner() {
  if (_offlineBanner) {
    _offlineBanner.style.transform = "translateY(100%)";
    _offlineBanner.style.opacity = "0";
    setTimeout(() => {
      _offlineBanner?.remove();
      _offlineBanner = null;
    }, 300);
  }
}

function _updateOfflineQueueMsg() {
  if (!window.OfflineQueue) return;
  window.OfflineQueue.getPendingCount().then((count) => {
    const msg = document.getElementById("offline-queue-msg");
    if (msg) {
      msg.textContent =
        count > 0
          ? `${count} operación${count > 1 ? "es" : ""} pendiente${count > 1 ? "s" : ""}`
          : "Las operaciones se sincronizarán al reconectar";
    }
  });
}

function _showToast(message, type = "info") {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`[PWA ${type}] ${message}`);
  }
}

window.addEventListener("online", () => {
  console.log("[PWA] Conexión restaurada");
  updateOfflineUI(true);
});

window.addEventListener("offline", () => {
  console.log("[PWA] Sin conexión — modo offline");
  updateOfflineUI(false);
});

// Initial state check
if (typeof navigator !== "undefined" && !navigator.onLine) {
  updateOfflineUI(false);
}

// Listen for queue updates
window.addEventListener("queue-updated", (e) => {
  const { count } = e.detail;
  if (count > 0 && !navigator.onLine) {
    _updateOfflineQueueMsg();
  }
});

// ─── Push Notification Subscription ───────────

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

// ─── Sync Status Indicator ────────────────────

let _syncStatus = { online: navigator.onLine, lastSync: null, pendingOps: 0 };

function updateSyncStatus() {
  const dot = document.getElementById("ws-dot");
  const label = document.getElementById("ws-label");
  if (!dot || !label) return;

  if (navigator.onLine) {
    dot.className = "ws-dot bg-green-500";
    label.textContent = "Conectado";
    _syncStatus.online = true;
  } else {
    dot.className = "ws-dot bg-yellow-500";
    label.textContent = "Offline";
    _syncStatus.online = false;
  }

  // Update pending ops count
  if (window.OfflineQueue) {
    window.OfflineQueue.getPendingCount().then((count) => {
      _syncStatus.pendingOps = count;
      const badge = document.getElementById("offline-badge");
      if (badge) {
        if (count > 0) {
          badge.textContent = String(count);
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }
    });
  }
}

window.addEventListener("online", updateSyncStatus);
window.addEventListener("offline", updateSyncStatus);
window.addEventListener("queue-updated", updateSyncStatus);

// Initial sync status
updateSyncStatus();
