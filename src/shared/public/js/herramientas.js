/* ═══════════════════════════════════════════════════════════════════
   P2.2 — Herramientas: Préstamos, Mantenimiento, Depreciación
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

let _herrTab = 'catalogo';

function renderHerramientas(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Herramientas</h2>
        <p class="text-sm text-gray-500">Catálogo, instancias, préstamos y mantenimiento</p>
      </div>
      <div class="flex gap-2">
        <button class="herr-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_herrTab === 'catalogo' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="catalogo">Catálogo</button>
        <button class="herr-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_herrTab === 'instancias' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="instancias">Instancias</button>
        <button class="herr-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_herrTab === 'prestamos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="prestamos">Préstamos</button>
        <button class="herr-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_herrTab === 'mantenimiento' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="mantenimiento">Mantenimiento</button>
        <button class="herr-tab px-3 py-1.5 rounded-lg text-xs font-medium ${_herrTab === 'depreciacion' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}" data-tab="depreciacion">Depreciación</button>
      </div>
    </div>
    <div id="herr-content" class="space-y-4"></div>`;

  const content = container.querySelector('#herr-content');
  container.querySelectorAll('.herr-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _herrTab = btn.dataset.tab;
      container.querySelectorAll('.herr-tab').forEach(b => {
        b.className = `herr-tab px-3 py-1.5 rounded-lg text-xs font-medium ${b.dataset.tab === _herrTab ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;
      });
      loadHerrTab(content);
    });
  });
  loadHerrTab(content);
}

function loadHerrTab(content) {
  if (_herrTab === 'catalogo') loadHerrCatalogo(content);
  else if (_herrTab === 'instancias') loadHerrInstancias(content);
  else if (_herrTab === 'prestamos') loadHerrPrestamos(content);
  else if (_herrTab === 'mantenimiento') loadHerrMantenimiento(content);
  else loadHerrDepreciacion(content);
}

// ─── Catálogo de Herramientas ──────────────────────
async function loadHerrCatalogo(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando...</div>';
  const data = await api('/inventory/herramientas').catch(() => null);
  const herramientas = data?.data || data || [];
  if (!Array.isArray(herramientas)) { content.innerHTML = '<div class="text-center py-8 text-gray-600">Sin datos</div>'; return; }

  content.innerHTML = `
    <div class="flex justify-between items-center mb-3">
      <span class="text-sm text-gray-500">${herramientas.length} herramientas</span>
      <button onclick="herrShowCreate()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nueva Herramienta</button>
    </div>
    <div id="herr-create-form" class="hidden bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4"></div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Código</th>
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Categoría</th>
            <th class="text-right px-4 py-3">Costo Unitario</th>
            <th class="text-center px-4 py-3">Unidades</th>
            <th class="text-right px-4 py-3">Acciones</th>
          </tr></thead>
          <tbody>${herramientas.map(h => `
            <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
              <td class="px-4 py-2.5 font-mono text-xs text-gray-400">${esc(h.codigo || '—')}</td>
              <td class="px-4 py-2.5 font-medium">${esc(h.nombre)}</td>
              <td class="px-4 py-2.5 text-gray-400">${esc(h.categoria || '—')}</td>
              <td class="px-4 py-2.5 text-right text-green-400">${h.costoUnitario ? '₲ ' + fmt(h.costoUnitario) : '—'}</td>
              <td class="px-4 py-2.5 text-center">${h.unidades || '—'}</td>
              <td class="px-4 py-2.5 text-right"><button onclick="herrEdit('${h.id}')" class="text-blue-400 hover:text-blue-300 text-xs">Editar</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function herrShowCreate(data) {
  const form = document.getElementById('herr-create-form');
  if (!form) return;
  form.classList.remove('hidden');
  form.innerHTML = `
    <h4 class="text-sm font-semibold text-gray-400 mb-3">${data ? 'Editar' : 'Nueva'} Herramienta</h4>
    <div class="grid grid-cols-3 gap-3">
      <div><label class="text-xs text-gray-500 block mb-1">Código *</label><input id="h-codigo" value="${esc(data?.codigo || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Nombre *</label><input id="h-nombre" value="${esc(data?.nombre || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Categoría</label><input id="h-categoria" value="${esc(data?.categoria || '')}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Costo Unitario (₲)</label><input id="h-costo" type="number" value="${data?.costoUnitario || ''}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Vida Útil (años)</label><input id="h-vida" type="number" value="${data?.vidaUtilAnos || ''}" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"></div>
      <div><label class="text-xs text-gray-500 block mb-1">Calibración Requerida</label>
        <select id="h-calibracion" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="false" ${!data?.calibracionRequerida ? 'selected' : ''}>No</option>
          <option value="true" ${data?.calibracionRequerida ? 'selected' : ''}>Sí</option>
        </select>
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <button onclick="document.getElementById('herr-create-form').classList.add('hidden')" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancelar</button>
      <button onclick="herrSave('${data?.id || ''}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Guardar</button>
    </div>`;
}

async function herrSave(id) {
  const body = {
    codigo: document.getElementById('h-codigo')?.value?.trim(),
    nombre: document.getElementById('h-nombre')?.value?.trim(),
    categoria: document.getElementById('h-categoria')?.value?.trim() || undefined,
    costoUnitario: parseFloat(document.getElementById('h-costo')?.value) || undefined,
    vidaUtilAnos: parseInt(document.getElementById('h-vida')?.value) || undefined,
    calibracionRequerida: document.getElementById('h-calibracion')?.value === 'true',
  };
  if (!body.codigo || !body.nombre) { showToast('Código y nombre son requeridos', 'error'); return; }
  try {
    if (id) await api(`/inventory/herramientas/${id}`, { method: 'PATCH', body });
    else await api('/inventory/herramientas', { method: 'POST', body });
    showToast('Herramienta guardada');
    document.getElementById('herr-create-form')?.classList.add('hidden');
    loadHerrCatalogo(document.getElementById('herr-content'));
  } catch (e) { showToast(e.message || 'Error', 'error'); }
}

async function herrEdit(id) {
  const data = await api(`/inventory/herramientas/${id}`).catch(() => null);
  if (data) herrShowCreate(data);
}

// ─── Instancias (activos físicos) ──────────────────
async function loadHerrInstancias(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando instancias...</div>';
  const [instancias, disponibles, calDue] = await Promise.all([
    api('/inventory/tool-instances').catch(() => null),
    api('/inventory/tool-instances/disponibles').catch(() => null),
    api('/inventory/tool-instances/due-for-calibration').catch(() => null)
  ]);
  const items = instancias?.data || instancias || [];
  const disp = disponibles?.data || disponibles || [];
  const cal = calDue?.data || calDue || [];

  const statsHtml = `
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Total Instancias</p>
        <p class="text-2xl font-bold text-blue-400 mt-1">${Array.isArray(items) ? items.length : 0}</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Disponibles</p>
        <p class="text-2xl font-bold text-green-400 mt-1">${Array.isArray(disp) ? disp.length : 0}</p>
      </div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
        <p class="text-gray-500 text-xs uppercase tracking-wider">Calibración Pendiente</p>
        <p class="text-2xl font-bold text-yellow-400 mt-1">${Array.isArray(cal) ? cal.length : 0}</p>
      </div>
    </div>`;

  content.innerHTML = statsHtml + `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">N° Serie</th>
            <th class="text-left px-4 py-3">Herramienta</th>
            <th class="text-center px-4 py-3">Estado</th>
            <th class="text-left px-4 py-3">Técnico Asignado</th>
            <th class="text-right px-4 py-3">Valor Neto</th>
            <th class="text-right px-4 py-3">Próx. Calibración</th>
          </tr></thead>
          <tbody>${Array.isArray(items) ? items.map(i => {
            const estadoColors = { DISPONIBLE: 'text-green-400 bg-green-500/20', EN_USO: 'text-blue-400 bg-blue-500/20', EN_CALIBRACION: 'text-yellow-400 bg-yellow-500/20', EN_REPARACION: 'text-orange-400 bg-orange-500/20', BAJA: 'text-red-400 bg-red-500/20' };
            const color = estadoColors[i.estadoActual] || 'text-gray-400 bg-gray-500/20';
            return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td class="px-4 py-2.5 font-mono text-xs">${esc(i.numeroSerie || '—')}</td>
              <td class="px-4 py-2.5">${esc(i.herramientaNombre || i.herramientaId || '—')}</td>
              <td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${color}">${(i.estadoActual || '—').replace(/_/g, ' ')}</span></td>
              <td class="px-4 py-2.5 text-gray-400">${esc(i.tecnicoActualNombre || '—')}</td>
              <td class="px-4 py-2.5 text-right text-green-400">${i.valorNetoActual ? '₲ ' + fmt(i.valorNetoActual) : '—'}</td>
              <td class="px-4 py-2.5 text-right text-gray-400 text-xs">${i.proximaCalibracion ? new Date(i.proximaCalibracion).toLocaleDateString('es-PY') : '—'}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="6" class="text-center py-8 text-gray-600">Sin instancias</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── Préstamos Activos ─────────────────────────────
async function loadHerrPrestamos(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando préstamos...</div>';
  const data = await api('/inventory/tool-loans').catch(() => null);
  const prestamos = data?.data || data || [];

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-semibold text-gray-400">Préstamos de Herramientas</h3>
      </div>
      ${Array.isArray(prestamos) && prestamos.length
        ? `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Herramienta</th>
              <th class="text-left px-4 py-3">Técnico</th>
              <th class="text-left px-4 py-3">OT Asociada</th>
              <th class="text-left px-4 py-3">Fecha Préstamo</th>
              <th class="text-left px-4 py-3">Devolución</th>
              <th class="text-right px-4 py-3">Acciones</th>
            </tr></thead>
            <tbody>${prestamos.map(p => `
              <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td class="px-4 py-2.5 font-medium">${esc(p.herramientaNombre || '—')}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(p.tecnicoNombre || '—')}</td>
                <td class="px-4 py-2.5 text-gray-400">${esc(p.ordenTrabajoId || '—')}</td>
                <td class="px-4 py-2.5 text-xs text-gray-400">${p.fechaPrestamo ? new Date(p.fechaPrestamo).toLocaleDateString('es-PY') : '—'}</td>
                <td class="px-4 py-2.5 text-xs">${p.fechaDevolucion ? new Date(p.fechaDevolucion).toLocaleDateString('es-PY') : '<span class="text-yellow-400">Pendiente</span>'}</td>
                <td class="px-4 py-2.5 text-right">${!p.fechaDevolucion ? `<button onclick="herrDevolver('${p.id}')" class="text-green-400 hover:text-green-300 text-xs">Devolver</button>` : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`
        : '<div class="text-center py-8 text-gray-600 text-sm">Sin préstamos activos</div>'}
    </div>`;
}

async function herrDevolver(loanId) {
  try {
    await api(`/inventory/tool-loans/${loanId}/return`, { method: 'POST' });
    showToast('Herramienta devuelta');
    loadHerrPrestamos(document.getElementById('herr-content'));
  } catch (e) { showToast(e.message || 'Error al devolver', 'error'); }
}

// ─── Mantenimiento ─────────────────────────────────
async function loadHerrMantenimiento(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando eventos de mantenimiento...</div>';
  const data = await api('/inventory/tool-service-events').catch(() => null);
  const eventos = data?.data || data || [];

  const tipoColors = { CALIBRACION: 'bg-yellow-500/20 text-yellow-400', REPARACION: 'bg-orange-500/20 text-orange-400', MANTENIMIENTO_PREVENTIVO: 'bg-blue-500/20 text-blue-400', INSPECCION: 'bg-cyan-500/20 text-cyan-400' };

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-semibold text-gray-400">Eventos de Mantenimiento y Calibración</h3>
      </div>
      ${Array.isArray(eventos) && eventos.length
        ? `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Herramienta</th>
              <th class="text-center px-4 py-3">Tipo</th>
              <th class="text-center px-4 py-3">Estado</th>
              <th class="text-left px-4 py-3">Inicio</th>
              <th class="text-left px-4 py-3">Fin</th>
              <th class="text-right px-4 py-3">Costo</th>
            </tr></thead>
            <tbody>${eventos.map(e => `
              <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td class="px-4 py-2.5 font-medium">${esc(e.herramientaNombre || '—')}</td>
                <td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs ${tipoColors[e.tipo] || 'bg-gray-500/20 text-gray-400'}">${(e.tipo || '—').replace(/_/g, ' ')}</span></td>
                <td class="px-4 py-2.5 text-center"><span class="text-xs ${e.estado === 'COMPLETADO' ? 'text-green-400' : 'text-yellow-400'}">${e.estado || '—'}</span></td>
                <td class="px-4 py-2.5 text-xs text-gray-400">${e.fechaInicio ? new Date(e.fechaInicio).toLocaleDateString('es-PY') : '—'}</td>
                <td class="px-4 py-2.5 text-xs text-gray-400">${e.fechaFin ? new Date(e.fechaFin).toLocaleDateString('es-PY') : '—'}</td>
                <td class="px-4 py-2.5 text-right text-green-400">${e.costo ? '₲ ' + fmt(e.costo) : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`
        : '<div class="text-center py-8 text-gray-600 text-sm">Sin eventos de mantenimiento registrados</div>'}
    </div>`;
}

// ─── Depreciación ──────────────────────────────────
async function loadHerrDepreciacion(content) {
  content.innerHTML = '<div class="text-center py-8 text-gray-600">Cargando datos de depreciación...</div>';
  const data = await api('/inventory/tool-instances').catch(() => null);
  const items = data?.data || data || [];

  const activos = Array.isArray(items) ? items.filter(i => i.estadoActual !== 'BAJA') : [];

  content.innerHTML = `
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-800">
        <h3 class="text-sm font-semibold text-gray-400">Control de Depreciación de Herramientas</h3>
      </div>
      ${activos.length
        ? `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th class="text-left px-4 py-3">Herramienta</th>
              <th class="text-left px-4 py-3">N° Serie</th>
              <th class="text-right px-4 py-3">Costo Adquisición</th>
              <th class="text-right px-4 py-3">Valor Neto Actual</th>
              <th class="text-right px-4 py-3">Depreciación</th>
              <th class="text-right px-4 py-3">Acciones</th>
            </tr></thead>
            <tbody>${activos.map(i => {
              const costo = i.costoAdquisicion || 0;
              const neto = i.valorNetoActual || 0;
              const dep = costo > 0 ? Math.round(((costo - neto) / costo) * 100) : 0;
              return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td class="px-4 py-2.5 font-medium">${esc(i.herramientaNombre || '—')}</td>
                <td class="px-4 py-2.5 font-mono text-xs text-gray-400">${esc(i.numeroSerie || '—')}</td>
                <td class="px-4 py-2.5 text-right">₲ ${fmt(costo)}</td>
                <td class="px-4 py-2.5 text-right text-green-400">₲ ${fmt(neto)}</td>
                <td class="px-4 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-16 bg-gray-800 rounded-full h-2"><div class="bg-yellow-500 rounded-full h-2" style="width:${dep}%"></div></div>
                    <span class="text-xs text-gray-500">${dep}%</span>
                  </div>
                </td>
                <td class="px-4 py-2.5 text-right"><button onclick="herrCalcDep('${i.id}')" class="text-blue-400 hover:text-blue-300 text-xs">Calcular</button></td>
              </tr>`;
            }).join('')}
            </tbody>
          </table></div>`
        : '<div class="text-center py-8 text-gray-600 text-sm">Sin herramientas activas para depreciación</div>'}
    </div>`;
}

async function herrCalcDep(instanceId) {
  try {
    const result = await api('/inventory/tools/depreciation/calculate', { method: 'POST', body: { toolInstanceId: instanceId } });
    showToast(`Depreciación calculada: ₲ ${fmt(result?.depreciacionMensual || 0)}/mes`);
  } catch (e) { showToast(e.message || 'Error al calcular', 'error'); }
}
