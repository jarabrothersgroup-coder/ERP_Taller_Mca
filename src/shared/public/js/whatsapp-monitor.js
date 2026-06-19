/* ─── WhatsApp Queue Monitor ───────────────────────────────────── */

/* ─── Main Render ───────────────────────────────────────────────── */

function renderWhatsappMonitor(container) {
  container.innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h2 class="text-lg font-semibold text-white">Monitor de Mensajeria WhatsApp</h2>' +
        '<p class="text-sm text-gray-400 mt-1">Estado de colas, entregas y errores — Evolution API</p>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
        '<button onclick="refreshWhatsAppMonitor()" ' +
          'class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition flex items-center gap-1.5">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>' +
          'Actualizar' +
        '</button>' +
        '<button onclick="retryFailedWhatsApp()" id="wa-retry-btn" ' +
          'class="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded-lg transition flex items-center gap-1.5">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>' +
          'Reenviar Fallidos' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div id="wa-connection-status" class="mb-4"></div>' +
    '<div id="wa-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"></div>' +
    '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">' +
      '<div class="lg:col-span-2">' +
        '<h3 class="text-sm font-medium text-gray-300 mb-3">Historial de Mensajes</h3>' +
        '<div id="wa-message-log" class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">' +
          '<div class="text-center py-6 text-gray-600 text-sm">Cargando...</div>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<h3 class="text-sm font-medium text-gray-300 mb-3">Errores Recientes</h3>' +
        '<div id="wa-errors" class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">' +
          '<div class="text-center py-6 text-gray-600 text-sm">Cargando...</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  refreshWhatsAppMonitor();
}

/* ─── Load All Data ─────────────────────────────────────────────── */

async function refreshWhatsAppMonitor() {
  await Promise.all([
    loadWhatsAppConnection(),
    loadWhatsAppStats(),
    loadWhatsAppLog(),
    loadWhatsAppErrors(),
  ]);
}

/* ─── Connection Status ─────────────────────────────────────────── */

