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
      <div class="flex items-center gap-2">
        <button class="svc-tab px-3 py-1.5 rounded-lg text-sm font-medium transition ${_serviciosActiveTab === 'servicios' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}" data-tab="servicios">Servicios</button>
        <button class="svc-tab px-3 py-1.5 rounded-lg text-sm font-medium transition ${_serviciosActiveTab === 'matriz' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}" data-tab="matriz">Matriz de Precios</button>
        <button class="svc-tab px-3 py-1.5 rounded-lg text-sm font-medium transition ${_serviciosActiveTab === 'categorias' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}" data-tab="categorias">Categorías</button>
      </div>
      <button id="add-servicio-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nuevo</button>
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
            <th class="text-left px-4 py-3">Código</th>
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Categoría</th>
            <th class="text-left px-4 py-3">Precio Base</th>
            <th class="text-left px-4 py-3">Duración</th>
            <th class="text-left px-4 py-3">Thinkcar</th>
            <th class="text-left px-4 py-3">Estado</th>
            <th class="text-right px-4 py-3">Acción</th>
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
          <button class="edit-servicio-btn text-blue-400 hover:text-blue-300 text-xs mr-2" data-id="${esc(s.id)}">✏️</button>
          <button class="pricing-servicio-btn text-purple-400 hover:text-purple-300 text-xs mr-2" data-id="${esc(s.id)}" title="Configurar precios">💰</button>
          ${s.activo ? `<button class="del-servicio-btn text-red-400 hover:text-red-300 text-xs" data-id="${esc(s.id)}">🗑️</button>` : ''}
        </td>
      </tr>`).join('');

    document.querySelectorAll('.edit-servicio-btn').forEach(b => b.addEventListener('click', () => showServicioModal(b.dataset.id)));
    document.querySelectorAll('.pricing-servicio-btn').forEach(b => b.addEventListener('click', () => showPricingModal(b.dataset.id)));
    document.querySelectorAll('.del-servicio-btn').forEach(b => b.addEventListener('click', async () => {
      if (confirm('¿Desactivar este servicio?')) {
        await api(`/workshop/servicios/${b.dataset.id}`, { method: 'DELETE' });
        fetchServicios();
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
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="servicio-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre *</label>
          <input id="sv-nombre" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${esc(data.nombre || '')}" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Código</label>
          <input id="sv-codigo" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono" value="${esc(data.codigo || '')}" placeholder="MEC-PM-05K">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Categoría</label>
          <select id="sv-categoria" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="">—</option>
            ${_serviciosCat.map(c => `<option value="${esc(c.nombre)}" data-id="${esc(c.id)}" ${data.categoria === c.nombre ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Thinkcar Module</label>
          <input id="sv-thinkcar" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${esc(data.thinkcarModulo || '')}" placeholder="ECM_RESET">
        </div>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descripción</label>
        <textarea id="sv-descripcion" rows="2" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">${esc(data.descripcion || '')}</textarea>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descripción Técnica</label>
        <textarea id="sv-desc-tec" rows="2" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">${esc(data.descripcionTecnica || '')}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Precio Base (Gs.)</label>
          <input id="sv-precio" type="number" step="0.01" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${data.precioEstimado || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Duración (minutos)</label>
          <input id="sv-duracion" type="number" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${data.duracionEstimada || ''}">
        </div>
      </div>
      <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">${editId ? 'Guardar Cambios' : 'Crear Servicio'}</button>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');

  document.getElementById('servicio-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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
    } catch (e) { alert(e.message); }
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
      <h3 class="text-lg font-bold">💰 Precios — ${esc(servicio?.nombre || '')}</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>

    <div class="mb-4 flex justify-between items-center">
      <span class="text-xs text-gray-500">${rules.length} regla(s) configurada(s)</span>
      <button id="add-pricing-rule-btn" class="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium transition">+ Agregar Regla</button>
    </div>

    <div class="bg-gray-800/50 rounded-lg overflow-hidden mb-4">
      <table class="w-full text-xs">
        <thead><tr class="border-b border-gray-700 text-gray-500 uppercase tracking-wider">
          <th class="text-left px-3 py-2">Tipo Vehículo</th>
          <th class="text-left px-3 py-2">Combustible</th>
          <th class="text-left px-3 py-2">Intervalo KM</th>
          <th class="text-right px-3 py-2">Precio Venta</th>
          <th class="text-right px-3 py-2">Tiempo (min)</th>
          <th class="text-center px-3 py-2">Estado</th>
          <th class="text-right px-3 py-2">Acción</th>
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
                <button class="edit-rule-btn text-blue-400 hover:text-blue-300 text-xs mr-1" data-id="${esc(r.id)}">✏️</button>
                <button class="del-rule-btn text-red-400 hover:text-red-300 text-xs" data-id="${esc(r.id)}">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <button id="modal-cancel" class="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition">Cerrar</button>`;

  dom.modalOverlay.classList.remove('hidden');

  // Add pricing rule
  document.getElementById('add-pricing-rule-btn')?.addEventListener('click', () => {
    showPricingRuleForm(servicioId, vtypes, ftypes, intervals, servicio);
  });

  // Delete pricing rule
  document.querySelectorAll('.del-rule-btn').forEach(b => b.addEventListener('click', async () => {
    if (confirm('¿Eliminar esta regla de precio?')) {
      await api(`/workshop/pricing-rules/${b.dataset.id}`, { method: 'DELETE' });
      showPricingModal(servicioId);
    }
  }));
}

function showPricingRuleForm(servicioId, vtypes, ftypes, intervals, servicio) {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Nueva Regla de Precio</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="pricing-rule-form" class="space-y-4">
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Tipo de Vehículo *</label>
        <select id="pr-vt" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" required>
          <option value="">Seleccionar...</option>
          ${vtypes.map(v => `<option value="${esc(v.id)}">${esc(v.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Combustible</label>
          <select id="pr-ft" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="">Todos</option>
            ${ftypes.map(f => `<option value="${esc(f.id)}">${esc(f.nombre)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Intervalo KM</label>
          <select id="pr-mi" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="">Todos</option>
            ${intervals.map(i => `<option value="${esc(i.id)}">${esc(i.nombre)} (${i.kmDesde?.toLocaleString()} km)</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Precio Venta (Gs.) *</label>
          <input id="pr-precio" type="number" step="1000" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Precio Costo (Gs.)</label>
          <input id="pr-costo" type="number" step="1000" value="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Tiempo Estimado (min) *</label>
          <input id="pr-tiempo" type="number" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Complejidad</label>
          <select id="pr-complejidad" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="NORMAL">Normal</option>
            <option value="COMPLEJA">Compleja</option>
            <option value="ELECTRONICA">Electrónica</option>
          </select>
        </div>
      </div>
      <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Guardar Regla</button>
    </form>`;

  document.getElementById('pricing-rule-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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
    } catch (err) { alert(err.message); }
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

    const vHeaders = vtypes.map(v => `<th class="text-center px-3 py-2 min-w-[120px]">${esc(v.nombre)}</th>`).join('');

    content.innerHTML = `
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Servicio</th>
              <th class="text-left px-3 py-3">Categoría</th>
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
      <button id="add-cat-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nueva Categoría</button>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Descripción</th>
            <th class="text-left px-4 py-3">Color</th>
            <th class="text-right px-4 py-3">Orden</th>
            <th class="text-right px-4 py-3">Acción</th>
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
          <button class="edit-cat-btn text-blue-400 hover:text-blue-300 text-xs mr-2" data-id="${esc(c.id)}">✏️</button>
          <button class="del-cat-btn text-red-400 hover:text-red-300 text-xs" data-id="${esc(c.id)}">🗑️</button>
        </td>
      </tr>`).join('');

    document.querySelectorAll('.edit-cat-btn').forEach(b => b.addEventListener('click', () => showCategoriaModal(b.dataset.id)));
    document.querySelectorAll('.del-cat-btn').forEach(b => b.addEventListener('click', async () => {
      if (confirm('¿Eliminar esta categoría?')) {
        await api(`/workshop/service-categories/${b.dataset.id}`, { method: 'DELETE' });
        fetchCategorias();
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
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="cat-form" class="space-y-4">
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre *</label>
        <input id="cat-nombre" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${esc(data.nombre)}" required>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descripción</label>
        <input id="cat-desc" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${esc(data.descripcion || '')}">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Color</label>
          <input id="cat-color" type="color" class="w-full h-10 px-2 bg-gray-800 border border-gray-700 rounded-lg" value="${esc(data.color || '#3b82f6')}">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Orden</label>
          <input id="cat-orden" type="number" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${data.orden ?? 0}">
        </div>
      </div>
      <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">${editId ? 'Guardar Cambios' : 'Crear Categoría'}</button>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');

  document.getElementById('cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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
    } catch (err) { alert(err.message); }
  });
}
