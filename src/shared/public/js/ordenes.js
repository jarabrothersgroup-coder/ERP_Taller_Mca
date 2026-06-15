function renderOrdenes(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Todas las órdenes de trabajo del taller</p>
      <button id="add-orden-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nueva Orden</button>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden mb-4">
      <div class="p-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
        <select id="filter-status" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="">Todos los estados</option>
          <option value="Presupuestado">Presupuestado</option>
          <option value="Aprobado">Aprobado</option>
          <option value="En_Proceso">En Proceso</option>
          <option value="Control_Calidad">Control Calidad</option>
          <option value="Listo">Listo</option>
        </select>
        <input id="filter-search" type="text" placeholder="Buscar vehículo / placa..." class="flex-1 min-w-[200px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500">
        <button id="filter-apply" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Filtrar</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Vehículo</th>
            <th class="text-left px-4 py-3">Cliente</th>
            <th class="text-left px-4 py-3">Estado</th>
            <th class="text-left px-4 py-3">Placa</th>
            <th class="text-left px-4 py-3">Creado</th>
            <th class="text-right px-4 py-3">Acción</th>
          </tr></thead>
          <tbody id="ordenes-tbody"><tr><td colspan="6" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="text-xs text-gray-600" id="ordenes-count"></div>`;
  fetchOrdenes();
}

async function fetchOrdenes(status = '') {
  const tbody = document.querySelector('#ordenes-tbody');
  const countEl = document.querySelector('#ordenes-count');
  if (!tbody) return;
  try {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    const ordenes = await api(`/workshop/ordenes${params}`);
    if (!ordenes || !ordenes.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-600">Sin órdenes registradas</td></tr>';
      if (countEl) countEl.textContent = '';
      return;
    }
    tbody.innerHTML = ordenes.map(o => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition cursor-pointer" data-id="${esc(o.id)}">
        <td class="px-4 py-3 font-medium">${esc(o.vehiculo || '—')}</td>
        <td class="px-4 py-3 text-gray-400">${esc(o.cliente || '—')}</td>
        <td class="px-4 py-3"><span class="status-badge ${statusBadge(o.status)}">${o.status?.replace(/_/g, ' ') || '—'}</span></td>
        <td class="px-4 py-3 text-gray-400 font-mono text-xs">${esc(o.plate || '—')}</td>
        <td class="px-4 py-3 text-gray-500 text-xs">${o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-PY') : '—'}</td>
        <td class="px-4 py-3 text-right">
          <button class="view-orden-btn text-blue-400 hover:text-blue-300 text-xs mr-2" data-id="${esc(o.id)}">Ver</button>
          <button class="print-orden-btn text-gray-400 hover:text-white text-xs" data-id="${esc(o.id)}" title="Imprimir OT">🖨️</button>
        </td>
      </tr>`).join('');
    if (countEl) countEl.textContent = `${ordenes.length} orden(es) encontrada(s)`;
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-600">Error al cargar órdenes</td></tr>';
  }
}

