/* ═══════════════════════════════════════════════════════════════════
   P2.3 — Flat Rate Tracking Frontend
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

function renderFlatRate(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Flat Rate Tracking</h2>
      <p class="text-sm text-gray-500">Eficiencia de mecánicos y rentabilidad por bahía</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Technician Efficiency -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          Eficiencia por Técnico
        </h3>
        <div class="mb-3">
          <input id="fr-tech-id" placeholder="ID del técnico" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
          <button onclick="loadTechEfficiency()" class="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Consultar</button>
        </div>
        <div id="fr-tech-result" class="text-center py-4 text-gray-600 text-sm">Ingresá el ID del técnico y presioná Consultar</div>
      </div>

      <!-- Bay Profitability -->
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          Rentabilidad por Bahía
        </h3>
        <div class="mb-3">
          <input id="fr-bay-num" type="number" min="1" placeholder="N° de bahía" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/50">
          <button onclick="loadBayProfitability()" class="mt-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">Consultar</button>
        </div>
        <div id="fr-bay-result" class="text-center py-4 text-gray-600 text-sm">Ingresá el número de bahía y presioná Consultar</div>
      </div>
    </div>

    <!-- Active Time Tracking -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mt-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Control de Tiempo Activo
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">ID Servicio (orden-servicio)</label>
          <input id="fr-clock-svc" placeholder="UUID del servicio" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">ID Técnico</label>
          <input id="fr-clock-tech" placeholder="UUID del técnico" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
        <div class="flex items-end gap-2">
          <button onclick="clockIn()" class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">⏱ Clock In</button>
          <button onclick="clockOut()" class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition">⏹ Clock Out</button>
        </div>
      </div>
      <div id="fr-clock-result" class="mt-3 text-sm"></div>
    </div>`;
}

async function loadTechEfficiency() {
  const id = document.getElementById('fr-tech-id')?.value?.trim();
  if (!id) { showToast('Ingresá el ID del técnico', 'error'); return; }
  const el = document.getElementById('fr-tech-result');
  el.innerHTML = '<div class="text-gray-600">Cargando...</div>';
  const data = await api(`/workshop/flat-rate/technician/${id}`).catch(() => null);
  if (!data) { el.innerHTML = '<div class="text-red-400">No se encontró eficiencia para este técnico</div>'; return; }

  el.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Técnico</span><span class="font-medium">${esc(data.tecnicoNombre || id)}</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Flat Rate Total</span><span class="font-medium text-blue-400">${data.flatRateHoras || '—'} hrs</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Tiempo Real</span><span class="font-medium text-orange-400">${data.tiempoRealHoras || '—'} hrs</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Eficiencia</span>
        <div class="flex items-center gap-2">
          <div class="w-24 bg-gray-800 rounded-full h-3"><div class="${(data.eficiencia || 0) >= 100 ? 'bg-green-500' : (data.eficiencia || 0) >= 80 ? 'bg-yellow-500' : 'bg-red-500'} rounded-full h-3" style="width:${Math.min(data.eficiencia || 0, 100)}%"></div></div>
          <span class="font-bold ${data.eficiencia >= 100 ? 'text-green-400' : data.eficiencia >= 80 ? 'text-yellow-400' : 'text-red-400'}">${data.eficiencia || 0}%</span>
        </div>
      </div>
      ${data.serviciosRecientes ? `<div class="pt-3 border-t border-gray-800">
        <p class="text-xs text-gray-500 mb-2">Servicios Recientes</p>
        ${data.serviciosRecientes.map(s => `<div class="flex justify-between text-xs py-1"><span class="text-gray-400">${esc(s.nombre || '—')}</span><span class="${s.eficiencia >= 100 ? 'text-green-400' : 'text-yellow-400'}">${s.eficiencia || 0}%</span></div>`).join('')}
      </div>` : ''}
    </div>`;
}

async function loadBayProfitability() {
  const num = document.getElementById('fr-bay-num')?.value;
  if (!num) { showToast('Ingresá el número de bahía', 'error'); return; }
  const el = document.getElementById('fr-bay-result');
  el.innerHTML = '<div class="text-gray-600">Cargando...</div>';
  const data = await api(`/workshop/flat-rate/bay/${num}`).catch(() => null);
  if (!data) { el.innerHTML = '<div class="text-red-400">No se encontró datos para esta bahía</div>'; return; }

  el.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Bahía N°</span><span class="font-medium">${num}</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Ingresos Totales</span><span class="font-medium text-green-400">₲ ${fmt(data.ingresosTotales || 0)}</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Horas Facturables</span><span class="font-medium text-blue-400">${data.horasFacturables || 0} hrs</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Ingreso / Hora</span><span class="font-medium text-cyan-400">₲ ${fmt(data.ingresoPorHora || 0)}</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">OTs Atendidas</span><span class="font-medium">${data.otsAtendidas || 0}</span></div>
      <div class="flex justify-between items-center"><span class="text-gray-500 text-sm">Utilización</span>
        <div class="flex items-center gap-2">
          <div class="w-24 bg-gray-800 rounded-full h-3"><div class="bg-cyan-500 rounded-full h-3" style="width:${Math.min(data.utilizacion || 0, 100)}%"></div></div>
          <span class="font-bold text-cyan-400">${data.utilizacion || 0}%</span>
        </div>
      </div>
    </div>`;
}

async function clockIn() {
  const svcId = document.getElementById('fr-clock-svc')?.value?.trim();
  const techId = document.getElementById('fr-clock-tech')?.value?.trim();
  if (!svcId || !techId) { showToast('Completá ambos campos', 'error'); return; }
  try {
    const result = await api(`/workshop/servicios/${svcId}/clock-in`, { method: 'POST', body: { tecnicoId: techId } });
    document.getElementById('fr-clock-result').innerHTML = `<span class="text-green-400">✓ Clock-in registrado: ${new Date(result?.inicio).toLocaleTimeString('es-PY') || 'ahora'}</span>`;
  } catch (e) { showToast(e.message || 'Error en clock-in', 'error'); }
}

async function clockOut() {
  const svcId = document.getElementById('fr-clock-svc')?.value?.trim();
  if (!svcId) { showToast('Ingresá el ID del servicio', 'error'); return; }
  try {
    const result = await api(`/workshop/servicios/${svcId}/clock-out`, { method: 'POST' });
    document.getElementById('fr-clock-result').innerHTML = `<span class="text-blue-400">✓ Clock-out: duración ${result?.duracionMinutos || '—'} min | Flat rate: ${result?.flatRateMinutos || '—'} min</span>`;
  } catch (e) { showToast(e.message || 'Error en clock-out', 'error'); }
}
