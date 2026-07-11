/**
 * Servicios View — Catálogo de servicios del taller + Matriz de Precios.
 *
 * Tabs:
 *   1. Servicios — CRUD list of services
 *   2. Matriz de Precios — Multi-dimensional pricing by vehicle type
 *   3. Categorías — Manage service categories
 *
 * @module js/servicios
 */

/* ─── Global references ─── */
let _serviciosCat = [];   // cached categories
let _serviciosVt = [];    // cached vehicle types
let _serviciosFt = [];    // cached fuel types
let _serviciosMi = [];    // cached mileage intervals
let _serviciosActiveTab = 'servicios';

function renderServicios(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2" role="tablist" aria-label="Secciones de servicios">
        <button class="svc-tab px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${_serviciosActiveTab === 'servicios' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}" data-tab="servicios" role="tab" aria-selected="${_serviciosActiveTab === 'servicios'}">
          <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Servicios
        </button>
        <button class="svc-tab px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${_serviciosActiveTab === 'matriz' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}" data-tab="matriz" role="tab" aria-selected="${_serviciosActiveTab === 'matriz'}">
          <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
          Matriz de Precios
        </button>
        <button class="svc-tab px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${_serviciosActiveTab === 'categorias' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}" data-tab="categorias" role="tab" aria-selected="${_serviciosActiveTab === 'categorias'}">
          <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
          Categorías
        </button>
      </div>
      <button id="add-servicio-btn" class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Nuevo
      </button>
    </div>
    <div id="svc-content"></div>`;

  // Tab switching
  container.querySelectorAll('.svc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _serviciosActiveTab = btn.dataset.tab;
      renderServicios(container);
    });
  });

  if (_serviciosActiveTab === 'matriz') renderMatrizPrecios(container);
  else if (_serviciosActiveTab === 'categorias') renderCategorias(container);
  else renderServiciosList(container);
}

/* ═══════════════════════════════════════════════════
   TAB 1: Servicios List
   ═══════════════════════════════════════════════════ */

function renderServiciosList(container) {
  // Show the add button for servicios tab
  document.getElementById('add-servicio-btn')?.classList.remove('hidden');

  const content = container.querySelector('#svc-content');
  if (!content) return;

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th scope="col" class="text-left px-4 py-3 font-semibold">Código</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Nombre</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Categoría</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Precio Base</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Duración</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Thinkcar</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Estado</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th>
          </tr></thead>
          <tbody id="servicios-tbody"><tr><td colspan="8" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  fetchServicios();

  document.getElementById('add-servicio-btn')?.addEventListener('click', showServicioModal);
}

async function fetchServicios() {
  const tbody = document.getElementById('servicios-tbody');
  if (!tbody) return;
  try {
    const servicios = await api('/workshop/servicios');
    if (!servicios || !servicios.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-600">Sin servicios registrados</td></tr>';
      return;
    }
    tbody.innerHTML = servicios.map(s => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 font-mono text-xs text-gray-500">${esc(s.codigo || '—')}</td>
        <td class="px-4 py-3 font-medium">${esc(s.nombre)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(s.categoria || '—')}</td>
        <td class="px-4 py-3 text-gray-400">${s.precioEstimado ? 'Gs. ' + esc(Number(s.precioEstimado).toLocaleString('es-PY')) : '—'}</td>
        <td class="px-4 py-3 text-gray-400">${s.duracionEstimada ? esc(s.duracionEstimada) + ' min' : '—'}</td>
        <td class="px-4 py-3"><span class="text-xs ${s.thinkcarModulo ? 'text-cyan-400' : 'text-gray-600'}">${esc(s.thinkcarModulo || '—')}</span></td>
        <td class="px-4 py-3"><span class="status-badge ${s.activo ? 'bg-green-900/30 text-green-300' : 'bg-gray-700/50 text-gray-400'}">${s.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td class="px-4 py-3 text-right">
          <button class="edit-servicio-btn inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded px-1.5 py-0.5" data-id="${esc(s.id)}" aria-label="Editar ${esc(s.nombre)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Editar
          </button>
          <button class="pricing-servicio-btn inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 text-xs font-medium mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/30 rounded px-1.5 py-0.5" data-id="${esc(s.id)}" title="Configurar precios" aria-label="Configurar precios de ${esc(s.nombre)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Precios
          </button>
          ${s.activo ? `<button class="del-servicio-btn inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded px-1.5 py-0.5" data-id="${esc(s.id)}" aria-label="Desactivar ${esc(s.nombre)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Desactivar
          </button>` : ''}
        </td>
      </tr>`).join('');

    document.querySelectorAll('.edit-servicio-btn').forEach(b => b.addEventListener('click', () => showServicioModal(b.dataset.id)));
    document.querySelectorAll('.pricing-servicio-btn').forEach(b => b.addEventListener('click', () => showPricingModal(b.dataset.id)));
    document.querySelectorAll('.del-servicio-btn').forEach(b => b.addEventListener('click', async () => {
      if (confirm('¿Desactivar este servicio?')) {
        try {
          await api(`/workshop/servicios/${b.dataset.id}`, { method: 'DELETE' });
          fetchServicios();
          if (typeof showToast === 'function') showToast('Servicio desactivado', 'success');
        } catch (e) {
          if (typeof showToast === 'function') showToast('Error: ' + e.message, 'error');
        }
      }
    }));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-red-400">Error: ${esc(e.message)}</td></tr>`;
  }
}

