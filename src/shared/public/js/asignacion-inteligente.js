/* ═══════════════════════════════════════════════════════════════════
   P2.4 — Asignación Inteligente de Mecánicos
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

function renderAsignacionInteligente(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Asignación Inteligente</h2>
      <p class="text-sm text-gray-500">Asigná automáticamente el mecánico más adecuado para cada OT</p>
    </div>

    <!-- Assignment Form -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Asignar Mecánico a OT</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">ID Orden de Trabajo *</label>
          <input id="ai-ot-id" placeholder="UUID de la OT" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
        </div>
        <div class="flex items-end gap-2">
          <button onclick="assignOptimal()" class="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg text-sm font-semibold transition-all">🧠 Asignar Óptimamente</button>
        </div>
      </div>
      <div id="ai-assignment-result" class="mt-4 hidden"></div>
    </div>

    <!-- Current Assignments Overview -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
        Disponibilidad de Mecánicos
      </h3>
      <div id="ai-mechanics" class="text-center py-4 text-gray-600 text-sm">Cargando mecánicos...</div>
    </div>`;

  loadMechanicsOverview();
}

async function loadMechanicsOverview() {
  const el = document.getElementById('ai-mechanics');
  const data = await api('/workshop/analytics/mechanics').catch(() => null);
  const mechanics = data?.data || data || [];

  if (!Array.isArray(mechanics) || !mechanics.length) {
    el.innerHTML = '<div class="text-gray-600">No hay mecánicos registrados</div>';
    return;
  }

  el.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${mechanics.map(m => {
        const otsActivas = m.otsActivas || m.activeOTs || 0;
        const eficiencia = m.eficiencia || m.efficiency || 0;
        const statusColor = otsActivas === 0 ? 'border-green-500/30' : otsActivas < 3 ? 'border-yellow-500/30' : 'border-red-500/30';
        return `<div class="bg-gray-800/50 rounded-lg p-3 border ${statusColor}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
              ${(m.nombre || m.name || 'M').charAt(0).toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">${esc(m.nombre || m.name || '—')}</p>
              <p class="text-xs text-gray-500">${otsActivas} OTs activas</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold ${eficiencia >= 100 ? 'text-green-400' : eficiencia >= 80 ? 'text-yellow-400' : 'text-red-400'}">${eficiencia}%</p>
              <p class="text-xs text-gray-500">eficiencia</p>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function assignOptimal() {
  const otId = document.getElementById('ai-ot-id')?.value?.trim();
  if (!otId) { showToast('Ingresá el ID de la OT', 'error'); return; }

  const resultEl = document.getElementById('ai-assignment-result');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<div class="text-blue-400 text-sm flex items-center gap-2"><svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Analizando compatibilidad, habilidades y disponibilidad...</div>';

  try {
    const result = await api('/workshop/mechanic-assignment/assign', {
      method: 'POST',
      body: { ordenTrabajoId: otId }
    });

    if (result?.asignado || result?.mecanicoAsignado) {
      resultEl.innerHTML = `
        <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-green-400">Mecánico Asignado</p>
              <p class="text-sm text-white">${esc(result.mecanicoNombre || result.mecanicoAsignado || result.tecnicoId || '—')}</p>
              <p class="text-xs text-gray-500 mt-1">Motivo: ${esc(result.motivo || result.razon || 'Asignación óptima por el sistema')}</p>
            </div>
          </div>
        </div>`;
    } else {
      resultEl.innerHTML = `<div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-400">${esc(result?.message || 'No se pudo asignar automáticamente. Verificá que la OT exista y tenga servicios definidos.')}</div>`;
    }
  } catch (e) {
    resultEl.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">${esc(e.message || 'Error en la asignación')}</div>`;
  }
}
