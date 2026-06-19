/**
 * Inventory Batch Operations — Frontend Module.
 *
 * Features:
 *   - CSV bulk import with preview
 *   - Bulk price update (percentage)
 *   - Bulk stock adjustment
 *   - Inventory turnover table
 *   - Dead stock alerts
 *   - Reorder predictions
 *
 * @module js/inventory-batch
 */

/* global api, esc */

// ─── Batch Import ───────────────────────────

function renderInventoryBatch(container) {
  container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-bold text-white">📦 Inventario — Operaciones Masivas</h3>
          <p class="text-xs text-gray-500">Importación CSV, ajustes de precio/stock, análisis</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 border-b border-gray-800 pb-2">
        <button onclick="invBatchShowTab('import')" class="inv-batch-tab px-4 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-500" data-tab="import">📥 Importar CSV</button>
        <button onclick="invBatchShowTab('prices')" class="inv-batch-tab px-4 py-2 text-sm font-medium text-gray-500 hover:text-white" data-tab="prices">💰 Actualizar Precios</button>
        <button onclick="invBatchShowTab('stock')" class="inv-batch-tab px-4 py-2 text-sm font-medium text-gray-500 hover:text-white" data-tab="stock">📊 Ajustar Stock</button>
        <button onclick="invBatchShowTab('analytics')" class="inv-batch-tab px-4 py-2 text-sm font-medium text-gray-500 hover:text-white" data-tab="analytics">📈 Análisis</button>
      </div>

      <!-- Import Tab -->
      <div id="inv-batch-import" class="inv-batch-content space-y-4">
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h4 class="text-sm font-semibold text-gray-300 mb-3">📥 Importar Repuestos desde CSV</h4>
          <p class="text-xs text-gray-500 mb-3">Formato: codigo, descripcion, marca, categoria, precioVenta, precioCompra, stockActual, puntoReorden, ubicacion</p>
          <div class="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition" onclick="document.getElementById('inv-batch-csv-input').click()">
            <input type="file" accept=".csv" class="hidden" id="inv-batch-csv-input" onchange="invBatchHandleCSV(event)">
            <span class="text-gray-500 text-sm">Arrastrá un archivo CSV o hacé click para seleccionar</span>
          </div>
          <div id="inv-batch-preview" class="mt-3 hidden"></div>
          <button id="inv-batch-import-btn" class="mt-3 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition hidden" onclick="invBatchExecuteImport()">📥 Importar</button>
        </div>
      </div>

      <!-- Prices Tab -->
      <div id="inv-batch-prices" class="inv-batch-content hidden space-y-4">
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h4 class="text-sm font-semibold text-gray-300 mb-3">💰 Actualización Masiva de Precios</h4>
          <div class="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">Campo</label>
              <select id="inv-price-field" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
                <option value="precioVenta">Precio de Venta</option>
                <option value="precioCompra">Precio de Compra</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Cambio %</label>
              <input id="inv-price-pct" type="number" value="10" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
            </div>
            <div class="flex items-end">
              <button onclick="invBatchPriceUpdate()" class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">Aplicar</button>
            </div>
          </div>
          <p class="text-xs text-gray-600">⚠️ Esto actualizará TODOS los repuestos activos. Usá con cuidado.</p>
        </div>
      </div>

      <!-- Stock Tab -->
      <div id="inv-batch-stock" class="inv-batch-content hidden space-y-4">
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <h4 class="text-sm font-semibold text-gray-300 mb-3">📊 Ajuste Masivo de Stock</h4>
          <p class="text-xs text-gray-500 mb-3">Cargá los repuestos que necesitan ajuste (+positivo, -negativo)</p>
          <div id="inv-stock-adjustments" class="space-y-2 mb-3"></div>
          <button onclick="invBatchAddAdjustment()" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition">+ Agregar línea</button>
          <button onclick="invBatchExecuteAdjust()" class="mt-3 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-semibold transition">Aplicar Ajustes</button>
        </div>
      </div>

      <!-- Analytics Tab -->
      <div id="inv-batch-analytics" class="inv-batch-content hidden space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-2">🔄 Turnover</h4>
            <div id="inv-turnover-count" class="text-2xl font-bold text-white">—</div>
            <button onclick="invBatchLoadTurnover()" class="mt-2 text-xs text-blue-400 hover:text-blue-300">Cargar</button>
          </div>
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-2">💀 Stock Muerto</h4>
            <div id="inv-deadstock-count" class="text-2xl font-bold text-red-400">—</div>
            <button onclick="invBatchLoadDeadStock()" class="mt-2 text-xs text-blue-400 hover:text-blue-300">Cargar</button>
          </div>
          <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <h4 class="text-xs text-gray-500 uppercase tracking-wider mb-2">🔔 Reorden</h4>
            <div id="inv-reorder-count" class="text-2xl font-bold text-yellow-400">—</div>
            <button onclick="invBatchLoadReorder()" class="mt-2 text-xs text-blue-400 hover:text-blue-300">Cargar</button>
          </div>
        </div>
        <div id="inv-analytics-detail" class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 hidden">
          <div id="inv-analytics-content"></div>
        </div>
      </div>
    </div>
  `;
}

// ─── Tab Switching ──────────────────────────

function invBatchShowTab(tab) {
  document.querySelectorAll('.inv-batch-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.inv-batch-tab').forEach(el => {
    el.classList.remove('text-blue-400', 'border-b-2', 'border-blue-500');
    el.classList.add('text-gray-500');
  });

  document.getElementById(`inv-batch-${tab}`)?.classList.remove('hidden');
  const activeTab = document.querySelector(`[data-tab="${tab}"]`);
  if (activeTab) {
    activeTab.classList.add('text-blue-400', 'border-b-2', 'border-blue-500');
    activeTab.classList.remove('text-gray-500');
  }
}

// ─── CSV Import ─────────────────────────────

let _csvData = [];

function invBatchHandleCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    _csvData = lines.slice(1).map(line => {
      const values = line.split(',');
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i]?.trim() || ''; });
      return {
        codigo: row.codigo || '',
        descripcion: row.descripcion || row.descripcion || '',
        marca: row.marca || '',
        categoria: row.categoria || '',
        precioVenta: parseFloat(row.precioventa || row.precio_venta || '0') || 0,
        precioCompra: parseFloat(row.preciocompra || row.precio_compra || '0') || 0,
        stockActual: parseInt(row.stockactual || row.stock_actual || '0') || 0,
        puntoReorden: parseInt(row.puntoreorden || row.punto_reorden || '5') || 5,
        ubicacion: row.ubicacion || '',
      };
    });

    const preview = document.getElementById('inv-batch-preview');
    const importBtn = document.getElementById('inv-batch-import-btn');
    if (preview) {
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <p class="text-sm text-gray-300 mb-2">${_csvData.length} filas detectadas</p>
        <div class="max-h-32 overflow-y-auto text-xs text-gray-500">
          ${_csvData.slice(0, 5).map(r => `<p>${esc(r.codigo)} — ${esc(r.descripcion)}</p>`).join('')}
          ${_csvData.length > 5 ? `<p>... y ${_csvData.length - 5} más</p>` : ''}
        </div>
      `;
    }
    if (importBtn) importBtn.classList.remove('hidden');
  };
  reader.readAsText(file);
}

