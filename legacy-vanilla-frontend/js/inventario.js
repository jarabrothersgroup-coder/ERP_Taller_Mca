/* ─── Inventario ───────────────────────── */
let invTab = 'repuestos';

function renderInventario(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Gestión de repuestos y herramientas del taller</p>
      <button id="inv-create-btn" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-xs font-semibold transition-all duration-150 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Nuevo
      </button>
    </div>
    <div class="flex gap-2 mb-4" role="tablist" aria-label="Secciones de inventario">
      <button class="inv-tab px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${invTab === 'repuestos' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="repuestos" role="tab" aria-selected="${invTab === 'repuestos'}">
        <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        Repuestos
      </button>
      <button class="inv-tab px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${invTab === 'herramientas' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="herramientas" role="tab" aria-selected="${invTab === 'herramientas'}">
        <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        Herramientas
      </button>
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
    thead.innerHTML = '<tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider"><th scope="col" class="text-left px-4 py-3 font-semibold">Código</th><th scope="col" class="text-left px-4 py-3 font-semibold">Nombre</th><th scope="col" class="text-center px-4 py-3 font-semibold">Stock</th><th scope="col" class="text-right px-4 py-3 font-semibold">Precio (Gs.)</th><th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th></tr>';
    fetchRepuestos();
  } else {
    thead.innerHTML = '<tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider"><th scope="col" class="text-left px-4 py-3 font-semibold">Nombre</th><th scope="col" class="text-left px-4 py-3 font-semibold">Estado</th><th scope="col" class="text-left px-4 py-3 font-semibold">Último Control</th><th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th></tr>';
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
          <button class="inv-entry-btn text-green-400 hover:text-green-300 text-xs mr-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/30 rounded px-1.5 py-0.5" data-id="${r.id}" aria-label="Registrar entrada de ${esc(r.descripcion || r.codigo)}">+ Entrada</button>
          <button class="inv-exit-btn text-red-400 hover:text-red-300 text-xs mr-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded px-1.5 py-0.5" data-id="${r.id}" aria-label="Registrar salida de ${esc(r.descripcion || r.codigo)}">- Salida</button>
          <button class="inv-edit-btn text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded px-1.5 py-0.5" data-id="${r.id}" aria-label="Editar ${esc(r.descripcion || r.codigo)}">Editar</button>
        </td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">Módulo de inventario — Conectando...</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">Módulo de inventario — Conectando...</td></tr>';
  }
}

/* ─── Inventario — Nuevo Repuesto Modal ─── */
function showNuevoRepuestoModal() {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Nuevo Repuesto</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
    </div>
    <form id="repuesto-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="rep-codigo" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Código *</label>
          <input id="rep-codigo" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" required aria-required="true" aria-label="Código del repuesto">
        </div>
        <div>
          <label for="rep-barcode" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Código Barras</label>
          <input id="rep-barcode" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" aria-label="Código de barras">
        </div>
      </div>
      <div>
        <label for="rep-desc" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Descripción *</label>
        <input id="rep-desc" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" required aria-required="true" aria-label="Descripción del repuesto">
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label for="rep-cat" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Categoría</label>
          <input id="rep-cat" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" placeholder="Filtros, Frenos..." aria-label="Categoría">
        </div>
        <div>
          <label for="rep-brand" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Marca</label>
          <input id="rep-brand" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" aria-label="Marca">
        </div>
        <div>
          <label for="rep-prov" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Proveedor</label>
          <input id="rep-prov" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" aria-label="Proveedor">
        </div>
      </div>
      <div class="grid grid-cols-4 gap-4">
        <div>
          <label for="rep-stock" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Stock Inicial</label>
          <input id="rep-stock" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" value="0" aria-label="Stock inicial">
        </div>
        <div>
          <label for="rep-min" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Stock Mínimo</label>
          <input id="rep-min" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" value="0" aria-label="Stock mínimo">
        </div>
        <div>
          <label for="rep-cost" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Precio Costo (Gs.)</label>
          <input id="rep-cost" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" aria-label="Precio costo">
        </div>
        <div>
          <label for="rep-price" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Precio Venta (Gs.)</label>
          <input id="rep-price" type="number" min="0" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" aria-label="Precio venta">
        </div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" id="rep-submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed">
          <svg class="w-4 h-4 hidden" id="rep-submit-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Crear Repuesto
        </button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gray-500/30">Cancelar</button>
      </div>
      <p id="rep-form-error" class="text-red-400 text-sm text-center hidden" role="alert"></p>
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
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
    </div>
    <form id="stock-mov-form" class="space-y-4">
      <input type="hidden" id="mov-repuesto-id" value="${repuestoId}">
      <input type="hidden" id="mov-tipo" value="${tipo}">
      <div>
        <label for="mov-cantidad" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Cantidad *</label>
        <input id="mov-cantidad" type="number" min="1" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" required aria-required="true" aria-label="Cantidad">
      </div>
      <div>
        <label for="mov-motivo" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Motivo *</label>
        <select id="mov-motivo" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" aria-label="Motivo del movimiento">
          ${esEntrada
            ? '<option value="Compra">Compra</option><option value="Devolución">Devolución</option><option value="Ajuste">Ajuste</option><option value="Transferencia">Transferencia</option>'
            : '<option value="Uso en OT">Uso en OT</option><option value="Venta">Venta</option><option value="Ajuste">Ajuste</option><option value="Vencimiento">Vencimiento</option>'}
        </select>
      </div>
      <div>
        <label for="mov-obs" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Observaciones</label>
        <textarea id="mov-obs" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" rows="2" aria-label="Observaciones"></textarea>
      </div>
      ${!esEntrada ? `
      <div>
        <label for="mov-ot" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Orden de Trabajo (opcional)</label>
        <input id="mov-ot" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" placeholder="UUID de la OT" aria-label="ID de orden de trabajo">
      </div>` : ''}
      <div class="flex gap-3 pt-2">
        <button type="submit" id="mov-submit" class="flex-1 py-2.5 ${esEntrada ? 'bg-green-600 hover:bg-green-500 active:bg-green-700' : 'bg-red-600 hover:bg-red-500 active:bg-red-700'} rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${esEntrada ? 'focus:ring-green-500/40' : 'focus:ring-red-500/40'} disabled:opacity-60 disabled:cursor-not-allowed">
          <svg class="w-4 h-4 hidden" id="mov-submit-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          ${esEntrada ? 'Registrar Entrada' : 'Registrar Salida'}
        </button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gray-500/30">Cancelar</button>
      </div>
      <p id="mov-form-error" class="text-red-400 text-sm text-center hidden" role="alert"></p>
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
