/**
 * Fleet — B2B Fleet Management Module (Enhanced).
 *
 * Frontend module for:
 *   - Fleet listing with stats
 *   - Create/edit fleet modal
 *   - Vehicle assignment
 *   - Service contracts
 *
 * @module js/fleet
 */

/* global api, esc */

// ─── Fleet View ─────────────────────────────

function renderFleet(container) {
  container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white"><svg class="w-5 h-5 inline-block -mt-0.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11h18l-2.25 6.75a2 2 0 01-2 1.25H7.25a2 2 0 01-2-1.25L3 11z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11l1.5-4.5A2 2 0 016.5 5h11a2 2 0 012 1.5L21 11"/></svg>Gestión de Flotas</h3>
          <p class="text-xs text-gray-500">Clientes corporativos con flotas de vehículos</p>
        </div>
        <button onclick="fleetOpenCreateModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nueva Flota</button>
      </div>

      <!-- Fleet Stats -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center">
          <div class="text-2xl font-bold text-blue-400" id="fleet-total">—</div>
          <div class="text-xs text-gray-500">Flotas</div>
        </div>
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center">
          <div class="text-2xl font-bold text-green-400" id="fleet-vehicles">—</div>
          <div class="text-xs text-gray-500">Vehículos</div>
        </div>
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 text-center">
          <div class="text-2xl font-bold text-yellow-400" id="fleet-contracts">—</div>
          <div class="text-xs text-gray-500">Contratos Activos</div>
        </div>
      </div>

      <!-- Fleet List -->
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
        <h4 class="text-sm font-semibold text-gray-300 mb-3">Flotas Registradas</h4>
        <div id="fleet-list" class="space-y-2">
          <p class="text-gray-500 text-sm">Cargando flotas...</p>
        </div>
      </div>
    </div>

    <!-- Fleet Modal -->
    <div id="fleet-modal" class="fixed inset-0 bg-black/60 hidden items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg mx-4 modal-content">
        <h3 class="text-lg font-bold text-white mb-4" id="fleet-modal-title">Nueva Flota</h3>
        <form id="fleet-form" class="space-y-4">
          <input type="hidden" id="fleet-edit-id">
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre de la Flota *</label>
            <input type="text" id="fleet-name" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required placeholder="Ej: Flota Municipal">
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Empresa *</label>
            <input type="text" id="fleet-company" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required placeholder="Ej: Municipalidad de Asunción">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Contacto</label>
              <input type="text" id="fleet-contact-name" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Nombre del contacto">
            </div>
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Teléfono</label>
              <input type="tel" id="fleet-contact-phone" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="0991-123456">
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Email del Contacto</label>
            <input type="email" id="fleet-contact-email" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="contacto@empresa.com">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Inicio Contrato</label>
              <input type="date" id="fleet-contract-start" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            </div>
            <div>
              <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Fin Contrato</label>
              <input type="date" id="fleet-contract-end" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descuento (%)</label>
            <input type="number" id="fleet-discount" min="0" max="50" step="0.5" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="0">
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Notas</label>
            <textarea id="fleet-notes" rows="2" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" placeholder="Condiciones especiales, notas internas..."></textarea>
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition" id="fleet-submit-btn">Crear Flota</button>
            <button type="button" onclick="fleetCloseModal()" class="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Form submit
  document.getElementById('fleet-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    _fleetSave();
  });

  _fleetLoadFleets();
}

async function _fleetLoadFleets() {
  try {
    const data = await api('/fleet');
    const list = document.getElementById('fleet-list');
    const totalEl = document.getElementById('fleet-total');
    const vehiclesEl = document.getElementById('fleet-vehicles');
    const contractsEl = document.getElementById('fleet-contracts');

    if (totalEl) totalEl.textContent = data?.length || '0';

    if (!data?.length) {
      if (list) list.innerHTML = '<p class="text-gray-500 text-sm">No hay flotas registradas. Cree su primera flota corporativa.</p>';
      return;
    }

    let totalVehicles = 0;
    let activeContracts = 0;

    list.innerHTML = data.map(f => {
      totalVehicles += f.vehicleCount || 0;
      if (f.contratoActivo) activeContracts++;

      return `
        <div class="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-800 transition">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center"><svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11h18l-2.25 6.75a2 2 0 01-2 1.25H7.25a2 2 0 01-2-1.25L3 11z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11l1.5-4.5A2 2 0 016.5 5h11a2 2 0 012 1.5L21 11"/></svg></div>
            <div>
              <p class="text-sm font-medium text-white">${esc(f.nombre)}</p>
              <p class="text-xs text-gray-500">${esc(f.empresa || 'Sin empresa')} · ${f.vehicleCount || 0} vehículos</p>
              ${f.descuentoPorcentaje > 0 ? `<span class="text-[10px] text-green-400">${f.descuentoPorcentaje}% descuento</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="status-badge ${f.contratoActivo ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}">${f.contratoActivo ? 'Activo' : 'Inactivo'}</span>
            <button onclick="fleetEdit('${esc(f.id)}')" class="text-gray-500 hover:text-white transition text-sm"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
          </div>
        </div>
      `;
    }).join('');

    if (vehiclesEl) vehiclesEl.textContent = totalVehicles;
    if (contractsEl) contractsEl.textContent = activeContracts;
  } catch (err) {
    console.error('[Fleet] Error loading fleets:', err);
  }
}

// ─── Modal ──────────────────────────────────

function fleetOpenCreateModal() {
  document.getElementById('fleet-modal-title').textContent = 'Nueva Flota';
  document.getElementById('fleet-submit-btn').textContent = 'Crear Flota';
  document.getElementById('fleet-edit-id').value = '';
  document.getElementById('fleet-form')?.reset();
  document.getElementById('fleet-modal')?.classList.remove('hidden');
  document.getElementById('fleet-modal')?.classList.add('flex');
}

function fleetEdit(id) {
  // TODO: Load fleet data and open edit modal
  if (typeof showToast === 'function') showToast(`Editar flota ${id} — Próximamente`, 'info');
}

function fleetCloseModal() {
  document.getElementById('fleet-modal')?.classList.add('hidden');
  document.getElementById('fleet-modal')?.classList.remove('flex');
}

async function _fleetSave() {
  const editId = document.getElementById('fleet-edit-id')?.value;
  const data = {
    nombre: document.getElementById('fleet-name')?.value,
    empresa: document.getElementById('fleet-company')?.value,
    contactoNombre: document.getElementById('fleet-contact-name')?.value,
    contactoTelefono: document.getElementById('fleet-contact-phone')?.value,
    contactoEmail: document.getElementById('fleet-contact-email')?.value,
    contratoInicio: document.getElementById('fleet-contract-start')?.value || undefined,
    contratoFin: document.getElementById('fleet-contract-end')?.value || undefined,
    descuentoPorcentaje: parseFloat(document.getElementById('fleet-discount')?.value) || 0,
    notas: document.getElementById('fleet-notes')?.value,
  };

  try {
    if (editId) {
      await api(`/fleet/${editId}`, { method: 'PATCH', body: data });
    } else {
      await api('/fleet', { method: 'POST', body: data });
    }
    fleetCloseModal();
    await _fleetLoadFleets();
    if (typeof showToast === 'function') showToast('Flota guardada correctamente', 'success');
  } catch (err) {
    console.error('[Fleet] Error saving fleet:', err);
    if (typeof showToast === 'function') showToast('Error al guardar la flota', 'error');
  }
}