async function loadWhatsAppConnection() {
  var el = document.getElementById('wa-connection-status');
  if (!el) return;
  try {
    var status = await api('/whatsapp/status');
    var isConnected = status.status === 'open' || status.status === 'CONNECTED';
    el.innerHTML =
      '<div class="flex items-center gap-2 px-3 py-2 rounded-lg border ' +
        (isConnected ? 'bg-green-900/20 border-green-800/30' : 'bg-red-900/20 border-red-800/30') + '">' +
        '<div class="w-2 h-2 rounded-full ' + (isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400') + '"></div>' +
        '<span class="text-sm ' + (isConnected ? 'text-green-300' : 'text-red-300') + '">' +
          (isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado') +
        '</span>' +
        (status.instanceName ? '<span class="text-xs text-gray-500 ml-auto">' + esc(status.instanceName) + '</span>' : '') +
      '</div>';
  } catch {
    el.innerHTML =
      '<div class="flex items-center gap-2 px-3 py-2 rounded-lg border bg-gray-800/50 border-gray-700">' +
        '<div class="w-2 h-2 rounded-full bg-gray-500"></div>' +
        '<span class="text-sm text-gray-400">Estado de conexion no disponible</span>' +
      '</div>';
  }
}

/* ─── Queue Stats ───────────────────────────────────────────────── */

async function loadWhatsAppStats() {
  var el = document.getElementById('wa-stats');
  if (!el) return;
  try {
    var stats = await api('/whatsapp/queue/stats');
    el.innerHTML =
      renderStatCard('Enviados', stats.sent || stats.totalSent || 0, 'green', 'M5 13l4 4L19 7') +
      renderStatCard('En Cola', stats.pending || stats.totalPending || 0, 'yellow', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z') +
      renderStatCard('Fallidos', stats.failed || stats.totalFailed || 0, 'red', 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z') +
      renderStatCard('Tasa Exito', stats.totalSent > 0 ? Math.round(((stats.totalSent || 0) / Math.max(stats.totalSent + (stats.totalFailed || 0), 1)) * 100) + '%' : '-', 'blue', 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z');
  } catch {
    el.innerHTML =
      renderStatCard('Enviados', '-', 'gray', 'M5 13l4 4L19 7') +
      renderStatCard('En Cola', '-', 'gray', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z') +
      renderStatCard('Fallidos', '-', 'gray', 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z') +
      renderStatCard('Tasa Exito', '-', 'gray', 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z');
  }
}

function renderStatCard(label, value, color, icon) {
  return '<div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">' +
    '<div class="flex items-center gap-2 mb-2">' +
      '<div class="w-7 h-7 rounded-lg bg-' + color + '-900/50 flex items-center justify-center">' +
        '<svg class="w-3.5 h-3.5 text-' + color + '-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="' + icon + '"/></svg>' +
      '</div>' +
      '<span class="text-xs text-gray-500">' + label + '</span>' +
    '</div>' +
    '<p class="text-2xl font-bold text-white">' + value + '</p>' +
  '</div>';
}

/* ─── Message Log ───────────────────────────────────────────────── */

async function loadWhatsAppLog() {
  var el = document.getElementById('wa-message-log');
  if (!el) return;
  try {
    var resp = await api('/whatsapp/log?limit=30');
    var messages = resp.items || resp.data || resp;
    if (!messages || !messages.length) {
      el.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay mensajes registrados</div>';
      return;
    }

    el.innerHTML = '<div class="divide-y divide-gray-800/50">' + messages.map(function(msg) {
      var status = msg.status || 'PENDING';
      var statusConfig = getWhatsAppStatusConfig(status);
      var fecha = msg.sentAt ? new Date(msg.sentAt).toLocaleString('es-PY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
        : (msg.createdAt ? new Date(msg.createdAt).toLocaleString('es-PY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '-');

      return '<div class="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/20 transition">' +
        '<div class="w-2 h-2 rounded-full flex-shrink-0 ' + statusConfig.dot + '"></div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2 mb-0.5">' +
            '<span class="text-sm text-white font-medium truncate">' + esc(msg.clienteName || '-') + '</span>' +
            '<span class="px-1.5 py-0.5 text-xs rounded ' + statusConfig.badge + '">' + statusConfig.label + '</span>' +
          '</div>' +
          '<p class="text-xs text-gray-500 truncate">' + esc((msg.messageText || '').substring(0, 80)) + '</p>' +
          '<div class="flex items-center gap-3 mt-1">' +
            '<span class="text-xs text-gray-600">' + esc(msg.phoneNumber || '-') + '</span>' +
            '<span class="text-xs text-gray-600">' + esc(msg.template || '-') + '</span>' +
            '<span class="text-xs text-gray-600 ml-auto">' + fecha + '</span>' +
          '</div>' +
        '</div>' +
        (status === 'FAILED' ?
          '<button onclick="resendWhatsAppMessage(\'' + msg.id + '\', \'' + esc(msg.phoneNumber || '') + '\', \'' + esc((msg.messageText || '').substring(0, 50)) + '\')" ' +
            'class="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded transition border border-red-800/30 flex-shrink-0">' +
            'Reenviar' +
          '</button>' : '') +
      '</div>';
    }).join('') + '</div>';

    // Pagination
    if (resp.hasNext) {
      el.innerHTML += '<div class="p-3 text-center"><button onclick="loadWhatsAppLogPage(' + (resp.page + 1) + ')" class="text-xs text-blue-400 hover:text-blue-300 transition">Ver mas mensajes</button></div>';
    }
  } catch {
    el.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">Error cargando historial</div>';
  }
}

function getWhatsAppStatusConfig(status) {
  switch (status) {
    case 'SENT':
      return { dot: 'bg-green-400', label: 'Enviado', badge: 'bg-green-900/40 text-green-300' };
    case 'PENDING':
      return { dot: 'bg-yellow-400 animate-pulse', label: 'En cola', badge: 'bg-yellow-900/40 text-yellow-300' };
    case 'FAILED':
      return { dot: 'bg-red-400', label: 'Fallido', badge: 'bg-red-900/40 text-red-300' };
    default:
      return { dot: 'bg-gray-400', label: status, badge: 'bg-gray-800 text-gray-400' };
  }
}

async function loadWhatsAppLogPage(page) {
  var el = document.getElementById('wa-message-log');
  if (!el) return;
  try {
    var resp = await api('/whatsapp/log?limit=30&page=' + page);
    var messages = resp.items || [];
    if (!messages.length) return;

    var existing = el.querySelector('.divide-y');
    if (existing) {
      messages.forEach(function(msg) {
        var status = msg.status || 'PENDING';
        var statusConfig = getWhatsAppStatusConfig(status);
        var fecha = msg.sentAt ? new Date(msg.sentAt).toLocaleString('es-PY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
          : (msg.createdAt ? new Date(msg.createdAt).toLocaleString('es-PY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '-');
        existing.insertAdjacentHTML('beforeend',
          '<div class="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/20 transition">' +
            '<div class="w-2 h-2 rounded-full flex-shrink-0 ' + statusConfig.dot + '"></div>' +
            '<div class="flex-1 min-w-0">' +
              '<div class="flex items-center gap-2 mb-0.5">' +
                '<span class="text-sm text-white font-medium truncate">' + esc(msg.clienteName || '-') + '</span>' +
                '<span class="px-1.5 py-0.5 text-xs rounded ' + statusConfig.badge + '">' + statusConfig.label + '</span>' +
              '</div>' +
              '<p class="text-xs text-gray-500 truncate">' + esc((msg.messageText || '').substring(0, 80)) + '</p>' +
              '<div class="flex items-center gap-3 mt-1">' +
                '<span class="text-xs text-gray-600">' + esc(msg.phoneNumber || '-') + '</span>' +
                '<span class="text-xs text-gray-600">' + esc(msg.template || '-') + '</span>' +
                '<span class="text-xs text-gray-600 ml-auto">' + fecha + '</span>' +
              '</div>' +
            '</div>' +
            (status === 'FAILED' ?
              '<button onclick="resendWhatsAppMessage(\'' + msg.id + '\', \'' + esc(msg.phoneNumber || '') + '\', \'' + esc((msg.messageText || '').substring(0, 50)) + '\')" ' +
                'class="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded transition border border-red-800/30 flex-shrink-0">Reenviar</button>' : '') +
          '</div>'
        );
      });
    }
  } catch { /* pagination optional */ }
}

/* ─── Errors ────────────────────────────────────────────────────── */

async function loadWhatsAppErrors() {
  var el = document.getElementById('wa-errors');
  if (!el) return;
  try {
    var resp = await api('/whatsapp/errors?limit=15');
    var errors = resp.items || resp.data || resp;
    if (!errors || !errors.length) {
      el.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay errores recientes</div>';
      return;
    }

    el.innerHTML = '<div class="divide-y divide-gray-800/50">' + errors.map(function(err) {
      var fecha = err.createdAt ? new Date(err.createdAt).toLocaleString('es-PY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '-';
      return '<div class="px-4 py-3 hover:bg-gray-800/20 transition">' +
        '<div class="flex items-center gap-2 mb-1">' +
          '<div class="w-2 h-2 rounded-full bg-red-400"></div>' +
          '<span class="text-sm text-red-300 font-medium">' + esc(err.source || err.errorType || 'Error') + '</span>' +
          '<span class="text-xs text-gray-600 ml-auto">' + fecha + '</span>' +
        '</div>' +
        '<p class="text-xs text-gray-400 ml-4">' + esc((err.errorMessage || err.message || '').substring(0, 120)) + '</p>' +
        (!err.resolved ?
          '<button onclick="resolveWhatsAppError(\'' + err.id + '\')" ' +
            'class="mt-1 ml-4 px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded transition">' +
            'Marcar resuelto' +
          '</button>' : '<span class="text-xs text-green-500 ml-4">Resuelto</span>') +
      '</div>';
    }).join('') + '</div>';
  } catch {
    el.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">Error cargando errores</div>';
  }
}

/* ─── Actions ───────────────────────────────────────────────────── */

async function retryFailedWhatsApp() {
  var btn = document.getElementById('wa-retry-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Reintentando...'; }

  try {
    var resp = await api('/whatsapp/queue/retry', { method: 'POST' });
    var retried = resp.retried || resp.processed || 0;
    alert('Reintentados: ' + retried + ' mensajes fallidos');
    refreshWhatsAppMonitor();
  } catch (err) {
    alert('Error: ' + (err.message || 'Error reintentando mensajes'));
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Reenviar Fallidos'; }
}

async function resendWhatsAppMessage(msgId, phone, preview) {
  if (!confirm('Reenviar mensaje a ' + phone + '?')) return;
  try {
    await api('/whatsapp/send-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, message: preview + ' (Reenvio)' }),
    });
    refreshWhatsAppMonitor();
  } catch (err) {
    alert('Error reenviando: ' + (err.message || 'Error desconocido'));
  }
}

async function resolveWhatsAppError(errorId) {
  try {
    await api('/whatsapp/errors/' + errorId + '/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    loadWhatsAppErrors();
  } catch { /* resolve optional */ }
}
