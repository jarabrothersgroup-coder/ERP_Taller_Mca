function renderWorkshop(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-300">Bahía del Mecánico</h2>
      <button id="scan-barcode" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition flex items-center gap-2">
        <span>📷</span> Escanear
      </button>
    </div>
    <div id="bay-tasks" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="text-center py-12 text-gray-600 text-sm col-span-2">Cargando tareas...</div>
    </div>
    <div id="hv-section" class="hidden mt-6 bg-gray-900/60 rounded-xl p-5 border border-red-900/50 card-glow">
      <div class="flex items-center gap-3 mb-4">
        <span class="hv-pulse text-xl">⚡</span>
        <h3 class="text-lg font-bold text-red-400">Checklist de Seguridad — Alta Tensión</h3>
      </div>
      <div class="space-y-3 mb-4">
        ${[1,2,3,4,5].map(i => `<label class="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer">
          <input type="checkbox" class="hv-check mt-1 accent-red-500" data-step="${i}">
          <span class="text-sm text-gray-300">${['EPP dieléctrico verificado (guantes, botas, alfombra)','Bloqueo físico del conector HV (lockout/tagout)','Medición de tensión residual < 60V CC verificado','Herramientas aisladas certificadas (CAT III/IV)','Señalización de zona de trabajo HV instalada'][i-1]}</span>
        </label>`).join('')}
      </div>
      <div class="flex items-center gap-3">
        <input id="hv-mechanic" type="text" placeholder="Nombre del mecánico" class="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500">
        <button id="hv-sign" disabled class="px-6 py-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-bold transition">Firmar Lockout</button>
      </div>
      <p id="hv-signed-info" class="hidden text-sm text-green-400 mt-2">✓ Lockout firmado</p>
    </div>`;
  fetchWorkshopTasks();
}

async function fetchWorkshopTasks() {
  const ingresos = await api('/workshop/ingresos').catch(() => null);
  const bayTasks = document.querySelector('#bay-tasks');
  const hvSection = document.querySelector('#hv-section');
  if (!bayTasks) return;
  if (!ingresos || !ingresos.length) {
    bayTasks.innerHTML = '<div class="text-center py-12 text-gray-600 text-sm col-span-2">No hay tareas asignadas</div>';
    if (hvSection) hvSection.classList.add('hidden');
    return;
  }
  let cards = '', hasHv = false;
  ingresos.forEach(ing => {
    const ot = ing.ordenTrabajo;
    if (!ot || ot.status === 'Listo') return;
    const isHv = ot.hvAlert || false;
    if (isHv) hasHv = true;
    cards += `<div class="bg-gray-900/60 rounded-xl p-4 border ${isHv ? 'border-red-900/50' : 'border-gray-800'} card-glow tv-card">
      <div class="flex items-start justify-between mb-3">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">${ing.vehiculo || 'Vehículo'}</p>
          <p class="text-lg font-bold mt-1">${ing.vehiculo || '—'}</p>
        </div>
        ${isHv ? '<span class="hv-pulse text-xs px-2 py-1 rounded bg-red-900/50 text-red-300 font-bold">⚡ HV</span>' : ''}
      </div>
      <div class="flex items-center gap-2 mb-3">
        <span class="status-badge ${statusBadge(ot.status)}">${ot.status}</span>
        <span class="text-xs text-gray-500">${new Date(ing.fechaIngreso).toLocaleDateString('es-PY')}</span>
      </div>
      <div class="flex gap-2">
        <button class="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-800/30 rounded-lg text-xs text-blue-300 font-medium transition">Escanear Repuesto</button>
        <button class="flex-1 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-800/30 rounded-lg text-xs text-purple-300 font-medium transition">Escanear Herramienta</button>
      </div>
      <div class="mt-2">${statusActionButton(ot)}</div>
    </div>`;
  });
  if (hvSection) { hasHv ? hvSection.classList.remove('hidden') : hvSection.classList.add('hidden'); }
  bayTasks.innerHTML = cards || '<div class="text-center py-12 text-gray-600 text-sm col-span-2">No hay tareas activas</div>';
}

/* ─── TV / Quiosco ──────────────────────── */
function renderTv(container) {
  container.innerHTML = `
    <div id="tv-no-data" class="text-center py-24">
      <p class="text-4xl mb-4">🔧</p>
      <p class="text-xl text-gray-500">Esperando órdenes de trabajo...</p>
      <p class="text-gray-600 text-sm mt-2">Las pantallas se actualizan automáticamente</p>
    </div>
    <div id="tv-cards" class="hidden grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></div>`;
}

