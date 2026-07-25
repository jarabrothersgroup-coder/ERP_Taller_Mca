/* ═══════════════════════════════════════════════════════════════════
   P3.5 — AI DTC Assistant Frontend
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, showToast */

function renderDTCAssistant(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">AI DTC Assistant</h2>
      <p class="text-sm text-gray-500">Asistente inteligente para diagnóstico de códigos DTC</p>
    </div>

    <!-- DTC Input -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Consultar Código DTC</h3>
      <div class="flex gap-3">
        <input id="dtc-code" placeholder="Ej: P0301, P0420, U0100" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-lg text-white placeholder-gray-600 font-mono uppercase focus:ring-2 focus:ring-blue-500/50" maxlength="5">
        <button onclick="analyzeDTC()" class="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 rounded-lg text-sm font-semibold transition-all flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          Analizar con AI
        </button>
      </div>
      <div id="dtc-result" class="mt-4 hidden"></div>
    </div>

    <!-- Recent DTCs from Thinkcar -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">DTCs Recientes del Vehículo</h3>
      <div class="flex gap-3 mb-4">
        <input id="dtc-vehicle" placeholder="ID del vehículo o VIN" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
        <button onclick="loadVehicleDTCs()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Buscar DTCs</button>
      </div>
      <div id="dtc-vehicle-list" class="text-center py-4 text-gray-600 text-sm">Ingresá el vehículo para ver sus DTCs</div>
    </div>

    <!-- DTC Database Quick Reference -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Referencia Rápida de Categorías DTC</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${[
          { prefix: 'P0xxx', label: 'Genérico Powertrain', color: 'blue' },
          { prefix: 'P1xxx', label: 'Manufacturer', color: 'purple' },
          { prefix: 'C0xxx', label: 'Chassis', color: 'orange' },
          { prefix: 'B0xxx', label: 'Body', color: 'cyan' },
          { prefix: 'U0xxx', label: 'Network/Communication', color: 'yellow' },
          { prefix: 'P2xxx', label: 'Genérico extendido', color: 'green' },
          { prefix: 'P3xxx', Manufacturer: true, label: 'Manufacturer extendido', color: 'red' },
          { prefix: 'C1xxx', label: 'Chassis extendido', color: 'pink' },
        ].map(c => `
          <div class="bg-gray-800/50 rounded-lg p-3 border border-${c.color}-500/20">
            <p class="font-mono text-sm font-bold text-${c.color}-400">${c.prefix}</p>
            <p class="text-xs text-gray-500">${c.label}</p>
          </div>`).join('')}
      </div>
    </div>`;
}

async function analyzeDTC() {
  const code = document.getElementById('dtc-code')?.value?.trim()?.toUpperCase();
  if (!code) { showToast('Ingresá un código DTC', 'error'); return; }

  const el = document.getElementById('dtc-result');
  el.classList.remove('hidden');
  el.innerHTML = '<div class="text-purple-400 text-sm flex items-center gap-2"><svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Analizando código ${esc(code)}...</div>';

  try {
    const data = await api(`/intelligence/dtc/analyze`, { method: 'POST', body: { code } });
    const severity = data?.severity || data?.gravedad || 'media';
    const sevColors = { baja: 'green', media: 'yellow', alta: 'orange', critica: 'red' };
    const color = sevColors[severity] || 'yellow';

    el.innerHTML = `
      <div class="bg-${color}-500/10 border border-${color}-500/30 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-4">
          <span class="font-mono text-2xl font-bold text-${color}-400">${esc(code)}</span>
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-${color}-500/20 text-${color}-400 uppercase">${severity}</span>
        </div>
        <h4 class="text-lg font-semibold text-white mb-2">${esc(data?.description || data?.descripcion || 'Código DTC')}</h4>
        <p class="text-sm text-gray-400 mb-4">${esc(data?.detailedInfo || data?.infoDetallada || data?.description || '')}</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Causas Comunes</p>
            <ul class="text-sm space-y-1">${(data?.causes || data?.causas || ['Sin datos específicos']).map(c => `<li class="text-gray-400">• ${esc(c)}</li>`).join('')}</ul>
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Soluciones Recomendadas</p>
            <ul class="text-sm space-y-1">${(data?.solutions || data?.soluciones || ['Requiere diagnóstico presencial']).map(s => `<li class="text-green-400">✓ ${esc(s)}</li>`).join('')}</ul>
          </div>
        </div>
        ${data?.relatedCodes?.length ? `<div class="mt-4 pt-3 border-t border-gray-800">
          <p class="text-xs text-gray-500 mb-2">Códigos Relacionados:</p>
          <div class="flex gap-2 flex-wrap">${data.relatedCodes.map(c => `<span class="bg-gray-800 px-2 py-1 rounded text-xs font-mono text-gray-400">${esc(c)}</span>`).join('')}</div>
        </div>` : ''}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">${esc(e.message || 'Error al analizar DTC. Verificá que el código sea válido.')}</div>`;
  }
}

async function loadVehicleDTCs() {
  const vehicleId = document.getElementById('dtc-vehicle')?.value?.trim();
  if (!vehicleId) { showToast('Ingresá el ID del vehículo', 'error'); return; }
  const el = document.getElementById('dtc-vehicle-list');
  el.innerHTML = '<div class="text-blue-400 text-sm">Buscando DTCs...</div>';

  try {
    const data = await api(`/thinkcar/imports?vehiculoId=${vehicleId}`);
    const imports = data?.data || data || [];
    if (!Array.isArray(imports) || !imports.length) {
      el.innerHTML = '<div class="text-gray-600 text-sm">Sin escaneos registrados para este vehículo</div>';
      return;
    }
    el.innerHTML = `
      <div class="space-y-2">
        ${imports.slice(0, 5).map(imp => `
          <div class="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium">${esc(imp.fecha || imp.createdAt || '—')}</p>
              <p class="text-xs text-gray-500">${esc(imp.dispositivo || 'Thinkcar')} · ${imp.dtcs?.length || imp.totalDTCs || 0} códigos</p>
            </div>
            <div class="flex gap-1 flex-wrap justify-end max-w-xs">
              ${(imp.dtcs || imp.codigos || []).slice(0, 5).map(d => `<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-mono">${esc(typeof d === 'string' ? d : d.codigo || d.code || '')}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="text-red-400 text-sm">${esc(e.message || 'Error al cargar DTCs')}</div>`;
  }
}
