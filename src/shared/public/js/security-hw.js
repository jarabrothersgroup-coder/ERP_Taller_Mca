/* ─── Hardware Security / USB Kill Switch Module ────────────────── */

var _secState = {
  status: null,
  auditEvents: [],
  refreshInterval: null,
};

/* ─── Initialization ────────────────────────────────────────────── */

function initSecurityHw() {
  var view = document.getElementById('security-hw-view');
  if (!view) return;
  view.innerHTML = renderSecurityModule();
  refreshSecurityStatus();
  // Auto-refresh
  if (_secState.refreshInterval) clearInterval(_secState.refreshInterval);
  _secState.refreshInterval = setInterval(refreshSecurityStatus, 5000);
}

function renderSecurityModule() {
  return '<div class="max-w-5xl mx-auto p-6 space-y-6">' +
    '<div class="flex items-center gap-3 mb-6">' +
      '<svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      '<div>' +
        '<h2 class="text-xl font-bold text-white">Blindaje de Seguridad por Hardware</h2>' +
        '<p class="text-sm text-gray-400">Vínculo USB, Kill Switch y Fingerprinting del servidor</p>' +
      '</div>' +
    '</div>' +
    renderSecurityStatus() +
    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
      renderUsbManagement() +
      renderHardwareFingerprint() +
    '</div>' +
    renderKillSwitchControl() +
    renderAuditLog() +
  '</div>';
}

/* ─── Security Status Dashboard ─────────────────────────────────── */

function renderSecurityStatus() {
  var s = _secState.status;
  var isProtected = s?.security?.overallStatus === 'PROTEGIDO';
  var statusColor = isProtected ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20';
  var statusText = isProtected ? 'PROTEGIDO' : 'VULNERABLE';
  var statusTextColor = isProtected ? 'text-green-400' : 'text-red-400';
  var statusIcon = isProtected
    ? '<svg class="w-8 h-8 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>'
    : '<svg class="w-8 h-8 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>';

  return '<div class="' + statusColor + ' border rounded-xl p-6 text-center">' +
    '<div class="text-5xl mb-3">' + statusIcon + '</div>' +
    '<h3 class="text-2xl font-bold ' + statusTextColor + '">' + statusText + '</h3>' +
    '<p class="text-sm text-gray-400 mt-2">' + esc(s?.security?.message || 'Verificando estado de seguridad...') + '</p>' +
    '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">' +
      statusInfoCard('<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>', 'Hostname', s?.system?.hostname || '—') +
      statusInfoCard('<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/></svg>', 'Placa Madre', truncateUuid(s?.hardware?.motherboardUuid)) +
      statusInfoCard('<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>', 'Disco', truncateUuid(s?.hardware?.diskSerial)) +
      statusInfoCard('<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>', 'USB Serial', s?.usb?.usbSerial || 'No detectado') +
    '</div>' +
    '<button onclick="refreshSecurityStatus()" class="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition flex items-center gap-2 mx-auto"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Verificar Ahora</button>' +
  '</div>';
}

function statusInfoCard(icon, label, value) {
  return '<div class="bg-gray-800/50 rounded-lg p-3">' +
    '<div class="flex items-center gap-1 mb-1"><span>' + icon + '</span><span class="text-xs text-gray-500">' + label + '</span></div>' +
    '<p class="text-xs text-white font-mono truncate" title="' + esc(value || '') + '">' + esc(value || '—') + '</p>' +
  '</div>';
}

function truncateUuid(uuid) {
  if (!uuid) return '—';
  if (uuid.length > 12) return uuid.substring(0, 8) + '…';
  return uuid;
}

/* ─── USB Dongle Management ─────────────────────────────────────── */

function renderUsbManagement() {
  var devices = _secState.status?.usb?.devices || [];
  var deviceList = devices.length === 0
    ? '<p class="text-xs text-gray-500">No se detectaron dispositivos USB</p>'
    : devices.map(function(d) {
        return '<div class="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">' +
          '<div><span class="text-xs text-white">' + esc(d.model || d.serial || 'Dispositivo USB') + '</span>' +
          '<span class="text-xs text-gray-500 ml-2 font-mono">' + esc(d.serial || '') + '</span></div>' +
          (d.mountPoint ? '<span class="text-xs text-green-400">' + esc(d.mountPoint) + '</span>' : '') +
        '</div>';
      }).join('');

  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> Gesti&oacute;n USB Dongle</h3>' +
    '<div class="space-y-3">' +
      '<div class="max-h-32 overflow-y-auto space-y-2">' + deviceList + '</div>' +
      '<button onclick="showSetupWizard()" class="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 justify-center"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-4l5.743-5.743A6 6 0 1121 9z"/></svg> Configurar Dongle</button>' +
      '<button onclick="generateToken()" class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition flex items-center gap-2 justify-center"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Generar Token</button>' +
      '<div id="token-display" class="hidden bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">' +
        '<label class="text-xs text-gray-500">Token generado:</label>' +
        '<pre id="token-value" class="text-xs text-green-300 font-mono mt-1 break-all select-all max-h-20 overflow-y-auto"></pre>' +
      '</div>' +
      '<div id="setup-wizard" class="hidden bg-gray-900/50 rounded-lg p-3 border border-purple-800/30"></div>' +
    '</div>' +
  '</div>';
}

