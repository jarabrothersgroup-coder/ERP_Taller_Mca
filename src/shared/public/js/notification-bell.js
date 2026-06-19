/**
 * Notification Bell — Real-time notification dropdown with WebSocket.
 *
 * Features:
 *   - WebSocket connection for real-time push
 *   - Unread count badge
 *   - Dropdown with notification list
 *   - Mark as read / mark all as read
 *   - Priority indicators (URGENT = red pulse)
 *
 * @module js/notification-bell
 */

/* global api, esc */

// ─── State ──────────────────────────────────
let _notifState = {
  ws: null,
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  connected: false,
};

// ─── WebSocket Connection ───────────────────

function connectNotificationWS() {
  if (_notifState.ws && _notifState.ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const tenant = window._state?.tenantSlug || "";
  const user = window._state?.userEmail || "";

  if (!tenant) return;

  const wsUrl = `${protocol}//${window.location.host}/ws/notifications?tenant=${encodeURIComponent(tenant)}&user=${encodeURIComponent(user)}`;

  try {
    _notifState.ws = new WebSocket(wsUrl);

    _notifState.ws.onopen = () => {
      _notifState.connected = true;
      updateConnectionDot(true);
      console.log("[notif-ws] Connected");
    };

    _notifState.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleNotificationMessage(msg);
      } catch {}
    };

    _notifState.ws.onclose = () => {
      _notifState.connected = false;
      updateConnectionDot(false);
      console.log("[notif-ws] Disconnected, reconnecting in 5s...");
      setTimeout(connectNotificationWS, 5000);
    };

    _notifState.ws.onerror = () => {
      _notifState.connected = false;
    };
  } catch {}
}

function handleNotificationMessage(msg) {
  if (msg.type === "notification") {
    const data = msg.data;

    // Check if it's a count update
    if (data.titulo === "count_update") {
      _notifState.unreadCount = parseInt(data.mensaje) || 0;
      updateBadge();
      return;
    }

    // New notification — prepend to list
    _notifState.notifications.unshift(data);
    _notifState.unreadCount++;
    updateBadge();
    updateDropdown();

    // Show toast for URGENT/HIGH priority
    if (data.priority === "URGENT" || data.priority === "HIGH") {
      showNotificationToast(data);
    }
  } else if (msg.type === "pong") {
    // Heartbeat response
  }
}

// ─── UI Rendering ───────────────────────────

