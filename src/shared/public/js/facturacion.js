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
            <th scope="col" class="text-left px-4 py-3 font-semibold">Vehículo</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Cliente</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Total (Gs.)</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Creado</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th>
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
            <th scope="col" class="text-left px-4 py-3 font-semibold">Nº Factura</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Tipo</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Total</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Estado Pago</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Estado SIFEN</th>
            <th scope="col" class="text-left px-4 py-3 font-semibold">Creado</th>
            <th scope="col" class="text-right px-4 py-3 font-semibold">Acción</th>
          </tr></thead>
          <tbody id="facturas-tbody"><tr><td colspan="7" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  fetchOrdenesListas();
  fetchFacturasEmitidas();
  bindFacturacionEvents();
}

function bindFacturacionEvents() {
  // Event delegation for facturar buttons
  document.getElementById('facturar-tbody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn && btn.id === 'facturar-orden-btn') {
      showFacturarModal(btn.dataset.id);
    }
  });
  // Event delegation for invoice detail and print buttons
  document.getElementById('facturas-tbody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn && btn.classList.contains('ver-factura-btn')) {
      showFacturaDetalle(btn.dataset.id);
    } else if (btn && btn.classList.contains('print-invoice-btn')) {
      window.open(`/api/v1/reports/factura/${btn.dataset.id}`, '_blank');
    }
  });
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
        <td class="px-4 py-3 text-right">
          <button id="facturar-orden-btn" data-id="${esc(o.id)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-xs font-medium transition-all duration-150 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40" aria-label="Emitir factura para ${esc(o.vehiculo || o.id)}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Emitir Factura
          </button>
          ${typeof getWhatsAppButtonForOrder === 'function' ? getWhatsAppButtonForOrder({
            id: o.id,
            status: o.status || 'LISTO',
            cliente: o.cliente || '',
            vehiculo: o.vehiculo || '',
            plate: o.plate || '',
            totalCost: o.totalCost,
          }) : ''}
        </td>
      </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-600">Error al cargar órdenes</td></tr>';
  }
}