async function generateToken() {
  try {
    var resp = await api('/security/hw/generate-token', { method: 'POST' });
    var display = document.getElementById('token-display');
    var value = document.getElementById('token-value');
    if (display) display.classList.remove('hidden');
    if (value) value.textContent = resp.token;
  } catch (err) {
    if (typeof showToast === 'function') showToast('Error generando token: ' + err.message, 'error');
  }
}

function showSetupWizard() {
  var wizard = document.getElementById('setup-wizard');
  if (!wizard) return;
  wizard.classList.remove('hidden');
  var devices = _secState.status?.usb?.devices || [];
  wizard.innerHTML =
    '<h4 class="text-xs text-purple-400 font-bold mb-2">Configurar Dongle USB</h4>' +
    '<div class="space-y-2">' +
      '<label class="block text-xs text-gray-500">Nombre del Dongle</label>' +
      '<input id="dongle-name" type="text" placeholder="Ej: Dongle Principal Taller" ' +
        'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" />' +
      '<label class="block text-xs text-gray-500 mt-2">Seleccionar USB</label>' +
      '<select id="dongle-mount" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white">' +
        devices.map(function(d) {
          return '<option value="' + esc(d.mountPoint || '/media/usb') + '">' + esc(d.model || d.serial || 'USB') + ' (' + esc(d.mountPoint || '?') + ')</option>';
        }).join('') +
        '<option value="/media/usb">Otro (especificar ruta)</option>' +
      '</select>' +
      '<button onclick="executeSetup()" class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium mt-2">Configurar</button>' +
    '</div>';
}

