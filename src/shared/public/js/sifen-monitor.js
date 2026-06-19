/* ─── SIFEN Fiscal Contingency Monitor ─────────────────────────── */

/* ─── Main Render ───────────────────────────────────────────────── */

function renderSifenMonitor(container) {
  container.innerHTML =
    '<div class="flex items-center justify-between mb-6">' +
      '<div>' +
        '<h2 class="text-lg font-semibold text-white">Monitor Fiscal SIFEN</h2>' +
        '<p class="text-sm text-gray-400 mt-1">Estado de facturacion electronica — DNIT Paraguay</p>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
        '<button onclick="checkSifenHealth()" id="sifen-health-btn" ' +
          'class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition flex items-center gap-1.5">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>' +
          'Verificar conexion' +
        '</button>' +
        '<button onclick="forceSifenTransmission()" id="sifen-force-btn" ' +
          'class="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded-lg transition flex items-center gap-1.5">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>' +
          'Forzar Transmision' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div id="sifen-health-result" class="hidden mb-4"></div>' +
    '<div id="sifen-stats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"></div>' +
    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
      '<div>' +
        '<h3 class="text-sm font-medium text-gray-300 mb-3">Documentos Pendientes de Envio</h3>' +
        '<div id="sifen-pending" class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">' +
          '<div class="text-center py-6 text-gray-600 text-sm">Cargando...</div>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<h3 class="text-sm font-medium text-gray-300 mb-3">Actividad Reciente</h3>' +
        '<div id="sifen-activity" class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">' +
          '<div class="text-center py-6 text-gray-600 text-sm">Cargando...</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  loadSifenDashboard();
}

/* ─── Dashboard Data ────────────────────────────────────────────── */

async function loadSifenDashboard() {
  try {
    var data = await api('/finance/sifen/dashboard');
    renderSifenStats(data.summary || {});
    renderSifenPending(data.pendingDocuments || []);
    renderSifenActivity(data.recentActivity || []);
  } catch (err) {
    var stats = document.getElementById('sifen-stats');
    if (stats) {
      stats.innerHTML =
        '<div class="col-span-full bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-center">' +
          '<p class="text-sm text-red-300">Error cargando dashboard SIFEN</p>' +
          '<p class="text-xs text-red-400 mt-1">' + esc(err.message || 'Conexion no disponible') + '</p>' +
        '</div>';
    }
  }
}

