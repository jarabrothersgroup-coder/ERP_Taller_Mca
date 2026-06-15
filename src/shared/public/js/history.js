/* ─── History Modals ───────────────────────── */
/* Vehicle & Client history panels               */

/**
 * Show vehicle history modal: all OTs, services, parts for a vehicle.
 */
async function showVehicleHistory(vehicleId) {
  dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando historial...</div>';
  dom.modalOverlay.classList.remove('hidden');

  try {
    const data = await api(`/workshop/vehiculos/${vehicleId}/history`);
    renderVehicleHistoryModal(data);
  } catch (err) {
    dom.modalContent.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(err.message)}</div>`;
  }
}

function renderVehicleHistoryModal(data) {
  const v = data.vehicle;
  if (!v) {
    dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Vehículo no encontrado</div>';
    return;
  }

  const ordenes = data.ordenes || [];
  const statusColors = {
    Presupuestado: 'bg-yellow-900/50 text-yellow-300',
    Aprobado: 'bg-blue-900/50 text-blue-300',
    En_Proceso: 'bg-orange-900/50 text-orange-300',
    Control_Calidad: 'bg-purple-900/50 text-purple-300',
    Listo: 'bg-green-900/50 text-green-300',
  };

  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <div>
        <h3 class="text-lg font-bold">🚗 Historial del Vehículo</h3>
        <p class="text-sm text-gray-400">${esc(v.brand)} ${esc(v.model)} — ${esc(v.vin || v.plate || 'S/N')}</p>
      </div>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>

    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="bg-gray-800 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-blue-400">${data.totalOrdenes}</p>
        <p class="text-xs text-gray-500">Órdenes</p>
      </div>
      <div class="bg-gray-800 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-white">${v.year || '—'}</p>
        <p class="text-xs text-gray-500">Año</p>
      </div>
      <div class="bg-gray-800 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-green-400">${v.kilometraje ? v.kilometraje.toLocaleString('es-PY') : '—'}</p>
        <p class="text-xs text-gray-500">Km</p>
      </div>
    </div>

    <h4 class="text-sm font-semibold text-gray-400 mb-3">Órdenes de Trabajo</h4>
    ${ordenes.length === 0 ? '<p class="text-gray-600 text-sm text-center py-4">Sin órdenes registradas</p>' : `
    <div class="space-y-2 max-h-[300px] overflow-y-auto">
      ${ordenes.map((ot) => `
        <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-gray-500">${ot.createdAt ? new Date(ot.createdAt).toLocaleDateString('es-PY') : '—'}</span>
            <span class="status-badge ${statusColors[ot.status] || 'bg-gray-700 text-gray-400'}">${ot.status}</span>
          </div>
          <p class="text-sm text-white">${esc(ot.description || ot.diagnosis || 'Sin descripción')}</p>
          ${ot.totalCost && Number(ot.totalCost) > 0 ? `<p class="text-xs text-gray-400 mt-1">₲${Number(ot.totalCost).toLocaleString('es-PY')}</p>` : ''}
          ${(ot.servicios?.length || ot.repuestos?.length) ? `
          <div class="flex gap-4 mt-2 text-xs text-gray-500">
            ${ot.servicios?.length ? `<span>🛠️ ${ot.servicios.length} servicio(s)</span>` : ''}
            ${ot.repuestos?.length ? `<span>📦 ${ot.repuestos.length} repuesto(s)</span>` : ''}
          </div>` : ''}
        </div>
      `).join('')}
    </div>`}
  `;
  dom.modalOverlay.classList.remove('hidden');
}

/**
 * Show client history modal: all vehicles + all their OTs.
 */
async function showClientHistory(clientId) {
  dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando historial...</div>';
  dom.modalOverlay.classList.remove('hidden');

  try {
    const data = await api(`/workshop/clientes/${clientId}/history`);
    renderClientHistoryModal(data);
  } catch (err) {
    dom.modalContent.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(err.message)}</div>`;
  }
}

function renderClientHistoryModal(data) {
  const c = data.client;
  if (!c) {
    dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Cliente no encontrado</div>';
    return;
  }

  const vehicles = data.vehicles || [];
  const ordenes = data.ordenes || [];
  const statusColors = {
    Presupuestado: 'bg-yellow-900/50 text-yellow-300',
    Aprobado: 'bg-blue-900/50 text-blue-300',
    En_Proceso: 'bg-orange-900/50 text-orange-300',
    Control_Calidad: 'bg-purple-900/50 text-purple-300',
    Listo: 'bg-green-900/50 text-green-300',
  };

  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <div>
        <h3 class="text-lg font-bold">👤 Historial del Cliente</h3>
        <p class="text-sm text-gray-400">${esc(c.name)} ${c.ruc ? `— RUC: ${esc(c.ruc)}` : ''}</p>
      </div>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>

    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="bg-gray-800 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-blue-400">${data.totalVehicles}</p>
        <p class="text-xs text-gray-500">Vehículos</p>
      </div>
      <div class="bg-gray-800 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-green-400">${data.totalOrdenes}</p>
        <p class="text-xs text-gray-500">Órdenes</p>
      </div>
      <div class="bg-gray-800 rounded-lg p-3 text-center">
        <p class="text-2xl font-bold text-white">${c.phone || '—'}</p>
        <p class="text-xs text-gray-500">Teléfono</p>
      </div>
    </div>

    ${vehicles.length > 0 ? `
    <h4 class="text-sm font-semibold text-gray-400 mb-3">Vehículos</h4>
    <div class="flex flex-wrap gap-2 mb-5">
      ${vehicles.map((vh) => `
        <span class="bg-gray-800 text-sm px-3 py-1.5 rounded-lg border border-gray-700">
          🚗 ${esc(vh.brand)} ${esc(vh.model)} ${vh.year ? `(${vh.year})` : ''}
        </span>
      `).join('')}
    </div>` : ''}

    <h4 class="text-sm font-semibold text-gray-400 mb-3">Órdenes de Trabajo</h4>
    ${ordenes.length === 0 ? '<p class="text-gray-600 text-sm text-center py-4">Sin órdenes registradas</p>' : `
    <div class="space-y-2 max-h-[300px] overflow-y-auto">
      ${ordenes.map((ot) => `
        <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-gray-500">${ot.createdAt ? new Date(ot.createdAt).toLocaleDateString('es-PY') : '—'}</span>
            <span class="status-badge ${statusColors[ot.status] || 'bg-gray-700 text-gray-400'}">${ot.status}</span>
          </div>
          <p class="text-sm text-white">${esc(ot.description || ot.diagnosis || 'Sin descripción')}</p>
          ${ot.totalCost && Number(ot.totalCost) > 0 ? `<p class="text-xs text-gray-400 mt-1">₲${Number(ot.totalCost).toLocaleString('es-PY')}</p>` : ''}
        </div>
      `).join('')}
    </div>`}
  `;
  dom.modalOverlay.classList.remove('hidden');
}

/* Expose to global scope */
window.showVehicleHistory = showVehicleHistory;
window.showClientHistory = showClientHistory;
