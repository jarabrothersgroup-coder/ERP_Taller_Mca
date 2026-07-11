/* ─── Notifications Bell + Panel ─────────── */
/* Sprint 13 — In-app alerts for workshop events */

let notifOpen = false;
let lastNotifCount = 0;

function renderNotifBell() {
  return `<div class="relative">
    <button id="notif-bell" class="relative p-2 text-gray-400 hover:text-white transition" title="Notificaciones">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
      <span id="notif-badge" class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center hidden">0</span>
    </button>
    <div id="notif-panel" class="hidden absolute right-0 top-full mt-2 w-80 max-h-96 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h4 class="text-sm font-semibold text-white">Notificaciones</h4>
        <button id="notif-read-all" class="text-xs text-blue-400 hover:text-blue-300">Marcar todo leído</button>
      </div>
      <div id="notif-list" class="overflow-y-auto max-h-72 divide-y divide-gray-700/50">
        <div class="px-4 py-6 text-center text-gray-500 text-sm">Cargando...</div>
      </div>
    </div>
  </div>`;
}

async function fetchNotifications() {
  try {
    const data = await api('/api/notifications?limit=20');
    renderNotifList(data || []);
    updateNotifBadge(data || []);
  } catch {
    // Silent — notifications are non-critical
  }
}

async function fetchNotifCount() {
  try {
    const data = await api('/api/notifications/count');
    const badge = document.getElementById('notif-badge');
    if (badge) {
      const count = data?.count || 0;
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('hidden', count === 0);
      // Show toast for new notifications
      if (count > lastNotifCount && lastNotifCount > 0 && typeof showToast === 'function') {
        showToast(`Tienes ${count - lastNotifCount} nueva(s) notificación(es)`, 'info', 5000);
      }
      lastNotifCount = count;
    }
  } catch {}
}

function renderNotifList(notifs) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!notifs.length) {
    list.innerHTML = '<div class="px-4 py-6 text-center text-gray-500 text-sm">Sin notificaciones</div>';
    return;
  }
  list.innerHTML = notifs.map(n => {
    const icon = notifIcon(n.tipo);
    const readClass = n.leido ? 'opacity-60' : '';
    const entityNav = n.entityType && n.entityId ? `data-entity-type="${esc(n.entityType)}" data-entity-id="${esc(n.entityId)}"` : '';
    return `<div class="notif-item px-4 py-3 hover:bg-gray-700/50 cursor-pointer transition ${readClass}" ${entityNav} data-notif-id="${esc(n.id)}">
      <div class="flex items-start gap-3">
        <span class="mt-0.5 flex-shrink-0">${icon}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">${esc(n.titulo)}</p>
          <p class="text-xs text-gray-400 mt-0.5 line-clamp-2">${esc(n.mensaje)}</p>
          <p class="text-[10px] text-gray-600 mt-1">${formatNotifTime(n.createdAt)}</p>
        </div>
        ${!n.leido ? '<span class="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>' : ''}
      </div>
    </div>`;
  }).join('');
}

function updateNotifBadge(notifs) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const unread = notifs.filter(n => !n.leido).length;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  badge.classList.toggle('hidden', unread === 0);
}

function notifIcon(tipo) {
  const icons = {
    INVENTARIO: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
    COBRO: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    OT: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/></svg>',
    SEGURIDAD: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>',
    SISTEMA: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/></svg>',
  };
  return icons[tipo] || '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>';
}

function formatNotifTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Hace ${diffD}d`;
}

function setupNotifListeners() {
  document.addEventListener('click', (e) => {
    // Toggle bell panel
    if (e.target.closest('#notif-bell')) {
      e.stopPropagation();
      notifOpen = !notifOpen;
      const panel = document.getElementById('notif-panel');
      if (panel) {
        panel.classList.toggle('hidden', !notifOpen);
        if (notifOpen) fetchNotifications();
      }
      return;
    }

    // Close panel on outside click
    if (!e.target.closest('#notif-panel')) {
      notifOpen = false;
      const panel = document.getElementById('notif-panel');
      if (panel) panel.classList.add('hidden');
      return;
    }

    // Mark all as read
    if (e.target.closest('#notif-read-all')) {
      api('/api/notifications/read-all', { method: 'POST' }).then(() => {
        fetchNotifications();
      }).catch(() => {});
      return;
    }

    // Click on notification item — navigate to entity
    const item = e.target.closest('.notif-item');
    if (item) {
      const notifId = item.dataset.notifId;
      const entityType = item.dataset.entityType;
      const entityId = item.dataset.entityId;

      // Mark as read
      if (notifId) {
        api(`/api/notifications/${notifId}/read`, { method: 'PATCH' }).catch(() => {});
      }

      // Navigate based on entity type
      if (entityType === 'repuesto') navigate('inventario');
      else if (entityType === 'factura') navigate('tesoreria');
      else if (entityType === 'orden_trabajo') navigate('ordenes');

      // Close panel
      notifOpen = false;
      const panel = document.getElementById('notif-panel');
      if (panel) panel.classList.add('hidden');
    }
  });
}

// Auto-poll notifications every 60s when logged in
let notifPollTimer = null;
function startNotifPolling() {
  if (notifPollTimer) clearInterval(notifPollTimer);
  fetchNotifCount();
  notifPollTimer = setInterval(() => {
    if (state.auth.profile) fetchNotifCount();
  }, 60000);
}

function stopNotifPolling() {
  if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; }
}
