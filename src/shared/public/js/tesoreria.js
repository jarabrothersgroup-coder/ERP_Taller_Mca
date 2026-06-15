// ═════════════════════════════════════════════════
//  TESORERÍA (Sprint 7)
// ═════════════════════════════════════════════════

const TESORERIA_TABS = {
  cuentas: 'Cuentas Bancarias',
  movimientos: 'Movimientos',
  conciliacion: 'Conciliación',
  cxc: 'CxC',
  cxp: 'CxP',
  flujo: 'Flujo de Caja',
};

function renderTesorería(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Gestión de tesorería, cuentas por cobrar/pagar y flujo de caja</p>
    </div>
    <div class="flex flex-wrap gap-1 mb-6 border-b border-gray-800">
      ${Object.entries(TESORERIA_TABS).map(([key, label]) => `
        <button class="tes-tab px-4 py-2.5 text-sm font-medium rounded-t-lg transition
          ${key === 'cuentas' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}"
          data-tes-tab="${key}">${label}</button>
      `).join('')}
    </div>
    <div id="tes-content" class="space-y-4"></div>`;
  showTesTab('cuentas');
}

function showTesTab(tab) {
  document.querySelectorAll('.tes-tab').forEach(btn => {
    const isActive = btn.dataset.tesTab === tab;
    btn.className = `tes-tab px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
      isActive
        ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500'
        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
    }`;
  });
  const content = document.querySelector('#tes-content');
  if (!content) return;
  content.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando...</div>';
  if (tab === 'cuentas') renderTesCuentas(content);
  else if (tab === 'movimientos') renderTesMovimientos(content);
  else if (tab === 'conciliacion') renderTesConciliacion(content);
  else if (tab === 'cxc') renderTesCxc(content);
  else if (tab === 'cxp') renderTesCxp(content);
  else if (tab === 'flujo') renderTesFlujo(content);
}

// ─── Cuentas Bancarias ──────────────────────

async function renderTesCuentas(container) {
  try {
    const cuentas = await api('/finance/treasury/cuentas');
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-400">Cuentas bancarias, cajas y billeteras digitales</p>
        <button id="btn-nueva-cuenta-bancaria" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nueva Cuenta</button>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Código</th>
              <th class="text-left px-4 py-3">Nombre</th>
              <th class="text-left px-4 py-3">Tipo</th>
              <th class="text-left px-4 py-3">Banco</th>
              <th class="text-right px-4 py-3">Saldo Actual</th>
              <th class="text-center px-4 py-3">Estado</th>
            </tr></thead>
            <tbody>${cuentas.map(c => {
              const tipoBadge = {
                CAJA_FISICA: 'bg-green-900/50 text-green-300',
                CTA_CTE: 'bg-blue-900/50 text-blue-300',
                CAJA_AHORRO: 'bg-purple-900/50 text-purple-300',
                BILLETERA_DIGITAL: 'bg-cyan-900/50 text-cyan-300',
              }[c.tipo] || 'bg-gray-700 text-gray-300';
              return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td class="px-4 py-2.5 font-mono text-xs text-gray-400">${esc(c.codigo)}</td>
                <td class="px-4 py-2.5 font-medium">${esc(c.nombre)}</td>
                <td class="px-4 py-2.5"><span class="status-badge ${tipoBadge}">${c.tipo}</span></td>
                <td class="px-4 py-2.5 text-gray-400">${esc(c.banco || '—')}</td>
                <td class="px-4 py-2.5 text-right font-mono font-semibold ${Number(c.saldoActual) >= 0 ? 'text-green-400' : 'text-red-400'}">₲ ${Number(c.saldoActual).toLocaleString('es-PY')}</td>
                <td class="px-4 py-2.5 text-center">${c.activo !== false ? '<span class="text-green-500 text-xs">Activa</span>' : '<span class="text-gray-600 text-xs">Inactiva</span>'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    document.querySelector('#btn-nueva-cuenta-bancaria')?.addEventListener('click', showModalNuevaCuentaBancaria);
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function showModalNuevaCuentaBancaria() {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Nueva Cuenta Bancaria</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="cuenta-bancaria-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Código</label>
          <input id="cb-codigo" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="CAJA-001" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Tipo</label>
          <select id="cb-tipo" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
            <option value="CAJA_FISICA">Caja Física</option>
            <option value="CTA_CTE">Cuenta Corriente</option>
            <option value="CAJA_AHORRO">Caja de Ahorro</option>
            <option value="BILLETERA_DIGITAL">Billetera Digital</option>
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre</label>
        <input id="cb-nombre" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="Banco Continental — Cta. Cte." required>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Banco</label>
          <input id="cb-banco" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="Banco Continental">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">N° Cuenta</label>
          <input id="cb-numero" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="123456789/1">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Moneda</label>
          <select id="cb-moneda" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
            <option value="PYG">PYG — Guaraníes</option>
            <option value="USD">USD — Dólares</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Saldo Inicial</label>
          <input id="cb-saldo" type="number" step="1" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="0">
        </div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Crear Cuenta</button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
      </div>
      <p id="cb-error" class="text-red-400 text-sm text-center hidden"></p>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');
  document.querySelector('#cuenta-bancaria-form')?.addEventListener('submit', handleNuevaCuentaBancaria);
}

async function handleNuevaCuentaBancaria(e) {
  e.preventDefault();
  const errEl = document.querySelector('#cb-error');
  try {
    await api('/finance/treasury/cuentas', {
      method: 'POST',
      body: {
        codigo: document.querySelector('#cb-codigo')?.value?.trim(),
        nombre: document.querySelector('#cb-nombre')?.value?.trim(),
        tipo: document.querySelector('#cb-tipo')?.value,
        banco: document.querySelector('#cb-banco')?.value?.trim() || null,
        numeroCuenta: document.querySelector('#cb-numero')?.value?.trim() || null,
        moneda: document.querySelector('#cb-moneda')?.value,
        saldoInicial: document.querySelector('#cb-saldo')?.value || '0',
      },
    });
    closeModal();
    showTesTab('cuentas');
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  }
}

// ─── Movimientos ────────────────────────────

async function renderTesMovimientos(container) {
  try {
    const [cuentas, movs] = await Promise.all([
      api('/finance/treasury/cuentas?soloActivas=true'),
      api('/finance/treasury/movimientos?limit=100'),
    ]);
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-400">Registro de ingresos, egresos y transferencias</p>
        <button id="btn-nuevo-movimiento" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nuevo Movimiento</button>
      </div>
      <div class="flex flex-wrap gap-3 mb-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Cuenta</label>
          <select id="filter-mov-cuenta" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="">Todas</option>
            ${cuentas.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Tipo</label>
          <select id="filter-mov-tipo" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="">Todos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="EGRESO">Egresos</option>
            <option value="TRANSFERENCIA">Transferencias</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Desde</label>
          <input id="filter-mov-desde" type="date" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Hasta</label>
          <input id="filter-mov-hasta" type="date" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
        </div>
        <div class="flex items-end">
          <button id="btn-filtrar-mov" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">Filtrar</button>
        </div>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Fecha</th>
              <th class="text-left px-4 py-3">Tipo</th>
              <th class="text-left px-4 py-3">Medio</th>
              <th class="text-left px-4 py-3">Concepto</th>
              <th class="text-right px-4 py-3">Monto</th>
              <th class="text-left px-4 py-3">Cuenta</th>
              <th class="text-center px-4 py-3">Conciliado</th>
            </tr></thead>
            <tbody>${movs.map(m => {
              const esIngreso = m.tipo === 'INGRESO' || m.tipo === 'TRANSFERENCIA';
              return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td class="px-4 py-2.5 text-xs text-gray-400">${new Date(m.fecha).toLocaleDateString('es-PY')}</td>
                <td class="px-4 py-2.5"><span class="status-badge ${esIngreso ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}">${m.tipo}</span></td>
                <td class="px-4 py-2.5 text-gray-400 text-xs">${m.medioPago}</td>
                <td class="px-4 py-2.5">${esc(m.concepto)}</td>
                <td class="px-4 py-2.5 text-right font-mono ${esIngreso ? 'text-green-400' : 'text-red-400'}">${esIngreso ? '+' : '-'}₲ ${Number(m.monto).toLocaleString('es-PY')}</td>
                <td class="px-4 py-2.5 text-xs text-gray-400">${cuentas.find(c => c.id === m.cuentaId)?.codigo || '—'}</td>
                <td class="px-4 py-2.5 text-center">${m.conciliado ? '<span class="text-green-500">✓</span>' : '<span class="text-gray-600">✕</span>'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    document.querySelector('#btn-nuevo-movimiento')?.addEventListener('click', () => showModalNuevoMovimiento(cuentas));
    document.querySelector('#btn-filtrar-mov')?.addEventListener('click', () => filtrarMovimientos(cuentas));
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

async function filtrarMovimientos(cuentas) {
  const cuentaId = document.querySelector('#filter-mov-cuenta')?.value;
  const tipo = document.querySelector('#filter-mov-tipo')?.value;
  const desde = document.querySelector('#filter-mov-desde')?.value;
  const hasta = document.querySelector('#filter-mov-hasta')?.value;
  const params = new URLSearchParams({ limit: '100' });
  if (cuentaId) params.set('cuentaId', cuentaId);
  if (tipo) params.set('tipo', tipo);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  const content = document.querySelector('#tes-content');
  if (!content) return;
  content.innerHTML = '<div class="text-center py-8 text-gray-500">Filtrando...</div>';
  try {
    const movs = await api(`/finance/treasury/movimientos?${params}`);
    renderTesMovimientosTable(content, movs, cuentas);
  } catch (e) {
    content.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderTesMovimientosTable(container, movs, cuentas) {
  container.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Fecha</th>
            <th class="text-left px-4 py-3">Tipo</th>
            <th class="text-left px-4 py-3">Medio</th>
            <th class="text-left px-4 py-3">Concepto</th>
            <th class="text-right px-4 py-3">Monto</th>
            <th class="text-left px-4 py-3">Cuenta</th>
            <th class="text-center px-4 py-3">Conciliado</th>
          </tr></thead>
          <tbody>${movs.length === 0 ? '<tr><td colspan="7" class="text-center py-8 text-gray-600">No hay movimientos</td></tr>' : movs.map(m => {
            const esIngreso = m.tipo === 'INGRESO' || m.tipo === 'TRANSFERENCIA';
            return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
              <td class="px-4 py-2.5 text-xs text-gray-400">${new Date(m.fecha).toLocaleDateString('es-PY')}</td>
              <td class="px-4 py-2.5"><span class="status-badge ${esIngreso ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}">${m.tipo}</span></td>
              <td class="px-4 py-2.5 text-gray-400 text-xs">${m.medioPago}</td>
              <td class="px-4 py-2.5">${esc(m.concepto)}</td>
              <td class="px-4 py-2.5 text-right font-mono ${esIngreso ? 'text-green-400' : 'text-red-400'}">${esIngreso ? '+' : '-'}₲ ${Number(m.monto).toLocaleString('es-PY')}</td>
              <td class="px-4 py-2.5 text-xs text-gray-400">${cuentas.find(c => c.id === m.cuentaId)?.codigo || '—'}</td>
              <td class="px-4 py-2.5 text-center">${m.conciliado ? '<span class="text-green-500">✓</span>' : '<span class="text-gray-600">✕</span>'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function showModalNuevoMovimiento(cuentas) {
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Nuevo Movimiento</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="movimiento-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Tipo</label>
          <select id="mov-tipo" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Medio de Pago</label>
          <select id="mov-medio" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CHEQUE">Cheque</option>
            <option value="TARJETA_DEBITO">Tarjeta Débito</option>
            <option value="TARJETA_CREDITO">Tarjeta Crédito</option>
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cuenta</label>
        <select id="mov-cuenta" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
          ${cuentas.map(c => `<option value="${c.id}">${esc(c.codigo)} — ${esc(c.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Monto (₲)</label>
          <input id="mov-monto" type="number" step="1" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Fecha</label>
          <input id="mov-fecha" type="date" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm" value="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Concepto</label>
        <input id="mov-concepto" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" placeholder="Descripción del movimiento" required>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Registrar</button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
      </div>
      <p id="mov-error" class="text-red-400 text-sm text-center hidden"></p>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');
  document.querySelector('#movimiento-form')?.addEventListener('submit', handleNuevoMovimiento);
}

async function handleNuevoMovimiento(e) {
  e.preventDefault();
  const errEl = document.querySelector('#mov-error');
  try {
    await api('/finance/treasury/movimientos', {
      method: 'POST',
      body: {
        tipo: document.querySelector('#mov-tipo')?.value,
        medioPago: document.querySelector('#mov-medio')?.value,
        cuentaId: document.querySelector('#mov-cuenta')?.value,
        monto: document.querySelector('#mov-monto')?.value,
        fecha: new Date(document.querySelector('#mov-fecha')?.value).toISOString(),
        concepto: document.querySelector('#mov-concepto')?.value?.trim(),
      },
    });
    closeModal();
    showTesTab('movimientos');
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  }
}

// ─── Conciliación ───────────────────────────

async function renderTesConciliacion(container) {
  try {
    const cuentas = await api('/finance/treasury/cuentas?soloActivas=true');
    container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-400">Conciliación bancaria mensual</p>
        <button id="btn-iniciar-conciliacion" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Iniciar Conciliación</button>
      </div>
      <div class="mb-4">
        <label class="text-xs text-gray-500 block mb-1">Seleccionar Cuenta</label>
        <select id="conc-cuenta-select" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
          <option value="">— Seleccionar —</option>
          ${cuentas.map(c => `<option value="${c.id}">${esc(c.codigo)} — ${esc(c.nombre)}</option>`).join('')}
        </select>
      </div>
      <div id="conc-listado">
        <div class="text-center py-8 text-gray-600">Seleccioná una cuenta para ver sus conciliaciones</div>
      </div>`;
    document.querySelector('#btn-iniciar-conciliacion')?.addEventListener('click', showModalIniciarConciliacion);
    document.querySelector('#conc-cuenta-select')?.addEventListener('change', async (ev) => {
      const cuentaId = ev.target.value;
      if (!cuentaId) return;
      const listado = document.querySelector('#conc-listado');
      if (!listado) return;
      listado.innerHTML = '<div class="text-center py-8 text-gray-500">Cargando...</div>';
      try {
        const concs = await api(`/finance/treasury/conciliacion/${cuentaId}`);
        listado.innerHTML = concs.length === 0
          ? '<div class="text-center py-8 text-gray-600">No hay conciliaciones para esta cuenta</div>'
          : `<div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                  <th class="text-left px-4 py-3">Período</th>
                  <th class="text-right px-4 py-3">Saldo Libros</th>
                  <th class="text-right px-4 py-3">Saldo Banco</th>
                  <th class="text-right px-4 py-3">Diferencia</th>
                  <th class="text-center px-4 py-3">Estado</th>
                </tr></thead>
                <tbody>${concs.map(c => `
                  <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td class="px-4 py-2.5 font-mono text-xs text-gray-400">${esc(c.periodo)}</td>
                    <td class="px-4 py-2.5 text-right font-mono">₲ ${Number(c.saldoLibros).toLocaleString('es-PY')}</td>
                    <td class="px-4 py-2.5 text-right font-mono">₲ ${Number(c.saldoBanco).toLocaleString('es-PY')}</td>
                    <td class="px-4 py-2.5 text-right font-mono ${Number(c.diferencia) === 0 ? 'text-green-400' : 'text-yellow-400'}">₲ ${Number(c.diferencia).toLocaleString('es-PY')}</td>
                    <td class="px-4 py-2.5 text-center">${c.conciliado ? '<span class="status-badge bg-green-900/50 text-green-300">Conciliado</span>' : '<span class="status-badge bg-yellow-900/50 text-yellow-300">Pendiente</span>'}</td>
                  </tr>`).join('')}</tbody>
              </table>
            </div>
          </div>`;
      } catch (e) {
        listado.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
      }
    });
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

async function showModalIniciarConciliacion() {
  const cuentas = await api('/finance/treasury/cuentas?soloActivas=true');
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">Iniciar Conciliación</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="conciliacion-form" class="space-y-4">
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cuenta</label>
        <select id="conc-cuenta" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm">
          ${cuentas.map(c => `<option value="${c.id}">${esc(c.codigo)} — ${esc(c.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Período</label>
          <input id="conc-periodo" type="month" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-sm" required>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Saldo según Banco</label>
          <input id="conc-saldo-banco" type="number" step="1" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" required>
        </div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Iniciar</button>
        <button type="button" id="modal-cancel" class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition">Cancelar</button>
      </div>
      <p id="conc-error" class="text-red-400 text-sm text-center hidden"></p>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');
  document.querySelector('#conciliacion-form')?.addEventListener('submit', handleIniciarConciliacion);
}

async function handleIniciarConciliacion(e) {
  e.preventDefault();
  const errEl = document.querySelector('#conc-error');
  try {
    const periodo = document.querySelector('#conc-periodo')?.value;
    await api('/finance/treasury/conciliacion', {
      method: 'POST',
      body: {
        cuentaId: document.querySelector('#conc-cuenta')?.value,
        periodo: periodo ? periodo.replace('-', '') : '',
        saldoBanco: document.querySelector('#conc-saldo-banco')?.value,
      },
    });
    closeModal();
    showTesTab('conciliacion');
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
  }
}

// ─── CxC (Cuentas por Cobrar) ───────────────

async function renderTesCxc(container) {
  try {
    const facturas = await api('/finance/treasury/cxc-pendientes?days=30');
    container.innerHTML = `
      <div class="mb-4">
        <p class="text-sm text-gray-400">Facturas de cliente pendientes de cobro</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Factura</th>
              <th class="text-left px-4 py-3">Cliente/OT</th>
              <th class="text-right px-4 py-3">Total</th>
              <th class="text-right px-4 py-3">Saldo Pend.</th>
              <th class="text-right px-4 py-3">Vencimiento</th>
              <th class="text-center px-4 py-3">Estado</th>
              <th class="text-right px-4 py-3">Acción</th>
            </tr></thead>
            <tbody>${facturas.length === 0 ? '<tr><td colspan="7" class="text-center py-8 text-gray-600">No hay CxC pendientes</td></tr>' : facturas.map(f => {
              const vencida = new Date(f.fechaVencimiento) < new Date();
              const puedeCobrar = f.estadoPago !== 'PAGA' && f.estadoPago !== 'ANULADA';
              return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition ${vencida ? 'bg-red-900/10' : ''}">
                <td class="px-4 py-2.5 font-mono text-xs text-gray-400">${esc(f.numeroFacturaManual || 'N/A')}</td>
                <td class="px-4 py-2.5">${esc(f.ordenId || '—')}</td>
                <td class="px-4 py-2.5 text-right font-mono">₲ ${Number(f.total).toLocaleString('es-PY')}</td>
                <td class="px-4 py-2.5 text-right font-mono text-yellow-400">₲ ${Number(f.saldoPendiente || f.total).toLocaleString('es-PY')}</td>
                <td class="px-4 py-2.5 text-right font-mono text-xs ${vencida ? 'text-red-400 font-semibold' : 'text-gray-400'}">${new Date(f.fechaVencimiento).toLocaleDateString('es-PY')}</td>
                <td class="px-4 py-2.5 text-center"><span class="status-badge ${(f.estadoPago || 'PENDIENTE') === 'PAGA' ? 'bg-green-900/50 text-green-300' : f.estadoPago === 'PARCIAL' ? 'bg-blue-900/50 text-blue-300' : 'bg-yellow-900/50 text-yellow-300'}">${f.estadoPago || 'PENDIENTE'}</span></td>
                <td class="px-4 py-2.5 text-right">${puedeCobrar ? `<button class="cxc-cobrar-btn px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-medium transition" data-id="${esc(f.id)}" data-total="${esc(f.total)}" data-saldo="${esc(f.saldoPendiente || f.total)}">💰 Cobrar</button>` : '—'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    // Bind Cobrar buttons
    document.querySelectorAll('.cxc-cobrar-btn').forEach(b => {
      b.addEventListener('click', () => showCobroModal(b.dataset.id, b.dataset.saldo));
    });
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function showCobroModal(facturaId, saldo) {
  // Fetch bank accounts for the select
  api('/finance/treasury/cuentas').then(cuentas => {
    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">💰 Registrar Cobro</h3>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <form id="cobro-form" class="space-y-4">
        <input type="hidden" id="cobro-factura-id" value="${esc(facturaId)}">
        <p class="text-sm text-gray-400">Saldo pendiente: <strong class="text-yellow-400">₲ ${Number(saldo).toLocaleString('es-PY')}</strong></p>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Monto a cobrar</label>
          <input id="cobro-monto" type="number" step="0.01" max="${saldo}" value="${saldo}" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Medio de pago</label>
          <select id="cobro-medio" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CHEQUE">Cheque</option>
            <option value="TARJETA_DEBITO">Tarjeta Débito</option>
            <option value="TARJETA_CREDITO">Tarjeta Crédito</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cuenta destino</label>
          <select id="cobro-cuenta" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="">Seleccionar...</option>
            ${(cuentas || []).filter(c => c.activo).map(c => `<option value="${esc(c.id)}">${esc(c.nombre)} (₲ ${Number(c.saldoActual).toLocaleString('es-PY')})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Concepto (opcional)</label>
          <input id="cobro-concepto" type="text" placeholder="Cobro factura..." class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        </div>
        <button type="submit" class="w-full py-2.5 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-semibold transition">Registrar Cobro</button>
        <p id="cobro-msg" class="text-sm text-center hidden"></p>
      </form>`;
    dom.modalOverlay.classList.remove('hidden');
    document.getElementById('cobro-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('cobro-msg');
      msg.classList.remove('hidden');
      msg.className = 'text-sm text-center text-gray-400';
      msg.textContent = 'Procesando cobro...';
      try {
        const result = await api('/finance/payments/register', {
          method: 'POST',
          body: {
            facturaId: document.getElementById('cobro-factura-id').value,
            monto: parseFloat(document.getElementById('cobro-monto').value),
            medioPago: document.getElementById('cobro-medio').value,
            cuentaId: document.getElementById('cobro-cuenta').value,
            concepto: document.getElementById('cobro-concepto').value.trim() || undefined,
          },
        });
        msg.className = 'text-sm text-center text-green-400';
        msg.textContent = `✅ Cobro registrado. Estado: ${result.nuevoEstado}. Saldo restante: ₲ ${Number(result.saldoRestante).toLocaleString('es-PY')}`;
        setTimeout(() => { dom.modalOverlay.classList.add('hidden'); renderTesCxc(document.getElementById('tes-content')); }, 2000);
      } catch (e) {
        msg.className = 'text-sm text-center text-red-400';
        msg.textContent = 'Error: ' + e.message;
      }
    });
  }).catch(() => {
    alert('Error al cargar cuentas bancarias');
  });
}

// ─── CxP (Cuentas por Pagar) ────────────────

async function renderTesCxp(container) {
  try {
    const facturas = await api('/finance/treasury/facturas-proveedor');
    renderTesCxpTable(container, facturas);
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

function renderTesCxpTable(container, facturas) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Facturas de proveedor pendientes de pago</p>
      <div class="flex gap-2">
        <select id="filter-cxp-estado" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
          <option value="">Todos</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="PARCIAL">Parciales</option>
          <option value="PAGA">Pagadas</option>
        </select>
      </div>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">N° Factura</th>
            <th class="text-left px-4 py-3">Concepto</th>
            <th class="text-right px-4 py-3">Total</th>
            <th class="text-right px-4 py-3">Saldo Pend.</th>
            <th class="text-right px-4 py-3">Vencimiento</th>
            <th class="text-center px-4 py-3">Estado</th>
            <th class="text-right px-4 py-3">Acción</th>
          </tr></thead>
          <tbody>${facturas.length === 0 ? '<tr><td colspan="7" class="text-center py-8 text-gray-600">No hay facturas de proveedor</td></tr>' : facturas.map(f => {
            const vencida = new Date(f.fechaVencimiento) < new Date() && f.estadoPago !== 'PAGA';
            const puedePagar = f.estadoPago !== 'PAGA' && f.estadoPago !== 'ANULADA';
            return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition ${vencida ? 'bg-red-900/10' : ''}">
              <td class="px-4 py-2.5 font-mono text-xs text-gray-400">${esc(f.nroFactura)}</td>
              <td class="px-4 py-2.5">${esc(f.concepto || '—')}</td>
              <td class="px-4 py-2.5 text-right font-mono">₲ ${Number(f.total).toLocaleString('es-PY')}</td>
              <td class="px-4 py-2.5 text-right font-mono ${f.estadoPago !== 'PAGA' ? 'text-yellow-400' : 'text-green-400'}">₲ ${Number(f.saldoPendiente || f.total).toLocaleString('es-PY')}</td>
              <td class="px-4 py-2.5 text-right font-mono text-xs ${vencida ? 'text-red-400 font-semibold' : 'text-gray-400'}">${new Date(f.fechaVencimiento).toLocaleDateString('es-PY')}</td>
              <td class="px-4 py-2.5 text-center"><span class="status-badge ${f.estadoPago === 'PAGA' ? 'bg-green-900/50 text-green-300' : f.estadoPago === 'PARCIAL' ? 'bg-blue-900/50 text-blue-300' : 'bg-yellow-900/50 text-yellow-300'}">${f.estadoPago}</span></td>
              <td class="px-4 py-2.5 text-right">${puedePagar ? `<button class="cxp-pagar-btn px-3 py-1.5 bg-orange-700 hover:bg-orange-600 rounded-lg text-xs font-medium transition" data-id="${esc(f.id)}" data-saldo="${esc(f.saldoPendiente || f.total)}">💳 Pagar</button>` : '—'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
  // Bind Pagar buttons
  document.querySelectorAll('.cxp-pagar-btn').forEach(b => {
    b.addEventListener('click', () => showPagoProveedorModal(b.dataset.id, b.dataset.saldo));
  });
  document.querySelector('#filter-cxp-estado')?.addEventListener('change', async (ev) => {
    const estado = ev.target.value;
    const content = document.querySelector('#tes-content');
    if (!content) return;
    const params = estado ? `?estado=${estado}` : '';
    content.innerHTML = '<div class="text-center py-8 text-gray-500">Filtrando...</div>';
    const data = await api(`/finance/treasury/facturas-proveedor${params}`);
    renderTesCxpTable(content, data);
  });
}

// ─── Flujo de Caja ──────────────────────────

async function renderTesFlujo(container) {
  try {
    const [cuentas, flujo] = await Promise.all([
      api('/finance/treasury/cuentas?soloActivas=true'),
      api('/finance/treasury/flujo-caja?dias=30'),
    ]);
    container.innerHTML = `
      <div class="mb-4">
        <p class="text-sm text-gray-400">Proyección de flujo de caja a 30 días</p>
      </div>
      ${flujo.alertaSobregiro ? `<div class="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-xl flex items-center gap-3">
        <span class="text-2xl">⚠️</span>
        <div><p class="font-semibold text-red-400">Alerta de Sobregiro</p>
        <p class="text-sm text-red-300">El saldo proyectado es negativo (₲ ${Number(flujo.saldoProyectado).toLocaleString('es-PY')}). Revisá urgente tus cuentas por cobrar y pagar.</p></div>
      </div>` : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">Saldo Actual</p>
          <p class="text-2xl font-bold ${Number(flujo.saldoActual) >= 0 ? 'text-blue-400' : 'text-red-400'}">₲ ${Number(flujo.saldoActual).toLocaleString('es-PY')}</p>
        </div>
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">Ingresos Proy.</p>
          <p class="text-2xl font-bold text-green-400">₲ ${Number(flujo.ingresosProyectados).toLocaleString('es-PY')}</p>
        </div>
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">Egresos Proy.</p>
          <p class="text-2xl font-bold text-red-400">₲ ${Number(flujo.egresosProyectados).toLocaleString('es-PY')}</p>
        </div>
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">Flujo Neto</p>
          <p class="text-2xl font-bold ${Number(flujo.flujoNetoProyectado) >= 0 ? 'text-green-400' : 'text-red-400'}">${Number(flujo.flujoNetoProyectado) >= 0 ? '+' : ''}₲ ${Number(flujo.flujoNetoProyectado).toLocaleString('es-PY')}</p>
        </div>
        <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">Saldo Proyectado</p>
          <p class="text-2xl font-bold ${Number(flujo.saldoProyectado) >= 0 ? 'text-cyan-400' : 'text-red-400'}">₲ ${Number(flujo.saldoProyectado).toLocaleString('es-PY')}</p>
        </div>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Proyección Detallada</h3>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between items-center py-2 border-b border-gray-800">
            <span class="text-gray-400">Saldo Actual (todas las cuentas)</span>
            <span class="font-mono font-semibold ${Number(flujo.saldoActual) >= 0 ? 'text-blue-400' : 'text-red-400'}">₲ ${Number(flujo.saldoActual).toLocaleString('es-PY')}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-800">
            <span class="text-gray-400">+ CxC próximos 30 días</span>
            <span class="font-mono text-green-400">+ ₲ ${Number(flujo.ingresosProyectados).toLocaleString('es-PY')}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-800">
            <span class="text-gray-400">− CxP próximos 30 días</span>
            <span class="font-mono text-red-400">− ₲ ${Number(flujo.egresosProyectados).toLocaleString('es-PY')}</span>
          </div>
          <div class="flex justify-between items-center py-2">
            <span class="font-semibold text-gray-300">= Saldo Proyectado</span>
            <span class="font-mono font-bold text-lg ${Number(flujo.saldoProyectado) >= 0 ? 'text-cyan-400' : 'text-red-400'}">₲ ${Number(flujo.saldoProyectado).toLocaleString('es-PY')}</span>
          </div>
        </div>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="text-center py-8 text-red-400">Error: ${esc(e.message)}</div>`;
  }
}

/* ─── Pago Proveedores ───────────────────── */
function showPagoProveedorModal(facturaProvId, saldo) {
  api('/finance/treasury/cuentas').then(cuentas => {
    dom.modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold">💳 Pagar Factura de Proveedor</h3>
        <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      <form id="pago-prov-form" class="space-y-4">
        <input type="hidden" id="pago-prov-factura-id" value="${esc(facturaProvId)}">
        <p class="text-sm text-gray-400">Saldo pendiente: <strong class="text-yellow-400">₲ ${Number(saldo).toLocaleString('es-PY')}</strong></p>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Monto a pagar</label>
          <input id="pago-prov-monto" type="number" step="0.01" max="${saldo}" value="${saldo}" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Medio de pago</label>
          <select id="pago-prov-medio" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CHEQUE">Cheque</option>
            <option value="TARJETA_DEBITO">Tarjeta Débito</option>
            <option value="TARJETA_CREDITO">Tarjeta Crédito</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Cuenta origen</label>
          <select id="pago-prov-cuenta" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            <option value="">Seleccionar...</option>
            ${(cuentas || []).filter(c => c.activo).map(c => `<option value="${esc(c.id)}">${esc(c.nombre)} (₲ ${Number(c.saldoActual).toLocaleString('es-PY')})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Concepto (opcional)</label>
          <input id="pago-prov-concepto" type="text" placeholder="Pago factura..." class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
        </div>
        <button type="submit" class="w-full py-2.5 bg-orange-700 hover:bg-orange-600 rounded-lg text-sm font-semibold transition">Registrar Pago</button>
        <p id="pago-prov-msg" class="text-sm text-center hidden"></p>
      </form>`;
    dom.modalOverlay.classList.remove('hidden');
    document.getElementById('pago-prov-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('pago-prov-msg');
      msg.classList.remove('hidden');
      msg.className = 'text-sm text-center text-gray-400';
      msg.textContent = 'Procesando pago...';
      try {
        const result = await api(`/finance/treasury/facturas-proveedor/${document.getElementById('pago-prov-factura-id').value}/pagar`, {
          method: 'POST',
          body: {
            monto: parseFloat(document.getElementById('pago-prov-monto').value),
            medioPago: document.getElementById('pago-prov-medio').value,
            cuentaId: document.getElementById('pago-prov-cuenta').value,
            concepto: document.getElementById('pago-prov-concepto').value.trim() || undefined,
          },
        });
        msg.className = 'text-sm text-center text-green-400';
        msg.textContent = `✅ Pago registrado. Estado: ${result.nuevoEstado}. Saldo restante: ₲ ${Number(result.saldoRestante).toLocaleString('es-PY')}`;
        setTimeout(() => { dom.modalOverlay.classList.add('hidden'); renderTesCxp(document.getElementById('tes-content')); }, 2000);
      } catch (e) {
        msg.className = 'text-sm text-center text-red-400';
        msg.textContent = 'Error: ' + e.message;
      }
    });
  }).catch(() => {
    alert('Error al cargar cuentas bancarias');
  });
}


// init() moved to app.js core — must run after all modules loaded

