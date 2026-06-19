/* ─── Label Printing Module ─────────────────────────────────────── */

var _labelState = {
  entityType: 'REPUESTO',
  protocolo: 'ESCPOS',
  copias: 1,
  entityId: '',
  history: JSON.parse(localStorage.getItem('labelPrintHistory') || '[]'),
};

/* ─── Initialization ────────────────────────────────────────────── */

function initLabelPrinting() {
  var view = document.getElementById('label-printing-view');
  if (!view) return;
  view.innerHTML = renderLabelModule();
}

function renderLabelModule() {
  return '<div class="max-w-5xl mx-auto p-6 space-y-6">' +
    '<div class="flex items-center gap-3 mb-6">' +
      '<span class="text-2xl">🏷️</span>' +
      '<div>' +
        '<h2 class="text-xl font-bold text-white">Impresión de Etiquetas y Rótulos</h2>' +
        '<p class="text-sm text-gray-400">Generación de códigos de barras y QR para inventario y herramientas</p>' +
      '</div>' +
    '</div>' +
    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
      renderLabelDesigner() +
      renderLabelPreview() +
    '</div>' +
    renderPrintHistory() +
  '</div>';
}

/* ─── Label Designer ────────────────────────────────────────────── */

function renderLabelDesigner() {
  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">' +
      '<span>🎨</span> Diseñador de Etiqueta' +
    '</h3>' +
    '<div class="space-y-4">' +
      '<div class="grid grid-cols-2 gap-3">' +
        '<div>' +
          '<label class="block text-xs text-gray-500 mb-1">Tipo de Etiqueta</label>' +
          '<select id="label-entity-type" onchange="_labelState.entityType=this.value; clearLabelPreview()"' +
            'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">' +
            '<option value="REPUESTO">📦 Repuesto (50×30mm)</option>' +
            '<option value="HERRAMIENTA">🔧 Herramienta (60×40mm)</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label class="block text-xs text-gray-500 mb-1">Protocolo</label>' +
          '<select id="label-protocolo" onchange="_labelState.protocolo=this.value; clearLabelPreview()"' +
            'class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">' +
            '<option value="ESCPOS">ESC/POS (Epson/Xprinter)</option>' +
            '<option value="ZPL">ZPL (Zebra)</option>' +
            '<option value="TSPL">TSPL (Brother/TSC)</option>' +
            '<option value="RAW_TEXT">Texto Plano</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<label class="block text-xs text-gray-500 mb-1">ID del Artículo</label>' +
        '<div class="flex gap-2">' +
          '<input id="label-entity-id" type="text" placeholder="UUID del repuesto o herramienta"' +
            'class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 font-mono" />' +
          '<button onclick="loadEntityForLabel()" class="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition">Cargar</button>' +
        '</div>' +
      '</div>' +
      '<div id="label-entity-info" class="hidden bg-gray-900/50 rounded-lg p-3 border border-gray-700/30"></div>' +
      '<div>' +
        '<label class="block text-xs text-gray-500 mb-1">Copias</label>' +
        '<div class="flex items-center gap-3">' +
          '<button onclick="adjustCopies(-1)" class="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm">−</button>' +
          '<span id="label-copies" class="text-white font-mono text-lg w-8 text-center">' + _labelState.copias + '</span>' +
          '<button onclick="adjustCopies(1)" class="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button onclick="previewLabel()" class="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition">' +
          '👁️ Vista Previa' +
        '</button>' +
        '<button onclick="printLabel()" class="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition">' +
          '🖨️ Imprimir' +
        '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ─── Label Preview ─────────────────────────────────────────────── */

function renderLabelPreview() {
  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">' +
      '<span>👁️</span> Vista Previa' +
    '</h3>' +
    '<div id="label-preview-container" class="flex items-center justify-center min-h-[200px] bg-gray-900/50 rounded-lg border border-gray-700/30">' +
      '<p class="text-gray-500 text-sm">Seleccione un artículo y presione "Vista Previa"</p>' +
    '</div>' +
    '<div id="label-preview-info" class="hidden mt-3 text-xs text-gray-500 text-center"></div>' +
  '</div>';
}

/* ─── Print History ─────────────────────────────────────────────── */

function renderPrintHistory() {
  var history = _labelState.history.slice(-20).reverse();
  var rows = history.length === 0
    ? '<tr><td colspan="5" class="text-center py-6 text-gray-500">Sin historial de impresión</td></tr>'
    : history.map(function(h) {
        return '<tr class="border-t border-gray-700/30">' +
          '<td class="py-2 text-xs text-gray-400">' + esc(h.fecha) + '</td>' +
          '<td class="py-2 text-xs text-white">' + esc(h.entityType) + '</td>' +
          '<td class="py-2 text-xs text-gray-300 font-mono">' + esc(h.entityId?.substring(0, 8) || '') + '</td>' +
          '<td class="py-2 text-xs text-gray-300">' + esc(h.protocolo) + '</td>' +
          '<td class="py-2 text-xs text-gray-300">' + h.copias + '</td>' +
        '</tr>';
      }).join('');

  return '<div class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">' +
    '<h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">' +
      '<span>📋</span> Historial de Impresión' +
    '</h3>' +
    '<div class="overflow-x-auto">' +
      '<table class="w-full text-xs">' +
        '<thead><tr class="text-gray-500 uppercase tracking-wider">' +
          '<th class="text-left py-2">Fecha</th>' +
          '<th class="text-left py-2">Tipo</th>' +
          '<th class="text-left py-2">Artículo</th>' +
          '<th class="text-left py-2">Protocolo</th>' +
          '<th class="text-left py-2">Copias</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
  '</div>';
}

/* ─── Actions ───────────────────────────────────────────────────── */

function adjustCopies(delta) {
  _labelState.copias = Math.max(1, Math.min(99, _labelState.copias + delta));
  var el = document.getElementById('label-copies');
  if (el) el.textContent = _labelState.copias;
}

async function loadEntityForLabel() {
  var idInput = document.getElementById('label-entity-id');
  var infoDiv = document.getElementById('label-entity-info');
  var id = idInput ? idInput.value.trim() : '';
  if (!id) { alert('Ingrese un ID de artículo'); return; }

  _labelState.entityId = id;
  var tipo = _labelState.entityType;
  var endpoint = tipo === 'REPUESTO'
    ? '/workshop/inventario/repuestos/' + id
    : '/workshop/inventario/herramientas/' + id;

  try {
    infoDiv.classList.remove('hidden');
    infoDiv.innerHTML = '<span class="text-gray-400 text-xs">Cargando...</span>';
    var entity = await api(endpoint);
    if (!entity) throw new Error('No encontrado');

    _labelState.entityData = entity;
    var name = tipo === 'REPUESTO' ? (entity.descripcion || entity.codigo) : (entity.nombre || entity.codigo);
    infoDiv.innerHTML =
      '<div class="flex items-center gap-2">' +
        '<span class="text-green-400">✓</span>' +
        '<span class="text-sm text-white font-medium">' + esc(name) + '</span>' +
      '</div>' +
      '<div class="text-xs text-gray-500 mt-1">Código: ' + esc(entity.codigo || '') +
        (entity.marca ? ' | Marca: ' + esc(entity.marca) : '') +
        (entity.precioVenta ? ' | Precio: Gs. ' + Number(entity.precioVenta).toLocaleString('es-PY') : '') +
      '</div>';
  } catch (err) {
    infoDiv.innerHTML = '<div class="flex items-center gap-2"><span class="text-red-400">✕</span><span class="text-sm text-red-300">Error: ' + esc(err.message) + '</span></div>';
  }
}

async function previewLabel() {
  var data = _labelState.entityData;
  if (!data) { alert('Cargue un artículo primero'); return; }

  var container = document.getElementById('label-preview-container');
  var info = document.getElementById('label-preview-info');

  try {
    container.innerHTML = '<span class="text-gray-400 text-xs">Generando vista previa...</span>';
    var resp = await api('/label-printing/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: _labelState.entityType,
        protocolo: _labelState.protocolo,
        data: data,
      }),
    });

    container.innerHTML = '<div class="p-4">' + resp.html + '</div>';
    info.classList.remove('hidden');
    info.textContent = resp.widthMm + '×' + resp.heightMm + 'mm — ' + _labelState.protocolo;
  } catch (err) {
    container.innerHTML = '<p class="text-red-400 text-sm">Error: ' + esc(err.message) + '</p>';
  }
}

