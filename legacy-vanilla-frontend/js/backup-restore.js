/* ─── Backup & Restore Module ───────────────────────────────────── */

var _backupState = {
  backups: [],
  policy: JSON.parse(localStorage.getItem('backupPolicy') || '{}'),
  restoreStep: 0,
  selectedBackup: null,
};

/* ─── Initialization ────────────────────────────────────────────── */

function initBackupRestore() {
  var view = document.getElementById('backup-view');
  if (!view) return;
  view.innerHTML = renderBackupModule();
  loadBackupList();
}

function renderBackupModule() {
  return '<div class="max-w-5xl mx-auto p-6 space-y-6">' +
    '<div class="flex items-center gap-3 mb-6">' +
      '<svg class="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>' +
      '<div>' +
        '<h2 class="text-xl font-bold text-white">Copias de Seguridad y Restauración</h2>' +
        '<p class="text-sm text-gray-400">Políticas de backup, compresión, encriptación AES-256 y wizard de restauración</p>' +
      '</div>' +
    '</div>' +
    renderBackupStats() +
    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
      renderBackupConfig() +
      renderBackupActions() +
    '</div>' +
    renderBackupHistory() +
    '<div id="restore-wizard-container" class="hidden">' +
      renderRestoreWizard() +
    '</div>' +
  '</div>';
}

/* ─── Stats Cards ───────────────────────────────────────────────── */

function renderBackupStats() {
  var lastBackup = _backupState.policy.lastBackup || 'Nunca';
  var totalBackups = _backupState.backups.length;
  var totalSize = _backupState.backups.reduce(function(sum, b) { return sum + (b.size || 0); }, 0);
  var nextBackup = _backupState.policy.frecuencia
    ? _backupState.policy.horaEjecucion + ':' + (_backupState.policy.minutoEjecucion || '00').toString().padStart(2, '0') + ' (' + (_backupState.policy.frecuencia || 'DIARIA') + ')'
    : 'No configurado';

  return '<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">' +
    statCard('<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>', 'Último Backup', lastBackup, lastBackup === 'Nunca' ? 'text-red-400' : 'text-green-400') +
    statCard('<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>', 'Total Backups', totalBackups.toString(), 'text-blue-400') +
    statCard('<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/></svg>', 'Espacio Usado', formatBytes(totalSize), 'text-purple-400') +
    statCard('<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', 'Próximo Backup', nextBackup, 'text-yellow-400') +
  '</div>';
}

function statCard(icon, label, value, valueColor) {
  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">' +
    '<div class="flex items-center gap-2 mb-2">' + icon + '<span class="text-xs text-gray-500">' + label + '</span></div>' +
    '<p class="text-lg font-bold ' + (valueColor || 'text-white') + '">' + esc(value) + '</p>' +
  '</div>';
}

/* ─── Backup Configuration ──────────────────────────────────────── */