async function showServicioModal(editId) {
  let data = { nombre: '', descripcion: '', descripcionTecnica: '', categoria: '', categoriaId: '', codigo: '', thinkcarModulo: '', precioEstimado: '', duracionEstimada: '' };
  if (editId) {
    try { data = await api(`/workshop/servicios/${editId}`); } catch { return; }
  }

  // Load categories for dropdown
  if (!_serviciosCat.length) {
    try { _serviciosCat = await api('/workshop/service-categories'); } catch { _serviciosCat = []; }
  }

  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">${editId ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
    </div>
    <form id="servicio-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="sv-nombre" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Nombre *</label>
          <input id="sv-nombre" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${esc(data.nombre || '')}" required aria-required="true" aria-label="Nombre del servicio">
        </div>
        <div>
          <label for="sv-codigo" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Código</label>
          <input id="sv-codigo" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white font-mono placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${esc(data.codigo || '')}" placeholder="MEC-PM-05K" aria-label="Código del servicio">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="sv-categoria" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Categoría</label>
          <select id="sv-categoria" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Categoría">
            <option value="">—</option>
            ${_serviciosCat.map(c => `<option value="${esc(c.nombre)}" data-id="${esc(c.id)}" ${data.categoria === c.nombre ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="sv-thinkcar" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Thinkcar Module</label>
          <input id="sv-thinkcar" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${esc(data.thinkcarModulo || '')}" placeholder="ECM_RESET" aria-label="Módulo Thinkcar">
        </div>
      </div>
      <div>
        <label for="sv-descripcion" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Descripción</label>
        <textarea id="sv-descripcion" rows="2" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Descripción">${esc(data.descripcion || '')}</textarea>
      </div>
      <div>
        <label for="sv-desc-tec" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Descripción Técnica</label>
        <textarea id="sv-desc-tec" rows="2" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Descripción técnica">${esc(data.descripcionTecnica || '')}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="sv-precio" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Precio Base (Gs.)</label>
          <input id="sv-precio" type="number" step="0.01" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${data.precioEstimado || ''}" aria-label="Precio base">
        </div>
        <div>
          <label for="sv-duracion" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Duración (minutos)</label>
          <input id="sv-duracion" type="number" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${data.duracionEstimada || ''}" aria-label="Duración estimada">
        </div>
      </div>
      <button type="submit" id="sv-submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed">
        <svg class="w-4 h-4 hidden" id="sv-submit-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        ${editId ? 'Guardar Cambios' : 'Crear Servicio'}
      </button>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');

  document.getElementById('servicio-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('sv-submit');
    const spinner = document.getElementById('sv-submit-spinner');
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    const catSel = document.getElementById('sv-categoria');
    const catOpt = catSel.options[catSel.selectedIndex];
    const body = {
      nombre: document.getElementById('sv-nombre').value.trim(),
      codigo: document.getElementById('sv-codigo').value.trim() || undefined,
      categoria: catSel.value || undefined,
      categoriaId: catOpt?.dataset?.id || undefined,
      thinkcarModulo: document.getElementById('sv-thinkcar').value.trim() || undefined,
      descripcion: document.getElementById('sv-descripcion').value.trim() || undefined,
      descripcionTecnica: document.getElementById('sv-desc-tec').value.trim() || undefined,
      precioEstimado: parseFloat(document.getElementById('sv-precio').value) || undefined,
      duracionEstimada: parseInt(document.getElementById('sv-duracion').value) || undefined,
    };
    try {
      if (editId) {
        await api(`/workshop/servicios/${editId}`, { method: 'PATCH', body });
      } else {
        await api('/workshop/servicios', { method: 'POST', body });
      }
      dom.modalOverlay.classList.add('hidden');
      fetchServicios();
      if (typeof showToast === 'function') showToast(editId ? 'Servicio actualizado' : 'Servicio creado', 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast('Error: ' + e.message, 'error');
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
    }
  });
}

/* ═══════════════════════════════════════════════════
   Pricing Modal — Configure pricing rules for a service
   ═══════════════════════════════════════════════════ */

async function showPricingModal(servicioId) {
  // Load reference data
  const [servicio, vtypes, ftypes, intervals, rules] = await Promise.all([
    api(`/workshop/servicios/${servicioId}`).catch(() => null),
    api('/workshop/reference/vehicle-types').catch(() => []),
    api('/workshop/reference/fuel-types').catch(() => []),
    api('/workshop/reference/mileage-intervals').catch(() => []),
    api(`/workshop/pricing-rules?servicioId=${servicioId}`).catch(() => []),
  ]);

  const vtypeMap = Object.fromEntries(vtypes.map(v => [v.id, v.nombre]));
  const ftypeMap = Object.fromEntries(ftypes.map(f => [f.id, f.nombre]));
  const intervalMap = Object.fromEntries(intervals.map(i => [i.id, `${i.nombre} (${i.kmDesde?.toLocaleString()} km)`]));

  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Precios — ${esc(servicio?.nombre || '')}</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
    </div>

    <div class="mb-4 flex justify-between items-center">
      <span class="text-xs text-gray-500">${rules.length} regla(s) configurada(s)</span>
      <button id="add-pricing-rule-btn" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg text-xs font-medium transition-all duration-150 shadow-lg hover:shadow-green-500/20 focus:outline-none focus:ring-2 focus:ring-green-500/40">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Agregar Regla
      </button>
    </div>

    <div class="bg-gray-800/50 rounded-lg overflow-hidden mb-4">
      <table class="w-full text-xs">
        <thead><tr class="border-b border-gray-700 text-gray-500 uppercase tracking-wider">
          <th scope="col" class="text-left px-3 py-2 font-semibold">Tipo Vehículo</th>
          <th scope="col" class="text-left px-3 py-2 font-semibold">Combustible</th>
          <th scope="col" class="text-left px-3 py-2 font-semibold">Intervalo KM</th>
          <th scope="col" class="text-right px-3 py-2 font-semibold">Precio Venta</th>
          <th scope="col" class="text-right px-3 py-2 font-semibold">Tiempo (min)</th>
          <th scope="col" class="text-center px-3 py-2 font-semibold">Estado</th>
          <th scope="col" class="text-right px-3 py-2 font-semibold">Acción</th>
        </tr></thead>
        <tbody id="pricing-rules-tbody">
          ${rules.length === 0
            ? '<tr><td colspan="7" class="text-center py-6 text-gray-600">Sin reglas de precio. Agrega una para configurar precios por tipo de vehículo.</td></tr>'
            : rules.map(r => `
            <tr class="border-b border-gray-700/50 hover:bg-gray-700/30">
              <td class="px-3 py-2">${esc(vtypeMap[r.vehicleTypeId] || r.vehicleTypeId?.slice(0,8))}</td>
              <td class="px-3 py-2 text-gray-400">${esc(ftypeMap[r.fuelTypeId] || 'Todos')}</td>
              <td class="px-3 py-2 text-gray-400">${esc(intervalMap[r.mileageIntervalId] || 'Todos')}</td>
              <td class="px-3 py-2 text-right font-medium">Gs. ${esc(Number(r.precioVentaPyg || 0).toLocaleString('es-PY'))}</td>
              <td class="px-3 py-2 text-right text-gray-400">${esc(r.tiempoEstimadoMin)} min</td>
              <td class="px-3 py-2 text-center">
                <span class="status-badge ${r.activo ? 'bg-green-900/30 text-green-300' : 'bg-gray-700/50 text-gray-400'}">${r.activo ? 'Activo' : 'Inactivo'}</span>
              </td>
              <td class="px-3 py-2 text-right">
                <button class="edit-rule-btn inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium mr-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded px-1.5 py-0.5" data-id="${esc(r.id)}" aria-label="Editar regla">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Editar
                </button>
                <button class="del-rule-btn inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded px-1.5 py-0.5" data-id="${esc(r.id)}" aria-label="Eliminar regla">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  Eliminar
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <button id="modal-cancel" class="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gray-500/30">Cerrar</button>`;

  dom.modalOverlay.classList.remove('hidden');

  // Add pricing rule
  document.getElementById('add-pricing-rule-btn')?.addEventListener('click', () => {
    showPricingRuleForm(servicioId, vtypes, ftypes, intervals, servicio);
  });

  // Delete pricing rule
  document.querySelectorAll('.del-rule-btn').forEach(b => b.addEventListener('click', async () => {
    if (confirm('¿Eliminar esta regla de precio?')) {
      try {
        await api(`/workshop/pricing-rules/${b.dataset.id}`, { method: 'DELETE' });
        showPricingModal(servicioId);
        if (typeof showToast === 'function') showToast('Regla eliminada', 'success');
      } catch (e) {
        if (typeof showToast === 'function') showToast('Error: ' + e.message, 'error');
      }
    }
  }));
}

function showPricingRuleForm(servicioId, vtypes, ftypes, intervals, servicio) {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Nueva Regla de Precio</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
    </div>
    <form id="pricing-rule-form" class="space-y-4">
      <div>
        <label for="pr-vt" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Tipo de Vehículo *</label>
        <select id="pr-vt" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" required aria-required="true" aria-label="Tipo de vehículo">
          <option value="">Seleccionar...</option>
          ${vtypes.map(v => `<option value="${esc(v.id)}">${esc(v.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="pr-ft" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Combustible</label>
          <select id="pr-ft" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Tipo de combustible">
            <option value="">Todos</option>
            ${ftypes.map(f => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="pr-mi" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Intervalo KM</label>
          <select id="pr-mi" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Intervalo de kilometraje">
            <option value="">Todos</option>
            ${intervals.map(i => `<option value="${esc(i.id)}">${esc(i.nombre)} (${i.kmDesde?.toLocaleString()} km)</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="pr-precio" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Precio Venta (Gs.) *</label>
          <input id="pr-precio" type="number" step="1000" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" required aria-required="true" aria-label="Precio de venta">
        </div>
        <div>
          <label for="pr-costo" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Precio Costo (Gs.)</label>
          <input id="pr-costo" type="number" step="1000" value="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Precio de costo">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="pr-tiempo" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Tiempo Estimado (min) *</label>
          <input id="pr-tiempo" type="number" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" required aria-required="true" aria-label="Tiempo estimado en minutos">
        </div>
        <div>
          <label for="pr-complejidad" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Complejidad</label>
          <select id="pr-complejidad" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Nivel de complejidad">
            <option value="NORMAL">Normal</option>
            <option value="COMPLEJA">Compleja</option>
            <option value="ELECTRONICA">Electrónica</option>
          </select>
        </div>
      </div>
      <button type="submit" id="pr-submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed">
        <svg class="w-4 h-4 hidden" id="pr-submit-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        Guardar Regla
      </button>
    </form>`;

  document.getElementById('pricing-rule-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('pr-submit');
    const spinner = document.getElementById('pr-submit-spinner');
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    const body = {
      servicioId,
      vehicleTypeId: document.getElementById('pr-vt').value,
      fuelTypeId: document.getElementById('pr-ft').value || undefined,
      mileageIntervalId: document.getElementById('pr-mi').value || undefined,
      precioVentaPyg: parseFloat(document.getElementById('pr-precio').value),
      precioCostoPyg: parseFloat(document.getElementById('pr-costo').value) || 0,
      tiempoEstimadoMin: parseInt(document.getElementById('pr-tiempo').value),
      complejidad: document.getElementById('pr-complejidad').value,
    };
    try {
      await api('/workshop/pricing-rules', { method: 'POST', body });
      showPricingModal(servicioId);
      if (typeof showToast === 'function') showToast('Regla de precio creada', 'success');
    } catch (err) {
      if (typeof showToast === 'function') showToast('Error: ' + err.message, 'error');
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
    }
  });
}

/* ═══════════════════════════════════════════════════
   TAB 2: Matriz de Precios (read-only matrix view)
   ═══════════════════════════════════════════════════ */

async function renderMatrizPrecios(container) {
  const content = container.querySelector('#svc-content');
  if (!content) return;

  // Hide the add button for read-only view
  document.getElementById('add-servicio-btn')?.classList.add('hidden');


  content.innerHTML = `<div class="text-center py-8 text-gray-600">Cargando matriz de precios...</div>`;

  try {
    const [servicios, vtypes, rules] = await Promise.all([
      api('/workshop/servicios?activo=true'),
      api('/workshop/reference/vehicle-types'),
      api('/workshop/pricing-rules'),
    ]);

    if (!vtypes.length) {
      content.innerHTML = `<div class="text-center py-8 text-gray-500">No hay tipos de vehículo configurados</div>`;
      return;
    }

    // Build matrix: service → vehicleType → price
    const matrix = {};
    for (const r of rules) {
      if (!matrix[r.servicioId]) matrix[r.servicioId] = {};
      matrix[r.servicioId][r.vehicleTypeId] = r;
    }

    const vHeaders = vtypes.map(v => `<th scope="col" class="text-center px-3 py-2 min-w-[120px] font-semibold">${esc(v.nombre)}</th>`).join('');

    content.innerHTML = `
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th scope="col" class="text-left px-4 py-3 font-semibold">Servicio</th>
              <th scope="col" class="text-left px-3 py-3 font-semibold">Categoría</th>
              ${vHeaders}
            </tr></thead>
            <tbody>
              ${(servicios || []).map(s => `
              <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td class="px-4 py-3 font-medium">${esc(s.nombre)}</td>
                <td class="px-3 py-3 text-gray-400 text-xs">${esc(s.categoria || '—')}</td>
                ${vtypes.map(v => {
                  const rule = matrix[s.id]?.[v.id];
                  return `<td class="px-3 py-3 text-center ${rule ? 'text-white' : 'text-gray-700'}">
                    ${rule
                      ? `<div class="font-medium text-xs">Gs. ${esc(Number(rule.precioVentaPyg || 0).toLocaleString('es-PY'))}</div><div class="text-[10px] text-gray-500">${esc(rule.tiempoEstimadoMin)} min</div>`
                      : '<span class="text-gray-700">—</span>'}
                  </td>`;
                }).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

/* ═══════════════════════════════════════════════════
   TAB 3: Categorías
   ═══════════════════════════════════════════════════ */

function renderCategorias(container) {
  const content = container.querySelector('#svc-content');
  if (!content) return;

  // Hide the main add button; categories have their own
  document.getElementById('add-servicio-btn')?.classList.add('hidden');

  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Categorías de servicios</p>
      <button id="add-cat-btn" class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Nueva Categoría
      </button>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th scope="col" class="text-left px-4 py-3 font-semibold">Nombre</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Descripción</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Color</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Orden</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th>
          </tr></thead>
          <tbody id="cat-tbody"><tr><td colspan="5" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;

  fetchCategorias();
  document.getElementById('add-cat-btn')?.addEventListener('click', showCategoriaModal);
}

async function fetchCategorias() {
  const tbody = document.getElementById('cat-tbody');
  if (!tbody) return;
  try {
    const cats = await api('/workshop/service-categories');
    if (!cats || !cats.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-600">Sin categorías. Se crean automáticamente al importar datos.</td></tr>';
      return;
    }
    tbody.innerHTML = cats.map(c => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 font-medium">${esc(c.nombre)}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${esc(c.descripcion || '—')}</td>
        <td class="px-4 py-3">
          ${c.color ? `<span class="inline-block w-4 h-4 rounded-full border border-gray-600" style="background:${esc(c.color)}"></span>` : '<span class="text-gray-600">—</span>'}
        </td>
        <td class="px-4 py-3 text-right text-gray-500">${c.orden ?? 0}</td>
        <td class="px-4 py-3 text-right">
          <button class="edit-cat-btn inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded px-1.5 py-0.5" data-id="${esc(c.id)}" aria-label="Editar categoría ${esc(c.nombre)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Editar
          </button>
          <button class="del-cat-btn inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded px-1.5 py-0.5" data-id="${esc(c.id)}" aria-label="Eliminar categoría ${esc(c.nombre)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Eliminar
          </button>
        </td>
      </tr>`).join('');

    document.querySelectorAll('.edit-cat-btn').forEach(b => b.addEventListener('click', () => showCategoriaModal(b.dataset.id)));
    document.querySelectorAll('.del-cat-btn').forEach(b => b.addEventListener('click', async () => {
      if (confirm('¿Eliminar esta categoría?')) {
        try {
          await api(`/workshop/service-categories/${b.dataset.id}`, { method: 'DELETE' });
          fetchCategorias();
          if (typeof showToast === 'function') showToast('Categoría eliminada', 'success');
        } catch (e) {
          if (typeof showToast === 'function') showToast('Error: ' + e.message, 'error');
        }
      }
    }));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-400">Error: ${esc(e.message)}</td></tr>`;
  }
}

async function showCategoriaModal(editId) {
  let data = { nombre: '', descripcion: '', icono: '', color: '', orden: 0 };
  if (editId) {
    try { const cats = await api('/workshop/service-categories'); data = cats.find(c => c.id === editId) || data; } catch { return; }
  }

  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">${editId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
    </div>
    <form id="cat-form" class="space-y-4">
      <div>
        <label for="cat-nombre" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Nombre *</label>
        <input id="cat-nombre" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${esc(data.nombre)}" required aria-required="true" aria-label="Nombre de la categoría">
      </div>
      <div>
        <label for="cat-desc" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Descripción</label>
        <input id="cat-desc" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${esc(data.descripcion || '')}" aria-label="Descripción">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="cat-color" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Color</label>
          <input id="cat-color" type="color" class="w-full h-10 px-2 bg-gray-800 border border-gray-600 rounded-lg cursor-pointer transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${esc(data.color || '#3b82f6')}" aria-label="Color de la categoría">
        </div>
        <div>
          <label for="cat-orden" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Orden</label>
          <input id="cat-orden" type="number" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" value="${data.orden ?? 0}" aria-label="Orden de visualización">
        </div>
      </div>
      <button type="submit" id="cat-submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed">
        <svg class="w-4 h-4 hidden" id="cat-submit-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        ${editId ? 'Guardar Cambios' : 'Crear Categoría'}
      </button>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');

  document.getElementById('cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('cat-submit');
    const spinner = document.getElementById('cat-submit-spinner');
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    const body = {
      nombre: document.getElementById('cat-nombre').value.trim(),
      descripcion: document.getElementById('cat-desc').value.trim() || undefined,
      color: document.getElementById('cat-color').value || undefined,
      orden: parseInt(document.getElementById('cat-orden').value) || 0,
    };
    try {
      if (editId) {
        await api(`/workshop/service-categories/${editId}`, { method: 'PATCH', body });
      } else {
        await api('/workshop/service-categories', { method: 'POST', body });
      }
      dom.modalOverlay.classList.add('hidden');
      fetchCategorias();
      if (typeof showToast === 'function') showToast(editId ? 'Categoría actualizada' : 'Categoría creada', 'success');
    } catch (err) {
      if (typeof showToast === 'function') showToast('Error: ' + err.message, 'error');
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
    }
  });
}
