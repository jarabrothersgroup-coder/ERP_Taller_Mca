/* ═══════════════════════════════════════════════════════════════════
   P2.1 — Catálogo de Servicios + Pricing Frontend
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

let _serviciosTab = 'catalogo';

function renderServiciosCatalog(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Catálogo de Servicios</h2>
        <p class="text-sm text-gray-500">Gestión de servicios del taller y reglas de precios</p>
      </div>
      <div class="flex gap-2">
        <button class="srv-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_serviciosTab === 'catalogo' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="catalogo">Catálogo</button>
        <button class="srv-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_serviciosTab === 'pricing' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="pricing">Pricing Rules</button>
        <button class="srv-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_serviciosTab === 'horas' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="horas">Horas Hombre</button>
      </div>
    </div>
    <div id="srv-content" class="space-y-4"></div>`;

  const content = container.querySelector('#srv-content');
  container.querySelectorAll('.srv-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _serviciosTab = btn.dataset.tab;
      container.querySelectorAll('.srv-tab').forEach(b => {
        b.className = `srv-tab px-3 py-1.5 rounded-lg text-xs font-medium ${b.dataset.tab === _serviciosTab ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;
      });
      loadSrvTab(content);
    });
  });
  loadSrvTab(content);
}

function loadSrvTab(content) {
  if (_serviciosTab === 'catalogo') loadCatalogo(content);
  else if (_serviciosTab === 'pricing') loadPricing(content);
  else loadHorasHombre(content);
}

// ─── Catálogo CRUD ─────────────────────────────────
async function loadCatalogo(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando catálogo...</div>';
  const servicios = await api('/workshop/servicios').catch(() => null);
  if (!servicios) { content.innerHTML = '<div class="text-center py-8 text-red-400">Error al cargar catálogo</div>'; return; }

  const categorias = [...new Set(servicios.map(s => s.categoria || 'Sin categoría'))];

  content.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm text-gray-500">${servicios.length} servicios</span>
      <button onclick="srvShowCreateForm()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nuevo Servicio</button>
    </div>
    <div id="srv-create-form" class="hidden bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4"></div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Categoría</th>
            <th class="text-right px-4 py-3">Precio Est.</th>
            <th class="text-right px-4 py-3">Duración</th>
            <th class="text-center px-4 py-3">Estado</th>
            <th class="text-right px-4 py-3">Acciones</th>
          </tr></thead>
          <tbody>${servicios.map(s => `
            <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
              <td class="px-4 py-2.5 font-medium">${esc(s.nombre)}</td>
              <td class="px-4 py-2.5 text-gray-400">${esc(s.categoria || '—')}</td>
              <td class="px-4 py-2.5 text-right text-green-400">${s.precioEstimado ? '₲ ' + fmt(s.precioEstimado) : '—'}</td>
              <td class="px-4 py-2.5 text-right text-gray-400">${s.duracionEstimada ? s.duracionEstimada + ' min' : '—'}</td>
              <td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${s.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${s.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td class="px-4 py-2.5 text-right">
                <button onclick="srvEdit('${s.id}')" class="text-blue-400 hover:text-blue-300 text-xs mr-2">Editar</button>
                <button onclick="srvDelete('${s.id}')" class="text-red-400 hover:text-red-300 text-xs">${s.activo ? 'Desactivar' : 'Activar'}</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function srvShowCreateForm(data) {
  const form = document.getElementById('srv-create-form');
  if (!form) return;
  const isEdit = !!data;
  form.classList.remove('hidden');
  form.innerHTML = `
    <h4 class="text-sm font-semibold text-gray-400 mb-3">${isEdit ? 'Editar Servicio' : 'Nuevo Servicio'}</h4>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-gray-500 block mb-1">Nombre *</label><input id="srv-nombre" value="${esc(data?.nombre || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Categoría</label><input id="srv-categoria" value="${esc(data?.categoria || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50" placeholder="Ej: Mantenimiento, Reparación"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Código</label><input id="srv-codigo" value="${esc(data?.codigo || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50" placeholder="SV-001"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Precio Estimado (₲)</label><input id="srv-precio" type="number" value="${data?.precioEstimado || ''}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Duración (min)</label><input id="srv-duracion" type="number" value="${data?.duracionEstimada || ''}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Módulo Thinkcar</label><input id="srv-thinkcar" value="${esc(data?.thinkcarModulo || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50"></div>
    </div>
    <div class="mt-3"><label class="text-xs text-gray-500 block mb-1">Descripción</label><textarea id="srv-descripcion" rows="2" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50">${esc(data?.descripcion || '')}</textarea></div>
    <div class="mt-3"><label class="text-xs text-gray-500 block mb-1">Descripción Técnica</label><textarea id="srv-descripcion-tec" rows="2" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50">${esc(data?.descripcionTecnica || '')}</textarea></div>
    <div class="flex justify-end gap-2 mt-4">
      <button onclick="document.getElementById('srv-create-form').classList.add('hidden')" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">Cancelar</button>
      <button onclick="srvSave('${data?.id || ''}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">${isEdit ? 'Guardar Cambios' : 'Crear Servicio'}</button>
    </div>`;
}

async function srvSave(id) {
  const body = {
    nombre: document.getElementById('srv-nombre')?.value?.trim(),
    categoria: document.getElementById('srv-categoria')?.value?.trim() || undefined,
    codigo: document.getElementById('srv-codigo')?.value?.trim() || undefined,
    precioEstimado: parseFloat(document.getElementById('srv-precio')?.value) || undefined,
    duracionEstimada: parseInt(document.getElementById('srv-duracion')?.value) || undefined,
    thinkcarModulo: document.getElementById('srv-thinkcar')?.value?.trim() || undefined,
    descripcion: document.getElementById('srv-descripcion')?.value?.trim() || undefined,
    descripcionTecnica: document.getElementById('srv-descripcion-tec')?.value?.trim() || undefined,
  };
  if (!body.nombre) { showToast('Ingresá un nombre', 'error'); return; }
  try {
    if (id) { await api(`/workshop/servicios/${id}`, { method: 'PATCH', body }); showToast('Servicio actualizado'); }
    else { await api('/workshop/servicios', { method: 'POST', body }); showToast('Servicio creado'); }
    document.getElementById('srv-create-form')?.classList.add('hidden');
    loadCatalogo(document.getElementById('srv-content'));
  } catch (e) { showToast(e.message || 'Error al guardar', 'error'); }
}

async function srvEdit(id) {
  const data = await api(`/workshop/servicios/${id}`).catch(() => null);
  if (data) srvShowCreateForm(data);
}

async function srvDelete(id) {
  if (!confirm('¿Desactivar este servicio?')) return;
  try { await api(`/workshop/servicios/${id}`, { method: 'DELETE' }); showToast('Servicio desactivado'); loadCatalogo(document.getElementById('srv-content')); }
  catch (e) { showToast(e.message || 'Error', 'error'); }
}

// ─── Pricing Rules ─────────────────────────────────
async function loadPricing(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando reglas de precio...</div>';
  const [servicios, pricing] = await Promise.all([
    api('/workshop/servicios').catch(() => []),
    api('/workshop/pricing-rules').catch(() => null)
  ]);
  const rules = pricing?.data || pricing || [];
  const svcList = Array.isArray(servicios) ? servicios : [];

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-400">Reglas de Precio por Vehículo</h3>
        <span class="text-xs text-gray-600">${Array.isArray(rules) ? rules.length : 0} reglas</span>
      </div>
      ${Array.isArray(rules) && rules.length
        ? `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Servicio</th>
              <th class="text-left px-4 py-3">Tipo Vehículo</th>
              <th class="text-left px-4 py-3">Combustible</th>
              <th class="text-right px-4 py-3">Intervalo KM</th>
              <th class="text-right px-4 py-3">Precio</th>
            </tr></thead>
            <tbody>${rules.map(r => `
              <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td class="px-4 py-2.5">${esc(r.servicioNombre || r.servicioId || '—')}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(r.tipoVehiculo || '—')}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(r.combustible || '—')}</td>
                <td class="px-4 py-2.5 text-right text-gray-400">${r.intervaloKm ? fmt(r.intervaloKm) + ' km' : '—'}</td>
                <td class="px-4 py-2.5 text-right text-green-400 font-medium">₲ ${fmt(r.precio)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`
        : '<div class="text-center py-8 text-gray-600 text-sm">Sin reglas de precio configuradas. Las reglas se generan automáticamente al configurar el catálogo de servicios con precios por tipo de vehículo.</div>'}
    </div>`;
}

// ─── Horas Hombre ──────────────────────────────────
async function loadHorasHombre(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando horas hombre...</div>';
  const horas = await api('/workshop/service-hours').catch(() => null);
  const list = horas?.data || horas || [];

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-400">Horas Hombre Estándar por Servicio</h3>
        <span class="text-xs text-gray-600">${Array.isArray(list) ? list.length : 0} registros</span>
      </div>
      ${Array.isArray(list) && list.length
        ? `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Servicio</th>
              <th class="text-left px-4 py-3">Tipo Vehículo</th>
              <th class="text-left px-4 py-3">Complejidad</th>
              <th class="text-right px-4 py-3">Horas Est.</th>
              <th class="text-right px-4 py-3">Flat Rate</th>
            </tr></thead>
            <tbody>${list.map(h => `
              <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td class="px-4 py-2.5 font-medium">${esc(h.servicioNombre || h.servicioId || '—')}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(h.tipoVehiculo || '—')}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(h.complejidad || '—')}</td>
                <td class="px-4 py-2.5 text-right text-blue-400 font-medium">${h.horasEstimadas || '—'}</td>
                <td class="px-4 py-2.5 text-right text-green-400">${h.flatRate ? 'Gs. ' + fmt(h.flatRate) : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`
        : '<div class="text-center py-8 text-gray-600 text-sm">Sin horas hombre configuradas. Estos registros se generan al definir el catálogo de servicios con estimaciones de tiempo por tipo de vehículo y complejidad.</div>'}
    </div>`;
}
