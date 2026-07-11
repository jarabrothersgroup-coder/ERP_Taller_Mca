/* ─── Thinkcar OBD2 Connection Wizard & Import Queue ──────────────── */

let _thinkcarWizardOpen = false;
let _thinkcarPendingRefresh = null;

/* ─── Main Render ───────────────────────────────────────────────── */

function renderThinkcar(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-white">Thinkcar OBD2</h2>
        <p class="text-sm text-gray-400 mt-1">Vinculación de diagnósticos y reportes de escaneo</p>
      </div>
      <button onclick="showConnectionWizard()"
        class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-blue-900/30">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        Vincular Diagnóstico OBD2
      </button>
    </div>

    <div id="thinkcar-wizard-modal" class="hidden"></div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-lg bg-green-900/50 flex items-center justify-center">
            <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          </div>
          <span class="text-sm text-gray-400">Vinculados</span>
        </div>
        <p id="thinkcar-stat-linked" class="text-2xl font-bold text-white">-</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-lg bg-yellow-900/50 flex items-center justify-center">
            <svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <span class="text-sm text-gray-400">Pendientes</span>
        </div>
        <p id="thinkcar-stat-pending" class="text-2xl font-bold text-white">-</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 p-4">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded-lg bg-red-900/50 flex items-center justify-center">
            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <span class="text-sm text-gray-400">Revisión Manual</span>
        </div>
        <p id="thinkcar-stat-review" class="text-2xl font-bold text-white">-</p>
      </div>
    </div>

    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium text-gray-300">Diagnosticos Pendientes de Asignar</h3>
        <button onclick="loadThinkcarPending()" class="text-xs text-blue-400 hover:text-blue-300 transition">Actualizar</button>
      </div>
      <div id="thinkcar-pending-section" class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="text-center py-6 text-gray-600 text-sm">Cargando...</div>
      </div>
    </div>

    <div>
      <h3 class="text-sm font-medium text-gray-300 mb-3">Historial de Importaciones</h3>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th scope="col" class="text-left px-4 py-3 font-semibold">Fecha</th>
              <th scope="col" class="text-left px-4 py-3 font-semibold">VIN</th>
              <th scope="col" class="text-left px-4 py-3 font-semibold">Vehiculo</th>
              <th scope="col" class="text-left px-4 py-3 font-semibold">DTCs</th>
              <th scope="col" class="text-left px-4 py-3 font-semibold">Estado</th>
              <th scope="col" class="text-left px-4 py-3 font-semibold">Origen</th>
            </tr></thead>
            <tbody id="thinkcar-tbody"><tr><td colspan="6" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  fetchThinkcarImports();
  loadThinkcarPending();
  loadThinkcarStats();
}

/* ─── Stats ─────────────────────────────────────────────────────── */

async function loadThinkcarStats() {
  try {
    const stats = await api('/thinkcar/stats');
    const byStatus = {};
    (stats.byStatus || []).forEach(s => { byStatus[s.status] = s.count; });
    safeSetHtml('thinkcar-stat-linked', String(byStatus.linked ?? 0));
    safeSetHtml('thinkcar-stat-pending', String(byStatus.pending ?? 0));
    safeSetHtml('thinkcar-stat-review', String(byStatus.manual_review ?? 0));
  } catch { /* stats optional */ }
}

/* ─── Imports Table ─────────────────────────────────────────────── */