function renderBackupConfig() {
  var p = _backupState.policy;
  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"/></svg> Pol&iacute;tica de Respaldo</h3>' +
    '<div class="space-y-4">' +
      '<div>' +
        '<label class="block text-xs text-gray-500 mb-2">Frecuencia</label>' +
        '<div class="flex gap-2">' +
          freqBtn('DIARIA', 'Diaria', p.frecuencia) +
          freqBtn('SEMANAL', 'Semanal', p.frecuencia) +
          freqBtn('MENSUAL', 'Mensual', p.frecuencia) +
        '</div>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-3">' +
        '<div><label class="block text-xs text-gray-500 mb-1">Hora</label>' +
          '<input id="backup-hour" type="number" min="0" max="23" value="' + (p.horaEjecucion || 23) + '" ' +
          'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" /></div>' +
        '<div><label class="block text-xs text-gray-500 mb-1">Minuto</label>' +
          '<input id="backup-minute" type="number" min="0" max="59" value="' + (p.minutoEjecucion || 30) + '" ' +
          'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" /></div>' +
      '</div>' +
      '<div>' +
        '<label class="block text-xs text-gray-500 mb-2">Destino</label>' +
        '<div class="flex gap-2">' +
          destBtn('LOCAL', 'Local', p.destino) +
          destBtn('S3', 'AWS S3', p.destino) +
          destBtn('GDRIVE', 'Google Drive', p.destino) +
          destBtn('FTP', 'FTP', p.destino) +
        '</div>' +
      '</div>' +
      '<div id="backup-dest-config" class="hidden">' + renderDestConfig(p.destino, p) + '</div>' +
      '<div class="grid grid-cols-2 gap-3">' +
        '<div><label class="block text-xs text-gray-500 mb-1">Retención (días)</label>' +
          '<input id="backup-retention" type="number" min="1" value="' + (p.retencionDias || 30) + '" ' +
          'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" /></div>' +
        '<div><label class="block text-xs text-gray-500 mb-1">Máx. respaldos</label>' +
          '<input id="backup-max" type="number" min="1" value="' + (p.maxBackups || 10) + '" ' +
          'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" /></div>' +
      '</div>' +
      '<div><label class="block text-xs text-gray-500 mb-1">Contraseña de encriptación (opcional)</label>' +
        '<input id="backup-password" type="password" placeholder="AES-256-GCM encryption key" ' +
        'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500" /></div>' +
      '<button onclick="saveBackupPolicy()" class="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">Guardar Política</button>' +
    '</div>' +
  '</div>';
}