/* ─── UI-001b: Orden Detail Modal (Live via WS) ── */
function renderOrdenModalBody(o) {
  return `
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-bold">Orden #${esc(o.id)}</h3>
        ${state.wsConnected ? '<span class="ws-dot bg-green-500" title="Tiempo real"></span>' : ''}
      </div>
      <div class="flex items-center gap-2">
        <button class="text-gray-400 hover:text-white text-sm" onclick="printOT('${esc(o.id)}')" title="Imprimir OT">🖨️</button>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
    </div>
    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Vehículo</p>
          <p class="font-medium mt-1">${esc(o.vehiculo || '—')}</p>
          <p class="text-xs text-gray-500">${esc(o.plate || '')}</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3">
          <p class="text-gray-500 text-xs uppercase tracking-wider">Cliente</p>
          <p class="font-medium mt-1">${esc(o.cliente || '—')}</p>
        </div>
      </div>
      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Descripción</p>
        <p class="mt-1">${esc(o.description || 'Sin descripción')}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-500 text-xs uppercase tracking-wider">Estado:</span>
        <span class="status-badge ${statusBadge(o.status)}">${o.status?.replace(/_/g, ' ') || '—'}</span>
      </div>
      ${o.hvAlert ? `<div class="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-center gap-2">
        <span class="hv-pulse">⚡</span><span class="text-red-300 text-xs font-bold">ALTA TENSIÓN — Lockout ${o.hvLockoutSigned ? 'firmado' : 'pendiente'}</span>
      </div>` : ''}
      ${o.dtcCodes?.length ? `<div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-gray-500 text-xs uppercase tracking-wider mb-2">DTCs</p>
        <div class="flex flex-wrap gap-1">${o.dtcCodes.map((c) => `<span class="px-2 py-0.5 rounded-full bg-red-900/30 text-red-300 text-xs font-mono">${esc(c)}</span>`).join('')}</div>
      </div>` : ''}
      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-gray-500 text-xs uppercase tracking-wider mb-2">Total</p>
        <p class="text-xl font-bold text-blue-400">${o.totalCost ? 'Gs. ' + esc(o.totalCost) : '—'}</p>
      </div>
      <div class="border-t border-gray-800 pt-3">
        <div class="flex gap-2 mb-3">
          <button class="load-servicios-btn px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-medium transition flex items-center gap-1" data-id="${esc(o.id)}">🛠️ Servicios</button>
          <button class="load-repuestos-btn px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-medium transition flex items-center gap-1" data-id="${esc(o.id)}">🔩 Repuestos</button>
        </div>
        <div id="orden-items-container" class="text-xs text-gray-400">Presione un botón para ver los items</div>
      </div>
      <div class="text-xs text-gray-600 pt-2 border-t border-gray-800" id="modal-timestamps">
        Creado: ${o.createdAt ? new Date(o.createdAt).toLocaleString('es-PY') : '—'} | 
        Actualizado: ${o.updatedAt ? new Date(o.updatedAt).toLocaleString('es-PY') : '—'}
      </div>
      <button id="modal-close-bottom" class="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm mt-2 transition">Cerrar</button>
    </div>`;
}