function initNotificationBell() {
  const container = document.getElementById("notif-bell-container");
  if (!container) return;

  container.innerHTML = `
    <div class="relative">
      <button id="notif-bell-btn" class="relative p-1.5 text-gray-400 hover:text-white transition" title="Notificaciones" aria-label="Notificaciones">
        <span class="text-lg">🔔</span>
        <span id="notif-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center hidden">0</span>
      </button>
      <div id="notif-dropdown" class="hidden absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span class="text-sm font-semibold text-white">Notificaciones</span>
          <div class="flex gap-2">
            <button onclick="notifMarkAllRead()" class="text-xs text-blue-400 hover:text-blue-300">Marcar todo leído</button>
            <button onclick="notifToggleDropdown()" class="text-gray-500 hover:text-white text-sm">&times;</button>
          </div>
        </div>
        <div id="notif-list" class="overflow-y-auto max-h-72 divide-y divide-gray-800"></div>
        <div id="notif-empty" class="px-4 py-6 text-center text-gray-500 text-sm hidden">Sin notificaciones</div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById("notif-bell-btn")?.addEventListener("click", notifToggleDropdown);

  // Load initial data
  notifLoadCount();
  notifLoadList();

  // Connect WebSocket
  connectNotificationWS();

  // Start heartbeat
  setInterval(() => {
    if (_notifState.ws?.readyState === WebSocket.OPEN) {
      _notifState.ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);
}

// ─── Data Loading ───────────────────────────

async function notifLoadCount() {
  try {
    const data = await api("/api/notifications/count");
    _notifState.unreadCount = data.count || 0;
    updateBadge();
  } catch {}
}

async function notifLoadList() {
  try {
    const data = await api("/api/notifications?limit=20");
    _notifState.notifications = data || [];
    updateDropdown();
  } catch {}
}

// ─── UI Updates ─────────────────────────────

function updateBadge() {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;

  if (_notifState.unreadCount > 0) {
    badge.textContent = _notifState.unreadCount > 99 ? "99+" : String(_notifState.unreadCount);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function updateDropdown() {
  const list = document.getElementById("notif-list");
  const empty = document.getElementById("notif-empty");
  if (!list || !empty) return;

  const notifs = _notifState.notifications;

  if (!notifs.length) {
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  list.classList.remove("hidden");
  empty.classList.add("hidden");

  const priorityColors = {
    URGENT: "border-l-4 border-red-500",
    HIGH: "border-l-4 border-yellow-500",
    NORMAL: "",
    LOW: "opacity-70",
  };

  const tipoIcons = {
    INVENTARIO: "📦",
    COBRO: "💰",
    OT: "📋",
    SEGURIDAD: "🛡️",
    SISTEMA: "⚙️",
  };

  list.innerHTML = notifs.map((n) => `
    <div class="px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition ${priorityColors[n.priority] || ""} ${n.leido ? "opacity-60" : ""}" onclick="notifClick('${esc(n.id)}', '${esc(n.entityType || "")}', '${esc(n.entityId || "")}')">
      <div class="flex items-start gap-2">
        <span class="text-sm mt-0.5">${tipoIcons[n.tipo] || "📢"}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">${esc(n.titulo)}</p>
          <p class="text-xs text-gray-500 truncate">${esc(n.mensaje?.substring(0, 80))}</p>
          <p class="text-[10px] text-gray-600 mt-0.5">${formatNotifTime(n.createdAt)}</p>
        </div>
        ${!n.leido ? '<span class="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>' : ""}
      </div>
    </div>
  `).join("");
}

function updateConnectionDot(connected) {
  // Update header WS dot
  const wsDot = document.getElementById("ws-dot");
  const wsLabel = document.getElementById("ws-label");
  if (wsDot) wsDot.className = `ws-dot ${connected ? "bg-green-500" : "bg-red-500"}`;
  if (wsLabel) wsLabel.textContent = connected ? "Online" : "Offline";
}

function showNotificationToast(data) {
  if (typeof showToast === "function") {
    showToast(`${data.titulo}: ${data.mensaje}`, data.priority === "URGENT" ? "error" : "info");
  }
}

// ─── Actions ────────────────────────────────

function notifToggleDropdown() {
  const dropdown = document.getElementById("notif-dropdown");
  if (!dropdown) return;

  _notifState.isOpen = !_notifState.isOpen;
  dropdown.classList.toggle("hidden", !_notifState.isOpen);

  if (_notifState.isOpen) {
    notifLoadList();
  }
}

async function notifMarkAllRead() {
  try {
    await api("/api/notifications/read-all", { method: "POST" });
    _notifState.unreadCount = 0;
    _notifState.notifications.forEach((n) => (n.leido = true));
    updateBadge();
    updateDropdown();
  } catch {}
}

async function notifClick(id, entityType, entityId) {
  // Mark as read
  try {
    await api(`/api/notifications/${id}/read`, { method: "PATCH" });
    const notif = _notifState.notifications.find((n) => n.id === id);
    if (notif) notif.leido = true;
    _notifState.unreadCount = Math.max(0, _notifState.unreadCount - 1);
    updateBadge();
    updateDropdown();
  } catch {}

  // Navigate to entity
  if (entityType && entityId) {
    const viewMap = {
      repuesto: "inventario",
      factura: "facturacion",
      orden_trabajo: "ordenes",
    };
    const view = viewMap[entityType];
    if (view && typeof navigateTo === "function") {
      notifToggleDropdown();
      navigateTo(view);
    }
  }
}

function formatNotifTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

// ─── Close dropdown on outside click ────────

if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#notif-bell-btn") && !e.target.closest("#notif-dropdown")) {
      const dropdown = document.getElementById("notif-dropdown");
      if (dropdown && !dropdown.classList.contains("hidden")) {
        _notifState.isOpen = false;
        dropdown.classList.add("hidden");
      }
    }
  });
}

// ─── Exports ────────────────────────────────

window.initNotificationBell = initNotificationBell;
window.notifToggleDropdown = notifToggleDropdown;
window.notifMarkAllRead = notifMarkAllRead;
window.notifClick = notifClick;
window.connectNotificationWS = connectNotificationWS;