function updateTvView(data) {
  const tvNoData = document.querySelector('#tv-no-data');
  const tvCards = document.querySelector('#tv-cards');
  if (!tvNoData || !tvCards) return;
  if (data) {
    tvNoData.classList.add('hidden');
    tvCards.classList.remove('hidden');
    const st = statusIcon(data.status);
    tvCards.innerHTML = `<div class="bg-gray-900/80 rounded-2xl p-6 border ${data.isHighVoltage ? 'border-red-800/50' : 'border-gray-800'} card-glow tv-card">
      <div class="flex items-start justify-between mb-4">
        <div>
          <p class="text-sm text-gray-500 uppercase tracking-wider">Vehículo</p>
          <p class="text-2xl font-bold mt-1">${data.vehicleModel || '—'}</p>
          ${data.plate ? `<p class="text-lg text-gray-400">${data.plate}</p>` : ''}
        </div>
        ${data.isHighVoltage ? '<span class="hv-pulse px-3 py-1 rounded-lg bg-red-900/50 border border-red-500 text-red-300 text-sm font-bold">⚡ AT</span>' : ''}
      </div>
      <div class="flex items-center gap-3 mb-4">
        <span class="text-2xl">${st.icon}</span>
        <div>
          <p class="text-xl font-bold ${st.color}">${st.label}</p>
          ${data.estimatedCompletion ? `<p class="text-sm text-gray-500">Est: ${data.estimatedCompletion}</p>` : ''}
        </div>
      </div>
      ${data.torqueSpecs && data.torqueSpecs.length ? `<div class="border-t border-gray-800 pt-4 mt-2">
        <p class="text-sm text-gray-500 mb-2">Especificaciones de Torque</p>
        <div class="grid grid-cols-2 gap-2">${data.torqueSpecs.map(t => `<div class="bg-gray-800/50 rounded-lg px-3 py-2 flex justify-between items-center">
          <span class="text-sm text-gray-400">${t.component}</span>
          <span class="text-base font-bold text-cyan-400">${t.value}</span>
        </div>`).join('')}</div>
      </div>` : ''}
      ${data.dtcCodes && data.dtcCodes.length ? `<div class="border-t border-gray-800 pt-4 mt-2">
        <p class="text-sm text-gray-500 mb-2">DTCs</p>
        <div class="flex flex-wrap gap-2">${data.dtcCodes.map(c => `<span class="px-2 py-1 rounded-full bg-red-900/30 text-red-300 text-xs font-mono">${c}</span>`).join('')}</div>
      </div>` : ''}
      <div class="mt-4 text-right"><p class="text-xs text-gray-600">Actualizado: ${data.updatedAt || new Date().toLocaleTimeString('es-PY')}</p></div>
    </div>`;
  }
}

function statusIcon(status) {
  const m = { DIAGNOSTICO: { icon: '🔍', label: 'Diagnóstico', color: 'text-yellow-400' }, REPARACION: { icon: '🔧', label: 'Reparación', color: 'text-blue-400' }, AJUSTE_FINAL: { icon: '🔩', label: 'Ajuste Final', color: 'text-purple-400' }, CONTROL_CALIDAD: { icon: '✅', label: 'Control de Calidad', color: 'text-green-400' } };
  return m[status] || { icon: '❓', label: status || 'Desconocido', color: 'text-gray-400' };
}