function showOrdenModal(ordenId) {
  dom.modalContent.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando detalle...</div>';
  dom.modalOverlay.classList.remove('hidden');
  state.subscribedOrderId = ordenId;
  api(`/workshop/ordenes/${ordenId}`).then(o => {
    dom.modalContent.innerHTML = renderOrdenModalBody(o);
    // Bind service/part loaders
    document.querySelector('.load-servicios-btn')?.addEventListener('click', async () => {
      const container = document.getElementById('orden-items-container');
      if (!container) return;
      container.innerHTML = 'Cargando servicios...';
      try {
        const items = await api(`/workshop/ordenes/${ordenId}/servicios`);
        if (!items || !items.length) {
          container.innerHTML = '<span class="text-gray-500">Sin servicios asignados.</span> ' +
            `<button class="add-item-btn text-blue-400 hover:text-blue-300" data-tipo="servicio">+ Agregar servicio</button>`;
          return;
        }
        container.innerHTML = `<table class="w-full text-xs"><thead><tr class="text-gray-500 uppercase tracking-wider"><th class="text-left py-1">Servicio</th><th class="text-right py-1">Cant.</th><th class="text-right py-1">Precio</th><th class="text-right py-1">Subtotal</th><th class="text-right py-1"></th></tr></thead><tbody>
          ${items.map(i => `<tr><td class="py-1">${esc(i.servicioNombre)}</td><td class="text-right py-1">${i.cantidad}</td><td class="text-right py-1">${esc(i.precioUnitario)}</td><td class="text-right py-1 font-medium">${esc(i.subtotal)}</td>
            <td class="text-right py-1"><button class="del-item-btn text-red-400 hover:text-red-300" data-id="${esc(i.id)}" data-tipo="servicio">✕</button></td></tr>`).join('')}
          </tbody></table>
          <button class="add-item-btn text-blue-400 hover:text-blue-300 text-xs mt-2" data-tipo="servicio">+ Agregar servicio</button>`;
        bindItemEvents(ordenId);
      } catch { container.innerHTML = '<span class="text-red-400">Error al cargar servicios</span>'; }
    });
    document.querySelector('.load-repuestos-btn')?.addEventListener('click', async () => {
      const container = document.getElementById('orden-items-container');
      if (!container) return;
      container.innerHTML = 'Cargando repuestos...';
      try {
        const items = await api(`/workshop/ordenes/${ordenId}/repuestos`);
        if (!items || !items.length) {
          container.innerHTML = '<span class="text-gray-500">Sin repuestos asignados.</span> ' +
            `<button class="add-item-btn text-blue-400 hover:text-blue-300" data-tipo="repuesto">+ Agregar repuesto</button>`;
          return;
        }
        container.innerHTML = `<table class="w-full text-xs"><thead><tr class="text-gray-500 uppercase tracking-wider"><th class="text-left py-1">Repuesto</th><th class="text-right py-1">Cant.</th><th class="text-right py-1">Precio</th><th class="text-right py-1">Subtotal</th><th class="text-right py-1"></th></tr></thead><tbody>
          ${items.map(i => `<tr><td class="py-1">${esc(i.repuestoNombre)}${i.codigo ? ' (' + esc(i.codigo) + ')' : ''}</td><td class="text-right py-1">${i.cantidad}</td><td class="text-right py-1">${esc(i.precioUnitario)}</td><td class="text-right py-1 font-medium">${esc(i.subtotal)}</td>
            <td class="text-right py-1"><button class="del-item-btn text-red-400 hover:text-red-300" data-id="${esc(i.id)}" data-tipo="repuesto">✕</button></td></tr>`).join('')}
          </tbody></table>
          <button class="add-item-btn text-blue-400 hover:text-blue-300 text-xs mt-2" data-tipo="repuesto">+ Agregar repuesto</button>`;
        bindItemEvents(ordenId);
      } catch { container.innerHTML = '<span class="text-red-400">Error al cargar repuestos</span>'; }
    });
  }).catch(() => {
    dom.modalContent.innerHTML = '<div class="text-center py-8 text-red-400">Error al cargar la orden</div>';
  });
}

