/* ─── Inventario ───────────────────────── */
let invTab = 'repuestos';

function renderInventario(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Gestión de repuestos y herramientas del taller</p>
      <button id="inv-create-btn" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold transition">+ Nuevo</button>
    </div>
    <div class="flex gap-2 mb-4">
      <button class="inv-tab px-4 py-2 rounded-lg text-sm font-medium transition ${invTab === 'repuestos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="repuestos">🔧 Repuestos</button>
      <button class="inv-tab px-4 py-2 rounded-lg text-sm font-medium transition ${invTab === 'herramientas' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="herramientas">🛠️ Herramientas</button>
    </div>
    <div id="inv-content" class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead id="inv-thead"></thead>
          <tbody id="inv-tbody"><tr><td colspan="5" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  switchInventarioTab(invTab);
}

function switchInventarioTab(tab) {
  invTab = tab;
  const thead = document.querySelector('#inv-thead');
  const tbody = document.querySelector('#inv-tbody');
  if (!thead || !tbody) return;

  // Update tab buttons
  document.querySelectorAll('.inv-tab').forEach((b) => {
    b.className = `inv-tab px-4 py-2 rounded-lg text-sm font-medium transition ${b.dataset.tab === tab ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;
  });

  if (tab === 'repuestos') {
    thead.innerHTML = '<tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider"><th class="text-left px-4 py-3">Código</th><th class="text-left px-4 py-3">Nombre</th><th class="text-center px-4 py-3">Stock</th><th class="text-right px-4 py-3">Precio (Gs.)</th><th class="text-right px-4 py-3">Acción</th></tr>';
    fetchRepuestos();
  } else {
    thead.innerHTML = '<tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider"><th class="text-left px-4 py-3">Nombre</th><th class="text-left px-4 py-3">Estado</th><th class="text-left px-4 py-3">Último Control</th><th class="text-right px-4 py-3">Acción</th></tr>';
    fetchHerramientas();
  }
}

async function fetchRepuestos() {
  const tbody = document.querySelector('#inv-tbody');
  if (!tbody) return;
  try {
    const resp = await api('/inventory/repuestos');
    const items = resp.items || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-600">Sin repuestos registrados</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((r) => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 font-mono text-xs text-gray-400">${esc(r.codigo || '—')}</td>
        <td class="px-4 py-3 font-medium">${esc(r.descripcion || '—')}</td>
        <td class="px-4 py-3 text-center"><span class="${(r.stockActual || 0) <= 0 ? 'text-red-400' : 'text-green-400'} font-bold">${r.stockActual ?? 0}</span></td>
        <td class="px-4 py-3 text-right font-mono">${r.precioVenta ? Number(r.precioVenta).toLocaleString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-right">
          <button class="inv-entry-btn text-green-400 hover:text-green-300 text-xs mr-2" data-id="${r.id}">+ Entrada</button>
          <button class="inv-exit-btn text-red-400 hover:text-red-300 text-xs mr-2" data-id="${r.id}">- Salida</button>
          <button class="inv-edit-btn text-blue-400 hover:text-blue-300 text-xs" data-id="${r.id}">Editar</button>
        </td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">📦 Módulo de inventario — Conectando...</td></tr>';
  }
}

async function fetchHerramientas() {
  const tbody = document.querySelector('#inv-tbody');
  if (!tbody) return;
  try {
    const resp = await api('/inventory/herramientas');
    const items = resp.items || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-600">Sin herramientas registradas</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((h) => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 font-medium">${esc(h.nombre || '—')}</td>
        <td class="px-4 py-3"><span class="status-badge ${(h.stockDisponible || 0) > 0 ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300'}">${(h.stockDisponible || 0) > 0 ? 'DISPONIBLE' : 'SIN STOCK'}</span></td>
        <td class="px-4 py-3 text-xs text-gray-500">${h.updatedAt ? new Date(h.updatedAt).toLocaleDateString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-right"></td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">🛠️ Módulo de inventario — Conectando...</td></tr>';
  }
}

/* ─── Inventario — Nuevo Repuesto Modal ─── */
function showNuevoRepuestoModal() {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Nuevo Repuesto</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="repuesto-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Código *</label>
          <input id="rep-codigo" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Código Barras</label>
          <input id="rep-barcode" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
        </div>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descripción *</label>
        <input id="rep-desc" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" required>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Categoría</label>
          <input id="rep-cat" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="Filtros, Frenos...">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Marca</label>
          <input id="rep-brand" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Proveedor</label>
          <input id="rep-prov" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
        </div>
      </div>
      <div class="grid grid-cols-4 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Stock Inicial</label>
          <input id="rep-stock" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" value="0">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Stock Mínimo</label>
          <input id="rep-min" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" value="0">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Precio Costo (Gs.)</label>
          <input id="rep-cost" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Precio Venta (Gs.)</label>
          <input id="rep-price" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm">
        </div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Crear Repuesto</button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
      </div>
      <p id="rep-form-error" class="text-red-400 text-sm text-center hidden"></p>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');
}

async function handleRepuestoFormSubmit(e) {
  e.preventDefault();
  const errEl = document.querySelector('#rep-form-error');
  const codigo = document.querySelector('#rep-codigo')?.value?.trim();
  const descripcion = document.querySelector('#rep-desc')?.value?.trim();
  if (!codigo || !descripcion) {
    if (errEl) { errEl.textContent = 'Completa los campos obligatorios'; errEl.classList.remove('hidden'); }
    return;
  }
  try {
    await api('/inventory/repuestos', {
      method: 'POST',
      body: {
        codigo,
        descripcion,
        codigoBarras: document.querySelector('#rep-barcode')?.value?.trim() || null,
        categoria: document.querySelector('#rep-cat')?.value?.trim() || null,
        marca: document.querySelector('#rep-brand')?.value?.trim() || null,
        proveedor: document.querySelector('#rep-prov')?.value?.trim() || null,
        stockActual: parseInt(document.querySelector('#rep-stock')?.value) || 0,
        stockMinimo: parseInt(document.querySelector('#rep-min')?.value) || 0,
        precioCosto: parseFloat(document.querySelector('#rep-cost')?.value) || null,
        precioVenta: parseFloat(document.querySelector('#rep-price')?.value) || null,
      },
    });
    closeModal();
    fetchRepuestos();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
}

/* ─── Inventario — Entrada/Salida de Stock ─── */
function showStockMovimientoModal(tipo, repuestoId) {
  const esEntrada = tipo === 'entrada';
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">${esEntrada ? 'Entrada de Stock' : 'Salida de Stock'}</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="stock-mov-form" class="space-y-4">
      <input type="hidden" id="mov-repuesto-id" value="${repuestoId}">
      <input type="hidden" id="mov-tipo" value="${tipo}">
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cantidad *</label>
        <input id="mov-cantidad" type="number" min="1" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" required>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Motivo *</label>
        <select id="mov-motivo" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
          ${esEntrada
            ? '<option value="Compra">Compra</option><option value="Devolución">Devolución</option><option value="Ajuste">Ajuste</option><option value="Transferencia">Transferencia</option>'
            : '<option value="Uso en OT">Uso en OT</option><option value="Venta">Venta</option><option value="Ajuste">Ajuste</option><option value="Vencimiento">Vencimiento</option>'}
        </select>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Observaciones</label>
        <textarea id="mov-obs" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" rows="2"></textarea>
      </div>
      ${!esEntrada ? `
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Orden de Trabajo (opcional)</label>
        <input id="mov-ot" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="UUID de la OT">
      </div>` : ''}
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 ${esEntrada ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} rounded-lg text-sm font-semibold transition">${esEntrada ? 'Registrar Entrada' : 'Registrar Salida'}</button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
      </div>
      <p id="mov-form-error" class="text-red-400 text-sm text-center hidden"></p>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');
}

async function handleStockMovFormSubmit(e) {
  e.preventDefault();
  const errEl = document.querySelector('#mov-form-error');
  const repuestoId = document.querySelector('#mov-repuesto-id')?.value;
  const tipo = document.querySelector('#mov-tipo')?.value;
  const cantidad = parseInt(document.querySelector('#mov-cantidad')?.value);
  const motivo = document.querySelector('#mov-motivo')?.value;
  const observaciones = document.querySelector('#mov-obs')?.value?.trim() || null;
  const ordenTrabajoId = document.querySelector('#mov-ot')?.value?.trim() || null;

  if (!cantidad || cantidad <= 0) {
    if (errEl) { errEl.textContent = 'La cantidad debe ser mayor a cero'; errEl.classList.remove('hidden'); return; }
  }
  if (!motivo) {
    if (errEl) { errEl.textContent = 'Selecciona un motivo'; errEl.classList.remove('hidden'); return; }
  }

  try {
    if (tipo === 'entrada') {
      await api(`/inventory/repuestos/${repuestoId}/ingreso`, {
        method: 'POST',
        body: { cantidad, motivo, observaciones },
      });
    } else {
      await api('/inventory/repuestos/salida', {
        method: 'POST',
        body: { repuestoId, cantidad, motivo, observaciones, ordenTrabajoId },
      });
    }
    closeModal();
    fetchRepuestos();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
}
