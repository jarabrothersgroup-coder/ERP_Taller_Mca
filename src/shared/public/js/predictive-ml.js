/* ═══════════════════════════════════════════════════════════════════
   P2.5 — Predictive ML Frontend
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

function renderPredictiveML(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Mantenimiento Predictivo ML</h2>
      <p class="text-sm text-gray-500">Predicciones basadas enmachine learning para mantenimiento preventivo</p>
    </div>

    <!-- Vehicle Prediction Lookup -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Predicción por Vehículo</h3>
      <div class="flex gap-3">
        <input id="ml-vehicle-id" placeholder="UUID del vehículo" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
        <button onclick="loadVehiclePrediction()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Predecir</button>
      </div>
      <div id="ml-vehicle-result" class="mt-4 hidden"></div>
    </div>

    <!-- High-Risk Predictions -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
          Vehículos de Alto Riesgo
        </h3>
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-500">Umbral:</label>
          <input id="ml-threshold" type="number" min="0" max="100" value="40" class="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white text-center">
          <span class="text-xs text-gray-600">%</span>
          <button onclick="loadHighRisk()" class="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition">Actualizar</button>
        </div>
      </div>
      <div id="ml-highrisk" class="text-center py-4 text-gray-600 text-sm">Cargando predicciones...</div>
    </div>

    <!-- Training Data Stats -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
        Datos de Entrenamiento
      </h3>
      <div id="ml-training" class="text-center py-4 text-gray-600 text-sm">Cargando estadísticas...</div>
    </div>`;

  loadHighRisk();
  loadTrainingData();
}

async function loadVehiclePrediction() {
  const vid = document.getElementById('ml-vehicle-id')?.value?.trim();
  if (!vid) { showToast('Ingresá el ID del vehículo', 'error'); return; }
  const el = document.getElementById('ml-vehicle-result');
  el.classList.remove('hidden');
  el.innerHTML = '<div class="text-blue-400 text-sm">Analizando historial del vehículo...</div>';

  try {
    const data = await api(`/workshop/predictions/ml/${vid}`);
    if (!data) { el.innerHTML = '<div class="text-gray-600 text-sm">Sin predicciones para este vehículo</div>'; return; }

    const riesgo = data.riesgo || data.riskScore || 0;
    const color = riesgo >= 70 ? 'red' : riesgo >= 40 ? 'yellow' : 'green';
    const predicciones = data.predicciones || data.predictions || [];

    el.innerHTML = `
      <div class="bg-${color}-500/10 border border-${color}-500/30 rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-sm font-semibold text-${color}-400">Riesgo: ${riesgo}%</p>
            <p class="text-xs text-gray-500">Vehículo ${esc(data.vehiculoPatente || data.vehiculoId || vid)}</p>
          </div>
          <div class="w-20 bg-gray-800 rounded-full h-4 relative">
            <div class="bg-${color}-500 rounded-full h-4" style="width:${riesgo}%"></div>
          </div>
        </div>
      </div>
      ${predicciones.length ? `
        <div class="space-y-2">
          ${predicciones.map(p => `
            <div class="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">${esc(p.componente || p.servicio || 'Componente')}</p>
                <p class="text-xs text-gray-500">${esc(p.descripcion || p.detail || '')}</p>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-${(p.probabilidad || p.probability || 0) >= 60 ? 'red' : 'yellow'}-400">${p.probabilidad || p.probability || 0}%</p>
                <p class="text-xs text-gray-500">${esc(p.fechaEstimada || p.estimatedDate || '—')}</p>
              </div>
            </div>`).join('')}
        </div>` : '<p class="text-xs text-gray-500">Sin predicciones componentes específicas</p>'}
    `;
  } catch (e) {
    el.innerHTML = `<div class="text-red-400 text-sm">${esc(e.message || 'Error al predecir')}</div>`;
  }
}

async function loadHighRisk() {
  const el = document.getElementById('ml-highrisk');
  const umbral = document.getElementById('ml-threshold')?.value || 40;
  const data = await api(`/workshop/predictions/ml?umbral=${umbral}`).catch(() => null);
  const items = data?.items || data || [];

  if (!Array.isArray(items) || !items.length) {
    el.innerHTML = `<div class="text-center py-6 text-gray-600 text-sm">✅ Sin vehículos con riesgo ≥ ${umbral}%</div>`;
    return;
  }

  el.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      ${items.map(v => {
        const riesgo = v.riesgo || v.riskScore || 0;
        const color = riesgo >= 70 ? 'red' : riesgo >= 40 ? 'yellow' : 'green';
        return `<div class="bg-gray-800/50 rounded-lg p-3 border border-${color}-500/20 cursor-pointer hover:border-${color}-500/40 transition" onclick="document.getElementById('ml-vehicle-id').value='${v.vehiculoId || v.vehicleId || ''}';loadVehiclePrediction();">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">${esc(v.vehiculoPatente || v.patente || '—')}</span>
            <span class="px-2 py-0.5 rounded-full text-xs bg-${color}-500/20 text-${color}-400 font-bold">${riesgo}%</span>
          </div>
          <p class="text-xs text-gray-500">${esc(v.vehiculoMarca || v.marca || '')} ${esc(v.vehiculoModelo || v.modelo || '')}</p>
          <p class="text-xs text-gray-600 mt-1">Última OT: ${v.ultimaOT ? new Date(v.ultimaOT).toLocaleDateString('es-PY') : '—'}</p>
        </div>`;
      }).join('')}
    </div>`;
}

async function loadTrainingData() {
  const el = document.getElementById('ml-training');
  const data = await api('/workshop/predictions/ml/training-data').catch(() => null);
  if (!data) { el.innerHTML = '<div class="text-gray-600 text-sm">Sin datos de entrenamiento disponibles</div>'; return; }

  el.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-gray-800/50 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-blue-400">${data.totalOTs || data.total_samples || 0}</p>
        <p class="text-xs text-gray-500">OTs en entrenamiento</p>
      </div>
      <div class="bg-gray-800/50 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-green-400">${data.totalVehiculos || data.total_vehicles || 0}</p>
        <p class="text-xs text-gray-500">Vehículos analizados</p>
      </div>
      <div class="bg-gray-800/50 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-purple-400">${data.precision || data.model_precision || '—'}${typeof data.precision === 'number' || typeof data.model_precision === 'number' ? '%' : ''}</p>
        <p class="text-xs text-gray-500">Precisión del modelo</p>
      </div>
      <div class="bg-gray-800/50 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-cyan-400">${data.ultimaActualizacion ? new Date(data.ultimaActualizacion).toLocaleDateString('es-PY') : '—'}</p>
        <p class="text-xs text-gray-500">Última actualización</p>
      </div>
    </div>`;
}