function bindItemEvents(ordenId) {
  // Delete items
  document.querySelectorAll('.del-item-btn').forEach(b => b.addEventListener('click', async () => {
    const tipo = b.dataset.tipo; // 'servicio' or 'repuesto'
    const itemId = b.dataset.id;
    if (!confirm(`¿Eliminar este ${tipo}?`)) return;
    try {
      await api(`/workshop/ordenes/${ordenId}/${tipo}s/${itemId}`, { method: 'DELETE' });
      // Re-trigger the current view
      document.querySelector(`.load-${tipo}s-btn`)?.click();
    } catch (e) { alert(e.message); }
  }));
  // Add items
  document.querySelectorAll('.add-item-btn').forEach(b => b.addEventListener('click', async () => {
    const tipo = b.dataset.tipo;
    if (tipo === 'servicio') {
      // Fetch catalog services and show a picker
      try {
        const servicios = await api('/workshop/servicios?activo=true');
        dom.modalContent.querySelector('#orden-items-container').innerHTML = `
          <div class="space-y-2">
            <select id="add-servicio-select" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="">Seleccionar servicio...</option>
              ${(servicios || []).map(s => `<option value="${esc(s.id)}" data-nombre="${esc(s.nombre)}" data-precio="${s.precioEstimado || '0'}">${esc(s.nombre)} ${s.precioEstimado ? '- Gs. ' + esc(s.precioEstimado) : ''}</option>`).join('')}
            </select>
            <div class="flex gap-2">
              <input id="add-servicio-cant" type="number" value="1" min="1" class="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <button id="add-servicio-confirm" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium">Agregar</button>
              <button id="add-servicio-cancel" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium">Cancelar</button>
            </div>
          </div>`;
        document.getElementById('add-servicio-confirm')?.addEventListener('click', async () => {
          const sel = document.getElementById('add-servicio-select');
          const cant = parseInt(document.getElementById('add-servicio-cant')?.value || '1');
          if (!sel?.value) return;
          try {
            await api(`/workshop/ordenes/${ordenId}/servicios`, { method: 'POST', body: { servicioId: sel.value, cantidad: cant } });
            document.querySelector('.load-servicios-btn')?.click();
          } catch (e) { alert(e.message); }
        });
        document.getElementById('add-servicio-cancel')?.addEventListener('click', () => {
          document.querySelector('.load-servicios-btn')?.click();
        });
      } catch { }
    } else if (tipo === 'repuesto') {
      // Show simple form for manual part entry
      dom.modalContent.querySelector('#orden-items-container').innerHTML = `
        <div class="space-y-2">
          <input id="add-rep-nombre" type="text" placeholder="Nombre del repuesto *" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <div class="flex gap-2">
            <input id="add-rep-codigo" type="text" placeholder="Código (opcional)" class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <input id="add-rep-cant" type="number" value="1" min="1" class="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          </div>
          <input id="add-rep-precio" type="number" step="0.01" placeholder="Precio unitario *" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <div class="flex gap-2">
            <button id="add-rep-confirm" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium">Agregar</button>
            <button id="add-rep-cancel" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium">Cancelar</button>
          </div>
        </div>`;
      document.getElementById('add-rep-confirm')?.addEventListener('click', async () => {
        const nombre = document.getElementById('add-rep-nombre')?.value.trim();
        const precio = parseFloat(document.getElementById('add-rep-precio')?.value || '0');
        if (!nombre || !precio) { alert('Nombre y precio son requeridos'); return; }
        try {
          await api(`/workshop/ordenes/${ordenId}/repuestos`, { method: 'POST', body: {
            repuestoNombre: nombre,
            codigo: document.getElementById('add-rep-codigo')?.value.trim() || undefined,
            cantidad: parseInt(document.getElementById('add-rep-cant')?.value || '1'),
            precioUnitario: precio,
          }});
          document.querySelector('.load-repuestos-btn')?.click();
        } catch (e) { alert(e.message); }
      });
      document.getElementById('add-rep-cancel')?.addEventListener('click', () => {
        document.querySelector('.load-repuestos-btn')?.click();
      });
    }
  }));
}

/* ─── UI-001c: Nueva Orden Modal ─────────── */
function showNewOrdenModal() {
  // Load clients and vehicles for the form selects
  Promise.all([
    api('/workshop/clientes').catch(() => []),
    api('/workshop/vehiculos').catch(() => []),
  ]).then(([clients, vehicles]) => {
    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">Nueva Orden de Trabajo</h3>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <form id="new-orden-form" class="space-y-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cliente</label>
          <select id="no-cliente" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required>
            <option value="">Seleccionar...</option>
            ${(Array.isArray(clients) ? clients : []).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Vehículo</label>
          <select id="no-vehiculo" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" required>
            <option value="">Seleccionar...</option>
            ${(Array.isArray(vehicles) ? vehicles : []).map((v) => `<option value="${esc(v.id)}">${esc(v.brand)} ${esc(v.model)} [${esc(v.plate || '—')}]</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descripción del Trabajo</label>
          <textarea id="no-desc" rows="3" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" placeholder="Describir el trabajo a realizar..." required></textarea>
        </div>
        <div class="flex items-center gap-2">
          <input id="no-hv" type="checkbox" class="accent-red-500">
          <label for="no-hv" class="text-sm text-gray-300">Vehículo de Alta Tensión (HEV/BEV)</label>
        </div>
        <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Crear Orden</button>
      </form>`;
    dom.modalOverlay.classList.remove('hidden');
  });
}