async function fetchFacturasEmitidas() {
  const tbody = document.querySelector('#facturas-tbody');
  if (!tbody) return;
  try {
    const facturas = await api('/finance/invoices');
    if (!facturas || !facturas.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-600">No hay facturas emitidas</td></tr>';
      return;
    }
    tbody.innerHTML = facturas.map((f) => {
      const estadoPagoColor = f.estadoPago === 'PAGA' ? 'text-green-400' :
                              f.estadoPago === 'PARCIAL' ? 'text-yellow-400' :
                              f.estadoPago === 'ANULADA' ? 'text-red-400' : 'text-gray-400';
      const sifenColor = f.sifenStatus === 'APROBADO_DNIT' ? 'text-green-400' :
                         f.sifenStatus === 'RECHAZADO' ? 'text-red-400' : 'text-yellow-400';
      return `
        <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
          <td class="px-4 py-3 font-mono text-sm">${esc(f.numeroFacturaManual || f.sifenCdc || f.id.slice(0,8) + '...')}</td>
          <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-xs ${f.tipo === 'ELECTRONICA' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700 text-gray-300'}">${f.tipo}</span></td>
          <td class="px-4 py-3 text-right font-mono">₲${Number(f.total || 0).toLocaleString('es-PY')}</td>
          <td class="px-4 py-3"><span class="${estadoPagoColor} text-xs font-medium">${f.estadoPago || 'PENDIENTE'}</span></td>
          <td class="px-4 py-3"><span class="${sifenColor} text-xs">${f.sifenStatus || '—'}</span></td>
          <td class="px-4 py-3 text-gray-500 text-xs">${f.createdAt ? new Date(f.createdAt).toLocaleDateString('es-PY') : '—'}</td>
          <td class="px-4 py-3 text-right">
            <button data-id="${esc(f.id)}" class="ver-factura-btn inline-flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30" aria-label="Ver detalle de factura">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              Ver
            </button>
            <button data-id="${esc(f.id)}" class="print-invoice-btn inline-flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs transition-colors ml-1 focus:outline-none focus:ring-2 focus:ring-green-500/30" aria-label="Descargar PDF de factura">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              PDF
            </button>
          </td>
        </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-600">Error al cargar facturas</td></tr>';
  }
}

async function showFacturaDetalle(facturaId) {
  try {
    const data = await api(`/finance/invoices/${facturaId}`);
    if (!data) return;

    const lineItems = data.lineItems || [];
    const lineItemsHtml = lineItems.length > 0 ? `
      <div class="mt-4">
        <h4 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Ítems de la Factura</h4>
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th scope="col" class="text-left px-3 py-2 font-semibold">#</th>
            <th scope="col" class="text-left px-3 py-2 font-semibold">Tipo</th>
            <th scope="col" class="text-left px-3 py-2 font-semibold">Descripción</th>
            <th scope="col" class="text-right px-3 py-2 font-semibold">Cant.</th>
            <th scope="col" class="text-right px-3 py-2 font-semibold">Precio Unit.</th>
            <th scope="col" class="text-right px-3 py-2 font-semibold">IVA</th>
            <th scope="col" class="text-right px-3 py-2 font-semibold">Subtotal</th>
          </tr></thead>
          <tbody>${lineItems.map(item => `
            <tr class="border-b border-gray-800/30">
              <td class="px-3 py-2 text-gray-500">${item.numeroLinea}</td>
              <td class="px-3 py-2"><span class="px-1.5 py-0.5 rounded text-xs ${item.tipoLinea === 'SERVICIO' ? 'bg-blue-900/50 text-blue-300' : 'bg-green-900/50 text-green-300'}">${item.tipoLinea}</span></td>
              <td class="px-3 py-2">${esc(item.descripcion)}</td>
              <td class="px-3 py-2 text-right">${item.cantidad}</td>
              <td class="px-3 py-2 text-right font-mono">₲${Number(item.precioUnitario || 0).toLocaleString('es-PY')}</td>
              <td class="px-3 py-2 text-right">${item.iva}%</td>
              <td class="px-3 py-2 text-right font-mono">₲${Number(item.subtotal || 0).toLocaleString('es-PY')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="text-sm text-gray-500 mt-4">Sin ítems detallados</p>';

    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">Detalle de Factura</h3>
        <div class="flex items-center gap-2">
          <button id="print-invoice-btn" data-id="${esc(data.id)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/40" aria-label="Imprimir PDF">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            Imprimir PDF
          </button>
          <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
        </div>
      </div>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500">Nº Factura:</span>
            <span class="ml-2 font-mono">${esc(data.numeroFacturaManual || data.sifenCdc || '—')}</span>
          </div>
          <div>
            <span class="text-gray-500">Tipo:</span>
            <span class="ml-2">${data.tipo}</span>
          </div>
          <div>
            <span class="text-gray-500">Total:</span>
            <span class="ml-2 font-mono font-bold">₲${Number(data.total || 0).toLocaleString('es-PY')}</span>
          </div>
          <div>
            <span class="text-gray-500">Estado Pago:</span>
            <span class="ml-2 ${data.estadoPago === 'PAGA' ? 'text-green-400' : data.estadoPago === 'PARCIAL' ? 'text-yellow-400' : 'text-gray-400'}">${data.estadoPago || 'PENDIENTE'}</span>
          </div>
          <div>
            <span class="text-gray-500">Saldo Pendiente:</span>
            <span class="ml-2 font-mono">₲${Number(data.saldoPendiente || 0).toLocaleString('es-PY')}</span>
          </div>
          <div>
            <span class="text-gray-500">Vencimiento:</span>
            <span class="ml-2">${data.fechaVencimiento ? new Date(data.fechaVencimiento).toLocaleDateString('es-PY') : '—'}</span>
          </div>
          <div>
            <span class="text-gray-500">Estado SIFEN:</span>
            <span class="ml-2">${data.sifenStatus || '—'}</span>
          </div>
          <div>
            <span class="text-gray-500">CDC:</span>
            <span class="ml-2 font-mono text-xs">${esc(data.sifenCdc || '—')}</span>
          </div>
        </div>
        ${lineItemsHtml}
      </div>`;
    dom.modalOverlay.classList.remove('hidden');
  } catch (err) {
    showToast('Error al cargar detalle de factura', 'error');
  }
}

function showFacturarModal(ordenId) {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Emitir Factura</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded p-1" aria-label="Cerrar">&times;</button>
    </div>
    <form id="facturar-form" class="space-y-4">
      <input type="hidden" id="facturar-orden-id" value="${esc(ordenId)}">
      <p class="text-sm text-gray-400 mb-2">Seleccioná el tipo de facturación:</p>
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col items-center gap-2 p-4 bg-gray-800/50 border-2 border-gray-700 rounded-xl cursor-pointer hover:border-blue-500 transition-all duration-150 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-900/20 has-[:checked]:shadow-lg has-[:checked]:shadow-blue-500/10">
          <input type="radio" name="facturar-tipo" value="MANUAL" class="accent-blue-500 sr-only" checked>
          <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span class="text-sm font-medium">Manual</span>
          <span class="text-xs text-gray-500 text-center">Factura preimpresa</span>
        </label>
        <label class="flex flex-col items-center gap-2 p-4 bg-gray-800/50 border-2 border-gray-700 rounded-xl cursor-pointer hover:border-blue-500 transition-all duration-150 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-900/20 has-[:checked]:shadow-lg has-[:checked]:shadow-blue-500/10">
          <input type="radio" name="facturar-tipo" value="ELECTRONICA" class="accent-blue-500 sr-only">
          <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span class="text-sm font-medium">Electrónica</span>
          <span class="text-xs text-gray-500 text-center">DTE con firma digital</span>
        </label>
      </div>
      <div id="facturar-manual-field">
        <label for="facturar-num-manual" class="text-xs text-gray-500 uppercase tracking-wider block mb-1.5 font-medium">Nº Factura Preimpresa</label>
        <input id="facturar-num-manual" type="text" placeholder="001-001-0001234" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 transition-all duration-150 hover:border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" aria-label="Número de factura preimpresa">
      </div>
      <button type="submit" id="facturar-submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed">
        <svg class="w-4 h-4 hidden" id="facturar-submit-spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        Emitir Factura
      </button>
      <p id="facturar-msg" class="text-sm text-center hidden" role="alert"></p>
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
