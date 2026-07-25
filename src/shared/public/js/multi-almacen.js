/* ═══════════════════════════════════════════════════════════════════
   P2.6 — Multi-Almacén Frontend (Transferencias)
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

let _almTab = 'almacenes';

function renderMultiAlmacen(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Multi-Almacén</h2>
        <p class="text-sm text-gray-500">Gestión de almacenes y transferencias de stock</p>
      </div>
      <div class="flex gap-2">
        <button class="alm-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_almTab === 'almacenes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="almacenes">Almacenes</button>
        <button class="alm-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_almTab === 'transferir' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="transferir">Transferir Stock</button>
        <button class="alm-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_almTab === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="historial">Historial</button>
      </div>
    </div>
    <div id="alm-content" class="space-y-4"></div>`;

  const content = container.querySelector('#alm-content');
  container.querySelectorAll('.alm-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _almTab = btn.dataset.tab;
      container.querySelectorAll('.alm-tab').forEach(b => {
        b.className = `alm-tab px-3 py-1.5 rounded-lg text-xs font-medium ${b.dataset.tab === _almTab ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;
      });
      loadAlmTab(content);
    });
  });
  loadAlmTab(content);
}

function loadAlmTab(content) {
  if (_almTab === 'almacenes') loadAlmacenes(content);
  else if (_almTab === 'transferir') loadTransferir(content);
  else loadHistorial(content);
}

// ─── Almacenes CRUD ────────────────────────────────
async function loadAlmacenes(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando almacenes...</div>';
  const almacenes = await api('/inventory/almacenes').catch(() => null);
  const list = Array.isArray(almacenes) ? almacenes : [];

  content.innerHTML = `
    <div class="flex justify-between items-center mb-3">
      <span class="text-sm text-gray-500">${list.length} almacenes</span>
      <button onclick="almShowCreate()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nuevo Almacén</button>
    </div>
    <div id="alm-create-form" class="hidden bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4"></div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${list.map(a => `
        <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            </div>
            <div>
              <p class="font-semibold text-sm">${esc(a.nombre)}</p>
              <p class="text-xs text-gray-500">${esc(a.codigo || '—')}</p>
            </div>
          </div>
          <div class="space-y-1 text-xs text-gray-500">
            ${a.direccion ? `<p>📍 ${esc(a.direccion)}</p>` : ''}
            ${a.responsable ? `<p>👤 ${esc(a.responsable)}</p>` : ''}
            ${a.telefono ? `<p>📞 ${esc(a.telefono)}</p>` : ''}
          </div>
          <div class="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-800">
            <button onclick="almEdit('${a.id}')" class="text-blue-400 hover:text-blue-300 text-xs">Editar</button>
            <button onclick="almDelete('${a.id}')" class="text-red-400 hover:text-red-300 text-xs">Desactivar</button>
          </div>
        </div>`).join('')}
      ${list.length === 0 ? '<div class="col-span-full text-center py-8 text-gray-600 text-sm">Sin almacenes registrados. Creá el primero para gestionar stock por ubicación.</div>' : ''}
    </div>`;
}

function almShowCreate(data) {
  const form = document.getElementById('alm-create-form');
  if (!form) return;
  form.classList.remove('hidden');
  form.innerHTML = `
    <h4 class="text-sm font-semibold text-gray-400 mb-3">${data ? 'Editar' : 'Nuevo'} Almacén</h4>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="text-xs text-gray-500 block mb-1">Código *</label><input id="a-codigo" value="${esc(data?.codigo || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Nombre *</label><input id="a-nombre" value="${esc(data?.nombre || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Dirección</label><input id="a-direccion" value="${esc(data?.direccion || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Responsable</label><input id="a-responsable" value="${esc(data?.responsable || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Teléfono</label><input id="a-telefono" value="${esc(data?.telefono || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <button onclick="document.getElementById('alm-create-form').classList.add('hidden')" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancelar</button>
      <button onclick="almSave('${data?.id || ''}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Guardar</button>
    </div>`;
}

async function almSave(id) {
  const body = {
    codigo: document.getElementById('a-codigo')?.value?.trim(),
    nombre: document.getElementById('a-nombre')?.value?.trim(),
    direccion: document.getElementById('a-direccion')?.value?.trim() || undefined,
    responsable: document.getElementById('a-responsable')?.value?.trim() || undefined,
    telefono: document.getElementById('a-telefono')?.value?.trim() || undefined,
  };
  if (!body.codigo || !body.nombre) { showToast('Código y nombre son requeridos', 'error'); return; }
  try {
    if (id) await api(`/inventory/almacenes/${id}`, { method: 'PATCH', body });
    else await api('/inventory/almacenes', { method: 'POST', body });
    showToast('Almacén guardado');
    document.getElementById('alm-create-form')?.classList.add('hidden');
    loadAlmacenes(document.getElementById('alm-content'));
  } catch (e) { showToast(e.message || 'Error', 'error'); }
}

async function almEdit(id) {
  const data = await api(`/inventory/almacenes/${id}`).catch(() => null);
  if (data) almShowCreate(data);
}

async function almDelete(id) {
  if (!confirm('¿Desactivar este almacén?')) return;
  try { await api(`/inventory/almacenes/${id}`, { method: 'DELETE' }); showToast('Almacén desactivado'); loadAlmacenes(document.getElementById('alm-content')); }
  catch (e) { showToast(e.message || 'Error', 'error'); }
}

// ─── Transferir Stock ──────────────────────────────
async function loadTransferir(content) {
  const [almacenes, repuestos] = await Promise.all([
    api('/inventory/almacenes').catch(() => []),
    api('/inventory/repuestos').catch(() => null)
  ]);
  const almList = Array.isArray(almacenes) ? almacenes : [];
  const repList = repuestos?.data || repuestos || [];

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Transferir Stock entre Almacenes</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Repuesto *</label>
          <select id="t-repuesto" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Seleccionar repuesto...</option>
            ${Array.isArray(repList) ? repList.map(r => `<option value="${r.id}">${esc(r.nombre || r.descripcion || r.codigo || '—')}</option>`).join('') : ''}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Cantidad *</label>
          <input id="t-cantidad" type="number" min="1" placeholder="0" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Almacén Origen</label>
          <select id="t-origen" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Entrada directa (sin origen)</option>
            ${almList.map(a => `<option value="${a.id}">${esc(a.nombre)} (${esc(a.codigo || '')})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Almacén Destino *</label>
          <select id="t-destino" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Seleccionar destino...</option>
            ${almList.map(a => `<option value="${a.id}">${esc(a.nombre)} (${esc(a.codigo || '')})</option>`).join('')}
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="text-xs text-gray-500 block mb-1">Motivo</label>
          <input id="t-motivo" placeholder="Ej: Reposición, Uso en OT, Ajuste de inventario" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600">
        </div>
      </div>
      <div class="mt-4">
        <button onclick="doTransfer()" class="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 rounded-lg text-sm font-semibold transition-all">Transferir Stock</button>
      </div>
      <div id="t-result" class="mt-3 hidden"></div>
    </div>`;
}

async function doTransfer() {
  const body = {
    repuestoId: document.getElementById('t-repuesto')?.value,
    cantidad: parseInt(document.getElementById('t-cantidad')?.value) || 0,
    almacenOrigenId: document.getElementById('t-origen')?.value || undefined,
    almacenDestinoId: document.getElementById('t-destino')?.value,
    motivo: document.getElementById('t-motivo')?.value?.trim() || undefined,
  };
  if (!body.repuestoId || !body.cantidad || !body.almacenDestinoId) {
    showToast('Completá repuesto, cantidad y destino', 'error'); return;
  }
  try {
    const result = await api('/inventory/almacenes/transferir', { method: 'POST', body });
    const el = document.getElementById('t-result');
    el.classList.remove('hidden');
    el.innerHTML = `<div class="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400">✓ Transferencia completada: ${body.cantidad} unidades</div>`;
    showToast('Stock transferido exitosamente');
  } catch (e) {
    const el = document.getElementById('t-result');
    el.classList.remove('hidden');
    el.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">${esc(e.message || 'Error en la transferencia')}</div>`;
  }
}

// ─── Historial de Transferencias ────────────────────
async function loadHistorial(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando historial...</div>';
  const data = await api('/inventory/stock-movements?tipo=transferencia').catch(() => null);
  const movimientos = data?.data || data || [];

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-semibold text-gray-400">Historial de Transferencias</h3>
      </div>
      ${Array.isArray(movimientos) && movimientos.length
        ? `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Fecha</th>
              <th class="text-left px-4 py-3">Repuesto</th>
              <th class="text-right px-4 py-3">Cantidad</th>
              <th class="text-left px-4 py-3">Origen</th>
              <th class="text-left px-4 py-3">Destino</th>
              <th class="text-left px-4 py-3">Motivo</th>
            </tr></thead>
            <tbody>${movimientos.map(m => `
              <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td class="px-4 py-2.5 text-xs text-gray-400">${m.fecha ? new Date(m.fecha).toLocaleDateString('es-PY') : '—'}</td>
                <td class="px-4 py-2.5 font-medium">${esc(m.repuestoNombre || m.descripcion || '—')}</td>
                <td class="px-4 py-2.5 text-right font-semibold ${m.tipo === 'ENTRADA' ? 'text-green-400' : 'text-red-400'}">${m.tipo === 'ENTRADA' ? '+' : '-'}${m.cantidad}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(m.almacenOrigen || '—')}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(m.almacenDestino || '—')}</td>
                <td class="px-4 py-2.5 text-xs text-gray-500">${esc(m.motivo || '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`
        : '<div class="text-center py-8 text-gray-600 text-sm">Sin transferencias registradas</div>'}
    </div>`;
}