async function fetchThinkcarImports() {
  const tbody = document.querySelector('#thinkcar-tbody');
  if (!tbody) return;
  try {
    const resp = await api('/thinkcar/imports');
    const imports = resp.data || resp;
    if (!imports || !imports.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-600">No hay reportes Thinkcar importados</td></tr>';
      return;
    }
    tbody.innerHTML = imports.map(function(imp) {
      var estado = (imp.status || '').toUpperCase();
      var badgeClass = estado === 'LINKED' ? 'bg-green-900/50 text-green-300'
        : estado === 'MANUAL_REVIEW' ? 'bg-red-900/50 text-red-300'
        : estado === 'ERROR' ? 'bg-red-900/50 text-red-300'
        : 'bg-yellow-900/50 text-yellow-300';
      var dtcCount = (imp.dtcCodes && imp.dtcCodes.length) ? imp.dtcCodes.length : (imp.dtcCount || 0);
      return '<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">' +
        '<td class="px-4 py-3 text-xs text-gray-400">' + (imp.createdAt ? new Date(imp.createdAt).toLocaleDateString('es-PY') : '-') + '</td>' +
        '<td class="px-4 py-3 font-mono text-xs">' + esc(imp.vin || '-') + '</td>' +
        '<td class="px-4 py-3">' + esc((imp.brand || '') + ' ' + (imp.model || '') || '-') + '</td>' +
        '<td class="px-4 py-3">' + (dtcCount > 0 ? '<span class="text-red-400 text-xs font-bold">' + dtcCount + '</span>' : '-') + '</td>' +
        '<td class="px-4 py-3"><span class="status-badge ' + badgeClass + '">' + esc(estado) + '</span></td>' +
        '<td class="px-4 py-3 text-xs text-gray-500">' + esc(imp.sourceChannel || '-') + '</td>' +
      '</tr>';
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">Modulo Thinkcar — Conectando...</td></tr>';
  }
}

/* ─── Pending Queue ─────────────────────────────────────────────── */

async function loadThinkcarPending() {
  var section = document.getElementById('thinkcar-pending-section');
  if (!section) return;
  try {
    var resp = await api('/thinkcar/pending');
    var pending = resp.data || resp;
    if (!pending || !pending.length) {
      section.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">No hay diagnosticos pendientes de asignar</div>';
      return;
    }
    section.innerHTML = '<div class="divide-y divide-gray-800/50">' + pending.map(function(item) {
      var dtcCount = (item.dtcCodes && item.dtcCodes.length) ? item.dtcCodes.length : 0;
      var dtcPreview = (item.dtcCodes || []).slice(0, 3).join(', ') + (dtcCount > 3 ? '...' : '');
      return '<div class="px-4 py-3 flex items-center justify-between gap-4 hover:bg-gray-800/20 transition">' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2 mb-1">' +
            '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300">PENDIENTE</span>' +
            '<span class="text-xs text-gray-500">' + (item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-PY') : '-') + '</span>' +
          '</div>' +
          '<p class="text-sm text-gray-300 truncate">' +
            (item.vin ? 'VIN: <span class="font-mono">' + esc(item.vin) + '</span>' : '<span class="text-gray-500">Sin VIN detectado</span>') +
            (item.brand ? ' — ' + esc(item.brand) + ' ' + esc(item.model || '') : '') +
          '</p>' +
          (dtcCount > 0 ? '<p class="text-xs text-red-400 mt-0.5">' + dtcCount + ' DTCs: ' + esc(dtcPreview) + '</p>' : '') +
          (item.errorMessage ? '<p class="text-xs text-gray-500 mt-0.5">' + esc(item.errorMessage) + '</p>' : '') +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          '<select id="ot-select-' + item.id + '" class="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]">' +
            '<option value="">Seleccionar OT...</option>' +
          '</select>' +
          '<button onclick="assignThinkcarPending(\'' + item.id + '\')" ' +
            'class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition font-medium">Asignar</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';

    pending.forEach(function(item) {
      loadActiveOtosForSelect(item.id);
    });
  } catch {
    section.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">Error al cargar diagnosticos pendientes</div>';
  }
}

async function loadActiveOtosForSelect(importId) {
  var select = document.getElementById('ot-select-' + importId);
  if (!select) return;
  try {
    var otos = await api('/workshop/ordenes-trabajo?status=En_Proceso&limit=50');
    var list = otos.data || otos;
    if (!list || !list.length) {
      var otos2 = await api('/workshop/ordenes-trabajo?status=Aprobado&limit=50');
      list = otos2.data || otos2 || [];
    }
    (list || []).forEach(function(ot) {
      var opt = document.createElement('option');
      opt.value = ot.id;
      var plate = ot.plate || '';
      var desc = ot.description || '';
      opt.textContent = 'OT #' + ot.id.slice(0, 8) + (plate ? ' (' + plate + ')' : '') + (desc ? ' — ' + desc.slice(0, 40) : '');
      select.appendChild(opt);
    });
  } catch { /* OT list optional */ }
}

async function assignThinkcarPending(importId) {
  var select = document.getElementById('ot-select-' + importId);
  if (!select || !select.value) {
    if (typeof showToast === 'function') showToast('Seleccione una Orden de Trabajo primero', 'warning');
    return;
  }
  try {
    await api('/thinkcar/pending/' + importId + '/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordenTrabajoId: select.value })
    });
    loadThinkcarPending();
    fetchThinkcarImports();
    loadThinkcarStats();
    if (typeof showToast === 'function') showToast('Diagnóstico asignado a la OT', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Error al asignar: ' + (err.message || err), 'error');
  }
}

/* ─── Connection Wizard Modal ───────────────────────────────────── */

function showConnectionWizard() {
  _thinkcarWizardOpen = true;
  var modal = document.getElementById('thinkcar-wizard-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.innerHTML = buildWizardHTML();
}

function closeWizard() {
  _thinkcarWizardOpen = false;
  var modal = document.getElementById('thinkcar-wizard-modal');
  if (modal) modal.classList.add('hidden');
  if (_thinkcarPendingRefresh) {
    clearInterval(_thinkcarPendingRefresh);
    _thinkcarPendingRefresh = null;
  }
}

function buildWizardHTML() {
  return '<div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background:rgba(0,0,0,0.7);backdrop-filter:blur(4px)">' +
    '<div class="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl overflow-hidden">' +
      '<div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">' +
        '<div>' +
          '<h2 class="text-lg font-semibold text-white">Conexion OBD2 — Thinkcar Mini</h2>' +
          '<p class="text-sm text-gray-400 mt-0.5">Como deseas transferir los datos de diagnostico?</p>' +
        '</div>' +
        '<button onclick="closeWizard()" class="text-gray-500 hover:text-gray-300 transition p-1">' +
          '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="p-6">' +
        '<div id="wizard-options" class="grid grid-cols-1 sm:grid-cols-3 gap-4">' +
          buildWizardCard('bluetooth', 'Sincronizacion Directa', 'Conexion inalambrica desde la bahia de trabajo. El escáner envia los datos directamente.', '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v8m-4-4h8"/></svg>') +
          buildWizardCard('usb', 'Importacion USB / OTG', 'Arrastra o selecciona el reporte exportado (.pdf, .json, .csv) desde una memoria USB.', '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>') +
          buildWizardCard('email', 'Correo Electronico', 'Recibe el reporte enviado desde la app oficial de Thinkcar a la casilla del taller.', '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>') +
        '</div>' +
        '<div id="wizard-flow-panel" class="hidden mt-6"></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function buildWizardCard(id, title, desc, iconSvg) {
  return '<button onclick="showWizardFlow(\'' + id + '\')" ' +
    'class="group flex flex-col items-center text-center p-5 rounded-xl border border-gray-700/50 bg-gray-800/40 hover:bg-gray-800 hover:border-blue-500/50 transition-all duration-200 cursor-pointer">' +
    '<div class="w-16 h-16 rounded-2xl bg-gray-800 group-hover:bg-blue-900/40 flex items-center justify-center mb-4 transition">' +
      '<div class="text-gray-400 group-hover:text-blue-400 transition">' + iconSvg + '</div>' +
    '</div>' +
    '<h3 class="text-sm font-semibold text-white mb-1">' + title + '</h3>' +
    '<p class="text-xs text-gray-500 leading-relaxed">' + desc + '</p>' +
  '</button>';
}

/* ─── Flow Panels ───────────────────────────────────────────────── */

function showWizardFlow(type) {
  var options = document.getElementById('wizard-options');
  var panel = document.getElementById('wizard-flow-panel');
  if (!options || !panel) return;
  options.classList.add('hidden');
  panel.classList.remove('hidden');

  if (type === 'bluetooth') renderBluetoothFlow(panel);
  else if (type === 'usb') renderUsbFlow(panel);
  else if (type === 'email') renderEmailFlow(panel);
}

function showWizardOptions() {
  var options = document.getElementById('wizard-options');
  var panel = document.getElementById('wizard-flow-panel');
  if (options) options.classList.remove('hidden');
  if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
}

/* ─── Bluetooth Flow ────────────────────────────────────────────── */

// Sprint 57: Bluetooth reconnect limit to prevent infinite loops
var BT_MAX_RETRIES = 3;
var btRetryCount = 0;

function renderBluetoothFlow(panel) {
  panel.innerHTML =
    '<div class="flex items-center gap-2 mb-4">' +
      '<button onclick="showWizardOptions()" class="text-gray-500 hover:text-gray-300 transition">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>' +
      '</button>' +
      '<span class="text-sm font-medium text-white">Sincronizacion Bluetooth</span>' +
    '</div>' +
    '<div id="bt-status" class="text-center py-8">' +
      '<div id="bt-icon" class="w-20 h-20 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4">' +
        '<svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>' +
      '</div>' +
      '<p class="text-sm text-gray-400 mb-4">Asegurate de que el Thinkcar Mini este encendido y en modo de emparejamiento</p>' +
      '<button onclick="startBluetoothScan()" id="bt-scan-btn" ' +
        'class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">' +
        'Buscar Dispositivos' +
      '</button>' +
    '</div>';
}

async function startBluetoothScan() {
  var btn = document.getElementById('bt-scan-btn');
  var status = document.getElementById('bt-status');
  var icon = document.getElementById('bt-icon');
  if (!btn || !status) return;

  // Sprint 57: Enforce Bluetooth reconnect limit
  if (btRetryCount >= BT_MAX_RETRIES) {
    icon.className = 'w-20 h-20 mx-auto rounded-full bg-red-900/30 flex items-center justify-center mb-4';
    icon.innerHTML = '<svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>';
    status.querySelector('p').textContent = 'Maximo de ' + BT_MAX_RETRIES + ' intentos alcanzado. Reinicia la pagina para reintentar.';
    btn.disabled = true;
    btn.textContent = 'Agotado';
    return;
  }

  btRetryCount++;
  btn.disabled = true;
  btn.textContent = 'Escaneando... (' + btRetryCount + '/' + BT_MAX_RETRIES + ')';

  icon.className = 'w-20 h-20 mx-auto rounded-full bg-blue-900/30 flex items-center justify-center mb-4 animate-pulse';
  icon.innerHTML = '<svg class="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>';

  try {
    var result = await api('/thinkcar/ingest/bluetooth', { method: 'POST' });
    var count = result.processed || 0;

    if (count > 0) {
      btRetryCount = 0; // Reset on success
      icon.className = 'w-20 h-20 mx-auto rounded-full bg-green-900/30 flex items-center justify-center mb-4';
      icon.innerHTML = '<svg class="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
      status.querySelector('p').textContent = count + ' reporte(s) importado(s) correctamente via Bluetooth';
      btn.textContent = 'Completado';
      fetchThinkcarImports();
      loadThinkcarPending();
      loadThinkcarStats();
    } else {
      icon.className = 'w-20 h-20 mx-auto rounded-full bg-gray-800 flex items-center justify-center mb-4';
      icon.innerHTML = '<svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>';
      status.querySelector('p').textContent = 'No se encontraron dispositivos Thinkcar cercanos. Verifica que este encendido y en modo de emparejamiento.';
      btn.disabled = false;
      btn.textContent = 'Reintentar (' + btRetryCount + '/' + BT_MAX_RETRIES + ')';
    }
  } catch (err) {
    icon.className = 'w-20 h-20 mx-auto rounded-full bg-red-900/30 flex items-center justify-center mb-4';
    icon.innerHTML = '<svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
    status.querySelector('p').textContent = 'Error de conexion: ' + (err.message || 'Intenta nuevamente');
    btn.disabled = false;
    btn.textContent = 'Reintentar (' + btRetryCount + '/' + BT_MAX_RETRIES + ')';
  }
}

/* ─── USB / File Upload Flow ────────────────────────────────────── */

function renderUsbFlow(panel) {
  panel.innerHTML =
    '<div class="flex items-center gap-2 mb-4">' +
      '<button onclick="showWizardOptions()" class="text-gray-500 hover:text-gray-300 transition">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>' +
      '</button>' +
      '<span class="text-sm font-medium text-white">Importacion USB / Archivo</span>' +
    '</div>' +
    '<div id="usb-dropzone" ' +
      'class="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-gray-800/30 transition-all"' +
      'ondragover="event.preventDefault(); this.classList.add(\'border-blue-500\',\'bg-blue-900/10\')" ' +
      'ondragleave="this.classList.remove(\'border-blue-500\',\'bg-blue-900/10\')" ' +
      'ondrop="handleUsbDrop(event)" ' +
      'onclick="document.getElementById(\'usb-file-input\').click()">' +
      '<svg class="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>' +
      '<p class="text-sm text-gray-400 mb-1">Arrastra el reporte aqui o haz clic para seleccionar</p>' +
      '<p class="text-xs text-gray-600">Formatos soportados: .pdf, .json, .csv (max 50 MB)</p>' +
      '<input type="file" id="usb-file-input" class="hidden" accept=".pdf,.json,.csv" onchange="handleUsbFileSelect(event)" />' +
    '</div>' +
    '<div id="usb-result" class="hidden mt-4"></div>';
}

function handleUsbDrop(e) {
  e.preventDefault();
  var zone = document.getElementById('usb-dropzone');
  if (zone) zone.classList.remove('border-blue-500', 'bg-blue-900/10');
  var files = e.dataTransfer.files;
  if (files.length > 0) uploadFile(files[0]);
}

function handleUsbFileSelect(e) {
  var files = e.target.files;
  if (files.length > 0) uploadFile(files[0]);
}

async function uploadFile(file) {
  var result = document.getElementById('usb-result');
  var zone = document.getElementById('usb-dropzone');
  if (!result) return;

  result.classList.remove('hidden');
  result.innerHTML =
    '<div class="bg-gray-800/50 rounded-lg p-4">' +
      '<div class="flex items-center gap-3 mb-3">' +
        '<div class="w-8 h-8 rounded bg-blue-900/30 flex items-center justify-center">' +
          '<svg class="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>' +
        '</div>' +
        '<div>' +
          '<p class="text-sm text-white font-medium">' + esc(file.name) + '</p>' +
          '<p class="text-xs text-gray-500">' + (file.size / 1024).toFixed(1) + ' KB</p>' +
        '</div>' +
      '</div>' +
      '<div class="w-full bg-gray-700 rounded-full h-1.5">' +
        '<div id="usb-progress" class="bg-blue-500 h-1.5 rounded-full transition-all" style="width:30%"></div>' +
      '</div>' +
    '</div>';

  if (zone) {
    zone.style.display = 'none';
  }

  try {
    var formData = new FormData();
    formData.append('file', file);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/thinkcar/upload', true);

    var progressBar = document.getElementById('usb-progress');

    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable && progressBar) {
        var pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = pct + '%';
      }
    };

    var uploadResult = await new Promise(function(resolve, reject) {
      xhr.onload = function() {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Respuesta invalida del servidor'));
        }
      };
      xhr.onerror = function() { reject(new Error('Error de conexion')); };
      xhr.send(formData);
    });

    if (uploadResult.status === 'error') {
      result.innerHTML =
        '<div class="bg-red-900/20 border border-red-800/50 rounded-lg p-4">' +
          '<p class="text-sm text-red-300 font-medium">Error al procesar</p>' +
          '<p class="text-xs text-red-400 mt-1">' + esc(uploadResult.error || 'Error desconocido') + '</p>' +
          '<button onclick="resetUsbFlow()" class="mt-3 text-xs text-blue-400 hover:text-blue-300 transition">Intentar con otro archivo</button>' +
        '</div>';
    } else if (uploadResult.status === 'duplicate') {
      result.innerHTML =
        '<div class="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">' +
          '<p class="text-sm text-yellow-300 font-medium">Archivo duplicado</p>' +
          '<p class="text-xs text-yellow-400 mt-1">Este reporte ya fue importado anteriormente</p>' +
          '<button onclick="resetUsbFlow()" class="mt-3 text-xs text-blue-400 hover:text-blue-300 transition">Intentar con otro archivo</button>' +
        '</div>';
    } else {
      var parsed = uploadResult.parsed || {};
      var dtcs = parsed.dtcs || [];
      var linking = uploadResult.linking || {};
      var statusClass = linking.status === 'linked' ? 'text-green-300' : 'text-yellow-300';
      var statusText = linking.status === 'linked' ? 'Vinculado automaticamente' : 'Requiere asignacion manual';

      result.innerHTML =
        '<div class="bg-green-900/20 border border-green-800/50 rounded-lg p-4">' +
          '<div class="flex items-center gap-2 mb-2">' +
            '<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' +
            '<p class="text-sm text-green-300 font-medium">Reporte procesado</p>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-3 text-xs">' +
            (parsed.vin ? '<div><span class="text-gray-500">VIN:</span> <span class="font-mono text-white">' + esc(parsed.vin) + '</span></div>' : '') +
            (parsed.brand ? '<div><span class="text-gray-500">Marca:</span> <span class="text-white">' + esc(parsed.brand) + '</span></div>' : '') +
            (parsed.model ? '<div><span class="text-gray-500">Modelo:</span> <span class="text-white">' + esc(parsed.model) + '</span></div>' : '') +
            (parsed.odometer ? '<div><span class="text-gray-500">Km:</span> <span class="text-white">' + parsed.odometer.toLocaleString('es-PY') + '</span></div>' : '') +
          '</div>' +
          (dtcs.length > 0 ?
            '<div class="mt-3"><p class="text-xs text-gray-500 mb-1">DTCs detectados (' + dtcs.length + '):</p>' +
            '<div class="flex flex-wrap gap-1">' +
              dtcs.slice(0, 10).map(function(d) { return '<span class="px-1.5 py-0.5 bg-red-900/40 text-red-300 text-xs rounded font-mono">' + esc(d.code) + '</span>'; }).join('') +
              (dtcs.length > 10 ? '<span class="text-xs text-gray-500">+' + (dtcs.length - 10) + ' mas</span>' : '') +
            '</div></div>' : '') +
          '<p class="mt-2 text-xs ' + statusClass + '">' + statusText + '</p>' +
          (linking.message ? '<p class="text-xs text-gray-500 mt-0.5">' + esc(linking.message) + '</p>' : '') +
          (linking.mileageAlert ? '<p class="text-xs text-yellow-400 mt-1 bg-yellow-900/20 rounded px-2 py-1">' + esc(linking.mileageAlert) + '</p>' : '') +
        '</div>';

      fetchThinkcarImports();
      loadThinkcarPending();
      loadThinkcarStats();
    }
  } catch (err) {
    result.innerHTML =
      '<div class="bg-red-900/20 border border-red-800/50 rounded-lg p-4">' +
        '<p class="text-sm text-red-300 font-medium">Error de conexion</p>' +
        '<p class="text-xs text-red-400 mt-1">' + esc(err.message || 'Error desconocido') + '</p>' +
        '<button onclick="resetUsbFlow()" class="mt-3 text-xs text-blue-400 hover:text-blue-300 transition">Reintentar</button>' +
      '</div>';
  }
}

function resetUsbFlow() {
  var panel = document.getElementById('wizard-flow-panel');
  if (panel) renderUsbFlow(panel);
}

/* ─── Email Flow ────────────────────────────────────────────────── */

function renderEmailFlow(panel) {
  panel.innerHTML =
    '<div class="flex items-center gap-2 mb-4">' +
      '<button onclick="showWizardOptions()" class="text-gray-500 hover:text-gray-300 transition">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>' +
      '</button>' +
      '<span class="text-sm font-medium text-white">Sincronizacion por Correo</span>' +
    '</div>' +
    '<div class="bg-gray-800/40 rounded-xl p-6">' +
      '<div class="text-center mb-6">' +
        '<svg class="w-14 h-14 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>' +
        '<p class="text-sm text-gray-300 mb-1">Envia el reporte desde la app Thinkcar</p>' +
        '<p class="text-xs text-gray-500">Abre la app Thinkcar en tu celular, selecciona el reporte y toca "Compartir" &rarr; "Correo Electronico"</p>' +
      '</div>' +
      '<div class="bg-gray-900 rounded-lg p-4 mb-4">' +
        '<p class="text-xs text-gray-500 mb-2">Direccion de correo del taller:</p>' +
        '<div class="flex items-center gap-2">' +
          '<code class="text-sm text-blue-400 font-mono bg-gray-800 px-3 py-1.5 rounded flex-1">scanner@taller.com</code>' +
          '<button onclick="navigator.clipboard.writeText(\'scanner@taller.com\')" ' +
            'class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded transition">Copiar</button>' +
        '</div>' +
      '</div>' +
      '<div class="flex items-center gap-3">' +
        '<button onclick="triggerEmailCheck()" id="email-check-btn" ' +
          'class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">' +
          'Verificar Correo Ahora' +
        '</button>' +
        '<span id="email-last-check" class="text-xs text-gray-600"></span>' +
      '</div>' +
      '<div id="email-result" class="hidden mt-4"></div>' +
    '</div>';
}

async function triggerEmailCheck() {
  var btn = document.getElementById('email-check-btn');
  var result = document.getElementById('email-result');
  var lastCheck = document.getElementById('email-last-check');
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = 'Verificando...';

  try {
    var resp = await api('/thinkcar/ingest/email', { method: 'POST' });
    var count = resp.processed || 0;

    if (lastCheck) lastCheck.textContent = 'Ultima verificacion: ' + new Date().toLocaleTimeString('es-PY');
    if (result) {
      result.classList.remove('hidden');
      if (count > 0) {
        result.innerHTML =
          '<div class="bg-green-900/20 border border-green-800/50 rounded-lg p-3">' +
            '<p class="text-sm text-green-300">' + count + ' reporte(s) Thinkcar procesado(s) desde el correo</p>' +
          '</div>';
        fetchThinkcarImports();
        loadThinkcarPending();
        loadThinkcarStats();
      } else {
        result.innerHTML =
          '<div class="bg-gray-800/50 rounded-lg p-3">' +
            '<p class="text-sm text-gray-400">No se encontraron nuevos reportes de Thinkcar en el correo</p>' +
          '</div>';
      }
    }
  } catch (err) {
    if (result) {
      result.classList.remove('hidden');
      result.innerHTML =
        '<div class="bg-red-900/20 border border-red-800/50 rounded-lg p-3">' +
          '<p class="text-sm text-red-300">Error: ' + esc(err.message || 'No se pudo conectar al servidor de correo') + '</p>' +
        '</div>';
    }
  }

  btn.disabled = false;
  btn.textContent = 'Verificar Correo Ahora';
}

/* ─── Utility ───────────────────────────────────────────────────── */

function safeSetHtml(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
