/* ─── PWA Registration + Offline Indicator ──── */

(function() {
  'use strict';

  // ─── Register Service Worker ─────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA] Service Worker registered:', reg.scope);

        // Check for updates periodically (every 60 minutes)
        setInterval(() => reg.update(), 60 * 60 * 1000);

        // Listen for controlling SW changes
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — show update toast
              if (window.showToast) {
                window.showToast('Nueva versión disponible. Recargá para actualizar.', 'info', 8000);
              }
            }
          });
        });
      } catch (err) {
        console.warn('[PWA] SW registration failed:', err);
      }
    });
  }

  // ─── Offline Indicator ───────────────────────
  const OFFLINE_KEY = 'automotiveos_offline_mode';

  function updateOfflineUI() {
    const badge = document.getElementById('offline-badge');
    const wsDot = document.getElementById('ws-dot');
    const wsLabel = document.getElementById('ws-label');

    if (!navigator.onLine) {
      // Show offline mode
      if (badge) {
        badge.classList.remove('hidden');
        badge.textContent = '⚠️';
        badge.title = 'Modo offline — Las operaciones se sincronizarán cuando vuelva la conexión';
      }
      if (wsDot) wsDot.className = 'ws-dot bg-yellow-500';
      if (wsLabel) wsLabel.textContent = 'Offline';

      document.body.classList.add('is-offline');
    } else {
      // Online
      if (badge) badge.classList.add('hidden');
      if (wsDot) wsDot.className = 'ws-dot bg-green-500';
      if (wsLabel) wsLabel.textContent = 'Conectado';

      document.body.classList.remove('is-offline');
    }
  }

  // Listen for online/offline events
  window.addEventListener('online', () => {
    updateOfflineUI();
    if (window.showToast) {
      window.showToast('Conexión restaurada', 'success', 3000);
    }
    // Trigger background sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.sync.register('flush-offline-queue').catch(() => {});
      });
    }
  });

  window.addEventListener('offline', () => {
    updateOfflineUI();
    if (window.showToast) {
      window.showToast('Sin conexión — Modo offline activado', 'warning', 5000);
    }
  });

  // ─── Listen for SW messages ──────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_STARTED') {
        if (window.showToast) {
          window.showToast('Sincronizando datos...', 'info', 2000);
        }
      }
    });
  }

  // ─── Initialize on DOM ready ─────────────────
  document.addEventListener('DOMContentLoaded', () => {
    updateOfflineUI();
  });

  // Also run immediately if DOM is already loaded
  if (document.readyState !== 'loading') {
    updateOfflineUI();
  }

  // ─── CSS for offline state ───────────────────
  const style = document.createElement('style');
  style.textContent = `
    .is-offline #view-content::before {
      content: '⚠️ Modo offline — Los datos mostrados pueden no estar actualizados';
      display: block;
      background: rgba(234, 179, 8, 0.1);
      border: 1px solid rgba(234, 179, 8, 0.3);
      color: #fbbf24;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      text-align: center;
    }
    .is-offline .sidebar-item[data-view] {
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);

})();
