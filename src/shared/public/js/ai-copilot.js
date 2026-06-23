/* ─── AI Diagnostic Copilot Sidebar ────────────────────────────── */

var _aiCopilotOpen = false;
var _aiCopilotOrderId = null;

/* ─── System Prompt (hidden from user) ──────────────────────────── */

var AI_SYSTEM_PROMPT = 'Eres un mecanico automotriz experto paraguayo con 20 anos de experiencia. ' +
  'Analizas codigos DTC (Diagnostic Trouble Codes) y proporcionas sugerencias precisas. ' +
  'Respondes en espanol paraguayo. ' +
  'Tu respuesta debe incluir: Causas mas probables, Procedimiento de diagnostico recomendado paso a paso, ' +
  'Diagramas de cableado o pines a medir con el multímetro si aplica, ' +
  'Repuestos necesarios (especificos para el mercado paraguayo), ' +
  'Costo estimado en Guaranies, Tiempo estimado de reparacion. ' +
  'Formato: Usa Markdown con negritas, listas y bloques de codigo para procedimientos tecnicos.';

var AI_LOADING_MESSAGES = [
  'Analizando codigos DTC...',
  'Consultando base de conocimiento automotriz...',
  'Calculando procedimiento de reparacion...',
  'Buscando boletines tecnicos de la marca...',
  'Evaluando causas mas probables...',
  'Preparando diagnostico detallado...',
];

/* ─── Markdown Renderer (lightweight) ───────────────────────────── */

