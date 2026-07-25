/**
 * Compras / Órdenes de Compra — Frontend Module.
 *
 * CRUD management for supplier invoices (facturas de compra).
 * Follows the same pattern as inventario.js and budget.js.
 *
 * @module js/compras
 */

/* global api, esc, showToast, dom, authHeaders */

// ─── State ──────────────────────────────────────

let _comprasTab = 'todas';

// ─── Main Render ────────────────────────────────

function renderCompras(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <p class="text-sm text-gray-400">Facturas de compra de proveedores</p>
      </div>
      <button onclick="showNewCompraModal()"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Nueva Compra
      </button>
    </div>
    <div class="flex gap-2 mb-4" role="tablist" aria-label="Filtrar compras">
      <button class="compras-tab px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${_comprasTab === 'todas' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="todas" role="tab" aria-selected="${_comprasTab === 'todas'}">Todas</button>
      <button class="compras-tab px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${_comprasTab === 'PENDIENTE' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="PENDIENTE" role="tab" aria-selected="${_comprasTab === 'PENDIENTE'}">Pendientes</button>
      <button class="compras-tab px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${_comprasTab === 'PAGADO' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="PAGADO" role="tab" aria-selected="${_comprasTab === 'PAGADO'}">Pagadas</button>
      <button class="compras-tab px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${_comprasTab === 'ANULADA' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="ANULADA" role="tab" aria-selected="${_comprasTab === 'ANULADA'}">Anuladas</button>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th scope="col" class="text-left px-4 py-3 font-semibold">N° Factura</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Proveedor</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Fecha</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Vencimiento</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Total (Gs.)</th>
            <th scope="col" class="text-center px-4 py-3 font-semibold">Estado</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th>
          </tr></thead>
          <tbody id="compras-tbody"><tr><td colspan="7" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="text-xs text-gray-600 mt-2" id="compras-count"></div>
  `;

  // Bind tab clicks
  document.querySelectorAll('.compras-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _comprasTab = btn.dataset.tab;
      renderCompras(container);
    });
  });

  fetchCompras(_comprasTab === 'todas' ? undefined : _comprasTab);
}

// ─── Fetch & Render Table ───────────────────────

async function fetchCompras(estadoPago) {
  const tbody = document.querySelector('#compras-tbody');
  const countEl = document.querySelector('#compras-count');
  if (!tbody) return;

  try {
    const params = estadoPago ? `?estadoPago=${encodeURIComponent(estadoPago)}` : '';
    const result = await api(`/finance/compras${params}`);
    const items = result.items || result || [];

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-600">Sin compras registradas</td></tr>';
      if (countEl) countEl.textContent = '';
      return;
    }

    tbody.innerHTML = items.map(c => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 font-mono text-xs">${esc(c.numeroFactura || '—')}</td>
        <td class="px-4 py-3 font-medium">${esc(c.proveedorNombre || '—')}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${c.fecha ? new Date(c.fecha).toLocaleDateString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-gray-400 text-xs">${c.fechaVencimiento ? new Date(c.fechaVencimiento).toLocaleDateString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-right font-mono">${c.total ? Number(c.total).toLocaleString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-center">${compraStatusBadge(c.estadoPago)}</td>
        <td class="px-4 py-3 text-right">
          <button onclick="showCompraDetail('${esc(c.id)}')" class="text-blue-400 hover:text-blue-300 text-xs font-medium mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded px-1.5 py-0.5">Ver</button>
          <button onclick="showEditCompraModal('${esc(c.id)}')" class="text-gray-400 hover:text-white text-xs font-medium mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded px-1.5 py-0.5">Editar</button>
          ${c.estadoPago !== 'ANULADA' ? `<button onclick="anularCompra('${esc(c.id)}')" class="text-red-400 hover:text-red-300 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded px-1.5 py-0.5">Anular</button>` : ''}
        </td>
      </tr>
    `).join('');

    if (countEl) countEl.textContent = `${items.length} compra(s) encontrada(s)`;
  } catch {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-600">Error al cargar compras</td></tr>';
  }
}

function compraStatusBadge(status) {
  const map = {
    PENDIENTE: 'bg-yellow-900/50 text-yellow-300',
    PARCIAL:   'bg-blue-900/50 text-blue-300',
    PAGADO:    'bg-green-900/50 text-green-300',
    ANULADA:   'bg-gray-700 text-gray-400',
  };
  return `<span class="status-badge ${map[status] || map.PENDIENTE}">${status || '—'}</span>`;
}

// ─── Detail View ────────────────────────────────

