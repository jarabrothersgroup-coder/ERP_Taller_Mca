/* ─── Thinkcar Review ──────────────────── */
function renderThinkcar(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-400">Reportes de diagnóstico Thinkcar importados</p>
    </div>
    <div class="bg-gray-900/60 rounded-xl border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Fecha</th>
            <th class="text-left px-4 py-3">VIN</th>
            <th class="text-left px-4 py-3">Vehículo</th>
            <th class="text-left px-4 py-3">DTCs</th>
            <th class="text-left px-4 py-3">Estado</th>
            <th class="text-left px-4 py-3">Origen</th>
          </tr></thead>
          <tbody id="thinkcar-tbody"><tr><td colspan="6" class="text-center py-8 text-gray-600">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  fetchThinkcarImports();
}

async function fetchThinkcarImports() {
  const tbody = document.querySelector('#thinkcar-tbody');
  if (!tbody) return;
  try {
    const imports = await api('/thinkcar/imports');
    if (!imports || !imports.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-600">No hay reportes Thinkcar importados</td></tr>';
      return;
    }
    tbody.innerHTML = imports.map((imp) => {
      const estado = imp.status || imp.estado || 'PENDING';
      const badgeClass = estado === 'LINKED' ? 'bg-green-900/50 text-green-300'
        : estado === 'MANUAL_REVIEW' ? 'bg-red-900/50 text-red-300'
        : 'bg-yellow-900/50 text-yellow-300';
      return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
        <td class="px-4 py-3 text-xs text-gray-400">${imp.createdAt ? new Date(imp.createdAt).toLocaleDateString('es-PY') : '—'}</td>
        <td class="px-4 py-3 font-mono text-xs">${esc(imp.detectedVin || imp.vin || '—')}</td>
        <td class="px-4 py-3">${esc(imp.vehicleModel || imp.marca || '—')}</td>
        <td class="px-4 py-3">${imp.dtcCount != null ? '<span class="text-red-400 text-xs font-bold">' + imp.dtcCount + '</span>' : '—'}</td>
        <td class="px-4 py-3"><span class="status-badge ${badgeClass}">${estado}</span></td>
        <td class="px-4 py-3 text-xs text-gray-500">${esc(imp.importSource || imp.origen || '—')}</td>
      </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">🔬 Módulo Thinkcar — Conectando...</td></tr>';
  }
}
