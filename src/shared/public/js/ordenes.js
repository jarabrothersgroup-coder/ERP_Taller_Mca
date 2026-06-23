function renderOrdenes(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Todas las órdenes de trabajo del taller</p>
      <button id="add-orden-btn" class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Nueva Orden
      </button>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden mb-4">
      <div class="p-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
        <select id="filter-status" class="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="Presupuestado">Presupuestado</option>
          <option value="Aprobado">Aprobado</option>
          <option value="En_Proceso">En Proceso</option>
          <option value="Control_Calidad">Control Calidad</option>
          <option value="Listo">Listo</option>
        </select>
        <input id="filter-search" type="text" placeholder="Buscar vehículo / placa..." class="flex-1 min-w-[200px] px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Buscar ordenes">
        <button id="filter-apply" class="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30" aria-label="Aplicar filtros">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          Filtrar
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th scope="col" class="text-left px-4 py-3 font-semibold">Vehículo</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Cliente</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Estado</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Placa</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Creado</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th>
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
          ${typeof getWhatsAppButtonForOrder === 'function' ? getWhatsAppButtonForOrder(o) : ''}
          <button class="view-orden-btn inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded px-1.5 py-0.5" data-id="${esc(o.id)}" aria-label="Ver orden ${esc(o.vehiculo || o.id)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Ver
          </button>
          <button class="print-orden-btn inline-flex items-center gap-1 text-gray-400 hover:text-white text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded px-1.5 py-0.5" data-id="${esc(o.id)}" aria-label="Imprimir orden ${esc(o.vehiculo || o.id)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          </button>
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
        ${typeof getWhatsAppButtonForOrder === 'function' ? getWhatsAppButtonForOrder(o) : ''}
        <button onclick="toggleAiCopilot('${esc(o.id)}')" class="px-2 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 text-xs rounded transition border border-purple-800/30 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-purple-500/30" title="Abrir Copiloto IA Diagnostica" aria-label="Abrir copiloto IA">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          IA
        </button>
        <button class="text-gray-400 hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" onclick="printOT('${esc(o.id)}')" title="Imprimir OT" aria-label="Imprimir orden ${esc(o.id)}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        </button>
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
      ${o.hvAlert ? `<div class="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-center gap-2" role="alert">
        <svg class="w-4 h-4 text-red-400 flex-shrink-0 hv-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        <span class="text-red-300 text-xs font-bold">ALTA TENSIÓN — Lockout ${o.hvLockoutSigned ? 'firmado' : 'pendiente'}</span>
      </div>` : ''}
      ${o.dtcCodes?.length ? `<div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-gray-500 text-xs uppercase tracking-wider mb-2">DTCs</p>
        <div class="flex flex-wrap gap-1">${o.dtcCodes.map((c) => `<span class="px-2 py-0.5 rounded-full bg-red-900/30 text-red-300 text-xs font-mono">${esc(c)}</span>`).join('')}</div>
      </div>` : ''}
      ${o.diagnosis ? `<div class="bg-purple-900/20 border border-purple-800/30 rounded-lg p-3">
        <p class="text-gray-500 text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Diagnóstico IA
        </p>
        <div class="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">${esc(o.diagnosis).replace(/--- Diagnostico IA \(([^)]+)\) ---/g, '<div class="mt-2 pt-2 border-t border-purple-800/30"><span class="text-purple-400 font-bold"><svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Diagnóstico IA ($1)</span></div>')}</div>
      </div>` : ''}
      <div class="bg-gray-800/50 rounded-lg p-3">
        <p class="text-gray-500 text-xs uppercase tracking-wider mb-2">Total</p>
        <p class="text-xl font-bold text-blue-400">${o.totalCost ? 'Gs. ' + esc(o.totalCost) : '—'}</p>
      </div>
      <div class="border-t border-gray-800 pt-3">
        <div class="flex gap-2 mb-3">
          <button class="load-servicios-btn px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-medium transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30" data-id="${esc(o.id)}" aria-label="Ver servicios">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Servicios
          </button>
          <button class="load-repuestos-btn px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-medium transition flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30" data-id="${esc(o.id)}" aria-label="Ver repuestos">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            Repuestos
          </button>
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
  _refreshOrdenModal(ordenId);
}