async function invBatchExecuteImport() {
  if (!_csvData.length) return;
  try {
    const result = await api('/inventory/bulk/import', {
      method: 'POST',
      body: { rows: _csvData },
    });
    alert(`Importados: ${result.imported}, Actualizados: ${result.updated}, Errores: ${result.errors?.length || 0}`);
    _csvData = [];
    document.getElementById('inv-batch-preview')?.classList.add('hidden');
    document.getElementById('inv-batch-import-btn')?.classList.add('hidden');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Price Update ───────────────────────────

async function invBatchPriceUpdate() {
  const field = document.getElementById('inv-price-field')?.value;
  const pct = parseFloat(document.getElementById('inv-price-pct')?.value || '0');
  if (!pct) return alert('Ingresá un porcentaje');

  if (!confirm(`¿Aplicar ${pct > 0 ? '+' : ''}${pct}% a TODOS los repuestos?`)) return;

  // Get all active repuestos
  try {
    const repuestos = await api('/inventory/repuestos');
    const ids = (repuestos || []).map(r => r.id);
    if (!ids.length) return alert('No hay repuestos');

    const result = await api('/inventory/bulk/price-update', {
      method: 'POST',
      body: { ids, field, percentageChange: pct },
    });
    alert(`${result.updated} precios actualizados`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Stock Adjustment ───────────────────────

let _stockAdjustments = [];

function invBatchAddAdjustment() {
  _stockAdjustments.push({ repuestoId: '', cantidad: 0, motivo: '' });
  invBatchRenderAdjustments();
}

function invBatchRenderAdjustments() {
  const container = document.getElementById('inv-stock-adjustments');
  if (!container) return;

  container.innerHTML = _stockAdjustments.map((adj, i) => `
    <div class="flex gap-2 items-center">
      <input placeholder="Repuesto ID" value="${esc(adj.repuestoId)}" onchange="invBatchUpdateAdj(${i}, 'repuestoId', this.value)" class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <input type="number" placeholder="Cantidad (+/-)" value="${adj.cantidad}" onchange="invBatchUpdateAdj(${i}, 'cantidad', parseInt(this.value))" class="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <input placeholder="Motivo" value="${esc(adj.motivo)}" onchange="invBatchUpdateAdj(${i}, 'motivo', this.value)" class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
      <button onclick="invBatchRemoveAdj(${i})" class="px-2 py-1 bg-red-900/40 hover:bg-red-800 rounded text-xs">✕</button>
    </div>
  `).join('');
}

function invBatchUpdateAdj(index, field, value) {
  _stockAdjustments[index][field] = value;
}

function invBatchRemoveAdj(index) {
  _stockAdjustments.splice(index, 1);
  invBatchRenderAdjustments();
}

async function invBatchExecuteAdjust() {
  const valid = _stockAdjustments.filter(a => a.repuestoId && a.cantidad);
  if (!valid.length) return alert('No hay ajustes válidos');

  try {
    const result = await api('/inventory/bulk/stock-adjust', {
      method: 'POST',
      body: { adjustments: valid },
    });
    alert(`Ajustados: ${result.adjusted}, Errores: ${result.errors?.length || 0}`);
    _stockAdjustments = [];
    invBatchRenderAdjustments();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Analytics ──────────────────────────────

async function invBatchLoadTurnover() {
  try {
    const data = await api('/inventory/analytics/turnover');
    document.getElementById('inv-turnover-count').textContent = data.count || 0;
    const detail = document.getElementById('inv-analytics-detail');
    const content = document.getElementById('inv-analytics-content');
    if (detail && content) {
      detail.classList.remove('hidden');
      content.innerHTML = `
        <h4 class="text-sm font-semibold text-gray-300 mb-3">🔄 Turnover de Inventario (${data.count} items)</h4>
        <div class="max-h-64 overflow-y-auto space-y-2">
          ${(data.turnover || []).slice(0, 20).map(t => `
            <div class="flex items-center justify-between py-2 border-b border-gray-800">
              <span class="text-sm text-white">${esc(t.descripcion)}</span>
              <div class="flex gap-4 text-xs text-gray-500">
                <span>Stock: ${t.stockActual}</span>
                <span>Ventas 30d: ${t.ventas30d}</span>
                <span>Turnover: ${t.turnoverRate}x</span>
                <span>${t.daysOfStock}d stock</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function invBatchLoadDeadStock() {
  try {
    const data = await api('/inventory/analytics/dead-stock');
    document.getElementById('inv-deadstock-count').textContent = `${data.count || 0} (₲${(data.totalValue || 0).toLocaleString('es-PY')})`;
    const detail = document.getElementById('inv-analytics-detail');
    const content = document.getElementById('inv-analytics-content');
    if (detail && content) {
      detail.classList.remove('hidden');
      content.innerHTML = `
        <h4 class="text-sm font-semibold text-gray-300 mb-3">💀 Stock Muerto (${data.count} items, ₲${(data.totalValue || 0).toLocaleString('es-PY')})</h4>
        <div class="max-h-64 overflow-y-auto space-y-2">
          ${(data.deadStock || []).slice(0, 20).map(d => `
            <div class="flex items-center justify-between py-2 border-b border-gray-800">
              <span class="text-sm text-white">${esc(d.descripcion)}</span>
              <div class="flex gap-4 text-xs text-gray-500">
                <span>Stock: ${d.stockActual}</span>
                <span>Valor: ₲${d.valorTotal.toLocaleString('es-PY')}</span>
                <span>Sin movimiento: ${d.diasSinMovimiento}d</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function invBatchLoadReorder() {
  try {
    const data = await api('/inventory/analytics/reorder');
    document.getElementById('inv-reorder-count').textContent = `${data.count || 0} (${data.critico || 0} críticos)`;
    const detail = document.getElementById('inv-analytics-detail');
    const content = document.getElementById('inv-analytics-content');
    if (detail && content) {
      detail.classList.remove('hidden');
      const urgenciaColors = { CRITICO: 'text-red-400', ALTO: 'text-yellow-400', MEDIO: 'text-blue-400', BAJO: 'text-gray-500' };
      content.innerHTML = `
        <h4 class="text-sm font-semibold text-gray-300 mb-3">🔔 Predicción de Reorden (${data.count} items)</h4>
        <div class="max-h-64 overflow-y-auto space-y-2">
          ${(data.predictions || []).slice(0, 20).map(p => `
            <div class="flex items-center justify-between py-2 border-b border-gray-800">
              <span class="text-sm text-white">${esc(p.descripcion)}</span>
              <div class="flex gap-4 text-xs text-gray-500">
                <span>Stock: ${p.stockActual}/${p.puntoReorden}</span>
                <span>Promedio: ${p.promedioDiario}/d</span>
                <span>Reorden: ${p.diasParaReorden}d</span>
                <span class="${urgenciaColors[p.urgencia] || ''}">${p.urgencia}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ─── Exports ────────────────────────────────

window.renderInventoryBatch = renderInventoryBatch;
window.invBatchShowTab = invBatchShowTab;
window.invBatchHandleCSV = invBatchHandleCSV;
window.invBatchExecuteImport = invBatchExecuteImport;
window.invBatchPriceUpdate = invBatchPriceUpdate;
window.invBatchAddAdjustment = invBatchAddAdjustment;
window.invBatchUpdateAdj = invBatchUpdateAdj;
window.invBatchRemoveAdj = invBatchRemoveAdj;
window.invBatchExecuteAdjust = invBatchExecuteAdjust;
window.invBatchLoadTurnover = invBatchLoadTurnover;
window.invBatchLoadDeadStock = invBatchLoadDeadStock;
window.invBatchLoadReorder = invBatchLoadReorder;
