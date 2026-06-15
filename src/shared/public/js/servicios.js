function renderServicios(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Catálogo de servicios del taller</p>
      <button id="add-servicio-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">+ Nuevo Servicio</button>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Categoría</th>
            <th class="text-left px-4 py-3">Precio Estimado</th>
            <th class="text-left px-4 py-3">Duración</th>
            <th class="text-left px-4 py-3">Estado</th>
            <th class="text-right px-4 py-3">Acción</th>
          </tr></thead>
          <tbody id="servicios-tbody"><tr><td colspan="6" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  fetchServicios();
  document.getElementById('add-servicio-btn')?.addEventListener('click', showServicioModal);
}

async function fetchServicios() {
  const tbody = document.getElementById('servicios-tbody');
  if (!tbody) return;
  try {
    const servicios = await api('/workshop/servicios');
    if (!servicios || !servicios.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-600">Sin servicios registrados</td></tr>';
      return;
    }
    tbody.innerHTML = servicios.map(s => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 font-medium">${esc(s.nombre)}</td>
        <td class="px-4 py-3 text-gray-400">${esc(s.categoria || '—')}</td>
        <td class="px-4 py-3 text-gray-400">${s.precioEstimado ? esc(s.precioEstimado) : '—'}</td>
        <td class="px-4 py-3 text-gray-400">${s.duracionEstimada ? esc(s.duracionEstimada) + ' min' : '—'}</td>
        <td class="px-4 py-3"><span class="status-badge ${s.activo ? 'bg-green-900/30 text-green-300' : 'bg-gray-700/50 text-gray-400'}">${s.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td class="px-4 py-3 text-right">
          <button class="edit-servicio-btn text-blue-400 hover:text-blue-300 text-xs mr-2" data-id="${esc(s.id)}">✏️</button>
          ${s.activo ? `<button class="del-servicio-btn text-red-400 hover:text-red-300 text-xs" data-id="${esc(s.id)}">🗑️</button>` : ''}
        </td>
      </tr>`).join('');
    // Bind edit/delete
    document.querySelectorAll('.edit-servicio-btn').forEach(b => b.addEventListener('click', () => showServicioModal(b.dataset.id)));
    document.querySelectorAll('.del-servicio-btn').forEach(b => b.addEventListener('click', async () => {
      if (confirm('¿Desactivar este servicio?')) {
        await api(`/workshop/servicios/${b.dataset.id}`, { method: 'DELETE' });
        fetchServicios();
      }
    }));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-400">Error: ${esc(e.message)}</td></tr>`;
  }
}

async function showServicioModal(editId) {
  let data = { nombre: '', descripcion: '', categoria: '', precioEstimado: '', duracionEstimada: '' };
  if (editId) {
    try { data = await api(`/workshop/servicios/${editId}`); } catch { return; }
  }
  dom.modalContent.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-lg font-bold">${editId ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
      <button id="modal-close" class="text-gray-500 hover:text-white text-xl">&times;</button>
    </div>
    <form id="servicio-form" class="space-y-4">
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Nombre *</label>
        <input id="sv-nombre" type="text" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${esc(data.nombre || '')}" required>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Categoría</label>
        <select id="sv-categoria" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">—</option>
          <option value="Mecánica" ${data.categoria === 'Mecánica' ? 'selected' : ''}>Mecánica</option>
          <option value="Eléctrica" ${data.categoria === 'Eléctrica' ? 'selected' : ''}>Eléctrica</option>
          <option value="Carrocería" ${data.categoria === 'Carrocería' ? 'selected' : ''}>Carrocería</option>
          <option value="Diagnóstico" ${data.categoria === 'Diagnóstico' ? 'selected' : ''}>Diagnóstico</option>
          <option value="Aire Acondicionado" ${data.categoria === 'Aire Acondicionado' ? 'selected' : ''}>Aire Acondicionado</option>
          <option value="Suspensión" ${data.categoria === 'Suspensión' ? 'selected' : ''}>Suspensión</option>
          <option value="Frenos" ${data.categoria === 'Frenos' ? 'selected' : ''}>Frenos</option>
          <option value="Transmisión" ${data.categoria === 'Transmisión' ? 'selected' : ''}>Transmisión</option>
          <option value="Motor" ${data.categoria === 'Motor' ? 'selected' : ''}>Motor</option>
          <option value="Otro" ${data.categoria === 'Otro' ? 'selected' : ''}>Otro</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Descripción</label>
        <textarea id="sv-descripcion" rows="2" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">${esc(data.descripcion || '')}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Precio Estimado (Gs.)</label>
          <input id="sv-precio" type="number" step="0.01" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${data.precioEstimado || ''}">
        </div>
        <div>
          <label class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Duración (minutos)</label>
          <input id="sv-duracion" type="number" class="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" value="${data.duracionEstimada || ''}">
        </div>
      </div>
      <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">${editId ? 'Guardar Cambios' : 'Crear Servicio'}</button>
    </form>`;
  dom.modalOverlay.classList.remove('hidden');
  document.getElementById('servicio-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      nombre: document.getElementById('sv-nombre').value.trim(),
      categoria: document.getElementById('sv-categoria').value,
      descripcion: document.getElementById('sv-descripcion').value.trim() || undefined,
      precioEstimado: parseFloat(document.getElementById('sv-precio').value) || undefined,
      duracionEstimada: parseInt(document.getElementById('sv-duracion').value) || undefined,
    };
    try {
      if (editId) {
        await api(`/workshop/servicios/${editId}`, { method: 'PATCH', body });
      } else {
        await api('/workshop/servicios', { method: 'POST', body });
      }
      dom.modalOverlay.classList.add('hidden');
      fetchServicios();
    } catch (e) { alert(e.message); }
  });
}

