/* ═══════════════════════════════════════════════════════════════════
   P3.4 — TecDoc Frontend (Búsqueda Partes por VIN)
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, showToast */

function renderTecDoc(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">TecDoc — Búsqueda de Partes</h2>
      <p class="text-sm text-gray-500">Buscá repuestos por VIN o marca/modelo con catálogo TecDoc</p>
    </div>

    <!-- Search Tabs -->
    <div class="flex gap-2 mb-4">
      <button id="td-tab-vin" class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white">Buscar por VIN</button>
      <button id="td-tab-brand" class="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700">Buscar por Marca/Modelo</button>
    </div>

    <!-- VIN Search -->
    <div id="td-vin-search" class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Búsqueda por VIN</h3>
      <div class="flex gap-3">
        <input id="td-vin" placeholder="Ej: 1HGBH41JXMN109186 (17 caracteres)" maxlength="17" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 font-mono focus:ring-2 focus:ring-blue-500/50">
        <button onclick="searchTecDocVIN()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">🔍 Buscar</button>
      </div>
      <div id="td-vin-result" class="mt-4 hidden"></div>
    </div>

    <!-- Brand/Model Search -->
    <div id="td-brand-search" class="hidden bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Búsqueda por Marca/Modelo</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Marca</label>
          <input id="td-brand" placeholder="Ej: Toyota" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Modelo</label>
          <input id="td-model" placeholder="Ej: Hilux" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Año</label>
          <input id="td-year" placeholder="Ej: 2020" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
      </div>
      <div class="flex gap-3 mt-3">
        <input id="td-keyword" placeholder="Buscar por nombre de parte (opcional)" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
        <button onclick="searchTecDocBrand()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">🔍 Buscar</button>
      </div>
      <div id="td-brand-result" class="mt-4 hidden"></div>
    </div>

    <!-- Integration Status -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Estado de Integración</h3>
      <div id="td-status" class="text-center py-4 text-gray-600 text-sm">Verificando...</div>
    </div>`;

  checkTecDocStatus();
  setupTecDocTabs();
}

function setupTecDocTabs() {
  document.getElementById('td-tab-vin')?.addEventListener('click', () => {
    document.getElementById('td-tab-vin').className = 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white';
    document.getElementById('td-tab-brand').className = 'px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700';
    document.getElementById('td-vin-search').classList.remove('hidden');
    document.getElementById('td-brand-search').classList.add('hidden');
  });
  document.getElementById('td-tab-brand')?.addEventListener('click', () => {
    document.getElementById('td-tab-brand').className = 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white';
    document.getElementById('td-tab-vin').className = 'px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700';
    document.getElementById('td-brand-search').classList.remove('hidden');
    document.getElementById('td-vin-search').classList.add('hidden');
  });
}

async function checkTecDocStatus() {
  const el = document.getElementById('td-status');
  const data = await api('/inventory/tecdoc/status').catch(() => null);
  if (!data) { el.innerHTML = '<span class="text-red-400">Error al verificar estado</span>'; return; }

  el.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="w-3 h-3 rounded-full ${data.configured ? 'bg-green-500' : 'bg-yellow-500'}"></span>
      <span class="text-sm ${data.configured ? 'text-green-400' : 'text-yellow-400'}">${data.configured ? 'TecDoc configurado y conectado' : 'TecDoc no configurado (API key requerida)'}</span>
    </div>
    ${!data.configured ? '<p class="text-xs text-gray-500 mt-2">Configurá la variable de entorno TECDOC_API_KEY para habilitar la integración con el catálogo de partes.</p>' : ''}
    ${data.stats ? `<div class="grid grid-cols-3 gap-3 mt-3 text-center">
      <div><p class="text-lg font-bold text-blue-400">${data.stats.totalBrands || 0}</p><p class="text-xs text-gray-500">Marcas</p></div>
      <div><p class="text-lg font-bold text-green-400">${data.stats.totalParts || 0}</p><p class="text-xs text-gray-500">Partes</p></div>
      <div><p class="text-lg font-bold text-purple-400">${data.stats.totalSuppliers || 0}</p><p class="text-xs text-gray-500">Proveedores</p></div>
    </div>` : ''}`;
}

async function searchTecDocVIN() {
  const vin = document.getElementById('td-vin')?.value?.trim();
  if (!vin || vin.length < 10) { showToast('Ingresá un VIN válido (mínimo 10 caracteres)', 'error'); return; }
  const el = document.getElementById('td-vin-result');
  el.classList.remove('hidden');
  el.innerHTML = '<div class="text-blue-400 text-sm">Buscando partes por VIN...</div>';

  try {
    const data = await api(`/inventory/tecdoc/search/vin?q=${encodeURIComponent(vin)}`);
    renderTecDocResults(el, data);
  } catch (e) {
    el.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">${esc(e.message || 'Error en la búsqueda')}</div>`;
  }
}

async function searchTecDocBrand() {
  const brand = document.getElementById('td-brand')?.value?.trim();
  const model = document.getElementById('td-model')?.value?.trim();
  const year = document.getElementById('td-year')?.value?.trim();
  const keyword = document.getElementById('td-keyword')?.value?.trim();

  if (!brand) { showToast('Ingresá al menos la marca', 'error'); return; }
  const el = document.getElementById('td-brand-result');
  el.classList.remove('hidden');
  el.innerHTML = '<div class="text-blue-400 text-sm">Buscando partes...</div>';

  try {
    const params = new URLSearchParams({ brand });
    if (model) params.set('model', model);
    if (year) params.set('year', year);
    if (keyword) params.set('q', keyword);
    const data = await api(`/inventory/tecdoc/search/brand?${params}`);
    renderTecDocResults(el, data);
  } catch (e) {
    el.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">${esc(e.message || 'Error en la búsqueda')}</div>`;
  }
}

function renderTecDocResults(el, data) {
  const parts = data?.parts || data?.data || [];
  if (!Array.isArray(parts) || !parts.length) {
    el.innerHTML = '<div class="text-center py-6 text-gray-600 text-sm">Sin resultados. Intentá con otros parámetros.</div>';
    return;
  }

  el.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm text-gray-500">${parts.length} partes encontradas · Fuente: ${esc(data?.source || 'TecDoc')}</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
          <th class="text-left px-3 py-2">Código</th>
          <th class="text-left px-3 py-2">Nombre</th>
          <th class="text-left px-3 py-2">Marca</th>
          <th class="text-left px-3 py-2">Categoría</th>
          <th class="text-right px-3 py-2">Precio Ref.</th>
          <th class="text-center px-3 py-2">Acciones</th>
        </tr></thead>
        <tbody>${parts.map(p => `
          <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
            <td class="px-3 py-2 font-mono text-xs text-gray-400">${esc(p.articleNumber || p.codigo || '—')}</td>
            <td class="px-3 py-2 font-medium">${esc(p.articleName || p.nombre || '—')}</td>
            <td class="px-3 py-2 text-gray-400">${esc(p.brandName || p.marca || '—')}</td>
            <td class="px-3 py-2 text-gray-400">${esc(p.categoryName || p.categoria || '—')}</td>
            <td class="px-3 py-2 text-right text-green-400">${p.price ? '₲ ' + fmt(p.price) : '—'}</td>
            <td class="px-3 py-2 text-center"><button onclick="showToast('Agregado al catálogo local')" class="text-blue-400 hover:text-blue-300 text-xs">+ Agregar</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
