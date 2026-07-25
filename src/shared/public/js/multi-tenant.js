/* ═══════════════════════════════════════════════════════════════════
   P3.7 — Consolidación Multi-Tenant Frontend
   ═══════════════════════════════════════════════════════════════════ */

/* global api, esc, fmt, showToast */

function renderMultiTenant(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-white mb-1">Consolidación Multi-Tenant</h2>
      <p class="text-sm text-gray-500">KPIs consolidados para propietarios de múltiples talleres</p>
    </div>

    <!-- Global KPIs -->
    <div id="mt-kpis" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-7 bg-gray-800 rounded w-16"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-7 bg-gray-800 rounded w-16"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-7 bg-gray-800 rounded w-16"></div></div>
      <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow animate-pulse"><div class="h-7 bg-gray-800 rounded w-16"></div></div>
    </div>

    <!-- Branch Comparison -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow mb-6">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Comparación por Sucursal</h3>
      <div id="mt-branches" class="text-center py-8 text-gray-600 text-sm">Cargando...</div>
    </div>

    <!-- Branch Detail -->
    <div class="bg-gray-900/60 rounded-xl p-5 border border-gray-800 card-glow">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Detalle por Sucursal</h3>
      <div class="flex gap-3 mb-4">
        <select id="mt-branch-select" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Seleccionar sucursal...</option>
        </select>
        <button onclick="loadBranchDetail()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">Ver Detalle</button>
      </div>
      <div id="mt-branch-detail" class="text-center py-4 text-gray-600 text-sm">Seleccioná una sucursal</div>
    </div>`;

  loadConsolidatedKPIs();
  loadBranches();
}

async function loadConsolidatedKPIs() {
  const el = document.getElementById('mt-kpis');
  const data = await api('/config/dashboard/consolidated').catch(() => null);
  if (!data) { el.innerHTML = '<div class="col-span-4 text-center py-8 text-gray-600 text-sm">Error al cargar KPIs consolidados</div>'; return; }

  const kpis = [
    { label: 'Sucursales', value: data.totalSucursales || 0, icon: '🏢', color: 'text-blue-400' },
    { label: 'OTs Activas', value: data.totalOTActivas || 0, icon: '📋', color: 'text-orange-400' },
    { label: 'OTs Completadas Mes', value: data.totalOTCompletadasMes || 0, icon: '✅', color: 'text-green-400' },
    { label: 'Ingresos del Mes', value: `₲ ${fmt(data.totalIngresoMes || 0)}`, icon: '💰', color: 'text-green-400' },
  ];

  el.innerHTML = kpis.map(k => `
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-800 card-glow">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-lg">${k.icon}</span>
        <p class="text-gray-500 text-xs uppercase tracking-wider">${k.label}</p>
      </div>
      <p class="text-2xl font-bold ${k.color}">${k.value}</p>
    </div>`).join('');
}

async function loadBranches() {
  const data = await api('/config/dashboard/consolidated').catch(() => null);
  const branches = data?.sucursales || [];
  const el = document.getElementById('mt-branches');
  const select = document.getElementById('mt-branch-select');

  if (!Array.isArray(branches) || !branches.length) {
    el.innerHTML = '<div class="text-gray-600 text-sm">No hay sucursales registradas. Este módulo es para propietarios multi-taller.</div>';
    return;
  }

  // Populate select
  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id || b.sucursalId || '';
    opt.textContent = `${b.nombre || b.sucursalNombre || 'Sucursal'} — ${b.codigo || ''}`;
    select.appendChild(opt);
  });

  // Render comparison cards
  el.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${branches.map(b => {
        const eficiencia = b.eficiencia || b.eficienciaMecanicos || 0;
        return `<div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-blue-500/30 transition">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="font-semibold text-sm">${esc(b.nombre || b.sucursalNombre || 'Sucursal')}</p>
              <p class="text-xs text-gray-500">${esc(b.codigo || '')}</p>
            </div>
            <span class="text-lg font-bold ${eficiencia >= 80 ? 'text-green-400' : 'text-yellow-400'}">${eficiencia}%</span>
          </div>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-gray-500">OTs Activas</span><span class="font-medium">${b.otsActivas || b.otActivas || 0}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">OTs Mes</span><span class="font-medium">${b.otsCompletadasMes || b.otCompletadasMes || 0}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Ingresos</span><span class="font-medium text-green-400">₲ ${fmt(b.ingresoMes || b.ingresosMes || 0)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Mecánicos</span><span class="font-medium">${b.mecanicosActivos || b.totalMecanicos || 0}</span></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function loadBranchDetail() {
  const sucursalId = document.getElementById('mt-branch-select')?.value;
  if (!sucursalId) { showToast('Seleccioná una sucursal', 'error'); return; }
  const el = document.getElementById('mt-branch-detail');
  el.innerHTML = '<div class="text-blue-400 text-sm">Cargando...</div>';

  try {
    const data = await api(`/config/dashboard/role?sucursalId=${sucursalId}`);
    el.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
          <p class="text-xl font-bold text-blue-400">${data.myActiveOTs || data.otsActivas || 0}</p>
          <p class="text-xs text-gray-500">OTs Activas</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
          <p class="text-xl font-bold text-green-400">₲ ${fmt(data.ingresosMes || data.totalIngresoMes || 0)}</p>
          <p class="text-xs text-gray-500">Ingresos</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
          <p class="text-xl font-bold text-purple-400">${data.eficiencia || data.eficienciaMecanicos || 0}%</p>
          <p class="text-xs text-gray-500">Eficiencia</p>
        </div>
        <div class="bg-gray-800/50 rounded-lg p-3 text-center">
          <p class="text-xl font-bold text-cyan-400">${data.clientesMes || 0}</p>
          <p class="text-xs text-gray-500">Clientes Atendidos</p>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="text-red-400 text-sm">${esc(e.message || 'Error al cargar detalle')}</div>`;
  }
}