function renderMarkdown(text) {
  if (!text) return '';
  var html = esc(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-gray-950 border border-gray-800 rounded-lg p-3 my-2 overflow-x-auto"><code class="text-xs text-green-300">$2</code></pre>');
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold text-white mt-4 mb-1">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="text-sm font-bold text-blue-300 mt-4 mb-1">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="text-base font-bold text-white mt-4 mb-2">$1</h2>');
  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 text-gray-300 text-sm list-disc mb-0.5">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="my-1">$&</ul>');
  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-gray-300 text-sm list-decimal mb-0.5">$1</li>');
  // Line breaks
  html = html.replace(/\n\n/g, '<br/>');
  return html;
}

/* ─── Sidebar Toggle ────────────────────────────────────────────── */

function toggleAiCopilot(orderId) {
  _aiCopilotOrderId = orderId || _aiCopilotOrderId;
  _aiCopilotOpen = !_aiCopilotOpen;
  var sidebar = document.getElementById('ai-copilot-sidebar');
  if (!sidebar) return;
  if (_aiCopilotOpen) {
    sidebar.classList.remove('hidden');
    sidebar.classList.add('flex');
    loadCopilotDtcSuggestions();
  } else {
    sidebar.classList.add('hidden');
    sidebar.classList.remove('flex');
  }
}

function closeAiCopilot() {
  _aiCopilotOpen = false;
  var sidebar = document.getElementById('ai-copilot-sidebar');
  if (sidebar) {
    sidebar.classList.add('hidden');
    sidebar.classList.remove('flex');
  }
}

/* ─── Render Sidebar ────────────────────────────────────────────── */

function renderAiCopilotSidebar() {
  return '<div id="ai-copilot-sidebar" class="hidden fixed right-0 top-0 h-full w-full sm:w-[420px] bg-gray-900 border-l border-gray-800 shadow-2xl z-40 flex-col overflow-hidden">' +
    '<div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur">' +
      '<div class="flex items-center gap-2">' +
        '<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' +
        '<div>' +
          '<h3 class="text-sm font-semibold text-white">Copiloto IA & Consulta Tecnica</h3>' +
          '<p class="text-xs text-gray-500">Diagnostico inteligente por DTC</p>' +
        '</div>' +
      '</div>' +
      '<button onclick="closeAiCopilot()" class="text-gray-500 hover:text-gray-300 transition p-1">' +
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="flex-1 overflow-y-auto p-4 space-y-4" id="ai-copilot-content">' +
      renderCopilotInput() +
      '<div id="ai-copilot-results"></div>' +
    '</div>' +
  '</div>';
}

function renderCopilotInput() {
  return '<div class="space-y-3">' +
    '<div>' +
      '<label for="ai-dtc-input" class="block text-xs text-gray-500 mb-1.5 font-medium">Codigos DTC (separados por coma)</label>' +
      '<input id="ai-dtc-input" type="text" placeholder="Ej: P0300, P0171, P0420" ' +
        'class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none font-mono" aria-label="Códigos DTC" />' +
    '</div>' +
    '<div>' +
      '<label for="ai-desc-input" class="block text-xs text-gray-500 mb-1.5 font-medium">Descripcion de la falla</label>' +
      '<textarea id="ai-desc-input" rows="2" placeholder="Ej: Toyota Hilux 2018 pierde fuerza en subidas, humo negro al acelerar"' +
        'class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none" aria-label="Descripción de la falla"></textarea>' +
    '</div>' +
    '<div class="grid grid-cols-2 gap-2">' +
      '<div>' +
        '<label for="ai-vehicle-input" class="block text-xs text-gray-500 mb-1.5 font-medium">Vehiculo</label>' +
        '<input id="ai-vehicle-input" type="text" placeholder="Ej: Hilux 2018"' +
          'class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Vehículo" />' +
      '</div>' +
      '<div>' +
        '<label for="ai-km-input" class="block text-xs text-gray-500 mb-1.5 font-medium">Kilometraje</label>' +
        '<input id="ai-km-input" type="number" placeholder="Ej: 85000"' +
          'class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Kilometraje" />' +
      '</div>' +
    '</div>' +
    '<div class="flex gap-2">' +
      '<button onclick="analyzeWithAi()" id="ai-analyze-btn" ' +
        'class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' +
        'Analizar con IA' +
      '</button>' +
      '<button onclick="searchTechnicalWeb()" id="ai-web-btn" ' +
        'class="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition" title="Buscar Boletines Tecnicos en la Web">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>' +
      '</button>' +
    '</div>' +
    '<div id="ai-loading-indicator" class="hidden">' +
      '<div class="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">' +
        '<div class="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>' +
        '<span id="ai-loading-text" class="text-sm text-blue-300">Analizando codigos DTC...</span>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ─── AI Analysis ───────────────────────────────────────────────── */

async function analyzeWithAi() {
  var dtcInput = document.getElementById('ai-dtc-input');
  var descInput = document.getElementById('ai-desc-input');
  var vehicleInput = document.getElementById('ai-vehicle-input');
  var kmInput = document.getElementById('ai-km-input');
  var results = document.getElementById('ai-copilot-results');
  var loading = document.getElementById('ai-loading-indicator');
  var loadingText = document.getElementById('ai-loading-text');
  var analyzeBtn = document.getElementById('ai-analyze-btn');

  var codigo = dtcInput ? dtcInput.value.trim() : '';
  var descripcion = descInput ? descInput.value.trim() : '';
  var vehiculo = vehicleInput ? vehicleInput.value.trim() : '';
  var kilometraje = kmInput ? parseInt(kmInput.value, 10) : undefined;

  if (!codigo && !descripcion) {
    if (typeof showToast === 'function') showToast('Ingresa al menos un codigo DTC o una descripcion de la falla', 'warning');
    return;
  }

  if (analyzeBtn) analyzeBtn.disabled = true;
  if (loading) loading.classList.remove('hidden');
  if (results) results.innerHTML = '';

  // Cycle through loading messages
  var msgIdx = 0;
  var msgInterval = setInterval(function() {
    msgIdx = (msgIdx + 1) % AI_LOADING_MESSAGES.length;
    if (loadingText) loadingText.textContent = AI_LOADING_MESSAGES[msgIdx];
  }, 2000);

  try {
    // Analyze each DTC code
    var codes = codigo ? codigo.split(',').map(function(c) { return c.trim(); }).filter(Boolean) : ['FALLA_CUSTOM'];
    var allResults = [];

    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      if (loadingText) loadingText.textContent = 'Analizando ' + code + ' (' + (i + 1) + '/' + codes.length + ')...';

      var body = {
        codigo: code,
        descripcion: descripcion || 'Sin descripcion adicional',
        vehiculo: vehiculo || 'No especificado',
      };
      if (kilometraje && !isNaN(kilometraje)) body.kilometraje = kilometraje;

      var resp = await api('/intelligence/ai-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      allResults.push(resp);
    }

    if (loading) loading.classList.add('hidden');
    clearInterval(msgInterval);

    if (results) {
      results.innerHTML = allResults.map(function(resp) {
        return renderAiResult(resp);
      }).join('');
    }
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    clearInterval(msgInterval);
    if (results) {
      results.innerHTML =
        '<div class="bg-red-900/20 border border-red-800/50 rounded-lg p-4">' +
          '<p class="text-sm text-red-300 font-medium">Error en el analisis</p>' +
          '<p class="text-xs text-red-400 mt-1">' + esc(err.message || 'Error de conexion con el servicio de IA') + '</p>' +
        '</div>';
    }
  }

  if (analyzeBtn) analyzeBtn.disabled = false;
}

/* ─── Apply AI Diagnosis to Work Order ──────────────────────────── */

async function applyDiagnosis(btn) {
  if (!_aiCopilotOrderId) {
    if (typeof showToast === 'function') showToast('No hay una orden de trabajo abierta. Abre una OT primero.', 'warning');
    return;
  }

  var codigo = btn.getAttribute('data-codigo');
  var causa = btn.getAttribute('data-causa');
  var recomendaciones = btn.getAttribute('data-recomendaciones');
  var repuestosRaw = btn.getAttribute('data-repuestos');
  var tiempo = btn.getAttribute('data-tiempo');
  var costo = btn.getAttribute('data-costo');

  var repuestos = [];
  try { repuestos = JSON.parse(repuestosRaw); } catch(_e) { /* ignore */ }

  if (!confirm('Aplicar diagnostico IA a esta orden de trabajo?\n\nCodigo: ' + codigo + '\nCausa: ' + causa)) {
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Aplicando...';

  try {
    var body = {
      ordenTrabajoId: _aiCopilotOrderId,
      codigo: codigo,
      causaProbable: causa,
    };
    if (recomendaciones) body.recomendaciones = recomendaciones;
    if (repuestos.length > 0) body.repuestosNecesarios = repuestos;
    if (tiempo) body.tiempoEstimadoHoras = parseFloat(tiempo);
    if (costo) body.costoEstimado = parseFloat(costo);

    var resp = await api('/intelligence/ai-diagnosis/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Aplicado';
    btn.className = 'w-full px-3 py-2 bg-green-700 text-white text-sm rounded-lg font-medium flex items-center justify-center gap-2 cursor-default';

    // Show success toast
    showToast('Diagnostico IA aplicado a la OT exitosamente', 'success');

    // Refresh OT modal if open
    if (typeof refreshOrdenModal === 'function' && _aiCopilotOrderId) {
      refreshOrdenModal(_aiCopilotOrderId);
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Aplicar a OT';
    if (typeof showToast === 'function') showToast('Error aplicando diagnostico: ' + (err.message || 'Error de conexion'), 'error');
  }
}

/* ─── Toast Helper ──────────────────────────────────────────────── */

function showToast(message, type) {
  var colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  var toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ' + (colors[type] || colors.info);
  toast.style.cssText = 'animation: slideUp 0.3s ease-out';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

function renderAiResult(resp) {
  if (!resp || !resp.suggestions || !resp.suggestions.length) {
    return '<div class="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">No se obtuvieron resultados para este codigo</div>';
  }

  return resp.suggestions.map(function(s) {
    var confianza = s.porcentajeConfianza || 60;
    var confianzaColor = confianza >= 80 ? 'text-green-400' : confianza >= 60 ? 'text-yellow-400' : 'text-red-400';
    var confianzaBg = confianza >= 80 ? 'bg-green-900/30' : confianza >= 60 ? 'bg-yellow-900/30' : 'bg-red-900/30';

    return '<div class="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between">' +
        '<div class="flex items-center gap-2">' +
          '<span class="px-2 py-0.5 bg-red-900/40 text-red-300 text-xs rounded font-mono font-bold">' + esc(s.codigo) + '</span>' +
          '<span class="text-xs ' + confianzaColor + '">' + confianza + '% confianza</span>' +
        '</div>' +
        (resp.modelo ? '<span class="text-xs text-gray-600">' + esc(resp.modelo) + '</span>' : '') +
      '</div>' +
      '<div class="p-4 space-y-3">' +
        '<div>' +
          '<h5 class="text-xs text-gray-500 uppercase tracking-wider mb-1">Causa Mas Probable</h5>' +
          '<p class="text-sm text-gray-200">' + renderMarkdown(s.causaProbable) + '</p>' +
        '</div>' +
        (s.recomendaciones ?
          '<div>' +
            '<h5 class="text-xs text-gray-500 uppercase tracking-wider mb-1">Procedimiento de Diagnostico</h5>' +
            '<div class="text-sm text-gray-300">' + renderMarkdown(s.recomendaciones) + '</div>' +
          '</div>' : '') +
        (s.repuestosNecesarios && s.repuestosNecesarios.length > 0 ?
          '<div>' +
            '<h5 class="text-xs text-gray-500 uppercase tracking-wider mb-1">Repuestos Necesarios</h5>' +
            '<div class="flex flex-wrap gap-1">' +
              s.repuestosNecesarios.map(function(r) {
                return '<span class="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded border border-gray-700">' + esc(r) + '</span>';
              }).join('') +
            '</div>' +
          '</div>' : '') +
        '<div class="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700/50">' +
          '<div>' +
            '<span class="text-xs text-gray-500">Tiempo estimado:</span>' +
            '<span class="text-sm text-white ml-1">' + (s.tiempoEstimadoHoras || '-') + 'h</span>' +
          '</div>' +
          '<div>' +
            '<span class="text-xs text-gray-500">Costo estimado:</span>' +
            '<span class="text-sm text-white ml-1">' + (s.costoEstimado ? 'Gs. ' + Number(s.costoEstimado).toLocaleString('es-PY') : '-') + '</span>' +
          '</div>' +
        '</div>' +
        (resp.costoEstimadoUSD > 0 ?
          '<div class="text-xs text-gray-600">Costo IA: $' + resp.costoEstimadoUSD.toFixed(4) + ' USD</div>' : '') +
      '</div>' +
      '<div class="px-4 py-3 border-t border-gray-700/50 bg-gray-900/30">' +
        '<button onclick="applyDiagnosis(this)" data-codigo="' + esc(s.codigo) + '" data-causa="' + esc(s.causaProbable || '') + '" ' +
          'data-recomendaciones="' + esc(s.recomendaciones || '') + '" ' +
          'data-repuestos="' + esc(JSON.stringify(s.repuestosNecesarios || [])) + '" ' +
          'data-tiempo="' + (s.tiempoEstimadoHoras || '') + '" data-costo="' + (s.costoEstimado || '') + '" ' +
          'class="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg font-medium transition flex items-center justify-center gap-2">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
          'Aplicar a OT' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ─── Web Technical Search ──────────────────────────────────────── */

async function searchTechnicalWeb() {
  var dtcInput = document.getElementById('ai-dtc-input');
  var vehicleInput = document.getElementById('ai-vehicle-input');
  var results = document.getElementById('ai-copilot-results');
  var loading = document.getElementById('ai-loading-indicator');
  var loadingText = document.getElementById('ai-loading-text');

  var codigo = dtcInput ? dtcInput.value.trim() : '';
  var vehiculo = vehicleInput ? vehicleInput.value.trim() : '';

  if (!codigo && !vehiculo) {
    if (typeof showToast === 'function') showToast('Ingresa al menos un codigo DTC o el vehiculo para buscar', 'warning');
    return;
  }

  if (loading) {
    loading.classList.remove('hidden');
    if (loadingText) loadingText.textContent = 'Buscando boletines tecnicos en la web...';
  }

  try {
    var query = (codigo ? 'DTC ' + codigo : '') + (vehiculo ? ' ' + vehiculo : '') + ' taller manual tecnico';
    var resp = await api('/intelligence/manuals/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query, topK: 10 }),
    });

    if (loading) loading.classList.add('hidden');

    if (results) {
      var items = resp.results || resp.chunks || resp;
      if (!items || !items.length) {
        results.innerHTML =
          '<div class="bg-gray-800/50 rounded-lg p-4 text-center">' +
            '<p class="text-sm text-gray-400 mb-2">No se encontraron boletines tecnicos en la base local</p>' +
            '<p class="text-xs text-gray-600">Intenta buscar directamente en Google:</p>' +
            '<a href="https://www.google.com/search?q=' + encodeURIComponent(query) + '" target="_blank" ' +
              'class="inline-block mt-2 px-3 py-1.5 bg-blue-600/20 text-blue-400 text-xs rounded-lg border border-blue-800/30 hover:bg-blue-600/30 transition">' +
              'Abrir busqueda en Google' +
            '</a>' +
          '</div>';
      } else {
        results.innerHTML =
          '<div class="space-y-2">' +
            '<h4 class="text-xs text-gray-500 uppercase tracking-wider">Resultados de la Base de Conocimiento</h4>' +
            items.map(function(item) {
              var content = item.content || item.text || '';
              var score = item.score || item.similarity || 0;
              var source = item.source || item.section || '';
              return '<div class="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3">' +
                '<div class="flex items-center justify-between mb-1">' +
                  (source ? '<span class="text-xs text-blue-400">' + esc(source) + '</span>' : '') +
                  (score > 0 ? '<span class="text-xs text-gray-600">Relevancia: ' + (score * 100).toFixed(0) + '%</span>' : '') +
                '</div>' +
                '<p class="text-sm text-gray-300 line-clamp-3">' + esc(content.substring(0, 300)) + '</p>' +
              '</div>';
            }).join('') +
          '</div>';
      }
    }
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    if (results) {
      results.innerHTML =
        '<div class="bg-gray-800/50 rounded-lg p-4 text-center">' +
          '<p class="text-sm text-gray-400 mb-2">Servicio de busqueda no disponible</p>' +
          '<p class="text-xs text-gray-600">Busca directamente en Google:</p>' +
          '<a href="https://www.google.com/search?q=' + encodeURIComponent((codigo || '') + ' ' + (vehiculo || '') + ' DTC manual taller') + '" target="_blank" ' +
            'class="inline-block mt-2 px-3 py-1.5 bg-blue-600/20 text-blue-400 text-xs rounded-lg border border-blue-800/30 hover:bg-blue-600/30 transition">' +
            'Abrir busqueda en Google' +
          '</a>' +
        '</div>';
    }
  }
}

/* ─── Auto-load DTCs from Thinkcar ─────────────────────────────── */

async function loadCopilotDtcSuggestions() {
  if (!_aiCopilotOrderId) return;
  try {
    var orden = await api('/workshop/ordenes-trabajo/' + _aiCopilotOrderId);
    if (orden && orden.dtcCodes && orden.dtcCodes.length > 0) {
      var dtcInput = document.getElementById('ai-dtc-input');
      if (dtcInput && !dtcInput.value) {
        dtcInput.value = orden.dtcCodes.join(', ');
      }
      var vehicleInput = document.getElementById('ai-vehicle-input');
      if (vehicleInput && !vehicleInput.value && orden.vehicleBrand) {
        vehicleInput.value = orden.vehicleBrand + ' ' + (orden.vehicleModel || '') + ' ' + (orden.vehicleYear || '');
      }
    }
  } catch { /* OT data optional */ }
}
