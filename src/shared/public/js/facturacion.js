/* ─── Facturación ─────────────────────── */
function renderFacturacion(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Facturación híbrida — MANUAL / ELECTRÓNICA</p>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden mb-6">
      <div class="px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Órdenes Listas para Facturar</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Vehículo</th>
            <th class="text-left px-4 py-3">Cliente</th>
            <th class="text-right px-4 py-3">Total (Gs.)</th>
            <th class="text-left px-4 py-3">Creado</th>
            <th class="text-right px-4 py-3">Acción</th>
          </tr></thead>
          <tbody id="facturar-tbody"><tr><td colspan="5" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Facturas Emitidas</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Nº Factura</th>
            <th class="text-left px-4 py-3">Tipo</th>
            <th class="text-right px-4 py-3">Total</th>
            <th class="text-left px-4 py-3">Estado SIFEN</th>
            <th class="text-left px-4 py-3">CDC</th>
            <th class="text-left px-4 py-3">Creado</th>
          </tr></thead>
          <tbody id="facturas-tbody"><tr><td colspan="6" class="text-center py-8 text-gray-500">Módulo SIFEN — Conectando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  fetchOrdenesListas();
  fetchFacturasEmitidas();
}

async function fetchOrdenesListas() {
  const tbody = document.querySelector('#facturar-tbody');
  if (!tbody) return;
  try {
    const ordenes = await api('/workshop/ordenes');
    const listas = (ordenes || []).filter((o) => o.status === 'Listo' || o.status === 'listo');
    if (!listas.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-600">No hay órdenes listas para facturar</td></tr>';
      return;
    }
    tbody.innerHTML = listas.map((o) => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 font-medium">${esc(o.vehiculo || '—')}</td>
        <td class="px-4 py-3 text-gray-400">${esc(o.cliente || '—')}</td>
        <td class="px-4 py-3 text-right font-mono">${o.totalCost ? Number(o.totalCost).toLocaleString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-gray-500 text-xs">${o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-right"><button id="facturar-orden-btn" data-id="${esc(o.id)}" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition">Emitir Factura</button></td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-600">Error al cargar órdenes</td></tr>';
  }
}

async function fetchFacturasEmitidas() {
  const tbody = document.querySelector('#facturas-tbody');
  if (!tbody) return;
  // Las facturas no tienen endpoint GET propio aún; mostramos placeholder informativo
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">📡 El módulo de consulta de facturas estará disponible cuando se active la homologación DNIT.</td></tr>';
}

function showFacturarModal(ordenId) {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Emitir Factura</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="facturar-form" class="space-y-4">
      <input type="hidden" id="facturar-orden-id" value="${esc(ordenId)}">
      <p class="text-sm text-gray-400 mb-2">Seleccioná el tipo de facturación:</p>
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col items-center gap-2 p-4 bg-gray-800/50 border-2 border-gray-700 rounded-xl cursor-pointer hover:border-blue-500 transition has-[:checked]:border-blue-500 has-[:checked]:bg-blue-900/20">
          <input type="radio" name="facturar-tipo" value="MANUAL" class="accent-blue-500" checked>
          <span class="text-2xl">📄</span>
          <span class="text-sm font-medium">Manual</span>
          <span class="text-xs text-gray-500 text-center">Factura preimpresa</span>
        </label>
        <label class="flex flex-col items-center gap-2 p-4 bg-gray-800/50 border-2 border-gray-700 rounded-xl cursor-pointer hover:border-blue-500 transition has-[:checked]:border-blue-500 has-[:checked]:bg-blue-900/20">
          <input type="radio" name="facturar-tipo" value="ELECTRONICA" class="accent-blue-500">
          <span class="text-2xl">⚡</span>
          <span class="text-sm font-medium">Electrónica</span>
          <span class="text-xs text-gray-500 text-center">DTE con firma digital</span>
        </label>
      </div>
      <div id="facturar-manual-field">
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nº Factura Preimpresa</label>
        <input id="facturar-num-manual" type="text" placeholder="001-001-0001234" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500">
      </div>
      <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Emitir Factura</button>
      <p id="facturar-msg" class="text-sm text-center hidden"></p>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');

  // Toggle manual field visibility based on selected tipo
  document.querySelectorAll('input[name="facturar-tipo"]').forEach((r) => {
    r.addEventListener('change', () => {
      const field = document.querySelector('#facturar-manual-field');
      if (field) field.style.display = r.value === 'MANUAL' ? 'block' : 'none';
    });
  });
  // Hide manual field if ELECTRONICA is pre-selected
  const selected = document.querySelector('input[name="facturar-tipo"]:checked');
  const field = document.querySelector('#facturar-manual-field');
  if (field && selected) field.style.display = selected.value === 'MANUAL' ? 'block' : 'none';
}