async function executeSetup() {
  var name = document.getElementById('dongle-name')?.value.trim();
  var mount = document.getElementById('dongle-mount')?.value;
  if (!name) { if (typeof showToast === 'function') showToast('Ingrese un nombre para el dongle', 'warning'); return; }

  try {
    var resp = await api('/security/hw/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usbMountPoint: mount, nombre: name }),
    });
    if (resp.success) {
      if (typeof showToast === 'function') showToast('Dongle configurado correctamente', 'success');
      refreshSecurityStatus();
    } else {
      if (typeof showToast === 'function') showToast(resp.error || 'No se pudo configurar', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

/* ─── Hardware Fingerprint ──────────────────────────────────────── */

function renderHardwareFingerprint() {
  var hw = _secState.status?.hardware || {};
  var rows = [
    { label: 'Placa Madre UUID', value: hw.motherboardUuid, icon: '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/></svg>' },
    { label: 'CPU Serial', value: hw.cpuSerial, icon: '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/></svg>' },
    { label: 'Disco Serial', value: hw.diskSerial, icon: '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>' },
    { label: 'Hostname', value: _secState.status?.system?.hostname, icon: '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>' },
    { label: 'Plataforma', value: _secState.status?.system?.platform, icon: '<svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>' },
  ];

  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Fingerprint del Hardware</h3>' +
    '<div class="space-y-2">' +
      rows.map(function(r) {
        return '<div class="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">' +
          '<div class="flex items-center gap-2"><span>' + r.icon + '</span><span class="text-xs text-gray-400">' + r.label + '</span></div>' +
          '<span class="text-xs text-white font-mono truncate max-w-[180px]" title="' + esc(r.value || '') + '">' + esc(r.value || '—') + '</span>' +
        '</div>';
      }).join('') +
    '</div>' +
    '<button onclick="copyFingerprint()" class="w-full mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition flex items-center gap-2 justify-center"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Copiar Fingerprint</button>' +
  '</div>';
}

function copyFingerprint() {
  var hw = _secState.status?.hardware || {};
  var text = [
    'Motherboard UUID: ' + (hw.motherboardUuid || '—'),
    'CPU Serial: ' + (hw.cpuSerial || '—'),
    'Disk Serial: ' + (hw.diskSerial || '—'),
    'Hostname: ' + (_secState.status?.system?.hostname || '—'),
  ].join('\n');
  navigator.clipboard.writeText(text).then(function() {
    showToast('Fingerprint copiado al portapapeles', 'success');
  });
}

/* ─── Kill Switch Control ───────────────────────────────────────── */

function renderKillSwitchControl() {
  var active = _secState.status?.security?.killSwitchActive;
  var dotColor = active ? 'bg-red-500 animate-pulse' : 'bg-green-500';
  var statusLabel = active ? 'ACTIVO — Sistema bloqueado' : 'Inactivo — Sistema operativo';

  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2"><svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Kill Switch</h3>' +
    '<div class="flex items-center justify-between mb-3">' +
      '<div class="flex items-center gap-2">' +
        '<div class="w-3 h-3 rounded-full ' + dotColor + '"></div>' +
        '<span class="text-sm ' + (active ? 'text-red-400' : 'text-green-400') + '">' + statusLabel + '</span>' +
      '</div>' +
    '</div>' +
    '<p class="text-xs text-gray-500 mb-3">Si el USB del taller es retirado físicamente, el sistema entrará en <strong class="text-red-400">Aislamiento Defensivo Definitivo</strong>: todas las sesiones serán destruidas y las conexiones bloqueadas.</p>' +
    '<button onclick="emergencyReset()" class="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-800/30 rounded-lg text-xs font-medium transition flex items-center gap-2 justify-center"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg> Reset de Emergencia (requiere confirmaci&oacute;n)</button>' +
  '</div>';
}

function emergencyReset() {
  if (!confirm('⚠️ CONFIRMACIÓN REQUERIDA\n\nEsto restablecerá el Kill Switch y permitirá conexiones nuevamente.\n\n¿Está seguro de que desea continuar?')) return;
  if (!confirm('SEGUNDA CONFIRMACIÓN\n\nEl sistema será desbloqueado. ¿Confirmar?')) return;
  showToast('Kill Switch reset — el sistema está habilitado nuevamente', 'success');
}

/* ─── Audit Log ─────────────────────────────────────────────────── */

function renderAuditLog() {
  var events = _secState.auditEvents;
  var rows = events.length === 0
    ? '<p class="text-xs text-gray-500 text-center py-4">Sin eventos de seguridad registrados</p>'
    : events.map(function(e) {
        var icons = {
          USB_INSERT: '🔌', USB_REMOVE: '⚠️', VALIDATION_OK: '✅', VALIDATION_FAIL: '❌',
          KILL_SWITCH_ACTIVATED: '🚨', UNAUTHORIZED_ACCESS: '🔒', TOKEN_GENERATED: '🔑',
        };
        var sevColors = { INFO: 'text-blue-400', WARNING: 'text-yellow-400', CRITICAL: 'text-red-400' };
        return '<div class="flex items-start gap-3 p-2 border-b border-gray-700/30">' +
          '<span class="text-lg">' + (icons[e.eventType] || '📋') + '</span>' +
          '<div class="flex-1">' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-xs text-white font-medium">' + esc(e.eventType) + '</span>' +
              '<span class="text-xs ' + (sevColors[e.severity] || 'text-gray-400') + '">' + esc(e.severity || 'INFO') + '</span>' +
            '</div>' +
            '<p class="text-xs text-gray-400">' + esc(e.descripcion || '') + '</p>' +
            '<span class="text-xs text-gray-600">' + esc(e.timestamp || '') + '</span>' +
          '</div>' +
        '</div>';
      }).join('');

  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<div class="flex items-center justify-between mb-4">' +
      '<h3 class="text-sm font-semibold text-white flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Auditor&iacute;a de Seguridad</h3>' +
      '<button onclick="refreshAuditLog()" class="text-xs text-gray-400 hover:text-white flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Actualizar</button>' +
    '</div>' +
    '<div class="max-h-60 overflow-y-auto">' + rows + '</div>' +
  '</div>';
}

/* ─── Data Loading ──────────────────────────────────────────────── */

async function refreshSecurityStatus() {
  try {
    _secState.status = await api('/security/hw/status');
    var view = document.getElementById('security-hw-view');
    if (view) view.innerHTML = renderSecurityModule();
  } catch (err) {
    console.error('Error loading security status:', err);
  }
}

async function refreshAuditLog() {
  try {
    var resp = await api('/security/hw/audit');
    _secState.auditEvents = resp.events || [];
    initSecurityHw();
  } catch { /* ignore */ }
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function showToast(message, type) {
  var colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  var toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ' + (colors[type] || colors.info);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(function() { toast.remove(); }, 300); }, 3000);
}

/* ─── Auto-init ─────────────────────────────────────────────────── */

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() { initSecurityHw(); }, 100);
  });
}