function freqBtn(value, label, current) {
  var active = current === value;
  return '<button onclick="setBackupFreq(\'' + value + '\')" ' +
    'class="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ' +
    (active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600') + '">' + label + '</button>';
}

function destBtn(value, label, current) {
  var active = current === value;
  return '<button onclick="setBackupDest(\'' + value + '\')" ' +
    'class="flex-1 px-2 py-2 rounded-lg text-xs font-medium transition ' +
    (active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600') + '">' + label + '</button>';
}

function renderDestConfig(dest, p) {
  switch (dest) {
    case 'S3': return '<div class="space-y-2 bg-gray-900/50 rounded-lg p-3">' +
      '<input id="dest-bucket" placeholder="Bucket name" value="' + esc(p.destinoConfig?.bucket || '') + '" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" />' +
      '<input id="dest-region" placeholder="Region (us-east-1)" value="' + esc(p.destinoConfig?.region || '') + '" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" />' +
      '<input id="dest-prefix" placeholder="Prefix (backups/)" value="' + esc(p.destinoConfig?.prefix || '') + '" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" /></div>';
    case 'GDRIVE': return '<div class="space-y-2 bg-gray-900/50 rounded-lg p-3">' +
      '<input id="dest-folder" placeholder="Google Drive Folder ID" value="' + esc(p.destinoConfig?.folderId || '') + '" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" /></div>';
    case 'FTP': return '<div class="space-y-2 bg-gray-900/50 rounded-lg p-3">' +
      '<input id="dest-ftp-host" placeholder="FTP Host" value="' + esc(p.destinoConfig?.host || '') + '" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" />' +
      '<div class="grid grid-cols-2 gap-2">' +
      '<input id="dest-ftp-port" placeholder="Puerto" value="' + (p.destinoConfig?.port || 21) + '" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" />' +
      '<input id="dest-ftp-user" placeholder="Usuario" value="' + esc(p.destinoConfig?.user || '') + '" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" /></div>' +
      '<input id="dest-ftp-pass" type="password" placeholder="Contraseña" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" /></div>';
    default: return '<div class="bg-gray-900/50 rounded-lg p-3">' +
      '<input id="dest-local-path" placeholder="/var/backups/erp" value="' + esc(p.destinoConfig?.path || '/var/backups/erp') + '" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" /></div>';
  }
}

function setBackupFreq(freq) {
  _backupState.policy.frecuencia = freq;
  initBackupRestore();
}

function setBackupDest(dest) {
  _backupState.policy.destino = dest;
  initBackupRestore();
}

function saveBackupPolicy() {
  _backupState.policy.horaEjecucion = parseInt(document.getElementById('backup-hour')?.value || '23');
  _backupState.policy.minutoEjecucion = parseInt(document.getElementById('backup-minute')?.value || '30');
  _backupState.policy.retencionDias = parseInt(document.getElementById('backup-retention')?.value || '30');
  _backupState.policy.maxBackups = parseInt(document.getElementById('backup-max')?.value || '10');
  _backupState.policy.lastBackup = _backupState.policy.lastBackup || 'Configurado';
  localStorage.setItem('backupPolicy', JSON.stringify(_backupState.policy));
  showToast('Política de backup guardada', 'success');
  initBackupRestore();
}

/* ─── Backup Actions ────────────────────────────────────────────── */

function renderBackupActions() {
  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/></svg> Acciones</h3>' +
    '<div class="space-y-3">' +
      '<button onclick="executeManualBackup()" id="backup-execute-btn" ' +
        'class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>' +
        'Ejecutar Backup Ahora' +
      '</button>' +
      '<button onclick="purgeOldBackups()" ' +
        'class="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-medium transition">' +
        '<button onclick="deleteOldBackups()" class="px-4 py-2 bg-red-600/20 text-red-400 border border-red-800/30 rounded-lg text-xs font-medium transition flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Eliminar Respaldos Antiguos</button>' +
      '</button>' +
      '<div id="backup-progress" class="hidden bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">' +
        '<div class="flex items-center gap-2 mb-2">' +
          '<div class="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>' +
          '<span class="text-xs text-blue-300">Ejecutando backup...</span>' +
        '</div>' +
        '<div id="backup-log" class="text-xs text-gray-400 font-mono max-h-40 overflow-y-auto"></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

async function executeManualBackup() {
  var btn = document.getElementById('backup-execute-btn');
  var progress = document.getElementById('backup-progress');
  var log = document.getElementById('backup-log');

  if (btn) btn.disabled = true;
  if (progress) progress.classList.remove('hidden');
  if (log) log.innerHTML = 'Iniciando backup...';

  try {
    var p = _backupState.policy;
    var resp = await api('/backup/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destino: p.destino || 'LOCAL',
        destinoConfig: p.destinoConfig || { path: '/var/backups/erp' },
        encryptionPassword: document.getElementById('backup-password')?.value || undefined,
      }),
    });

    if (resp.log && log) {
      log.innerHTML = resp.log.map(function(l) { return '<div>' + esc(l) + '</div>'; }).join('');
    }

    if (resp.success) {
      showToast('Backup completado: ' + (resp.fileSize ? formatBytes(resp.fileSize) : ''), 'success');
      _backupState.policy.lastBackup = new Date().toLocaleString('es-PY');
      localStorage.setItem('backupPolicy', JSON.stringify(_backupState.policy));
      loadBackupList();
    } else {
      showToast('Backup falló: ' + (resp.error || 'Error desconocido'), 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }

  if (btn) btn.disabled = false;
}

async function purgeOldBackups() {
  if (!confirm('¿Eliminar respaldos antiguos según la política de retención?')) return;
  try {
    var resp = await api('/backup/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxAgeDays: _backupState.policy.retencionDias || 30,
        maxCount: _backupState.policy.maxBackups || 10,
      }),
    });
    showToast(resp.message || 'Limpieza completada', 'success');
    loadBackupList();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── Backup History ────────────────────────────────────────────── */

function renderBackupHistory() {
  var backups = _backupState.backups;
  var rows = backups.length === 0
    ? '<tr><td colspan="5" class="text-center py-6 text-gray-500">Sin respaldos disponibles</td></tr>'
    : backups.map(function(b, i) {
        return '<tr class="border-t border-gray-700/30">' +
          '<td class="py-2 text-xs text-gray-400">' + new Date(b.createdAt).toLocaleString('es-PY') + '</td>' +
          '<td class="py-2 text-xs text-white font-mono">' + esc(b.filename) + '</td>' +
          '<td class="py-2 text-xs text-gray-300">' + esc(b.sizeFormatted || formatBytes(b.size)) + '</td>' +
          '<td class="py-2 text-xs">' + (b.isEncrypted ? '<span class="text-green-400">🔒 Sí</span>' : '<span class="text-gray-500">No</span>') + '</td>' +
          '<td class="py-2 text-xs"><button onclick="startRestore(\'' + esc(b.filePath) + '\',' + b.isEncrypted + ')" class="text-blue-400 hover:text-blue-300">Restaurar</button></td>' +
        '</tr>';
      }).join('');

  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Historial de Respaldos</h3>' +
    '<div class="overflow-x-auto">' +
      '<table class="w-full text-xs">' +
        '<thead><tr class="text-gray-500 uppercase tracking-wider">' +
          '<th class="text-left py-2">Fecha</th><th class="text-left py-2">Archivo</th><th class="text-left py-2">Tamaño</th><th class="text-left py-2">Encriptado</th><th class="text-left py-2">Acción</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '</div></div>';
}

async function loadBackupList() {
  try {
    var resp = await api('/backup/list');
    _backupState.backups = resp.backups || [];
    initBackupRestore();
  } catch { /* ignore */ }
}

/* ─── Restore Wizard ────────────────────────────────────────────── */

function renderRestoreWizard() {
  var steps = ['Seleccionar Backup', 'Contraseña', 'Verificación 2FA', 'Confirmar', 'Restaurando'];
  var step = _backupState.restoreStep;
  return '<div class="bg-gray-800/50 border border-red-800/30 rounded-xl p-5">' +
    '<div class="flex items-center justify-between mb-4">' +
      '<h3 class="text-sm font-semibold text-red-400 flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg> Asistente de Restauraci&oacute;n</h3>' +
      '<button onclick="closeRestoreWizard()" class="text-gray-500 hover:text-white text-sm">&times;</button>' +
    '</div>' +
    '<div class="flex items-center gap-1 mb-4">' +
      steps.map(function(s, i) {
        return '<div class="flex-1 h-1 rounded ' + (i <= step ? 'bg-blue-500' : 'bg-gray-700') + '"></div>';
      }).join('') +
    '</div>' +
    '<div class="text-xs text-gray-500 mb-3">Paso ' + (step + 1) + ' de ' + steps.length + ': ' + steps[step] + '</div>' +
    '<div id="restore-step-content">' + renderRestoreStep(step) + '</div>' +
  '</div>';
}

function renderRestoreStep(step) {
  switch (step) {
    case 0: return '<p class="text-sm text-gray-300 mb-3">Seleccione el backup a restaurar:</p>' +
      '<div class="space-y-2 max-h-40 overflow-y-auto">' +
      _backupState.backups.map(function(b) {
        return '<label class="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-700/50">' +
          '<input type="radio" name="restore-file" value="' + esc(b.filePath) + '" data-enc="' + b.isEncrypted + '" class="accent-blue-500" />' +
          '<span class="text-xs text-white">' + esc(b.filename) + '</span>' +
          '<span class="text-xs text-gray-500">' + esc(b.sizeFormatted) + '</span>' +
        '</label>';
      }).join('') + '</div>' +
      '<button onclick="restoreNext()" class="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white">Siguiente →</button>';
    case 1: return '<p class="text-sm text-gray-300 mb-3">Ingrese la contraseña de encriptación (si aplica):</p>' +
      '<input id="restore-password" type="password" placeholder="Contraseña (dejar vacío si no está encriptado)" ' +
        'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500" />' +
      '<div class="flex gap-2 mt-3"><button onclick="restorePrev()" class="flex-1 px-4 py-2 bg-gray-700 rounded-lg text-sm text-white">← Atrás</button>' +
      '<button onclick="restoreNext()" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white">Siguiente →</button></div>';
    case 2: return '<p class="text-sm text-gray-300 mb-3">Código de autenticación de dos factores:</p>' +
      '<input id="restore-2fa" type="text" placeholder="000000" maxlength="6" ' +
        'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono text-center text-lg tracking-widest" />' +
      '<div class="flex gap-2 mt-3"><button onclick="restorePrev()" class="flex-1 px-4 py-2 bg-gray-700 rounded-lg text-sm text-white">← Atrás</button>' +
      '<button onclick="restoreNext()" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white">Siguiente →</button></div>';
    case 3: return '<div class="bg-red-900/20 border border-red-800/30 rounded-lg p-4 mb-3">' +
      '<p class="text-sm text-red-300 font-medium"><svg class="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>ADVERTENCIA: Esta acci&oacute;n es irreversible</p>' +
      '<p class="text-xs text-gray-400 mt-2">La base de datos actual será sobrescrita con el contenido del backup seleccionado.</p>' +
      '</div>' +
      '<div class="flex gap-2"><button onclick="restorePrev()" class="flex-1 px-4 py-2 bg-gray-700 rounded-lg text-sm text-white">← Atrás</button>' +
      '<button onclick="executeRestore()" class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white font-medium flex items-center gap-2 justify-center"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Restaurar Ahora</button></div>';
    case 4: return '<div class="flex items-center gap-3 mb-3"><div class="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>' +
      '<span class="text-sm text-blue-300">Restaurando base de datos...</span></div>' +
      '<div id="restore-log" class="text-xs text-gray-400 font-mono max-h-40 overflow-y-auto bg-gray-900/50 rounded-lg p-3"></div>';
    default: return '';
  }
}

function restoreNext() {
  if (_backupState.restoreStep === 0) {
    var selected = document.querySelector('input[name="restore-file"]:checked');
    if (!selected) { if (typeof showToast === 'function') showToast('Seleccione un backup', 'warning'); return; }
    _backupState.selectedBackup = { path: selected.value, encrypted: selected.dataset.enc === 'true' };
  }
  _backupState.restoreStep = Math.min(4, _backupState.restoreStep + 1);
  document.getElementById('restore-wizard-container').innerHTML = renderRestoreWizard();
}

function restorePrev() {
  _backupState.restoreStep = Math.max(0, _backupState.restoreStep - 1);
  document.getElementById('restore-wizard-container').innerHTML = renderRestoreWizard();
}

function startRestore(filePath, isEncrypted) {
  _backupState.restoreStep = 0;
  _backupState.selectedBackup = { path: filePath, encrypted: isEncrypted };
  document.getElementById('restore-wizard-container').classList.remove('hidden');
  document.getElementById('restore-wizard-container').innerHTML = renderRestoreWizard();
}

function closeRestoreWizard() {
  document.getElementById('restore-wizard-container').classList.add('hidden');
  _backupState.restoreStep = 0;
}

async function executeRestore() {
  var logDiv = document.getElementById('restore-log');
  if (logDiv) logDiv.innerHTML = '<div>Iniciando restauración...</div>';

  try {
    var resp = await api('/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backupFilePath: _backupState.selectedBackup.path,
        decryptionPassword: document.getElementById('restore-password')?.value || undefined,
        twoFactorCode: document.getElementById('restore-2fa')?.value || '000000',
      }),
    });

    if (resp.log && logDiv) {
      logDiv.innerHTML = resp.log.map(function(l) { return '<div>' + esc(l) + '</div>'; }).join('');
    }

    if (resp.success) {
      showToast('Restauración completada exitosamente', 'success');
    } else {
      showToast('Restauración falló: ' + (resp.error || ''), 'error');
    }
  } catch (err) {
    if (logDiv) logDiv.innerHTML += '<div class="text-red-400">Error: ' + esc(err.message) + '</div>';
  }
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var k = 1024;
  var sizes = ['B', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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
    setTimeout(function() { initBackupRestore(); }, 100);
  });
}