async function printLabel() {
  var data = _labelState.entityData;
  if (!data) { alert('Cargue un artículo primero'); return; }

  try {
    var endpoint = _labelState.entityType === 'REPUESTO'
      ? '/label-printing/repuesto/' + _labelState.entityId
      : '/label-printing/herramienta/' + _labelState.entityId;

    var resp = await api(endpoint + '?protocolo=' + _labelState.protocolo + '&copias=' + _labelState.copias);

    // Try to open print dialog with the payload
    if (resp.payload) {
      var printWindow = window.open('', '_blank', 'width=400,height=300');
      if (printWindow) {
        printWindow.document.write(
          '<html><head><title>Imprimir Etiqueta</title>' +
          '<style>body{font-family:monospace;font-size:12px;white-space:pre;margin:20px;}' +
          '.barcode{letter-spacing:2px;font-weight:bold;}</style></head>' +
          '<body><pre>' + esc(resp.payload) + '</pre>' +
          '<script>window.onload=function(){window.print();}<\/script>' +
          '</body></html>'
        );
        printWindow.document.close();
      } else {
        alert('Impresora: Payload generado. Copie el siguiente código:\n\n' + resp.payload.substring(0, 200));
      }
    }

    // Save to history
    _labelState.history.push({
      fecha: new Date().toLocaleString('es-PY'),
      entityType: _labelState.entityType,
      entityId: _labelState.entityId,
      protocolo: _labelState.protocolo,
      copias: _labelState.copias,
    });
    localStorage.setItem('labelPrintHistory', JSON.stringify(_labelState.history.slice(-50)));
    initLabelPrinting(); // Refresh
  } catch (err) {
    alert('Error imprimiendo: ' + err.message);
  }
}

function clearLabelPreview() {
  var container = document.getElementById('label-preview-container');
  var info = document.getElementById('label-preview-info');
  if (container) container.innerHTML = '<p class="text-gray-500 text-sm">Seleccione un artículo y presione "Vista Previa"</p>';
  if (info) info.classList.add('hidden');
}

/* ─── Quick Print Button (for inventory views) ──────────────────── */

function createLabelPrintButton(entityType, entityId, entityNombre) {
  return '<button onclick="quickPrintLabel(\'' + entityType + '\',\'' + esc(entityId) + '\',\'' + esc(entityNombre) + '\')" ' +
    'class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition" title="Imprimir Etiqueta">' +
    '🖨️' +
  '</button>';
}

function quickPrintLabel(entityType, entityId, entityNombre) {
  _labelState.entityType = entityType;
  _labelState.entityId = entityId;
  _labelState.entityType = entityType;
  // Navigate to label printing view
  if (typeof navigateTo === 'function') {
    navigateTo('label-printing');
  }
}

/* ─── Auto-init ─────────────────────────────────────────────────── */

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() { initLabelPrinting(); }, 100);
  });
}
