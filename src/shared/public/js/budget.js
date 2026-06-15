/**
 * Budget Module — Presupuestos + Control de Gestión (Sprint 11).
 *
 * @module js/budget
 */

/* global API, authHeaders */

// ─── State ──────────────────────────────────────

let budgetState = {
  presupuestos: [],
  selectedId: null,
  comparativa: null,
  loading: false,
};

// ─── API Helpers ────────────────────────────────

async function budgetApi(path, opts = {}) {
  const res = await fetch(`/finance${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Main Render ────────────────────────────────

async function renderBudget(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Presupuestos</h2>
        <p class="text-sm text-gray-400">Control de gestión: real vs presupuestado</p>
      </div>
      <div class="flex gap-2">
        <button onclick="loadBudgetAlertas()" class="px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded text-sm hover:bg-yellow-600/30 flex items-center gap-1">
          <span>⚠️</span> Alertas
        </button>
        <button onclick="showCreateBudgetModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          + Nuevo Presupuesto
        </button>
      </div>
    </div>

    <div id="budget-alerts" class="hidden mb-4"></div>
    <div id="budget-content"></div>
  `;

  await loadBudgetList();
}

// ─── List ───────────────────────────────────────

async function loadBudgetList() {
  const el = document.getElementById('budget-content');
  if (!el) return;

  el.innerHTML = '<p class="text-gray-400 text-sm">Cargando presupuestos...</p>';

  try {
    const data = await budgetApi('/presupuestos');
    budgetState.presupuestos = data;

    if (data.length === 0) {
      el.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          <p class="text-4xl mb-2">📊</p>
          <p class="text-lg">No hay presupuestos creados</p>
          <p class="text-sm mt-1">Crea uno para empezar el control de gestión</p>
        </div>
      `;
      return;
    }

    const rows = data.map(p => `
      <tr class="border-b border-gray-700/50 hover:bg-gray-700/20 cursor-pointer" onclick="loadBudgetComparativa('${p.id}')">
        <td class="px-4 py-3 text-white font-medium">${p.periodo}</td>
        <td class="px-4 py-3 text-gray-300">${p.descripcion || '—'}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded text-xs font-medium ${
            p.estado === 'aprobado' ? 'bg-green-600/20 text-green-400' :
            p.estado === 'cerrado' ? 'bg-gray-600/20 text-gray-400' :
            'bg-yellow-600/20 text-yellow-400'
          }">${p.estado}</span>
        </td>
        <td class="px-4 py-3 text-right">
          <button onclick="event.stopPropagation(); deleteBudgetConfirm('${p.id}', '${p.periodo}')" class="text-red-400 hover:text-red-300 text-sm">🗑️</button>
        </td>
      </tr>
    `).join('');

    el.innerHTML = `
      <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-left text-gray-400">
              <th class="px-4 py-3">Período</th>
              <th class="px-4 py-3">Descripción</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<p class="text-red-400 text-sm">Error: ${err.message}</p>`;
  }
}

// ─── Create Budget Modal ────────────────────────

function showCreateBudgetModal() {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const modal = document.createElement('div');
  modal.id = 'budget-modal';
  modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
      <h3 class="text-lg font-semibold text-white mb-4">Nuevo Presupuesto</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Período *</label>
          <input id="budget-periodo" type="text" value="${defaultPeriod}"
            class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="2026-01, 2026-Q1, 2026">
          <p class="text-xs text-gray-500 mt-1">Formato: YYYY-MM (mes), YYYY-QN (trimestre), YYYY (anual)</p>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Descripción</label>
          <input id="budget-descripcion" type="text"
            class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="Ej: Presupuesto mensual enero 2026">
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-6">
        <button onclick="document.getElementById('budget-modal').remove()" class="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
        <button onclick="createBudget()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Crear</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function createBudget() {
  const periodo = document.getElementById('budget-periodo')?.value?.trim();
  const descripcion = document.getElementById('budget-descripcion')?.value?.trim();

  if (!periodo) {
    alert('El período es obligatorio');
    return;
  }

  try {
    await budgetApi('/presupuestos', {
      method: 'POST',
      body: JSON.stringify({ periodo, descripcion }),
    });
    document.getElementById('budget-modal')?.remove();
    await loadBudgetList();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Delete Budget ──────────────────────────────

function deleteBudgetConfirm(id, periodo) {
  if (!confirm(`¿Eliminar presupuesto ${periodo}?`)) return;
  deleteBudget(id);
}

async function deleteBudget(id) {
  try {
    await budgetApi(`/presupuestos/${id}`, { method: 'DELETE' });
    await loadBudgetList();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Comparativa ────────────────────────────────

async function loadBudgetComparativa(id) {
  budgetState.selectedId = id;
  const el = document.getElementById('budget-content');
  if (!el) return;

  el.innerHTML = '<p class="text-gray-400 text-sm">Calculando comparativa...</p>';

  try {
    const data = await budgetApi(`/presupuestos/${id}/comparativa`);
    budgetState.comparativa = data;
    renderComparativa(data);
  } catch (err) {
    el.innerHTML = `<p class="text-red-400 text-sm">Error: ${err.message}</p>`;
  }
}

function renderComparativa(data) {
  const el = document.getElementById('budget-content');
  if (!el) return;

  const { presupuesto, items, resumen, alertas } = data;

  // Status badge
  const resumenBadge = resumen.estadoGeneral === 'OK'
    ? 'bg-green-600/20 text-green-400'
    : resumen.estadoGeneral === 'ALERTA'
    ? 'bg-yellow-600/20 text-yellow-400'
    : 'bg-red-600/20 text-red-400';

  // Item rows
  const rows = items.map(item => {
    const badge = item.estadoDesvio === 'OK'
      ? 'bg-green-600/20 text-green-400'
      : item.estadoDesvio === 'ALERTA'
      ? 'bg-yellow-600/20 text-yellow-400'
      : 'bg-red-600/20 text-red-400';

    return `
      <tr class="border-b border-gray-700/50 hover:bg-gray-700/20">
        <td class="px-4 py-3">
          <span class="text-xs text-gray-500">${item.centroCostoCodigo}</span>
          <span class="text-white ml-1">${item.centroCostoNombre}</span>
        </td>
        <td class="px-4 py-3 text-gray-300 capitalize">${item.categoria}</td>
        <td class="px-4 py-3 text-right text-white font-mono">${fmt(item.montoPresupuestado)}</td>
        <td class="px-4 py-3 text-right text-white font-mono">${fmt(item.montoReal)}</td>
        <td class="px-4 py-3 text-right">
          <span class="px-2 py-0.5 rounded text-xs font-medium ${badge}">
            ${item.desvio > 0 ? '+' : ''}${item.desvio.toFixed(1)}%
          </span>
        </td>
        <td class="px-4 py-3 text-right text-gray-500 text-xs">${item.notas || '—'}</td>
      </tr>
    `;
  }).join('');

  // Alerts section
  let alertsHtml = '';
  if (alertas.length > 0) {
    const alertItems = alertas.map(a => `
      <div class="flex items-center gap-2 px-3 py-2 ${
        a.severidad === 'CRITICO' ? 'bg-red-600/10 text-red-400' : 'bg-yellow-600/10 text-yellow-400'
      } rounded text-sm">
        <span>${a.severidad === 'CRITICO' ? '🔴' : '🟡'}</span>
        <span>${a.mensaje}</span>
        <span class="ml-auto font-mono">${fmt(String(a.montoReal))} vs ${fmt(String(a.montoPresupuestado))}</span>
      </div>
    `).join('');
    alertsHtml = `
      <div class="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
        <h4 class="text-sm font-medium text-gray-400 mb-2">⚠️ Alertas de Desvío</h4>
        <div class="space-y-1">${alertItems}</div>
      </div>
    `;
  }

  // Add item form
  const addItemForm = presupuesto.estado === 'borrador' ? `
    <details class="mb-4 bg-gray-800 rounded-lg border border-gray-700">
      <summary class="px-4 py-3 text-sm text-gray-400 cursor-pointer hover:text-white">+ Agregar línea de presupuesto</summary>
      <div class="px-4 pb-4 grid grid-cols-4 gap-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Centro de Costo</label>
          <select id="additem-centro" class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"></select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Categoría</label>
          <select id="additem-categoria" class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm">
            <option value="servicios">Servicios</option>
            <option value="repuestos">Repuestos</option>
            <option value="mano_obra">Mano de Obra</option>
            <option value="fijo">Costo Fijo</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Monto Presupuestado</label>
          <input id="additem-monto" type="number" step="0.01" min="0"
            class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm" placeholder="0">
        </div>
        <div class="flex items-end">
          <button onclick="addBudgetItem('${presupuesto.id}')" class="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Agregar</button>
        </div>
      </div>
    </details>
  ` : '';

  el.innerHTML = `
    <div class="mb-4 flex items-center justify-between">
      <button onclick="loadBudgetList()" class="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Volver a la lista
      </button>
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded text-xs font-medium ${
          presupuesto.estado === 'aprobado' ? 'bg-green-600/20 text-green-400' :
          presupuesto.estado === 'cerrado' ? 'bg-gray-600/20 text-gray-400' :
          'bg-yellow-600/20 text-yellow-400'
        }">${presupuesto.estado}</span>
        ${presupuesto.estado === 'borrador' ? `
          <button onclick="approveBudget('${presupuesto.id}')" class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">Aprobar</button>
        ` : ''}
        ${presupuesto.estado === 'aprobado' ? `
          <button onclick="closeBudget('${presupuesto.id}')" class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">Cerrar</button>
        ` : ''}
        <button onclick="refreshBudgetReal('${presupuesto.id}')" class="px-3 py-1 bg-purple-600/20 text-purple-400 rounded text-sm hover:bg-purple-600/30">🔄 Recalcular</button>
      </div>
    </div>

    <h3 class="text-white font-medium mb-3">Período: ${presupuesto.periodo} ${presupuesto.descripcion ? '— ' + presupuesto.descripcion : ''}</h3>

    ${alertsHtml}
    ${addItemForm}

    <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-4">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-700 text-left text-gray-400">
            <th class="px-4 py-3">Centro de Costo</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3 text-right">Presupuestado</th>
            <th class="px-4 py-3 text-right">Real</th>
            <th class="px-4 py-3 text-right">Desvío</th>
            <th class="px-4 py-3 text-right">Notas</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-500">Sin ítems — agrega líneas de presupuesto</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
        <p class="text-xs text-gray-400 mb-1">Presupuestado</p>
        <p class="text-xl font-bold text-white">${fmt(String(resumen.totalPresupuestado))}</p>
      </div>
      <div class="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
        <p class="text-xs text-gray-400 mb-1">Real</p>
        <p class="text-xl font-bold text-white">${fmt(String(resumen.totalReal))}</p>
      </div>
      <div class="bg-gray-800 rounded-lg border border-gray-700 p-4 text-center">
        <p class="text-xs text-gray-400 mb-1">Desvío Total</p>
        <p class="text-xl font-bold ${resumenBadge} px-2 py-0.5 rounded inline-block">
          ${resumen.desvioTotal > 0 ? '+' : ''}${resumen.desvioTotal.toFixed(1)}%
        </p>
      </div>
    </div>
  `;

  // Load cost centers for add-item form
  loadCostCentersForBudget();
}

// ─── Add Item ───────────────────────────────────

async function loadCostCentersForBudget() {
  const select = document.getElementById('additem-centro');
  if (!select) return;

  try {
    const res = await fetch('/finance/accounting/cost-centers', { headers: authHeaders() });
    const data = await res.json();
    const centers = Array.isArray(data) ? data : (data.tree || []);
    select.innerHTML = centers.map(c =>
      `<option value="${c.id}">${c.codigo} — ${c.nombre}</option>`
    ).join('');
  } catch {
    select.innerHTML = '<option value="">Error cargando centros</option>';
  }
}

async function addBudgetItem(presupuestoId) {
  const centroCostoId = document.getElementById('additem-centro')?.value;
  const categoria = document.getElementById('additem-categoria')?.value;
  const montoPresupuestado = parseFloat(document.getElementById('additem-monto')?.value || '0');

  if (!centroCostoId || !categoria) {
    alert('Selecciona centro de costo y categoría');
    return;
  }

  if (montoPresupuestado <= 0) {
    alert('El monto debe ser mayor a 0');
    return;
  }

  try {
    await budgetApi(`/presupuestos/${presupuestoId}/items`, {
      method: 'POST',
      body: JSON.stringify({ centroCostoId, categoria, montoPresupuestado }),
    });
    await loadBudgetComparativa(presupuestoId);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Budget Actions ─────────────────────────────

async function approveBudget(id) {
  try {
    await budgetApi(`/presupuestos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'aprobado' }),
    });
    await loadBudgetComparativa(id);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function closeBudget(id) {
  if (!confirm('¿Cerrar presupuesto? No se podrán hacer más cambios.')) return;
  try {
    await budgetApi(`/presupuestos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: 'cerrado' }),
    });
    await loadBudgetComparativa(id);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function refreshBudgetReal(id) {
  try {
    await budgetApi(`/presupuestos/${id}/refresh`, { method: 'POST' });
    await loadBudgetComparativa(id);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Alerts ─────────────────────────────────────

async function loadBudgetAlertas() {
  const el = document.getElementById('budget-alerts');
  if (!el) return;

  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) {
    try {
      const alertas = await budgetApi('/presupuestos/alertas');
      if (alertas.length === 0) {
        el.innerHTML = '<div class="p-3 bg-green-600/10 text-green-400 rounded text-sm">✅ Sin alertas de desvío en presupuestos aprobados</div>';
        return;
      }
      const items = alertas.map(a => `
        <div class="flex items-center gap-2 px-3 py-2 ${
          a.severidad === 'CRITICO' ? 'bg-red-600/10 text-red-400' : 'bg-yellow-600/10 text-yellow-400'
        } rounded text-sm">
          <span>${a.severidad === 'CRITICO' ? '🔴' : '🟡'}</span>
          <span class="flex-1">${a.mensaje}</span>
          <span class="font-mono">${fmt(String(a.montoReal))} / ${fmt(String(a.montoPresupuestado))}</span>
        </div>
      `).join('');
      el.innerHTML = items;
    } catch (err) {
      el.innerHTML = `<p class="text-red-400 text-sm">Error: ${err.message}</p>`;
    }
  }
}

// ─── Exports (global) ───────────────────────────
window.renderBudget = renderBudget;
window.loadBudgetComparativa = loadBudgetComparativa;
window.showCreateBudgetModal = showCreateBudgetModal;
window.createBudget = createBudget;
window.deleteBudgetConfirm = deleteBudgetConfirm;
window.addBudgetItem = addBudgetItem;
window.approveBudget = approveBudget;
window.closeBudget = closeBudget;
window.refreshBudgetReal = refreshBudgetReal;
window.loadBudgetAlertas = loadBudgetAlertas;