async function showCompraDetail(compraId) {
  dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando detalle...</div>';
  dom.modalOverlay.classList.remove('hidden');

  try {
    const c = await api(`/finance/compras/${compraId}`);
    const detalles = c.detalles || [];

    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">Compra #${esc(c.numeroFactura)}</h3>
        <button onclick="closeModal()" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <div class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Proveedor</p>
            <p class="font-medium mt-1">${esc(c.proveedorNombre || '—')}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Estado</p>
            <p class="mt-1">${compraStatusBadge(c.estadoPago)}</p>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Fecha</p>
            <p class="mt-1">${c.fecha ? new Date(c.fecha).toLocaleDateString('es-PY') : '—'}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Vencimiento</p>
            <p class="mt-1">${c.fechaVencimiento ? new Date(c.fechaVencimiento).toLocaleDateString('es-PY') : '—'}</p>
          </div>
          <div class="bg-gray-800/50 rounded-lg p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wider">Total</p>
            <p class="text-xl font-bold text-blue-400 mt-1">Gs. ${c.total ? Number(c.total).toLocaleString('es-PY') : '0'}</p>
          </div>
        </div>
        ${c.notas ? `<div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Notas</p>
          <p class="mt-1">${esc(c.notas)}</p>
        </div>` : ''}
        ${detalles.length ? `
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-2">Detalles</p>
          <table class="w-full text-xs">
            <thead><tr class="text-gray-500 uppercase tracking-wider border-b border-gray-700">
              <th scope="col" class="text-left py-1 font-semibold">Descripción</th>
              <th scope="col" class="text-right py-1 font-semibold">Cant.</th>
              <th scope="col" class="text-right py-1 font-semibold">Precio Unit.</th>
              <th scope="col" class="text-right py-1 font-semibold">Subtotal</th>
            </tr></thead>
            <tbody>
              ${detalles.map(d => `<tr class="border-b border-gray-700/50">
                <td class="py-1">${esc(d.descripcion || '—')}</td>
                <td class="text-right py-1">${d.cantidad || 0}</td>
                <td class="text-right py-1">${d.precioUnitario ? Number(d.precioUnitario).toLocaleString('es-PY') : '—'}</td>
                <td class="text-right py-1 font-medium">${d.subtotal ? Number(d.subtotal).toLocaleString('es-PY') : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<p class="text-gray-500 text-xs">Sin detalles</p>'}

        <!-- Status change buttons -->
        ${c.estadoPago !== 'ANULADA' ? `
        <div class="border-t border-gray-800 pt-3 flex gap-2">
          ${c.estadoPago !== 'PAGADO' ? `<button onclick="changeCompraStatus('${esc(c.id)}', 'PAGADO')" class="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition">Marcar Pagado</button>` : ''}
          ${c.estadoPago !== 'PARCIAL' && c.estadoPago !== 'PAGADO' ? `<button onclick="changeCompraStatus('${esc(c.id)}', 'PARCIAL')" class="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Pago Parcial</button>` : ''}
          <button onclick="changeCompraStatus('${esc(c.id)}', 'ANULADA')" class="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm font-medium transition">Anular</button>
        </div>` : ''}

        <button onclick="closeModal()" class="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm mt-2 transition">Cerrar</button>
      </div>
    `;
  } catch (err) {
    dom.modalContent.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(err.message)}</div>`;
  }
}

// ─── New Compra Modal ───────────────────────────

function showNewCompraModal() {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Nueva Compra</h3>
      <button onclick="closeModal()" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="compra-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="cf-numero" class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">N° Factura *</label>
          <input id="cf-numero" type="text" required class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" placeholder="Ej: 001-001-0001234">
        </div>
        <div>
          <label for="cf-proveedor" class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">Proveedor *</label>
          <input id="cf-proveedor" type="text" required class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" placeholder="Nombre del proveedor">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="cf-fecha" class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">Fecha</label>
          <input id="cf-fecha" type="date" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
        <div>
          <label for="cf-vencimiento" class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">Vencimiento</label>
          <input id="cf-vencimiento" type="date" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
      </div>
      <div>
        <label for="cf-notas" class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">Notas</label>
        <textarea id="cf-notas" rows="2" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" placeholder="Observaciones..."></textarea>
      </div>

      <!-- Detalles -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs text-gray-500 uppercase tracking-wider font-medium">Detalles de la compra</label>
          <button type="button" onclick="addCompraDetalleRow()" class="text-blue-400 hover:text-blue-300 text-xs font-medium">+ Agregar ítem</button>
        </div>
        <div id="compra-detalles" class="space-y-2">
          <div class="compra-detalle-row grid grid-cols-12 gap-2 items-end">
            <div class="col-span-5">
              <input type="text" placeholder="Descripción *" class="det-desc w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white" required>
            </div>
            <div class="col-span-2">
              <input type="number" min="1" value="1" placeholder="Cant." class="det-cant w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white">
            </div>
            <div class="col-span-3">
              <input type="number" min="0" step="1000" placeholder="Precio unit." class="det-precio w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white">
            </div>
            <div class="col-span-2 flex items-center gap-1">
              <span class="det-subtotal text-xs text-gray-400 font-mono">Gs. 0</span>
              <button type="button" onclick="removeCompraDetalleRow(this)" class="text-red-400 hover:text-red-300 text-xs ml-1">&times;</button>
            </div>
          </div>
        </div>
        <div class="flex justify-end mt-2">
          <span class="text-sm text-gray-400">Total: <span id="compra-total" class="text-blue-400 font-bold">Gs. 0</span></span>
        </div>
      </div>

      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Crear Compra</button>
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
      </div>
      <p id="cf-error" class="text-red-400 text-sm text-center hidden"></p>
    </form>
  `;

  dom.modalOverlay.classList.remove('hidden');

  // Bind subtotal calculation
  dom.modalContent.querySelectorAll('.det-cant, .det-precio').forEach(inp => {
    inp.addEventListener('input', updateCompraTotals);
  });

  // Bind submit
  document.getElementById('compra-form')?.addEventListener('submit', handleCompraSubmit);
}

function addCompraDetalleRow() {
  const container = document.getElementById('compra-detalles');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'compra-detalle-row grid grid-cols-12 gap-2 items-end';
  row.innerHTML = `
    <div class="col-span-5">
      <input type="text" placeholder="Descripción *" class="det-desc w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white" required>
    </div>
    <div class="col-span-2">
      <input type="number" min="1" value="1" placeholder="Cant." class="det-cant w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white">
    </div>
    <div class="col-span-3">
      <input type="number" min="0" step="1000" placeholder="Precio unit." class="det-precio w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white">
    </div>
    <div class="col-span-2 flex items-center gap-1">
      <span class="det-subtotal text-xs text-gray-400 font-mono">Gs. 0</span>
      <button type="button" onclick="removeCompraDetalleRow(this)" class="text-red-400 hover:text-red-300 text-xs ml-1">&times;</button>
    </div>
  `;
  container.appendChild(row);
  row.querySelectorAll('.det-cant, .det-precio').forEach(inp => {
    inp.addEventListener('input', updateCompraTotals);
  });
}

function removeCompraDetalleRow(btn) {
  const rows = document.querySelectorAll('.compra-detalle-row');
  if (rows.length <= 1) return; // keep at least one
  btn.closest('.compra-detalle-row').remove();
  updateCompraTotals();
}

function updateCompraTotals() {
  let total = 0;
  document.querySelectorAll('.compra-detalle-row').forEach(row => {
    const cant = parseInt(row.querySelector('.det-cant')?.value) || 0;
    const precio = parseFloat(row.querySelector('.det-precio')?.value) || 0;
    const subtotal = cant * precio;
    total += subtotal;
    const subEl = row.querySelector('.det-subtotal');
    if (subEl) subEl.textContent = 'Gs. ' + subtotal.toLocaleString('es-PY');
  });
  const totalEl = document.getElementById('compra-total');
  if (totalEl) totalEl.textContent = 'Gs. ' + total.toLocaleString('es-PY');
}

async function handleCompraSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('cf-error');

  const numeroFactura = document.getElementById('cf-numero')?.value?.trim();
  const proveedorNombre = document.getElementById('cf-proveedor')?.value?.trim();

  if (!numeroFactura || !proveedorNombre) {
    if (errEl) { errEl.textContent = 'N° Factura y Proveedor son requeridos'; errEl.classList.remove('hidden'); }
    return;
  }

  const detalles = [];
  document.querySelectorAll('.compra-detalle-row').forEach(row => {
    const desc = row.querySelector('.det-desc')?.value?.trim();
    const cant = parseInt(row.querySelector('.det-cant')?.value) || 1;
    const precio = parseFloat(row.querySelector('.det-precio')?.value) || 0;
    if (desc && precio > 0) {
      detalles.push({ descripcion: desc, cantidad: cant, precioUnitario: precio });
    }
  });

  if (!detalles.length) {
    if (errEl) { errEl.textContent = 'Agregá al menos un ítem con precio'; errEl.classList.remove('hidden'); }
    return;
  }

  try {
    await api('/finance/compras', {
      method: 'POST',
      body: {
        numeroFactura,
        proveedorNombre,
        fecha: document.getElementById('cf-fecha')?.value || undefined,
        fechaVencimiento: document.getElementById('cf-vencimiento')?.value || undefined,
        notas: document.getElementById('cf-notas')?.value?.trim() || undefined,
        detalles,
      },
    });
    closeModal();
    fetchCompras(_comprasTab === 'todas' ? undefined : _comprasTab);
    if (typeof showToast === 'function') showToast('Compra creada', 'success');
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
}

// ─── Edit Compra ────────────────────────────────

async function showEditCompraModal(compraId) {
  dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando...</div>';
  dom.modalOverlay.classList.remove('hidden');

  try {
    const c = await api(`/finance/compras/${compraId}`);

    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">Editar Compra #${esc(c.numeroFactura)}</h3>
        <button onclick="closeModal()" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <form id="compra-edit-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">N° Factura</label>
            <input id="ce-numero" type="text" value="${esc(c.numeroFactura || '')}" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          </div>
          <div>
            <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">Proveedor</label>
            <input id="ce-proveedor" type="text" value="${esc(c.proveedorNombre || '')}" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">Estado de Pago</label>
          <select id="ce-estado" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="PENDIENTE" ${c.estadoPago === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
            <option value="PARCIAL" ${c.estadoPago === 'PARCIAL' ? 'selected' : ''}>Parcial</option>
            <option value="PAGADO" ${c.estadoPago === 'PAGADO' ? 'selected' : ''}>Pagado</option>
            <option value="ANULADA" ${c.estadoPago === 'ANULADA' ? 'selected' : ''}>Anulada</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1 font-medium">Notas</label>
          <textarea id="ce-notas" rows="2" class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500">${esc(c.notas || '')}</textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Guardar Cambios</button>
          <button type="button" onclick="closeModal()" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
        </div>
        <p id="ce-error" class="text-red-400 text-sm text-center hidden"></p>
      </form>
    `;

    document.getElementById('compra-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('ce-error');
      try {
        await api(`/finance/compras/${compraId}`, {
          method: 'PATCH',
          body: {
            numeroFactura: document.getElementById('ce-numero')?.value?.trim(),
            proveedorNombre: document.getElementById('ce-proveedor')?.value?.trim(),
            estadoPago: document.getElementById('ce-estado')?.value,
            notas: document.getElementById('ce-notas')?.value?.trim() || undefined,
          },
        });
        closeModal();
        fetchCompras(_comprasTab === 'todas' ? undefined : _comprasTab);
        if (typeof showToast === 'function') showToast('Compra actualizada', 'success');
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
      }
    });
  } catch (err) {
    dom.modalContent.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(err.message)}</div>`;
  }
}

// ─── Change Status ──────────────────────────────

async function changeCompraStatus(compraId, newStatus) {
  try {
    await api(`/finance/compras/${compraId}`, {
      method: 'PATCH',
      body: { estadoPago: newStatus },
    });
    closeModal();
    fetchCompras(_comprasTab === 'todas' ? undefined : _comprasTab);
    if (typeof showToast === 'function') showToast(`Compra marcada como ${newStatus}`, 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Error: ' + err.message, 'error');
  }
}

// ─── Anular ─────────────────────────────────────

async function anularCompra(compraId) {
  if (!confirm('¿Anular esta compra? Esta acción genera un asiento de reversión contable.')) return;
  try {
    await api(`/finance/compras/${compraId}`, {
      method: 'PATCH',
      body: { estadoPago: 'ANULADA' },
    });
    fetchCompras(_comprasTab === 'todas' ? undefined : _comprasTab);
    if (typeof showToast === 'function') showToast('Compra anulada', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Error: ' + err.message, 'error');
  }
}

// ─── Helper ─────────────────────────────────────

function closeModal() {
  if (dom.modalOverlay) dom.modalOverlay.classList.add('hidden');
}

// ─── Global exports ─────────────────────────────

window.renderCompras = renderCompras;
window.fetchCompras = fetchCompras;
window.showCompraDetail = showCompraDetail;
window.showNewCompraModal = showNewCompraModal;
window.showEditCompraModal = showEditCompraModal;
window.addCompraDetalleRow = addCompraDetalleRow;
window.removeCompraDetalleRow = removeCompraDetalleRow;
window.changeCompraStatus = changeCompraStatus;
window.anularCompra = anularCompra;