function renderSifenStats(summary) {
  var stats = document.getElementById('sifen-stats');
  if (!stats) return;

  var items = [
    { key: 'BORRADOR', label: 'Borradores', color: 'gray', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { key: 'FIRMADO', label: 'Firmados', color: 'blue', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
    { key: 'ENVIADO', label: 'En Cola', color: 'yellow', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
    { key: 'APROBADO', label: 'Aprobados', color: 'green', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'RECHAZADO', label: 'Rechazados', color: 'red', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'ANULADO', label: 'Anulados', color: 'gray', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  ];

  stats.innerHTML = items.map(function(item) {
    var count = summary[item.key] || 0;
    var isAlert = (item.key === 'RECHAZADO' && count > 0) || (item.key === 'ENVIADO' && count > 5);
    var borderClass = isAlert ? 'border-' + item.color + '-700/50' : 'border-gray-800';
    return '<div class="bg-gray-900/60 rounded-xl border ' + borderClass + ' p-4">' +
      '<div class="flex items-center gap-2 mb-2">' +
        '<div class="w-7 h-7 rounded-lg bg-' + item.color + '-900/50 flex items-center justify-center">' +
          '<svg class="w-3.5 h-3.5 text-' + item.color + '-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="' + item.icon + '"/></svg>' +
        '</div>' +
        '<span class="text-xs text-gray-500">' + item.label + '</span>' +
      '</div>' +
      '<p class="text-2xl font-bold text-white">' + count + '</p>' +
      (isAlert ? '<p class="text-xs text-' + item.color + '-400 mt-1">' + (item.key === 'RECHAZADO' ? 'Requiere atencion' : 'Pendiente de envio') + '</p>' : '') +
    '</div>';
  }).join('');
}

function renderSifenPending(docs) {
  var el = document.getElementById('sifen-pending');
  if (!el) return;

  if (!docs || !docs.length) {
    el.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay documentos pendientes de envio</div>';
    return;
  }

  el.innerHTML = '<div class="divide-y divide-gray-800/50">' + docs.map(function(doc) {
    var age = doc.ageHours;
    var ageText = age != null ? (age < 1 ? 'Reciente' : age + 'h') : '-';
    var ageClass = age != null && age > 24 ? 'text-red-400' : age != null && age > 4 ? 'text-yellow-400' : 'text-gray-500';
    return '<div class="px-4 py-3 flex items-center justify-between hover:bg-gray-800/20 transition">' +
      '<div>' +
        '<div class="flex items-center gap-2">' +
          '<span class="px-2 py-0.5 bg-yellow-900/40 text-yellow-300 text-xs rounded font-medium">' + esc(doc.dteTipo || '-') + '</span>' +
          '<span class="text-sm text-white font-mono">' + esc((doc.serie || '') + '-' + (doc.numero || '')) + '</span>' +
        '</div>' +
        '<p class="text-xs text-gray-500 mt-0.5">En cola desde hace ' + ageText + '</p>' +
      '</div>' +
      '<button onclick="forceSendDoc(\'' + doc.id + '\')" ' +
        'class="px-2.5 py-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 text-xs rounded transition border border-yellow-800/30">' +
        'Enviar ahora' +
      '</button>' +
    '</div>';
  }).join('') + '</div>';
}

function renderSifenActivity(activities) {
  var el = document.getElementById('sifen-activity');
  if (!el) return;

  if (!activities || !activities.length) {
    el.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay actividad reciente</div>';
    return;
  }

  el.innerHTML = '<div class="divide-y divide-gray-800/50">' + activities.map(function(act) {
    var isOk = act.exitoso;
    var statusDot = isOk ? 'bg-green-400' : 'bg-red-400';
    var statusText = isOk ? 'Exitoso' : 'Error';
    var statusClass = isOk ? 'text-green-400' : 'text-red-400';
    var fecha = act.createdAt ? new Date(act.createdAt).toLocaleString('es-PY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '-';
    return '<div class="px-4 py-3 hover:bg-gray-800/20 transition">' +
      '<div class="flex items-center gap-2 mb-1">' +
        '<div class="w-2 h-2 rounded-full ' + statusDot + '"></div>' +
        '<span class="text-sm text-white font-medium">' + esc(act.operacion || '-') + '</span>' +
        '<span class="text-xs ' + statusClass + '">' + statusText + '</span>' +
        '<span class="text-xs text-gray-600 ml-auto">' + fecha + '</span>' +
      '</div>' +
      (act.mensajeError ? '<p class="text-xs text-red-400 ml-4">' + esc(act.mensajeError) + '</p>' : '') +
      (act.cdc ? '<p class="text-xs text-gray-500 ml-4 font-mono">CDC: ' + esc(act.cdc.substring(0, 20)) + '...</p>' : '') +
    '</div>';
  }).join('') + '</div>';
}

/* ─── Actions ───────────────────────────────────────────────────── */

async function checkSifenHealth() {
  var result = document.getElementById('sifen-health-result');
  var btn = document.getElementById('sifen-health-btn');
  if (!result) return;
  if (btn) btn.disabled = true;

  try {
    var resp = await api('/finance/sifen/health');
    result.classList.remove('hidden');
    var isOk = resp.status === 'OK' || resp.status === 'CONNECTED';
    result.innerHTML =
      '<div class="' + (isOk ? 'bg-green-900/20 border-green-800/50' : 'bg-red-900/20 border-red-800/50') + ' border rounded-lg p-3">' +
        '<div class="flex items-center gap-2">' +
          '<div class="w-2 h-2 rounded-full ' + (isOk ? 'bg-green-400' : 'bg-red-400') + '"></div>' +
          '<span class="text-sm ' + (isOk ? 'text-green-300' : 'text-red-300') + '">' +
            (isOk ? 'Conexion con DNIT activa' : 'Conexion con DNIT no disponible') +
          '</span>' +
        '</div>' +
        (resp.timestamp ? '<p class="text-xs text-gray-500 mt-1 ml-4">Verificado: ' + new Date(resp.timestamp).toLocaleString('es-PY') + '</p>' : '') +
      '</div>';
  } catch (err) {
    result.classList.remove('hidden');
    result.innerHTML =
      '<div class="bg-red-900/20 border border-red-800/50 rounded-lg p-3">' +
        '<p class="text-sm text-red-300">Error verificando conexion: ' + esc(err.message || 'Timeout') + '</p>' +
      '</div>';
  }
  if (btn) btn.disabled = false;
}

async function forceSifenTransmission() {
  var btn = document.getElementById('sifen-force-btn');
  if (!confirm('Esto reintentara enviar todas las facturas en cola de contingencia. Continuar?')) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    var pendingResp = await api('/finance/sifen/documentos?estado=ENVIADO&limit=50');
    var docs = pendingResp.data || pendingResp.items || pendingResp || [];
    var sent = 0;
    var errors = 0;

    for (var i = 0; i < docs.length; i++) {
      try {
        await api('/finance/sifen/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentoId: docs[i].id }),
        });
        sent++;
      } catch {
        errors++;
      }
    }

    alert('Transmision completada: ' + sent + ' enviados, ' + errors + ' errores');
    loadSifenDashboard();
  } catch (err) {
    alert('Error: ' + (err.message || 'Error desconocido'));
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg> Forzar Transmision'; }
}

async function forceSendDoc(docId) {
  try {
    await api('/finance/sifen/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentoId: docId }),
    });
    loadSifenDashboard();
  } catch (err) {
    alert('Error enviando documento: ' + (err.message || 'Error desconocido'));
  }
}