function _refreshOrdenModal(ordenId) {
  return api(`/workshop/ordenes/${ordenId}`).then(o => {
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
        container.innerHTML = `<table class="w-full text-xs"><thead><tr class="text-gray-500 uppercase tracking-wider"><th scope="col" class="text-left py-1 font-semibold">Servicio</th><th scope="col" class="text-right py-1 font-semibold">Cant.</th><th scope="col" class="text-right py-1 font-semibold">Precio</th><th scope="col" class="text-right py-1 font-semibold">Subtotal</th><th scope="col" class="text-right py-1 font-semibold"></th></tr></thead><tbody>
          ${items.map(i => `<tr><td class="py-1">${esc(i.servicioNombre)}</td><td class="text-right py-1">${i.cantidad}</td><td class="text-right py-1">${esc(i.precioUnitario)}</td><td class="text-right py-1 font-medium">${esc(i.subtotal)}</td>
            <td class="text-right py-1"><button class="del-item-btn text-red-400 hover:text-red-300" data-id="${esc(i.id)}" data-tipo="servicio"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></td></tr>`).join('')}
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
        container.innerHTML = `<table class="w-full text-xs"><thead><tr class="text-gray-500 uppercase tracking-wider"><th scope="col" class="text-left py-1 font-semibold">Repuesto</th><th scope="col" class="text-right py-1 font-semibold">Cant.</th><th scope="col" class="text-right py-1 font-semibold">Precio</th><th scope="col" class="text-right py-1 font-semibold">Subtotal</th><th scope="col" class="text-right py-1 font-semibold"></th></tr></thead><tbody>
          ${items.map(i => `<tr><td class="py-1">${esc(i.repuestoNombre)}${i.codigo ? ' (' + esc(i.codigo) + ')' : ''}</td><td class="text-right py-1">${i.cantidad}</td><td class="text-right py-1">${esc(i.precioUnitario)}</td><td class="text-right py-1 font-medium">${esc(i.subtotal)}</td>
            <td class="text-right py-1"><button class="del-item-btn text-red-400 hover:text-red-300" data-id="${esc(i.id)}" data-tipo="repuesto"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></td></tr>`).join('')}
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
      if (typeof showToast === 'function') showToast(`${tipo} eliminado`, 'success');
    } catch (e) {
      if (typeof showToast === 'function') showToast('Error al eliminar: ' + e.message, 'error');
    }
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
            if (typeof showToast === 'function') showToast('Servicio agregado', 'success');
          } catch (e) { if (typeof showToast === 'function') showToast('Error al agregar servicio: ' + e.message, 'error'); }
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
        if (!nombre || !precio) {
          if (typeof showToast === 'function') showToast('Nombre y precio son requeridos', 'warning');
          return;
        }
        try {
          await api(`/workshop/ordenes/${ordenId}/repuestos`, { method: 'POST', body: {
            repuestoNombre: nombre,
            codigo: document.getElementById('add-rep-codigo')?.value.trim() || undefined,
            cantidad: parseInt(document.getElementById('add-rep-cant')?.value || '1'),
            precioUnitario: precio,
          }});
          document.querySelector('.load-repuestos-btn')?.click();
          if (typeof showToast === 'function') showToast('Repuesto agregado', 'success');
        } catch (e) { if (typeof showToast === 'function') showToast('Error al agregar repuesto: ' + e.message, 'error'); }
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
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
      </div>
      <form id="new-orden-form" class="space-y-4">
        <div>
          <label for="no-cliente" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Cliente</label>
          <select id="no-cliente" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" required aria-required="true">
            <option value="">Seleccionar...</option>
            ${(Array.isArray(clients) ? clients : []).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="no-vehiculo" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Vehículo</label>
          <select id="no-vehiculo" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" required aria-required="true">
            <option value="">Seleccionar...</option>
            ${(Array.isArray(vehicles) ? vehicles : []).map((v) => `<option value="${esc(v.id)}">${esc(v.brand)} ${esc(v.model)} [${esc(v.plate || '—')}]</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="no-desc" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Descripción del Trabajo</label>
          <textarea id="no-desc" rows="3" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" placeholder="Describir el trabajo a realizar..." required aria-required="true"></textarea>
        </div>
        <div class="flex items-center gap-2">
          <input id="no-hv" type="checkbox" class="w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 accent-red-500 focus:ring-2 focus:ring-red-500/30 focus:outline-none">
          <label for="no-hv" class="text-sm text-gray-300 cursor-pointer select-none">Vehículo de Alta Tensión (HEV/BEV)</label>
        </div>
        <button type="submit" id="new-orden-submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed">
          <svg class="w-4 h-4 hidden" id="new-orden-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Crear Orden
        </button>
      </form>`;
    dom.modalOverlay.classList.remove('hidden');
  });
}

/* ─── Refresh OT modal (called by AI Copilot after applying diagnosis) ── */

function refreshOrdenModal(ordenId) {
  return _refreshOrdenModal(ordenId);
}

